import React, { useState, useEffect } from "react";
import {
  FaUserPlus,
  FaEdit,
  FaTrash,
  FaSearch,
  FaUser,
  FaEye,
  FaEyeSlash,
  FaLock,
  FaEnvelope,
  FaPhone,
  FaTimes,
  FaSync,
  FaImage,
  FaCog,
  FaArchive,
  FaBan,
  FaCheck,
  FaEllipsisV,
  FaUserShield,
  FaKey,
} from "react-icons/fa";
import {
  userAPI,
  securityQuestionAPI,
  userRoleAPI,
} from "../../lib/supabaseClient";
import Swal from "sweetalert2";
import UserRole from "../../Maintenance/UserRole";
import RolePermissions from "../../Maintenance/RolePermission";

function UserManagement() {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [securityQuestions, setSecurityQuestions] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("All Roles");
  const [showModal, setShowModal] = useState(false);
  const [showQuestionsModal, setShowQuestionsModal] = useState(false);
  const [showUserActionsModal, setShowUserActionsModal] = useState(false);
  const [showRoleManagement, setShowRoleManagement] = useState(false);
  const [showRolePermissions, setShowRolePermissions] = useState(false);
  const [selectedRoleForPermissions, setSelectedRoleForPermissions] =
    useState(null);
  const [selectedUserForActions, setSelectedUserForActions] = useState(null);
  const [deactivateDuration, setDeactivateDuration] = useState("now");
  const [modalMode, setModalMode] = useState("add");
  const [selectedUser, setSelectedUser] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteType, setDeleteType] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [imagePreview, setImagePreview] = useState(null);

  const [formData, setFormData] = useState({
    username: "",
    email: "",
    fullName: "",
    phone: "",
    password: "",
    confirmPassword: "",
    role: "User",
    status: "Active",
    securityQuestion: "",
    securityAnswer: "",
    imageBase64: null,
  });

  const [questionForm, setQuestionForm] = useState({ question: "", id: null });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [usersRes, questionsRes, rolesRes] = await Promise.all([
        userAPI.getAllUsers(),
        securityQuestionAPI.getAll(),
        userRoleAPI.getAll(),
      ]);

      if (usersRes.data) setUsers(usersRes.data);
      if (questionsRes.data) setSecurityQuestions(questionsRes.data);

      // ✅ FIX: Don't filter by status string, database uses boolean
      if (rolesRes.data) {
        // Show all roles OR filter by: rolesRes.data.filter(r => r.status === true)
        setRoles(rolesRes.data);
      }
    } catch (err) {
      console.error("Error loading data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredUsers = users.filter((user) => {
    const matchesSearch = Object.values(user).some((val) =>
      String(val).toLowerCase().includes(searchTerm.toLowerCase()),
    );
    const matchesRole = roleFilter === "All Roles" || user.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        setError("Image size must be less than 2MB");
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          let width = img.width;
          let height = img.height;

          const MAX_WIDTH = 200;
          const MAX_HEIGHT = 200;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height = height * (MAX_WIDTH / width);
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width = width * (MAX_HEIGHT / height);
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, width, height);

          const compressedBase64 = canvas.toDataURL("image/jpeg", 0.5);

          const sizeInBytes = (compressedBase64.length * 3) / 4;
          if (sizeInBytes > 8000) {
            setError(
              "Image is still too large after compression. Please use a smaller image.",
            );
            return;
          }

          setFormData((prev) => ({ ...prev, imageBase64: compressedBase64 }));
          setImagePreview(compressedBase64);
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    }
  };

  const openModal = (mode, user = null) => {
    setModalMode(mode);
    setSelectedUser(user);
    setError("");
    setImagePreview(user?.image_url || null);

    if (mode === "add") {
      setFormData({
        username: "",
        email: "",
        fullName: "",
        phone: "",
        password: "",
        confirmPassword: "",
        role: roles.length > 0 ? roles[0].role_name : "User",
        status: "Active",
        securityQuestion: "",
        securityAnswer: "",
        imageBase64: null,
      });
    } else if ((mode === "edit" || mode === "view") && user) {
      setFormData({
        username: user.username,
        email: user.email,
        fullName: user.full_name,
        phone: user.phone || "",
        password: "",
        confirmPassword: "",
        role: user.role,
        status: user.status,
        securityQuestion: user.security_questions || "",
        securityAnswer: user.security_answer || "",
        imageBase64: null,
      });
    }
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (modalMode === "view") return;

    setError("");

    if (
      modalMode === "add" &&
      (!formData.password || formData.password !== formData.confirmPassword)
    ) {
      setError("Password is required and must match");
      return;
    }

    if (
      modalMode === "edit" &&
      formData.password &&
      formData.password !== formData.confirmPassword
    ) {
      setError("Passwords do not match");
      return;
    }

    setIsLoading(true);

    try {
      const result =
        modalMode === "add"
          ? await userAPI.createUser(formData)
          : await userAPI.updateUser(selectedUser.id, formData);

      if (result.error) {
        setError(result.error);
      } else {
        await loadData();
        setShowModal(false);
        Swal.fire({
          icon: "success",
          title: "Success!",
          text: `User ${modalMode === "add" ? "added" : "updated"} successfully!`,
          timer: 2000,
          showConfirmButton: false,
        });
      }
    } catch (err) {
      setError("An error occurred");
      console.error("Error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (type) => {
    setIsLoading(true);
    try {
      const result =
        type === "user"
          ? await userAPI.deleteUser(deleteTarget.id)
          : await securityQuestionAPI.delete(deleteTarget.id);

      if (result.error) {
        alert("Error: " + result.error);
      } else {
        await loadData();
        alert(`${type === "user" ? "User" : "Question"} deleted successfully!`);
      }
    } catch (err) {
      alert("An error occurred");
    } finally {
      setIsLoading(false);
      setShowDeleteConfirm(false);
      setDeleteTarget(null);
    }
  };

  const handleUserAction = async (action) => {
    const user = selectedUserForActions;

    if (action === "delete") {
      const result = await Swal.fire({
        title: "Delete User",
        text: `Are you sure you want to delete ${user.full_name}? This action cannot be undone.`,
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#dc2626",
        cancelButtonColor: "#6b7280",
        confirmButtonText: "Yes, delete it!",
        cancelButtonText: "Cancel",
      });

      if (result.isConfirmed) {
        try {
          const deleteResult = await userAPI.deleteUser(user.id);
          if (!deleteResult.error) {
            await loadData();
            setShowUserActionsModal(false);
            Swal.fire("Deleted!", "User has been deleted.", "success");
          } else {
            Swal.fire("Error!", deleteResult.error, "error");
          }
        } catch (err) {
          Swal.fire("Error!", "An error occurred while deleting.", "error");
        }
      }
    } else if (action === "deactivate") {
      const result = await Swal.fire({
        title: "Deactivate Account",
        text: `Are you sure you want to deactivate ${user.full_name}'s account for ${getDurationLabel()}?`,
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#f59e0b",
        cancelButtonColor: "#6b7280",
        confirmButtonText: "Yes, deactivate!",
        cancelButtonText: "Cancel",
      });

      if (result.isConfirmed) {
        try {
          const updateResult = await userAPI.updateUser(user.id, {
            email: user.email,
            fullName: user.full_name,
            phone: user.phone,
            role: user.role,
            status: "Inactive",
            securityQuestion: user.security_questions,
            securityAnswer: user.security_answer,
          });
          if (!updateResult.error) {
            await loadData();
            setShowUserActionsModal(false);
            Swal.fire(
              "Deactivated!",
              `Account has been deactivated for ${getDurationLabel()}.`,
              "success",
            );
          } else {
            Swal.fire("Error!", updateResult.error, "error");
          }
        } catch (err) {
          Swal.fire("Error!", "An error occurred while deactivating.", "error");
        }
      }
    } else if (action === "enable") {
      const result = await Swal.fire({
        title: "Enable Account",
        text: `Are you sure you want to enable ${user.full_name}'s account?`,
        icon: "question",
        showCancelButton: true,
        confirmButtonColor: "#10b981",
        cancelButtonColor: "#6b7280",
        confirmButtonText: "Yes, enable it!",
        cancelButtonText: "Cancel",
      });

      if (result.isConfirmed) {
        try {
          const updateResult = await userAPI.updateUser(user.id, {
            email: user.email,
            fullName: user.full_name,
            phone: user.phone,
            role: user.role,
            status: "Active",
            securityQuestion: user.security_questions,
            securityAnswer: user.security_answer,
          });
          if (!updateResult.error) {
            await loadData();
            setShowUserActionsModal(false);
            Swal.fire("Enabled!", "Account has been activated.", "success");
          } else {
            Swal.fire("Error!", updateResult.error, "error");
          }
        } catch (err) {
          Swal.fire("Error!", "An error occurred while enabling.", "error");
        }
      }
    }
  };

  const getDurationLabel = () => {
    switch (deactivateDuration) {
      case "now":
        return "indefinitely";
      case "1day":
        return "1 Day";
      case "3days":
        return "3 Days";
      case "7days":
        return "7 Days";
      case "3weeks":
        return "3 Weeks";
      case "1month":
        return "1 Month";
      case "1year":
        return "1 Year";
      default:
        return "indefinitely";
    }
  };

  const openUserActionsModal = (user) => {
    setSelectedUserForActions(user);
    setDeactivateDuration("now");
    setShowUserActionsModal(true);
  };

  const handleManagePermissions = (role) => {
    console.log("🎯 Manage Permissions clicked");
    console.log("📦 Role object received:", role);
    console.log("📝 Role name:", role?.role_name);

    // Safety check
    if (!role) {
      console.error("❌ No role object!");
      Swal.fire("Error", "No role selected", "error");
      return;
    }

    if (!role.role_name) {
      console.error("❌ Role object missing role_name!");
      Swal.fire("Error", "Invalid role data", "error");
      return;
    }

    console.log("✅ Setting selectedRoleForPermissions to:", role);
    setSelectedRoleForPermissions(role);
    setShowRolePermissions(true);
    setShowRoleManagement(false);
  };

  const handleQuestionSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const result = questionForm.id
        ? await securityQuestionAPI.update(questionForm.id, {
            question: questionForm.question,
          })
        : await securityQuestionAPI.create({ question: questionForm.question });

      if (result.error) {
        alert("Error: " + result.error);
      } else {
        await loadData();
        setQuestionForm({ question: "", id: null });
      }
    } catch (err) {
      alert("An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  // If role management is open, show that component instead
  if (showRoleManagement) {
    console.log("📍 Rendering UserRole component");
    return <UserRole onManagePermissions={handleManagePermissions} />;
  }

  // If role permissions modal is open
  if (showRolePermissions && selectedRoleForPermissions) {
    console.log("📍 Rendering RolePermissions component");
    console.log("📦 selectedRoleForPermissions:", selectedRoleForPermissions);
    return (
      <RolePermissions
        selectedRole={selectedRoleForPermissions}
        onClose={() => {
          console.log("🔙 Closing RolePermissions");
          setShowRolePermissions(false);
          setSelectedRoleForPermissions(null);
          setShowRoleManagement(true);
        }}
      />
    );
  }

  return (
    <div className="px-6 mx-auto max-w-7xl">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-3xl font-bold text-blue-600">User Management</h2>
      </div>

      {/* Search and Filters */}
      <div className="p-5 mb-6 bg-white border border-gray-200 rounded-lg shadow-sm">
        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <FaSearch className="absolute left-3 top-3.5 text-gray-400" />
            <input
              type="text"
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full py-2.5 pl-10 pr-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="All Roles">All Roles</option>
            {roles.map((role) => (
              <option key={role.id} value={role.role_name}>
                {role.role_name}
              </option>
            ))}
          </select>

          <button
            onClick={() => openModal("add")}
            className="flex items-center gap-2 px-4 py-2.5 text-white bg-blue-600 rounded-lg hover:bg-blue-700 font-semibold"
          >
            <FaUserPlus /> Add User
          </button>

          {/* <button
            onClick={() => setShowRoleManagement(true)}
            className="flex items-center gap-2 px-4 py-2.5 text-white bg-purple-600 rounded-lg hover:bg-purple-700 font-semibold"
          >
            <FaUserShield /> Manage Roles
          </button> */}
          <button
            onClick={() => alert("View Archives - Coming soon!")}
            className="flex items-center gap-2 px-4 py-2.5 text-white bg-gray-700 rounded-lg hover:bg-gray-800 font-semibold"
          >
            <FaArchive /> Archives
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-5 mb-6">
        <div className="p-4 bg-white border border-blue-200 rounded-lg shadow-sm">
          <p className="text-sm font-semibold text-gray-600">
            Total: <span className="text-blue-600">{users.length}</span>
          </p>
        </div>
        <div className="p-4 bg-white border border-green-200 rounded-lg shadow-sm">
          <p className="text-sm font-semibold text-gray-600">
            Active:{" "}
            <span className="text-green-600">
              {users.filter((u) => u.status === "Active").length}
            </span>
          </p>
        </div>
        <div className="p-4 bg-white border border-red-200 rounded-lg shadow-sm">
          <p className="text-sm font-semibold text-gray-600">
            Deactivated:{" "}
            <span className="text-red-600">
              {users.filter((u) => u.status === "Inactive").length}
            </span>
          </p>
        </div>
      </div>

      {/* Users Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <FaSync className="mr-3 text-3xl text-blue-600 animate-spin" />
          <span className="text-lg text-gray-600">Loading...</span>
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="py-20 text-center bg-white border border-gray-200 rounded-lg">
          <p className="text-gray-500">No users found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
          {filteredUsers.map((user) => (
            <div
              key={user.id}
              className="overflow-hidden transition-shadow bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md"
            >
              <div className="p-6 text-center">
                <div className="flex justify-center mb-4">
                  {user.image_url ? (
                    <img
                      src={user.image_url}
                      alt={user.full_name}
                      className="object-cover w-24 h-24 border-4 border-gray-100 rounded-full"
                    />
                  ) : (
                    <div className="flex items-center justify-center w-24 h-24 text-2xl font-bold text-white bg-blue-500 border-4 border-gray-100 rounded-full">
                      {user.full_name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .toUpperCase()}
                    </div>
                  )}
                </div>

                <div className="flex justify-center mb-3">
                  <span
                    className={`inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold rounded-full ${
                      user.status === "Active"
                        ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    <span
                      className={`w-2 h-2 rounded-full ${user.status === "Active" ? "bg-green-500" : "bg-red-500"}`}
                    ></span>
                    {user.status}
                  </span>
                </div>

                <h3 className="mb-1 text-lg font-bold text-gray-900">
                  {user.full_name}
                </h3>

                <p className={`text-sm font-semibold mb-2 ${user.role}`}>
                  {user.role}
                </p>

                {/* <p className="mb-4 text-xs text-gray-500">{user.email}</p> */}

                <div className="flex gap-2">
                  <button
                    onClick={() => openModal("edit", user)}
                    className="flex items-center justify-center flex-1 gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700"
                  >
                    <FaEdit /> Edit
                  </button>
                  <button
                    onClick={() => openUserActionsModal(user)}
                    className="p-2 text-gray-600 rounded-lg hover:bg-gray-100"
                    title="More Options"
                  >
                    <FaEllipsisV />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* User Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white rounded-lg">
            <div className="sticky top-0 flex items-center justify-between p-6 bg-white border-b">
              <h3 className="text-xl font-bold">
                {modalMode === "add"
                  ? "Add User"
                  : modalMode === "edit"
                    ? "Edit User"
                    : "User Details"}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <FaTimes />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6">
              {error && (
                <div className="p-4 mb-4 text-sm text-red-600 border border-red-200 rounded-lg bg-red-50">
                  {error}
                </div>
              )}

              <div className="space-y-4">
                {/* Image Upload */}
                <div className="flex flex-col items-center">
                  {imagePreview ? (
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="object-cover w-32 h-32 mb-4 border-4 border-gray-100 rounded-full"
                    />
                  ) : (
                    <div className="flex items-center justify-center w-32 h-32 mb-4 bg-gray-200 rounded-full">
                      <FaImage className="text-4xl text-gray-400" />
                    </div>
                  )}
                  <label className="px-4 py-2 text-sm bg-gray-100 rounded-lg cursor-pointer hover:bg-gray-200">
                    <FaImage className="inline mr-2" />
                    {imagePreview ? "Change Image" : "Upload Image"}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      className="hidden"
                    />
                  </label>
                  <p className="mt-2 text-xs text-gray-500">Max size: 2MB</p>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  {[
                    {
                      name: "username",
                      label: "Username",
                      icon: FaUser,
                      required: true,
                      disabled: modalMode === "edit",
                    },
                    { name: "fullName", label: "Full Name", required: true },
                    {
                      name: "email",
                      label: "Email",
                      type: "email",
                      icon: FaEnvelope,
                      required: true,
                    },
                    { name: "phone", label: "Phone", icon: FaPhone },
                    {
                      name: "password",
                      label: `Password ${modalMode === "edit" ? "(leave blank to keep)" : ""}`,
                      type: "password",
                      icon: FaLock,
                      required: modalMode === "add",
                    },
                    {
                      name: "confirmPassword",
                      label: "Confirm Password",
                      type: "password",
                      icon: FaLock,
                      required: modalMode === "add",
                    },
                  ].map((field) => (
                    <div key={field.name}>
                      <label className="block mb-2 text-sm font-medium">
                        {field.label}{" "}
                        {field.required && (
                          <span className="text-red-500">*</span>
                        )}
                      </label>
                      <div className="relative">
                        {field.icon && (
                          <field.icon className="absolute text-gray-400 left-3 top-3" />
                        )}
                        <input
                          type={
                            field.type ||
                            (field.name === "password" ||
                            field.name === "confirmPassword"
                              ? showPassword
                                ? "text"
                                : "password"
                              : "text")
                          }
                          name={field.name}
                          value={formData[field.name]}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              [e.target.name]: e.target.value,
                            }))
                          }
                          className={`w-full py-2.5 ${field.icon ? "pl-10" : "pl-4"} pr-4 border rounded-lg focus:ring-2 focus:ring-blue-500`}
                          required={field.required}
                          disabled={field.disabled}
                        />
                        {(field.name === "password" ||
                          field.name === "confirmPassword") && (
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute text-gray-400 right-3 top-3"
                          >
                            {showPassword ? <FaEyeSlash /> : <FaEye />}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}

                  <div>
                    <label className="block mb-2 text-sm font-medium">
                      Role *
                    </label>
                    <select
                      name="role"
                      value={formData.role}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          role: e.target.value,
                        }))
                      }
                      className="w-full py-2.5 px-4 border rounded-lg focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      {roles.map((role) => (
                        <option key={role.id} value={role.role_name}>
                          {role.role_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block mb-2 text-sm font-medium">
                      Status *
                    </label>
                    <select
                      name="status"
                      value={formData.status}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          status: e.target.value,
                        }))
                      }
                      className="w-full py-2.5 px-4 border rounded-lg focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      {["Active", "Inactive"].map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block mb-2 text-sm font-medium">
                    Security Question *
                  </label>
                  <select
                    name="securityQuestion"
                    value={formData.securityQuestion}
                    onChange={(e) => {
                      const selected = securityQuestions.find(
                        (q) => q.question === e.target.value,
                      );
                      setFormData((prev) => ({
                        ...prev,
                        securityQuestion: e.target.value,
                        securityAnswer: selected?.answer || "",
                      }));
                    }}
                    className="w-full py-2.5 px-4 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">Select a security question</option>
                    {securityQuestions.map((q) => (
                      <option key={q.id} value={q.question}>
                        {q.question}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block mb-2 text-sm font-medium">
                    Security Answer
                    <span className="ml-2 text-xs font-normal text-gray-400">
                      (auto-filled)
                    </span>
                  </label>
                  <input
                    type="text"
                    name="securityAnswer"
                    value={formData.securityAnswer}
                    readOnly
                    className="w-full py-2.5 px-4 border border-gray-200 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed select-none"
                  />
                </div>

                <div className="flex gap-3 pt-4 border-t">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="flex-1 px-6 py-2.5 bg-gray-100 rounded-lg hover:bg-gray-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="flex-1 px-6 py-2.5 text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    {isLoading
                      ? "Saving..."
                      : modalMode === "add"
                        ? "Add User"
                        : "Update User"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* User Actions Modal */}
      {showUserActionsModal && selectedUserForActions && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
          <div className="w-full max-w-lg bg-white rounded-lg">
            <div className="flex items-center justify-between p-6 border-b">
              <h3 className="text-xl font-bold text-gray-800">
                Deactivate / Enable / Delete User
              </h3>
              <button
                onClick={() => setShowUserActionsModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <FaTimes />
              </button>
            </div>

            <div className="p-6">
              <div className="mb-6 text-center">
                <div className="flex justify-center mb-3">
                  {selectedUserForActions.image_url ? (
                    <img
                      src={selectedUserForActions.image_url}
                      alt={selectedUserForActions.full_name}
                      className="object-cover w-16 h-16 rounded-full"
                    />
                  ) : (
                    <div className="flex items-center justify-center w-16 h-16 text-xl font-bold text-white bg-blue-500 rounded-full">
                      {selectedUserForActions.full_name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .toUpperCase()}
                    </div>
                  )}
                </div>
                <h4 className="text-lg font-bold text-gray-800">
                  {selectedUserForActions.full_name}
                </h4>
                <p className="text-sm text-gray-500">
                  {selectedUserForActions.email}
                </p>
              </div>

              <div className="p-3 mb-6 rounded-lg bg-gray-50">
                <p className="text-sm text-gray-600">
                  Current Status:{" "}
                  <span
                    className={`font-semibold ${selectedUserForActions.status === "Active" ? "text-green-600" : "text-red-600"}`}
                  >
                    {selectedUserForActions.status}
                  </span>
                </p>
              </div>

              <div className="mb-6">
                <label className="block mb-3 text-sm font-medium text-gray-700">
                  Select duration to disable the account or enable it:
                </label>
                <div className="space-y-2">
                  {[
                    {
                      value: "now",
                      label: "Enable Now",
                      icon: <FaCheck className="text-green-600" />,
                      highlight: selectedUserForActions.status === "Inactive",
                    },
                    { value: "1day", label: "1 Day" },
                    { value: "3days", label: "3 Days" },
                    { value: "7days", label: "7 Days" },
                    { value: "3weeks", label: "3 Weeks" },
                    { value: "1month", label: "1 Month" },
                    { value: "1year", label: "1 Year" },
                  ].map((option) => (
                    <label
                      key={option.value}
                      className={`flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50 ${
                        deactivateDuration === option.value
                          ? "border-blue-500 bg-blue-50"
                          : "border-gray-200"
                      } ${option.highlight ? "border-green-500 bg-green-50" : ""}`}
                    >
                      <input
                        type="radio"
                        name="duration"
                        value={option.value}
                        checked={deactivateDuration === option.value}
                        onChange={(e) => setDeactivateDuration(e.target.value)}
                        className="w-4 h-4 text-blue-600"
                      />
                      <span className="flex items-center gap-2 ml-3 text-sm font-medium text-gray-700">
                        {option.icon}
                        {option.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowUserActionsModal(false)}
                  className="flex-1 px-4 py-2.5 bg-gray-500 text-white rounded-lg hover:bg-gray-600 font-semibold"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleUserAction("delete")}
                  className="flex-1 px-4 py-2.5 bg-white text-red-600 border-2 border-red-600 rounded-lg hover:bg-red-50 font-semibold"
                >
                  Delete Account
                </button>
                <button
                  onClick={() =>
                    handleUserAction(
                      deactivateDuration === "now" &&
                        selectedUserForActions.status === "Inactive"
                        ? "enable"
                        : "deactivate",
                    )
                  }
                  className={`flex-1 px-4 py-2.5 rounded-lg font-semibold ${
                    deactivateDuration === "now" &&
                    selectedUserForActions.status === "Inactive"
                      ? "bg-green-600 text-white hover:bg-green-700"
                      : "bg-red-400 text-white hover:bg-red-500"
                  }`}
                >
                  {deactivateDuration === "now" &&
                  selectedUserForActions.status === "Inactive"
                    ? "Enable"
                    : "Deactivate"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default UserManagement;
