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
  
  // Admin has access to everything
  if (roleName === 'Admin') return true;
  
  // Always allowed pages
  if (ALWAYS_ALLOWED.includes(pagePath)) return true;
  
  // Load permissions if not cached
  if (!cacheLoaded || !permissionsCache[roleName]) return false;

  const rolePerms = permissionsCache[roleName];
  
  // Check if page has explicit permission
  if (rolePerms[pagePath] !== undefined) {
    return rolePerms[pagePath].canView === true;
  }

  // Check if any submenu has access
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
      // Always show login
      if (item.path === 'login') return true;
      
      // Check if can access this page
      if (!canAccessPage(roleName, item.path)) return false;
      
      // If has submenu, check if any submenu item is accessible
      if (item.submenu) {
        const accessibleSubmenus = item.submenu.filter((sub) => 
          canAccessPage(roleName, sub.path)
        );
        return accessibleSubmenus.length > 0;
      }
      
      return true;
    })
    .map((item) => {
      // Filter submenu items
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
    // Add main menu item
    if (item.path && item.path !== 'login') {
      pages.push({
        path: item.path,
        label: item.label,
        isSubmenu: false,
        parent: null
      });
    }
    
    // Add submenu items
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
// REACT COMPONENT (default export)
// ============================================================================

const RolePermissions = ({ selectedRole, onClose }) => {
  const [permissions, setPermissions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [availablePages, setAvailablePages] = useState([]);

  useEffect(() => {
    // Only load if selectedRole exists
    if (selectedRole && selectedRole.role_name) {
      // Get all pages from Sidebar menu
      const menuItems = getAllMenuItems();
      const pages = extractAllPagesFromMenu(menuItems);
      setAvailablePages(pages);
      
      // Load permissions
      loadPermissions(pages);
    }
  }, [selectedRole]);

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

      // If we have data from database, use that!
      if (data && data.length > 0) {
        // Add UI labels from Sidebar menu items
        const menuItems = getAllMenuItems();
        const pagesMap = {};
        
        // Create lookup map for labels and parent info
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
        
        // Merge database data with UI labels
        const enrichedPerms = data.map(perm => ({
          ...perm,
          label: pagesMap[perm.module_path]?.label || perm.module_path,
          isSubmenu: pagesMap[perm.module_path]?.isSubmenu || false,
          parent: pagesMap[perm.module_path]?.parent || null
        }));
        
        setPermissions(enrichedPerms);
      } else {
        // No data in database, create from Sidebar (fallback)
        const initializedPerms = pages.map(page => ({
          module_path: page.path,
          role_name: selectedRole.role_name,
          can_view: false,
          can_create: false,
          can_edit: false,
          can_delete: false,
          label: page.label,
          isSubmenu: page.isSubmenu,
          parent: page.parent
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
    updated[index] = {
      ...updated[index],
      [field]: value,
    };

    // Auto-enable view if any other permission is enabled
    if (value && field !== 'can_view') {
      updated[index].can_view = true;
    }

    // Auto-disable other permissions if view is disabled
    if (!value && field === 'can_view') {
      updated[index].can_create = false;
      updated[index].can_edit = false;
      updated[index].can_delete = false;
    }

    setPermissions(updated);
  };

const handleSave = async () => {
  setIsSaving(true);
  try {
    // Save each permission
    for (const perm of permissions) {
      const payload = {
        role_name: selectedRole.role_name,
        module_path: perm.module_path,
        can_view: perm.can_view,
        can_create: perm.can_create,
        can_edit: perm.can_edit,
        can_delete: perm.can_delete,
      };

      let result;
      if (perm.id) {
        // ✅ Update existing (since auto-populate trigger already created them)
        result = await rolePermissionAPI.update(perm.id, payload);
      } else {
        // ✅ Rare case: create if somehow missing
        result = await rolePermissionAPI.create(payload);
      }

      if (result?.error) {
        throw new Error(result.error);
      }
    }

    // Clear cache after saving
    clearPermissionsCache();

    Swal.fire({
      icon: 'success',
      title: 'Success!',
      text: 'Permissions updated successfully!',
      timer: 2000,
      showConfirmButton: false
    });

    // Reload permissions to get updated data
    await loadPermissions(availablePages);
  } catch (err) {
    console.error('Error saving permissions:', err);
    Swal.fire('Error', 'Failed to save permissions: ' + err.message, 'error');
  } finally {
    setIsSaving(false);
  }
};

  // Safety check - if no role selected, show error message
  if (!selectedRole || !selectedRole.role_name) {
    return (
      <div className="px-6 mx-auto max-w-7xl">
        <div className="bg-red-50 border border-red-200 rounded-lg p-8 text-center">
          <h2 className="text-2xl font-bold text-red-600 mb-2">No Role Selected</h2>
          <p className="text-red-700 mb-4">Please select a role to manage permissions.</p>
          <button
            onClick={onClose}
            className="flex items-center gap-2 px-6 py-2.5 text-white bg-red-600 rounded-lg hover:bg-red-700 font-semibold"
          >
            <FaArrowLeft /> Back to Roles
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="px-6 mx-auto max-w-7xl">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-blue-600">Role Permissions</h2>
          <p className="text-gray-600 mt-1">
            Managing permissions for: <span className="font-semibold text-purple-600">{selectedRole.role_name}</span>
          </p>
        </div>
        <button
          onClick={onClose}
          className="flex items-center gap-2 px-4 py-2.5 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 font-semibold"
        >
          <FaArrowLeft /> Back to Roles
        </button>
      </div>

      {/* Permissions Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <FaSync className="animate-spin text-4xl text-blue-600 mx-auto mb-4" />
              <p className="text-gray-600">Loading permissions...</p>
            </div>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Module / Page</th>
                    <th className="px-6 py-4 text-center text-sm font-semibold text-gray-700 w-24">View</th>
                    <th className="px-6 py-4 text-center text-sm font-semibold text-gray-700 w-24">Create</th>
                    <th className="px-6 py-4 text-center text-sm font-semibold text-gray-700 w-24">Edit</th>
                    <th className="px-6 py-4 text-center text-sm font-semibold text-gray-700 w-24">Delete</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {permissions.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-12 text-gray-400">
                        No pages found. Please check your Sidebar configuration.
                      </td>
                    </tr>
                  ) : (
                    permissions.map((perm, index) => (
                      <tr key={perm.module_path} className={`hover:bg-gray-50 ${perm.isSubmenu ? 'bg-blue-50/30' : ''}`}>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          <div className={`flex items-center gap-2 ${perm.isSubmenu ? 'pl-6' : ''}`}>
                            {perm.isSubmenu && (
                              <span className="text-gray-400">└─</span>
                            )}
                            <div>
                              <div className="font-medium">{perm.label}</div>
                              {perm.parent && (
                                <div className="text-xs text-gray-500">under {perm.parent}</div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <input
                            type="checkbox"
                            checked={perm.can_view}
                            onChange={(e) => handlePermissionChange(index, 'can_view', e.target.checked)}
                            className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500 cursor-pointer"
                          />
                        </td>
                        <td className="px-6 py-4 text-center">
                          <input
                            type="checkbox"
                            checked={perm.can_create}
                            onChange={(e) => handlePermissionChange(index, 'can_create', e.target.checked)}
                            disabled={!perm.can_view}
                            className="w-5 h-5 text-green-600 rounded focus:ring-2 focus:ring-green-500 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                          />
                        </td>
                        <td className="px-6 py-4 text-center">
                          <input
                            type="checkbox"
                            checked={perm.can_edit}
                            onChange={(e) => handlePermissionChange(index, 'can_edit', e.target.checked)}
                            disabled={!perm.can_view}
                            className="w-5 h-5 text-yellow-600 rounded focus:ring-2 focus:ring-yellow-500 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                          />
                        </td>
                        <td className="px-6 py-4 text-center">
                          <input
                            type="checkbox"
                            checked={perm.can_delete}
                            onChange={(e) => handlePermissionChange(index, 'can_delete', e.target.checked)}
                            disabled={!perm.can_view}
                            className="w-5 h-5 text-red-600 rounded focus:ring-2 focus:ring-red-500 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                          />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Action Buttons */}
            <div className="p-6 bg-gray-50 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={onClose}
                className="px-6 py-2.5 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center gap-2 px-6 py-2.5 text-white bg-blue-600 rounded-lg hover:bg-blue-700 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FaSave />
                {isSaving ? 'Saving...' : 'Save Permissions'}
              </button>
            </div>
          </>
        )}
      </div>

      {/* Legend */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-blue-900 mb-2">Permission Guide:</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li><strong>View:</strong> User can see and access this module/page</li>
          <li><strong>Create:</strong> User can add new records (requires View permission)</li>
          <li><strong>Edit:</strong> User can modify existing records (requires View permission)</li>
          <li><strong>Delete:</strong> User can remove records (requires View permission)</li>
        </ul>
        <div className="mt-3 pt-3 border-t border-blue-200">
          <p className="text-xs text-blue-700">
            <strong>Note:</strong> Admin role has access to all pages by default. 
            Indented items (└─) are submenu pages under their parent menu.
          </p>
        </div>
      </div>
    </div>
  );
};

export default RolePermissions;