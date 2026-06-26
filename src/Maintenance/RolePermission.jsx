import React, { useState, useEffect } from 'react';
import { FaSave, FaArrowLeft, FaSync, FaShieldAlt } from 'react-icons/fa';
import { rolePermissionAPI } from '../lib/supabaseClient';
import Swal from 'sweetalert2';
import { getAllMenuItems } from '../components/sidebar';

// ============================================================================
// UTILITY FUNCTIONS
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
  if (rolePerms[pagePath] !== undefined) return rolePerms[pagePath].canView === true;

  const hasAnySubAccess = Object.keys(rolePerms).some(
    (key) => key.startsWith(pagePath + '-') || key.startsWith(pagePath.toLowerCase() + '-')
  );
  return hasAnySubAccess;
}

export function canApprovePage(roleName, pagePath) {
  if (!roleName || !pagePath) return false;
  if (roleName === 'Admin') return true;
  if (!cacheLoaded || !permissionsCache[roleName]) return false;
  const rolePerms = permissionsCache[roleName];
  return rolePerms[pagePath]?.canCreate === true;
}

export function filterMenuByRole(menuItems, roleName) {
  if (!roleName) return [];
  if (roleName === 'Admin') return menuItems;

  return menuItems
    .filter((item) => {
      if (item.path === 'login') return true;
      if (!canAccessPage(roleName, item.path)) return false;
      if (item.submenu) {
        return item.submenu.some((sub) => canAccessPage(roleName, sub.path));
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
// HELPER: Extract ONLY current Sidebar pages (source of truth)
// ============================================================================
function extractSidebarPages(menuItems) {
  const pages = [];
  menuItems.forEach(item => {
    if (item.path && item.path !== 'login') {
      pages.push({ path: item.path, label: item.label, isSubmenu: false, parent: null });
    }
    if (item.submenu) {
      item.submenu.forEach(sub => {
        pages.push({ path: sub.path, label: sub.label, isSubmenu: true, parent: item.label });
      });
    }
  });
  return pages;
}

// ============================================================================
// AUTO-SYNC: Only insert missing Sidebar pages, never add stale ones
// ============================================================================
async function syncSidebarPagesToDB(roleName, sidebarPages) {
  try {
    const { data: existing, error } = await rolePermissionAPI.getPermissionsForUser(roleName);
    if (error) return;

    const existingPaths = new Set((existing || []).map(p => p.module_path));
    const sidebarPaths  = new Set(sidebarPages.map(p => p.path));

    // Only insert pages that exist in Sidebar but not yet in DB
    const missing = sidebarPages.filter(p => !existingPaths.has(p.path));
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

    if (missing.length > 0) {
      console.log(`[RolePermissions] Synced ${missing.length} new page(s) for "${roleName}"`);
    }

    return missing.length;
  } catch (err) {
    console.error('[RolePermissions] Sync error:', err);
    return 0;
  }
}

// ============================================================================
// COMPONENT
// ============================================================================
const RolePermissions = ({ selectedRole, onClose }) => {
  const [permissions, setPermissions] = useState([]);
  const [isLoading, setIsLoading]     = useState(false);
  const [isSaving, setIsSaving]       = useState(false);
  const [isSyncing, setIsSyncing]     = useState(false);
  const [newPagesCount, setNewPagesCount] = useState(0);
  const [sidebarPages, setSidebarPages]   = useState([]);

  useEffect(() => {
    if (selectedRole?.role_name) {
      const pages = extractSidebarPages(getAllMenuItems());
      setSidebarPages(pages);
      init(pages);
    }
  }, [selectedRole]);

  const init = async (pages) => {
    setIsLoading(true);
    setIsSyncing(true);
    try {
      const added = await syncSidebarPagesToDB(selectedRole.role_name, pages);
      setNewPagesCount(added || 0);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSyncing(false);
    }
    await loadPermissions(pages);
  };

  const loadPermissions = async (pages) => {
    setIsLoading(true);
    try {
      const { data, error } = await rolePermissionAPI.getPermissionsForUser(selectedRole.role_name);
      if (error) throw error;

      // Build a path→label map from current Sidebar only
      const sidebarPathSet = new Set(pages.map(p => p.path));
      const pagesMeta = {};
      pages.forEach(p => { pagesMeta[p.path] = p; });

      // ── KEY FIX: filter to only Sidebar paths ──
      const filtered = (data || []).filter(perm => sidebarPathSet.has(perm.module_path));

      // Sort: parent rows first, then their children, grouped by parent
      const sorted = [...filtered].sort((a, b) => {
        const aMeta = pagesMeta[a.module_path];
        const bMeta = pagesMeta[b.module_path];
        const aGroup = aMeta?.isSubmenu ? aMeta.parent : aMeta?.label || a.module_path;
        const bGroup = bMeta?.isSubmenu ? bMeta.parent : bMeta?.label || b.module_path;
        if (aGroup !== bGroup) return aGroup?.localeCompare(bGroup);
        if (!aMeta?.isSubmenu && bMeta?.isSubmenu) return -1;
        if (aMeta?.isSubmenu && !bMeta?.isSubmenu) return 1;
        return 0;
      });

      const enriched = sorted.map(perm => ({
        ...perm,
        label:     pagesMeta[perm.module_path]?.label     || perm.module_path,
        isSubmenu: pagesMeta[perm.module_path]?.isSubmenu || false,
        parent:    pagesMeta[perm.module_path]?.parent    || null,
      }));

      setPermissions(enriched);
    } catch (err) {
      console.error(err);
      Swal.fire('Error', 'Failed to load permissions', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (index, field, value) => {
    const updated = [...permissions];
    updated[index] = { ...updated[index], [field]: value };
    if (value && field !== 'can_view') updated[index].can_view = true;
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
        const result = perm.id
          ? await rolePermissionAPI.update(perm.id, payload)
          : await rolePermissionAPI.create(payload);
        if (result?.error) throw new Error(result.error);
      }
      clearPermissionsCache();
      Swal.fire({ icon: 'success', title: 'Saved', text: 'Permissions updated.', timer: 1800, showConfirmButton: false });
      await loadPermissions(sidebarPages);
    } catch (err) {
      Swal.fire('Error', err.message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  if (!selectedRole?.role_name) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-sm text-gray-400">No role selected.</p>
      </div>
    );
  }

  // Group permissions for section headers
  const grouped = permissions.reduce((acc, perm, idx) => {
    if (!perm.isSubmenu) {
      acc.push({ type: 'parent', perm, idx });
    } else {
      acc.push({ type: 'child', perm, idx });
    }
    return acc;
  }, []);

  const COLS = ['View', 'Create', 'Edit', 'Delete'];
  const FIELDS = ['can_view', 'can_create', 'can_edit', 'can_delete'];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Header ── */}
      <div className="px-8 py-5 bg-white border-b border-gray-200">
        <div className="flex items-center justify-between max-w-5xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center bg-gray-900 rounded-lg w-9 h-9">
              <FaShieldAlt size={14} className="text-white" />
            </div>
            <div>
              <h1 className="text-base font-semibold text-gray-900">Role Permissions</h1>
              <p className="text-xs text-gray-400 mt-0.5">
                Editing access for <span className="font-medium text-gray-600">{selectedRole.role_name}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
          >
            <FaArrowLeft size={10} /> Back to Roles
          </button>
        </div>
      </div>

      <div className="max-w-5xl px-8 py-6 mx-auto">

        {/* ── New pages banner ── */}
        {newPagesCount > 0 && (
          <div className="flex items-center gap-3 px-4 py-3 mb-5 text-xs text-gray-500 bg-white border border-gray-200 rounded-lg">
            <FaSync size={10} className="flex-shrink-0 text-gray-400" />
            <span>
              <strong className="text-gray-700">{newPagesCount} new {newPagesCount === 1 ? 'page' : 'pages'}</strong> added from Sidebar — all hidden by default. Enable View to grant access.
            </span>
          </div>
        )}

        {/* ── Table ── */}
        <div className="overflow-hidden bg-white border border-gray-200 rounded-xl">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-24">
              <div className="border-2 border-gray-900 rounded-full w-7 h-7 border-t-transparent animate-spin" />
              <p className="text-xs text-gray-400">
                {isSyncing ? 'Syncing pages...' : 'Loading permissions...'}
              </p>
            </div>
          ) : (
            <>
              {/* Table head */}
              <div className="grid grid-cols-[1fr_80px_80px_80px_80px] border-b border-gray-100 bg-gray-50/70">
                <div className="px-6 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                  Module / Page
                </div>
                {COLS.map(col => (
                  <div key={col} className="py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400 text-center">
                    {col}
                  </div>
                ))}
              </div>

              {/* Rows */}
              {grouped.length === 0 ? (
                <div className="py-16 text-sm text-center text-gray-400">
                  No pages found.
                </div>
              ) : (
                grouped.map(({ type, perm, idx }) => (
                  <div
                    key={perm.module_path}
                    className={`grid grid-cols-[1fr_80px_80px_80px_80px] border-b border-gray-50 last:border-0 transition-colors
                      ${type === 'parent'
                        ? 'bg-white hover:bg-gray-50/60'
                        : 'bg-gray-50/30 hover:bg-gray-50/70'
                      }`}
                  >
                    {/* Label */}
                    <div className={`px-6 py-3.5 flex items-center gap-2.5 ${type === 'child' ? 'pl-12' : ''}`}>
                      {type === 'child' && (
                        <span className="text-xs text-gray-300">└</span>
                      )}
                      <div>
                        <div className={`text-sm ${type === 'parent' ? 'font-semibold text-gray-800' : 'font-normal text-gray-600'}`}>
                          {perm.label}
                        </div>
                        {perm.parent && (
                          <div className="text-[11px] text-gray-400 mt-0.5">{perm.parent}</div>
                        )}
                      </div>
                    </div>

                    {/* Checkboxes */}
                    {FIELDS.map((field, fi) => (
                      <div key={field} className="flex items-center justify-center py-3.5">
                        <input
                          type="checkbox"
                          checked={perm[field] || false}
                          disabled={fi > 0 && !perm.can_view}
                          onChange={e => handleChange(idx, field, e.target.checked)}
                          className={`
                            w-4 h-4 rounded border-gray-300 cursor-pointer
                            checked:bg-gray-900 checked:border-gray-900
                            focus:ring-1 focus:ring-gray-900 focus:ring-offset-1
                            disabled:opacity-25 disabled:cursor-not-allowed
                            transition-all
                          `}
                        />
                      </div>
                    ))}
                  </div>
                ))
              )}

              {/* Footer */}
              <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50/50">
                <p className="text-xs text-gray-400">
                  {permissions.length} {permissions.length === 1 ? 'page' : 'pages'} · changes apply on next login
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={onClose}
                    className="px-4 py-2 text-xs font-medium text-gray-600 transition border border-gray-200 rounded-lg hover:bg-gray-100"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white transition bg-gray-900 rounded-lg hover:bg-gray-700 disabled:opacity-40"
                  >
                    <FaSave size={10} />
                    {isSaving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* ── Legend ── */}
        <div className="px-5 py-4 mt-4 bg-white border border-gray-100 rounded-xl">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2">Permission guide</p>
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: 'View',   desc: 'Can access and see the page' },
              { label: 'Create', desc: 'Can add records (also used as Approve flag)' },
              { label: 'Edit',   desc: 'Can modify existing records' },
              { label: 'Delete', desc: 'Can remove records' },
            ].map(({ label, desc }) => (
              <div key={label}>
                <p className="text-xs font-semibold text-gray-700">{label}</p>
                <p className="text-[11px] text-gray-400 mt-0.5">{desc}</p>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
};

export default RolePermissions;