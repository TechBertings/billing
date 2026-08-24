import React, { useState } from "react";
import { ArrowLeft, HelpCircle, Building2, Home, Landmark } from "lucide-react";
import SecretQuestions        from "../../Maintenance/secret_question";
import RolePermissions        from "../../Maintenance/role_permission";
import UserRole               from "../../Maintenance/user_role";
import Status                 from "../../Maintenance/status";
import TaxType                from "../../Maintenance/tax_type";
import BusinessRegistration   from "../../Maintenance/business_registration";
import LineOfBusiness         from "../../Maintenance/line_of_business";
import SourceOfIncome         from "../../Maintenance/source_of_income";
import TaxPayerClassification from "../../Maintenance/tax_payer_classification";
import VatType                from "../../Maintenance/vat_type";
import SalaryBracket          from "../../Maintenance/salary_bracket";
import Account                from "../../Maintenance/account";
import BatchBilling            from "../../Maintenance/batch_billing"; 
import Period                 from "../../Maintenance/period";
import RentFees                from "../../Maintenance/rent_fees";
import ContributionRates       from "../../Maintenance/contribution_rates"; // ← new
import TaxSetup                from "../../Maintenance/tax_setup";  
import SSSContributionRates from "../../Maintenance/sss_table_setup"; // ← new

const Maintenance = () => {
  const [selectedModule, setSelectedModule] = useState(null);
  const [selectedRole,   setSelectedRole]   = useState(null);
  const [sortBy,         setSortBy]         = useState("all");

  const modules = [
    { id: "secret-questions",        name: "Secret Questions",          description: "Manage security questions for user accounts",     icon: HelpCircle },
    { id: "UserRole",                name: "User Role",                 description: "Manage your user's roles",                        icon: HelpCircle },
    { id: "Status",                  name: "Status",                    description: "Manage your user's status",                       icon: HelpCircle },
    { id: "TaxType",                 name: "Tax Type",                  description: "Manage tax types",                                icon: HelpCircle },
    { id: "BusinessRegistration",    name: "Business Registration",     description: "Manage business registration types",              icon: HelpCircle },
    { id: "LineOfBusiness",          name: "Line of Business",          description: "Manage lines of business",                        icon: HelpCircle },
    { id: "SourceOfIncome",          name: "Source of Income",          description: "Manage income sources",                           icon: HelpCircle },
    { id: "TaxPayerClassification",  name: "Tax Payer Classification",  description: "Manage tax payer classifications",                icon: HelpCircle },
    { id: "VatType",                 name: "VAT Type",                  description: "Manage VAT types",                                icon: HelpCircle },
    { id: "SalaryBracket",           name: "Salary Bracket",            description: "Manage salary brackets",                          icon: HelpCircle },
    { id: "Account",                 name: "Account",                   description: "Manage user accounts",                            icon: HelpCircle },
    { id: "BatchBilling",            name: "BatchBilling",              description: "Manage agencies used in Chart of Accounts tabs",  icon: Building2  }, 
    { id: "Period",                  name: "Period",                    description: "Date period",                                      icon: Building2 },
    { id: "RentFees",                name: "Rent Fees",                 description: "Manage rental term schedules (Net of VAT, VAT, WTAX per year)", icon: Home },
    { id: "ContributionRates",       name: "Contribution Rates",        description: "Manage SSS, PhilHealth, and Pag-IBIG rate schedules", icon: Landmark }, // ← new
    { id: "TaxSetup",                name: "Tax Setup",                 description: "Manage per-client tax rates and amounts",         icon: Landmark },
    { id: "SSSContributionRates",    name: "SSS Bracket Table",         description: "Manage the SSS fixed peso-per-bracket EE contribution table", icon: Landmark }, // ← new
  ];

  const filteredModules = sortBy === "all" ? modules : modules.filter(m => m.id === sortBy);

  const handleManagePermissions = (role) => { setSelectedRole(role); setSelectedModule("RolePermissions"); };
  const handleBackToRoles       = ()     => { setSelectedRole(null); setSelectedModule("UserRole"); };

  const renderModule = () => {
    switch (selectedModule) {
      case "secret-questions":       return <SecretQuestions />;
      case "RolePermissions":        return <RolePermissions selectedRole={selectedRole} onClose={handleBackToRoles} />;
      case "UserRole":               return <UserRole onManagePermissions={handleManagePermissions} />;
      case "Status":                 return <Status />;
      case "TaxType":                return <TaxType />;
      case "BusinessRegistration":   return <BusinessRegistration />;
      case "LineOfBusiness":         return <LineOfBusiness />;
      case "SourceOfIncome":         return <SourceOfIncome />;
      case "TaxPayerClassification": return <TaxPayerClassification />;
      case "VatType":                return <VatType />;
      case "SalaryBracket":          return <SalaryBracket />;
      case "Account":                return <Account />;
      case "BatchBilling":           return <BatchBilling />;  
      case "Period":                 return <Period />;
      case "RentFees":               return <RentFees />;
      case "ContributionRates":
  return (
    <ContributionRates
      onNavigateToSSS={() => setSelectedModule("SSSContributionRates")}
    />
  );
      case "TaxSetup":               return <TaxSetup />;
      case "SSSContributionRates":   return <SSSContributionRates />; // ← new
      default:                       return null;
    }
  };

  return (
    <div className="min-h-screen px-8 py-10 bg-gray-50">
      {selectedModule ? (
        <div className="max-w-6xl mx-auto">
          <button
            onClick={() => { setSelectedModule(null); setSelectedRole(null); }}
            className="flex items-center gap-2 px-4 py-2 mb-8 text-sm font-semibold text-teal-700 transition-all bg-white border border-teal-100 rounded-lg hover:bg-teal-50">
            <ArrowLeft size={16} />
            Back to Maintenance Modules
          </button>
          {renderModule()}
        </div>
      ) : (
        <div className="max-w-6xl mx-auto">
          <div className="flex items-start justify-between mb-8">
            <div>
              <h1 className="text-3xl font-black tracking-tight text-slate-800">Maintenance Modules</h1>
              <p className="mt-1 text-sm font-medium text-slate-500">Manage and configure your system modules</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold text-slate-500">Sort by:</span>
              <select value={sortBy} onChange={e => setSortBy(e.target.value)}
                className="px-4 py-2 text-sm font-semibold transition-all bg-white border rounded-lg cursor-pointer border-slate-200 text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-200 focus:border-teal-300">
                <option value="all">All Modules</option>
                {modules.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {filteredModules.map(module => {
              const Icon = module.icon;
              return (
                <div key={module.id} onClick={() => setSelectedModule(module.id)}
                  className="flex flex-col items-center p-8 text-center transition-all duration-200 bg-white border cursor-pointer border-slate-200 rounded-2xl hover:border-teal-200 hover:shadow-md hover:-translate-y-1 group">
                  <div className="flex items-center justify-center w-16 h-16 mb-5 transition-colors rounded-2xl bg-teal-50 group-hover:bg-teal-100">
                    <Icon size={28} className="text-teal-600" />
                  </div>
                  <h3 className="mb-2 text-xs font-black tracking-widest uppercase text-slate-800">{module.name}</h3>
                  <p className="text-xs font-medium leading-relaxed text-slate-400">{module.description}</p>
                </div>
              );
            })}
          </div>

          <div className="px-6 py-4 mt-8 text-center bg-white border border-slate-200 rounded-2xl">
            <span className="text-sm font-semibold text-emerald-600">
              {modules.length} module{modules.length !== 1 ? 's' : ''} available for configuration
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default Maintenance;