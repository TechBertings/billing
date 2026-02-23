import React, { useState, useEffect } from "react";
import {
  FaPlus,
  FaEdit,
  FaTrash,
  FaShieldAlt,
  FaTimes,
  FaSync,
  FaSave,
  FaArrowLeft,
  FaUserShield,
  FaToggleOn,
  FaToggleOff,
} from "react-icons/fa";
import { userRoleAPI } from "../lib/supabaseClient";
import Swal from "sweetalert2";

function UserRole({ onManagePermissions }) {
  const [roles, setRoles] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState("add"); // 'add' | 'edit'
  const [selectedRole, setSelectedRole] = useState(null);
  const [formData, setFormData] = useState({
    roleName: "",
    status: true, // boolean: true = Active, false = Inactive
  });
  const [formError, setFormError] = useState("");

  useEffect(() => {
    loadRoles();
  }, []);

  const loadRoles = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await userRoleAPI.getAll();

      // ✅ FIX: Filter by boolean status, not string
      if (data) {
        console.log("Loaded roles:", data); // Debug log
        setRoles(data); // Show all roles OR filter by: data.filter(r => r.status === true)
      }

      if (error) console.error("Error loading roles:", error);
    } catch (err) {
      console.error("Error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const openModal = (mode, role = null) => {
    setModalMode(mode);
    setSelectedRole(role);
    setFormError("");
    if (mode === "add") {
      setFormData({ roleName: "", status: true });
    } else if (role) {
      setFormData({
        roleName: role.role_name,
        status: role.status, // already boolean from DB
      });
    }
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");

    if (!formData.roleName.trim()) {
      setFormError("Role name is required.");
      return;
    }

    setIsLoading(true);
    try {
      const result =
        modalMode === "add"
          ? await userRoleAPI.create(formData)
          : await userRoleAPI.update(selectedRole.id, formData);

      if (result.error) {
        setFormError(result.error);
      } else {
        await loadRoles();
        setShowModal(false);
        Swal.fire({
          icon: "success",
          title: "Success!",
          text: `Role ${modalMode === "add" ? "created" : "updated"} successfully!`,
          timer: 2000,
          showConfirmButton: false,
        });
      }
    } catch (err) {
      setFormError("An error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (role) => {
    const result = await Swal.fire({
      title: "Delete Role",
      text: `Are you sure you want to delete "${role.role_name}"? This cannot be undone.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#6b7280",
      confirmButtonText: "Yes, delete it!",
    });

    if (result.isConfirmed) {
      setIsLoading(true);
      try {
        const { error } = await userRoleAPI.delete(role.id);
        if (error) {
          Swal.fire("Error!", error, "error");
        } else {
          await loadRoles();
          Swal.fire("Deleted!", "Role has been deleted.", "success");
        }
      } catch (err) {
        Swal.fire("Error!", "An error occurred.", "error");
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleToggleStatus = async (role) => {
    const newStatus = !role.status; // Toggle boolean
    try {
      const { error } = await userRoleAPI.update(role.id, {
        roleName: role.role_name,
        status: newStatus,
      });
      if (!error) {
        await loadRoles();
      } else {
        Swal.fire("Error!", error, "error");
      }
    } catch (err) {
      Swal.fire("Error!", "An error occurred.", "error");
    }
  };

  // Convert boolean status to display text and color
  const getStatusDisplay = (status) => {
    return status ? "Active" : "Inactive";
  };

  const statusColor = (status) =>
    status ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700";

  return (
    <div className="px-6 mx-auto max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-3xl font-bold text-blue-600">Role Management</h2>
          <p className="text-sm text-gray-500 mt-1">
            Manage user roles and their permissions.
          </p>
        </div>
        <button
          onClick={() => openModal("add")}
          className="flex items-center gap-2 px-4 py-2.5 text-white bg-blue-600 rounded-lg hover:bg-blue-700 font-semibold"
        >
          <FaPlus /> Add Role
        </button>
      </div>

      {/* Roles Table */}
      {isLoading && roles.length === 0 ? (
        <div className="flex items-center justify-center py-20">
          <FaSync className="animate-spin text-3xl text-blue-600 mr-3" />
          <span className="text-lg text-gray-600">Loading roles...</span>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left font-semibold text-gray-700">
                  Role Name
                </th>
                <th className="px-6 py-3 text-center font-semibold text-gray-700">
                  Status
                </th>
                <th className="px-6 py-3 text-center font-semibold text-gray-700">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {roles.length === 0 ? (
                <tr>
                  <td colSpan={3} className="text-center py-12 text-gray-400">
                    No roles found. Click "Add Role" to create one.
                  </td>
                </tr>
              ) : (
                roles.map((role) => (
                  <tr
                    key={role.id}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <FaUserShield className="text-blue-400" />
                        <span className="font-semibold text-gray-800">
                          {role.role_name}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span
                        className={`inline-block px-3 py-1 text-xs font-semibold rounded-full ${statusColor(role.status)}`}
                      >
                        {getStatusDisplay(role.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                        {/* Toggle Status */}
                        {/* <button
                          onClick={() => handleToggleStatus(role)}
                          className={`p-1.5 rounded-lg ${role.status ? "text-green-600 hover:bg-green-50" : "text-gray-400 hover:bg-gray-100"}`}
                          title={role.status ? "Deactivate" : "Activate"}
                        >
                          {role.status ? (
                            <FaToggleOn size={18} />
                          ) : (
                            <FaToggleOff size={18} />
                          )}
                        </button> */}
                        {/* ✅ ADD THIS - Manage Permissions */}
                        <button
                          onClick={() =>
                            onManagePermissions && onManagePermissions(role)
                          }
                          className="p-1.5 text-purple-600 hover:bg-purple-50 rounded-lg"
                          title="Manage Permissions"
                        >
                          <FaShieldAlt />
                        </button>

                        {/* Edit */}
                        <button
                          onClick={() => openModal("edit", role)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg"
                          title="Edit Role"
                        >
                          <FaEdit />
                        </button>
                        {/* Delete */}
                        <button
                          onClick={() => handleDelete(role)}
                          className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"
                          title="Delete Role"
                        >
                          <FaTrash />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
          <div className="w-full max-w-md bg-white rounded-lg shadow-xl">
            <div className="flex items-center justify-between p-6 border-b">
              <h3 className="text-xl font-bold text-gray-800">
                {modalMode === "add" ? "Add New Role" : "Edit Role"}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <FaTimes />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg">
                  {formError}
                </div>
              )}

              <div>
                <label className="block mb-1.5 text-sm font-medium text-gray-700">
                  Role Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.roleName}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, roleName: e.target.value }))
                  }
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  placeholder="e.g. Manager, Cashier"
                  required
                />
              </div>

              <div>
                <label className="block mb-1.5 text-sm font-medium text-gray-700">
                  Status
                </label>
                <select
                  value={formData.status ? "Active" : "Inactive"}
                  onChange={(e) =>
                    setFormData((p) => ({
                      ...p,
                      status: e.target.value === "Active",
                    }))
                  }
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 font-semibold"
                >
                  <FaSave />
                  {isLoading
                    ? "Saving..."
                    : modalMode === "add"
                      ? "Create Role"
                      : "Update Role"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default UserRole;
