import React, { useState } from "react";
import {
  ChevronRight,
  ShieldCheck, Briefcase, Receipt, Wallet,
  HelpCircle, UserCog, BadgeCheck,
  Percent, ClipboardList, Building2, Coins, Users, FileText, BookOpen,
  Layers, CalendarDays, Home, Calculator,
  Banknote, PiggyBank, Table,
} from "lucide-react";
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
import BatchBilling           from "../../Maintenance/batch_billing";
import Period                 from "../../Maintenance/period";
import RentFees               from "../../Maintenance/rent_fees";
import ContributionRates      from "../../Maintenance/contribution_rates";
import TaxSetup               from "../../Maintenance/tax_setup";
import SSSContributionRates   from "../../Maintenance/sss_table_setup";

const GROUPS = [
  { id: "access",  icon: ShieldCheck, label: "Users & Access",          description: "Roles, statuses and security questions" },
  { id: "client",  icon: Briefcase,   label: "Client Profile Setup",    description: "Tax, business and income classifications" },
  { id: "billing", icon: Receipt,     label: "Billing & Fees",          description: "Agencies, periods, rent fees and tax setup" },
  { id: "payroll", icon: Wallet,      label: "Payroll & Contributions", description: "Salary brackets and SSS, PhilHealth, Pag-IBIG rates" },
];

const MODULES = [
  // Users & Access
  { id: "secret-questions", group: "access", icon: HelpCircle, name: "Secret Questions", description: "Manage security questions for user accounts" },
  { id: "UserRole",         group: "access", icon: UserCog,    name: "User Role",        description: "Manage your user's roles" },
  { id: "Status",           group: "access", icon: BadgeCheck, name: "Status",           description: "Manage your user's status" },

  // Client Profile Setup
  { id: "TaxType",                group: "client", icon: Percent,       name: "Tax Type",                 description: "Manage tax types" },
  { id: "BusinessRegistration",   group: "client", icon: ClipboardList, name: "Business Registration",    description: "Manage business registration types" },
  { id: "LineOfBusiness",         group: "client", icon: Building2,     name: "Line of Business",         description: "Manage lines of business" },
  { id: "SourceOfIncome",         group: "client", icon: Coins,         name: "Source of Income",         description: "Manage income sources" },
  { id: "TaxPayerClassification", group: "client", icon: Users,         name: "Tax Payer Classification", description: "Manage tax payer classifications" },
  { id: "VatType",                group: "client", icon: FileText,      name: "VAT Type",                 description: "Manage VAT types" },
  { id: "Account",                group: "client", icon: BookOpen,      name: "Account",                  description: "Manage user accounts" },

  // Billing & Fees
  { id: "BatchBilling", group: "billing", icon: Layers,       name: "BatchBilling", description: "Manage agencies used in Chart of Accounts tabs" },
  { id: "Period",       group: "billing", icon: CalendarDays, name: "Period",       description: "Date period" },
  { id: "RentFees",     group: "billing", icon: Home,         name: "Rent Fees",    description: "Manage rental term schedules (Net of VAT, VAT, WTAX per year)" },
  { id: "TaxSetup",     group: "billing", icon: Calculator,   name: "Tax Setup",    description: "Manage per-client tax rates and amounts" },

  // Payroll & Contributions
  { id: "SalaryBracket",        group: "payroll", icon: Banknote,  name: "Salary Bracket",     description: "Manage salary brackets" },
  { id: "ContributionRates",    group: "payroll", icon: PiggyBank, name: "Contribution Rates", description: "Manage PhilHealth, and Pag-IBIG rate schedules" },
  { id: "SSSContributionRates", group: "payroll", icon: Table,     name: "SSS Bracket Table",  description: "Manage the SSS fixed peso-per-bracket EE contribution table" },
];

const cardCls =
  "flex items-start gap-4 p-4 text-left transition bg-white border border-gray-200 rounded-lg hover:border-gray-400 hover:bg-gray-50";

// Simple black line icon, Windows-Settings style
const CardIcon = ({ icon: Icon, size = 26 }) => (
  <Icon size={size} strokeWidth={1.5} className="mt-0.5 text-black shrink-0" />
);

// Breadcrumb: items with onClick are links, the last one is plain text
const Crumbs = ({ items }) => (
  <nav className="flex flex-wrap items-center gap-2 mb-6 text-sm">
    {items.map((c, i) => (
      <React.Fragment key={i}>
        {i > 0 && <ChevronRight size={14} className="text-gray-300" />}
        {c.onClick ? (
          <button onClick={c.onClick} className="font-medium text-gray-600 hover:text-black hover:underline">
            {c.label}
          </button>
        ) : (
          <span className="font-medium text-gray-900">{c.label}</span>
        )}
      </React.Fragment>
    ))}
  </nav>
);

const Maintenance = () => {
  const [selectedGroup,  setSelectedGroup]  = useState(null);
  const [selectedModule, setSelectedModule] = useState(null);
  const [selectedRole,   setSelectedRole]   = useState(null);

  const goHome  = () => { setSelectedGroup(null); setSelectedModule(null); setSelectedRole(null); };
  const goGroup = () => { setSelectedModule(null); setSelectedRole(null); };

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
        return <ContributionRates onNavigateToSSS={() => setSelectedModule("SSSContributionRates")} />;
      case "TaxSetup":               return <TaxSetup />;
      case "SSSContributionRates":   return <SSSContributionRates />;
      default:                       return null;
    }
  };

  const group        = GROUPS.find((g) => g.id === selectedGroup);
  const groupModules = MODULES.filter((m) => m.group === selectedGroup);
  const moduleLabel  = MODULES.find((m) => m.id === selectedModule)?.name || "Role Permissions";

  return (
    <div className="min-h-screen px-8 py-10 bg-gray-50">
      <div className="max-w-6xl mx-auto">
        {/* STEP 3: a module is open */}
        {group && selectedModule && (
          <>
            <Crumbs
              items={[
                { label: "Maintenance", onClick: goHome },
                { label: group.label,   onClick: goGroup },
                { label: moduleLabel },
              ]}
            />
            {renderModule()}
          </>
        )}

        {/* STEP 2: a group is picked, show its modules */}
        {group && !selectedModule && (
          <>
            <Crumbs items={[{ label: "Maintenance", onClick: goHome }, { label: group.label }]} />
            <div className="flex items-center gap-3 mb-6">
              <CardIcon icon={group.icon} size={30} />
              <div>
                <h1 className="text-2xl font-bold text-gray-800">{group.label}</h1>
                <p className="mt-1 text-sm text-gray-500">{group.description}</p>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {groupModules.map((m) => (
                <button key={m.id} onClick={() => setSelectedModule(m.id)} className={cardCls}>
                  <CardIcon icon={m.icon} />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-800">{m.name}</p>
                    <p className="mt-1 text-xs leading-relaxed text-gray-500">{m.description}</p>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}

        {/* STEP 1: pick a group */}
        {!group && (
          <>
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-gray-800">Maintenance</h1>
              <p className="mt-1 text-sm text-gray-500">Choose a category to manage</p>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {GROUPS.map((g) => {
                const count = MODULES.filter((m) => m.group === g.id).length;
                return (
                  <button key={g.id} onClick={() => setSelectedGroup(g.id)} className={cardCls}>
                    <CardIcon icon={g.icon} size={30} />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-800">{g.label}</p>
                      <p className="mt-1 text-xs leading-relaxed text-gray-500">{g.description}</p>
                      <p className="mt-3 text-xs font-medium text-gray-400">
                        {count} module{count !== 1 ? "s" : ""}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Maintenance;