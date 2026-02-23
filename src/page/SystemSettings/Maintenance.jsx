import React, { useState } from "react";
import { ArrowLeft, HelpCircle } from "lucide-react";
import SecretQuestions from "../../Maintenance/SecretQuestion"
import RolePermissions from "../../Maintenance/RolePermission";
import UserRole from "../../Maintenance/UserRole";

const Maintenance = () => {
  const [selectedModule, setSelectedModule] = useState(null);
  const [selectedRole, setSelectedRole] = useState(null); // ✅ ADD THIS
  const [sortBy, setSortBy] = useState("all");

  const modules = [
    {
      id: "secret-questions",
      name: "Secret Questions",
      description: "Manage security questions for user accounts",
      icon: HelpCircle,
    },
    {
      id: "UserRole",
      name: "User Role",
      description: "Manage Your User's Role",
      icon: HelpCircle,
    },
    // Remove RolePermissions from modules list since it's now accessed via UserRole
  ];

  const filteredModules =
    sortBy === "all"
      ? modules
      : modules.filter((m) => m.id === sortBy);

  // ✅ ADD THIS FUNCTION
  const handleManagePermissions = (role) => {
    console.log('Managing permissions for role:', role); // Debug
    setSelectedRole(role);
    setSelectedModule("RolePermissions");
  };

  // ✅ ADD THIS FUNCTION
  const handleBackToRoles = () => {
    setSelectedRole(null);
    setSelectedModule("UserRole");
  };

  const renderModule = () => {
    switch (selectedModule) {
      case "secret-questions":
        return <SecretQuestions />;
      case "RolePermissions":
        return (
          <RolePermissions 
            selectedRole={selectedRole} 
            onClose={handleBackToRoles} 
          />
        );
      case "UserRole":
        return <UserRole onManagePermissions={handleManagePermissions} />; // ✅ PASS THE PROP
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen px-8 py-10 bg-gray-50">
      {selectedModule ? (
        /* ── Module View ── */
        <div className="max-w-6xl mx-auto">
          <button
            onClick={() => {
              setSelectedModule(null);
              setSelectedRole(null); // ✅ CLEAR SELECTED ROLE
            }}
            className="flex items-center gap-2 px-4 py-2 mb-8 text-sm font-semibold text-blue-600 transition-all bg-white border border-blue-100 rounded-lg hover:bg-blue-50"
          >
            <ArrowLeft size={16} />
            Back to Maintenance Modules
          </button>
          {renderModule()}
        </div>
      ) : (
        /* ── Grid View ── */
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="flex items-start justify-between mb-8">
            <div>
              <h1 className="text-3xl font-black tracking-tight text-slate-800">
                Maintenance Modules
              </h1>
              <p className="mt-1 text-sm font-medium text-slate-500">
                Manage and configure your system modules
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold text-slate-500">Sort by:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-4 py-2 text-sm font-semibold transition-all bg-white border rounded-lg cursor-pointer border-slate-200 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-300"
              >
                <option value="all">All Modules</option>
                {modules.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Card Grid */}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {filteredModules.map((module) => {
              const Icon = module.icon;
              return (
                <div
                  key={module.id}
                  onClick={() => setSelectedModule(module.id)}
                  className="flex flex-col items-center p-8 text-center transition-all duration-200 bg-white border cursor-pointer border-slate-200 rounded-2xl hover:border-blue-200 hover:shadow-md hover:-translate-y-1 group"
                >
                  <div className="flex items-center justify-center w-16 h-16 mb-5 transition-colors rounded-2xl bg-blue-50 group-hover:bg-blue-100">
                    <Icon size={28} className="text-blue-500" />
                  </div>
                  <h3 className="mb-2 text-xs font-black tracking-widest uppercase text-slate-800">
                    {module.name}
                  </h3>
                  <p className="text-xs font-medium leading-relaxed text-slate-400">
                    {module.description}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Footer count */}
          <div className="px-6 py-4 mt-8 text-center bg-white border border-slate-200 rounded-2xl">
            <span className="text-sm font-semibold text-blue-500">
              {modules.length} module{modules.length !== 1 ? "s" : ""} available for configuration
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default Maintenance;