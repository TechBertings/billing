import React, { useState, useEffect } from 'react';
import { FaTimes, FaSave, FaArrowLeft, FaSync } from 'react-icons/fa';
import { rolePermissionAPI } from '../lib/supabaseClient';
import Swal from 'sweetalert2';

// Import menu items from Sidebar
import { getAllMenuItems } from '../Components/Sidebar';

// ============================================================================
// UTILITY FUNCTIONS (kept for backwards compatibility)
// ============================================================================

let permissionsCache = {};
let cacheLoaded = false;

export async function loadPermissionsForRole(roleName) {
  try {
    const { data, error } = await rolePermissionAPI.getPermissionsForUser(roleName);
    if (error || !data) return;

    const permObj = {};
    data.forEach((perm) => {
      permObj[perm.module_path] = {
        canView:   perm.can_view,
        canCreate: perm.can_create,
        canEdit:   perm.can_edit,
        canDelete: perm.can_delete,
      };
    });

    permissionsCache[roleName] = permObj;
    cacheLoaded = true;
  } catch (err) {
    console.error('Failed to load permissions for role:', roleName, err);
  }
}

export function clearPermissionsCache() {
  permissionsCache = {};
  cacheLoaded = false;
}

const ALWAYS_ALLOWED = ['login', 'dashboard'];

export function canAccessPage(roleName, pagePath) {
  if (!roleName || !pagePath) return false;
  if (roleName === 'Admin') return true;
  if (ALWAYS_ALLOWED.includes(pagePath)) return true;
  if (!cacheLoaded || !permissionsCache[roleName]) return false;

  const rolePerms = permissionsCache[roleName];

  if (rolePerms[pagePath] !== undefined) {
    return rolePerms[pagePath].canView === true;
  }

  const hasAnySubAccess = Object.keys(rolePerms).some(
    (key) => key.startsWith(pagePath + '-') || key.startsWith(pagePath.toLowerCase() + '-')
  );

  return hasAnySubAccess;
}

export function filterMenuByRole(menuItems, roleName) {
  if (!roleName) return [];
  if (roleName === 'Admin') return menuItems;

  return menuItems
    .filter((item) => {
      if (item.path === 'login') return true;
      if (!canAccessPage(roleName, item.path)) return false;
      if (item.submenu) {
        const accessibleSubmenus = item.submenu.filter((sub) =>
          canAccessPage(roleName, sub.path)
        );
        return accessibleSubmenus.length > 0;
      }
      return true;
    })
    .map((item) => {
      if (item.submenu) {
        return {
          ...item,
          submenu: item.submenu.filter((sub) => canAccessPage(roleName, sub.path)),
        };
      }
      return item;
    });
}

// ============================================================================
// HELPER: Extract all pages from menu structure
// ============================================================================
function extractAllPagesFromMenu(menuItems) {
  const pages = [];

  menuItems.forEach(item => {
    if (item.path && item.path !== 'login') {
      pages.push({
        path: item.path,
        label: item.label,
        isSubmenu: false,
        parent: null
      });
    }

    if (item.submenu) {
      item.submenu.forEach(subitem => {
        pages.push({
          path: subitem.path,
          label: subitem.label,
          isSubmenu: true,
          parent: item.label
        });
      });
    }
  });

  return pages;
}

// ============================================================================
// ✅ AUTO-SYNC: Insert missing Sidebar pages into role_permissions for ALL roles
// This runs every time RolePermissions loads — ensures new Sidebar items
// are automatically added to the DB so they show up in permission management.
// ============================================================================
async function syncSidebarPagesToDB(roleName, allPages) {
  try {
    // 1. Get all existing permissions for this role
    const { data: existing, error } = await rolePermissionAPI.getPermissionsForUser(roleName);
    if (error) return;

    const existingPaths = new Set((existing || []).map(p => p.module_path));

    // 2. Find pages in Sidebar that are NOT yet in DB
    const missing = allPages.filter(p => !existingPaths.has(p.path));

    if (missing.length === 0) return; // Nothing to sync

    // 3. Insert missing pages with all permissions OFF by default
    for (const page of missing) {
      await rolePermissionAPI.create({
        role_name:   roleName,
        module_path: page.path,
        can_view:    false,
        can_create:  false,
        can_edit:    false,
        can_delete:  false,
      });
    }

    console.log(`[RolePermissions] Auto-synced ${missing.length} new page(s) for role "${roleName}":`,
      missing.map(p => p.path));
  } catch (err) {
    console.error('[RolePermissions] Sync error:', err);
  }
}

// ============================================================================
// REACT COMPONENT (default export)
// ============================================================================

const RolePermissions = ({ selectedRole, onClose }) => {
  const [permissions, setPermissions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [availablePages, setAvailablePages] = useState([]);
  const [newPagesCount, setNewPagesCount] = useState(0);

  useEffect(() => {
    if (selectedRole && selectedRole.role_name) {
      const menuItems = getAllMenuItems();
      const pages = extractAllPagesFromMenu(menuItems);
      setAvailablePages(pages);
      initWithSync(pages);
    }
  }, [selectedRole]);

  // ── Run sync THEN load permissions ──
  const initWithSync = async (pages) => {
    if (!selectedRole?.role_name) return;
    setIsLoading(true);
    setIsSyncing(true);

    // Check how many new pages will be added before sync
    try {
      const { data: existing } = await rolePermissionAPI.getPermissionsForUser(selectedRole.role_name);
      const existingPaths = new Set((existing || []).map(p => p.module_path));
      const missing = pages.filter(p => !existingPaths.has(p.path));
      setNewPagesCount(missing.length);

      // Auto-sync missing pages
      await syncSidebarPagesToDB(selectedRole.role_name, pages);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSyncing(false);
    }

    // Now load full permissions (all pages should exist in DB now)
    await loadPermissions(pages);
  };

  const loadPermissions = async (pages) => {
    if (!selectedRole || !selectedRole.role_name) return;

    setIsLoading(true);
    try {
      const { data, error } = await rolePermissionAPI.getPermissionsForUser(selectedRole.role_name);

      if (error) {
        console.error('Error loading permissions:', error);
        Swal.fire('Error', 'Failed to load permissions', 'error');
        return;
      }

      if (data && data.length > 0) {
        const menuItems = getAllMenuItems();
        const pagesMap = {};

        const addToMap = (item, parent = null) => {
          if (item.path && item.path !== 'login') {
            pagesMap[item.path] = {
              label: item.label,
              isSubmenu: !!parent,
              parent: parent
            };
          }
          if (item.submenu) {
            item.submenu.forEach(sub => addToMap(sub, item.label));
          }
        };

        menuItems.forEach(item => addToMap(item));

        // ── Sort: parent menus first, then their submenus ──
        const sorted = [...data].sort((a, b) => {
          const aInfo = pagesMap[a.module_path];
          const bInfo = pagesMap[b.module_path];
          const aParent = aInfo?.isSubmenu ? aInfo.parent : a.module_path;
          const bParent = bInfo?.isSubmenu ? bInfo.parent : b.module_path;
          if (aParent !== bParent) return aParent?.localeCompare(bParent);
          if (!aInfo?.isSubmenu && bInfo?.isSubmenu) return -1;
          if (aInfo?.isSubmenu && !bInfo?.isSubmenu) return 1;
          return 0;
        });

        const enrichedPerms = sorted.map(perm => ({
          ...perm,
          label:     pagesMap[perm.module_path]?.label    || perm.module_path,
          isSubmenu: pagesMap[perm.module_path]?.isSubmenu || false,
          parent:    pagesMap[perm.module_path]?.parent    || null
        }));

        setPermissions(enrichedPerms);
      } else {
        // Fallback (should rarely happen after sync)
        const initializedPerms = pages.map(page => ({
          module_path: page.path,
          role_name:   selectedRole.role_name,
          can_view:    false,
          can_create:  false,
          can_edit:    false,
          can_delete:  false,
          label:       page.label,
          isSubmenu:   page.isSubmenu,
          parent:      page.parent
        }));
        setPermissions(initializedPerms);
      }
    } catch (err) {
      console.error('Error:', err);
      Swal.fire('Error', 'An error occurred while loading permissions', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePermissionChange = (index, field, value) => {
    const updated = [...permissions];
    updated[index] = { ...updated[index], [field]: value };

    if (value && field !== 'can_view') {
      updated[index].can_view = true;
    }
    if (!value && field === 'can_view') {
      updated[index].can_create = false;
      updated[index].can_edit   = false;
      updated[index].can_delete = false;
    }

    setPermissions(updated);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      for (const perm of permissions) {
        const payload = {
          role_name:   selectedRole.role_name,
          module_path: perm.module_path,
          can_view:    perm.can_view,
          can_create:  perm.can_create,
          can_edit:    perm.can_edit,
          can_delete:  perm.can_delete,
        };

        let result;
        if (perm.id) {
          result = await rolePermissionAPI.update(perm.id, payload);
        } else {
          result = await rolePermissionAPI.create(payload);
        }

        if (result?.error) throw new Error(result.error);
      }

      clearPermissionsCache();

      Swal.fire({
        icon: 'success',
        title: 'Success!',
        text: 'Permissions updated successfully!',
        timer: 2000,
        showConfirmButton: false
      });

      await loadPermissions(availablePages);
    } catch (err) {
      console.error('Error saving permissions:', err);
      Swal.fire('Error', 'Failed to save permissions: ' + err.message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  if (!selectedRole || !selectedRole.role_name) {
    return (
      <div className="px-6 mx-auto max-w-7xl">
        <div className="p-8 text-center border border-red-200 rounded-lg bg-red-50">
          <h2 className="mb-2 text-2xl font-bold text-red-600">No Role Selected</h2>
          <p className="mb-4 text-red-700">Please select a role to manage permissions.</p>
          <button onClick={onClose}
            className="flex items-center gap-2 px-6 py-2.5 text-white bg-red-600 rounded-lg hover:bg-red-700 font-semibold">
            <FaArrowLeft /> Back to Roles
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="px-6 mx-auto max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-3xl font-bold text-blue-600">Role Permissions</h2>
          <p className="mt-1 text-gray-600">
            Managing permissions for:{' '}
            <span className="font-semibold text-purple-600">{selectedRole.role_name}</span>
          </p>
        </div>
        <button onClick={onClose}
          className="flex items-center gap-2 px-4 py-2.5 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 font-semibold">
          <FaArrowLeft /> Back to Roles
        </button>
      </div>

      {/* ── Auto-sync banner ── shows when new pages were detected ── */}
      {newPagesCount > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 mb-4 text-sm text-blue-700 border border-blue-200 rounded-lg bg-blue-50">
          <FaSync className="flex-shrink-0 text-blue-500" />
          <span>
            <strong>{newPagesCount} new page{newPagesCount > 1 ? 's' : ''}</strong> detected from Sidebar and auto-added to permissions.
            All new pages are <strong>hidden by default</strong> — tick View to enable access.
          </span>
        </div>
      )}

      {/* Permissions Table */}
      <div className="overflow-hidden bg-white border border-gray-200 rounded-lg shadow-sm">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <FaSync className={`text-4xl text-blue-600 mx-auto mb-4 ${isSyncing ? 'animate-spin' : ''}`} />
              <p className="text-gray-600">
                {isSyncing ? 'Syncing new pages from Sidebar...' : 'Loading permissions...'}
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-gray-200 bg-gray-50">
                  <tr>
                    <th className="px-6 py-4 text-sm font-semibold text-left text-gray-700">Module / Page</th>
                    <th className="w-24 px-6 py-4 text-sm font-semibold text-center text-gray-700">View</th>
                    <th className="w-24 px-6 py-4 text-sm font-semibold text-center text-gray-700">Create</th>
                    <th className="w-24 px-6 py-4 text-sm font-semibold text-center text-gray-700">Edit</th>
                    <th className="w-24 px-6 py-4 text-sm font-semibold text-center text-gray-700">Delete</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {permissions.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-gray-400">
                        No pages found. Please check your Sidebar configuration.
                      </td>
                    </tr>
                  ) : (
                    permissions.map((perm, index) => (
                      <tr key={perm.module_path}
                        className={`hover:bg-gray-50 transition-colors
                          ${perm.isSubmenu ? 'bg-blue-50/30' : 'bg-white font-medium'}`}>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          <div className={`flex items-center gap-2 ${perm.isSubmenu ? 'pl-6' : ''}`}>
                            {perm.isSubmenu && <span className="text-gray-400">└─</span>}
                            <div>
                              <div className={perm.isSubmenu ? 'font-normal' : 'font-semibold text-slate-700'}>
                                {perm.label}
                              </div>
                              {perm.parent && (
                                <div className="text-xs text-gray-400">under {perm.parent}</div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <input type="checkbox" checked={perm.can_view}
                            onChange={(e) => handlePermissionChange(index, 'can_view', e.target.checked)}
                            className="w-5 h-5 text-blue-600 rounded cursor-pointer focus:ring-2 focus:ring-blue-500" />
                        </td>
                        <td className="px-6 py-4 text-center">
                          <input type="checkbox" checked={perm.can_create}
                            onChange={(e) => handlePermissionChange(index, 'can_create', e.target.checked)}
                            disabled={!perm.can_view}
                            className="w-5 h-5 text-green-600 rounded cursor-pointer focus:ring-2 focus:ring-green-500 disabled:opacity-30 disabled:cursor-not-allowed" />
                        </td>
                        <td className="px-6 py-4 text-center">
                          <input type="checkbox" checked={perm.can_edit}
                            onChange={(e) => handlePermissionChange(index, 'can_edit', e.target.checked)}
                            disabled={!perm.can_view}
                            className="w-5 h-5 text-yellow-600 rounded cursor-pointer focus:ring-2 focus:ring-yellow-500 disabled:opacity-30 disabled:cursor-not-allowed" />
                        </td>
                        <td className="px-6 py-4 text-center">
                          <input type="checkbox" checked={perm.can_delete}
                            onChange={(e) => handlePermissionChange(index, 'can_delete', e.target.checked)}
                            disabled={!perm.can_view}
                            className="w-5 h-5 text-red-600 rounded cursor-pointer focus:ring-2 focus:ring-red-500 disabled:opacity-30 disabled:cursor-not-allowed" />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
              <button onClick={onClose}
                className="px-6 py-2.5 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 font-semibold">
                Cancel
              </button>
              <button onClick={handleSave} disabled={isSaving}
                className="flex items-center gap-2 px-6 py-2.5 text-white bg-blue-600 rounded-lg hover:bg-blue-700 font-semibold disabled:opacity-50 disabled:cursor-not-allowed">
                <FaSave />
                {isSaving ? 'Saving...' : 'Save Permissions'}
              </button>
            </div>
          </>
        )}
      </div>

      {/* Legend */}
      <div className="p-4 mt-6 border border-blue-200 rounded-lg bg-blue-50">
        <h3 className="mb-2 text-sm font-semibold text-blue-900">Permission Guide:</h3>
        <ul className="space-y-1 text-sm text-blue-800">
          <li><strong>View:</strong> User can see and access this module/page</li>
          <li><strong>Create:</strong> User can add new records (requires View)</li>
          <li><strong>Edit:</strong> User can modify existing records (requires View)</li>
          <li><strong>Delete:</strong> User can remove records (requires View)</li>
        </ul>
        <div className="pt-3 mt-3 border-t border-blue-200">
          <p className="text-xs text-blue-700">
            <strong>Auto-sync:</strong> New pages added to the Sidebar are automatically detected
            and added to this list with all permissions <strong>OFF</strong> by default.
            No manual setup needed — just add to Sidebar, then enable access here.
          </p>
        </div>
      </div>
    </div>
  );
};

export default RolePermissions;