import React, { useState, useEffect } from 'react';
import { FaLock } from 'react-icons/fa';
import Login from './page/login';
import Header from './components/header';
import Sidebar from './components/sidebar';
import Maintenance from './page/SystemSettings/maintenance';
import UserManagement from './page/SystemSettings/user_management';
import { canAccessPage, loadPermissionsForRole, clearPermissionsCache } from './Maintenance/role_permission';
import ClientProfile from './page/ClientManagement/client_profile';
import ClientProfileList from './page/ClientManagement/client_profile_list';
import ClientApproval from './page/Approval/client_profile_approval';
import EmployeeProfile from './page/ClientManagement/employee_profile';
import BillingInformation from './page/ClientManagement/billing_information';
import CreateBilling from './page/AccountingManagement/create_billing';
import RecordPayment from './page/AccountingManagement/record_payment';
import StatementOfAccountSummary from './page/AccountingManagement/statement_of_account_summary';
import FinanceDashboard from './page/finance_dashboard';
import JobOrder from './page/ClientManagement/job_order';
import BankReconciliation from './page/AccountingManagement/bank_reconciliation';
import ChartOfAccounts from './page/AccountingManagement/chart_of_accounts';
import SOAApproval from './page/Approval/statement_of_account_approval';
import ARAgingReport from './page/Reports/aging_reports';
import FinancialReports from './page/Reports/financial_reports';
import TransmittalReport from './page/Reports/document_management_transmittal_report';
import ReceivablesList from './page/AccountingManagement/receivable_list';
import UndepositedFunds from './page/AccountingManagement/undeposited_funds';
import AuditTrail from './page/Reports/audit_trail';


// ── Roles allowed to approve & send SOAs ──
export const APPROVER_ROLES = ['Admin', 'Manager', 'Supervisor'];

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    const saved = localStorage.getItem('isLoggedIn');
    return saved === 'true';
  });

  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem('currentUser');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [sidebarOpen, setSidebarOpen] = useState(() => {
    const saved = localStorage.getItem('sidebarOpen');
    return saved !== null ? saved === 'true' : true;
  });

  const [currentPage, setCurrentPage] = useState(() => {
    const saved = localStorage.getItem('currentPage');
    return saved || 'dashboard';
  });
const [preselectedClient, setPreselectedClient] = useState(null);
const [preselectedBillingId, setPreselectedBillingId] = useState(null);

  useEffect(() => { localStorage.setItem('isLoggedIn', isLoggedIn); }, [isLoggedIn]);
  useEffect(() => { localStorage.setItem('currentUser', JSON.stringify(currentUser)); }, [currentUser]);
  useEffect(() => { localStorage.setItem('sidebarOpen', sidebarOpen); }, [sidebarOpen]);
  useEffect(() => { localStorage.setItem('currentPage', currentPage); }, [currentPage]);

  const handleLogin = async (userData) => {
    setIsLoggedIn(true);
    setCurrentUser(userData);
    await loadPermissionsForRole(userData.role);
    setCurrentPage('dashboard');
  };

  const handleLogout = () => {
    clearPermissionsCache();
    setIsLoggedIn(false);
    setCurrentUser(null);
    setCurrentPage('login');
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('currentUser');
    localStorage.removeItem('currentPage');
  };

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);

  const handleNavigation = (page) => {
    if (page === 'login' && isLoggedIn) {
      handleLogout();
    } else if (page === 'login' && !isLoggedIn) {
      setCurrentPage('login');
      setIsLoggedIn(false);
    } else {
      if (currentUser && !canAccessPage(currentUser.role, page)) {
        alert('You do not have permission to access this page.');
        return;
      }
      setCurrentPage(page);
    }
  };

  const AccessDenied = () => (
    <div className="px-6">
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="flex items-center justify-center w-24 h-24 mx-auto mb-6 text-red-600 bg-red-100 rounded-full">
            <FaLock className="text-4xl" />
          </div>
          <h2 className="mb-3 text-3xl font-bold text-gray-800">Access Denied</h2>
          <p className="mb-6 text-gray-600">You do not have permission to access this page.</p>
          <p className="mb-8 text-sm text-gray-500">
            Current role: <span className="font-semibold text-gray-700">{currentUser?.role}</span>
          </p>
          <button
            onClick={() => handleNavigation('dashboard')}
            className="px-6 py-3 text-white transition-colors bg-blue-500 rounded-lg hover:bg-blue-600"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    </div>
  );

  const renderPage = () => {
    if (currentPage === 'login') return <Login onLogin={handleLogin} />;
    if (!isLoggedIn) return <Login onLogin={handleLogin} />;
    if (!canAccessPage(currentUser?.role, currentPage)) return <AccessDenied />;

    switch (currentPage) {
      case 'dashboard':
        return <FinanceDashboard currentUser={currentUser} onNavigate={handleNavigation} />;

      case 'Maintenance':        return <Maintenance />;
      case 'UserManagement':     return <UserManagement />;
      case 'ClientProfile':      return <ClientProfile />;
      case 'ClientProfileList':  return <ClientProfileList />;
      case 'ClientApproval':     return <ClientApproval currentUser={currentUser} />;
      case 'SOAApproval':        return <SOAApproval currentUser={currentUser} />;
      case 'EmployeeProfile':    return <EmployeeProfile />;
      case 'BillingInformation': return <BillingInformation />;
      case 'StatementOfAccountSummary': return <StatementOfAccountSummary />;
      case 'ARAgingReport':      return <ARAgingReport />;
      case 'FinancialReports':   return <FinancialReports />;
case 'TransmittalReport':
  return <TransmittalReport currentUser={currentUser} />;
  case 'AuditTrail':
  return <AuditTrail />;
      case 'ReceivablesList':
        return <ReceivablesList
          onSelectInvoice={(client, clientId, billingId) => {
            setPreselectedClient(client);
            setPreselectedBillingId(billingId);
            handleNavigation('RecordPayment');
          }}
        />;

           case 'RecordPayment':
            return <RecordPayment
              currentUser={currentUser}
              onClose={() => handleNavigation('ReceivablesList')}
              onSaved={() => {
                setPreselectedClient(null);
                setPreselectedBillingId(null);
              }}
              preselectedClient={preselectedClient}
              preselectedBillingId={preselectedBillingId}
            />;

      // ── Pass currentUser so CreateBilling knows the role ──
      case 'CreateBilling':
        return <CreateBilling currentUser={currentUser} onNavigate={handleNavigation} />;

      case 'JobOrder':           return <JobOrder />;
      case 'BankReconciliation': return <BankReconciliation />;
      case 'ChartOfAccounts':    return <ChartOfAccounts />;
            case 'UndepositedFunds':   return <UndepositedFunds currentUser={currentUser} />;

      default:
        return (
          <div className="px-6">
            <h2 className="mb-4 text-2xl font-bold text-gray-800">Page Not Found</h2>
            <div className="p-8 text-center bg-white border border-gray-100 rounded-lg shadow-sm">
              <p className="text-gray-600">This page is under construction.</p>
              <button
                onClick={() => handleNavigation('dashboard')}
                className="px-6 py-2 mt-4 text-white transition-colors bg-blue-500 rounded-lg hover:bg-blue-600"
              >
                Go to Dashboard
              </button>
            </div>
          </div>
        );
    }
  };

  if (!isLoggedIn && currentPage !== 'login') return <Login onLogin={handleLogin} />;
  if (currentPage === 'login') return <Login onLogin={handleLogin} />;

  return (
    <div className="min-h-screen bg-gray-50">
      <Header toggleSidebar={toggleSidebar} currentUser={currentUser} onLogout={handleLogout} />
      <Sidebar
        isOpen={sidebarOpen}
        onNavigate={handleNavigation}
        currentPage={currentPage}
        currentUser={currentUser}
      />
      <main className={`pt-20 pb-8 transition-all duration-300 ${sidebarOpen ? 'ml-72' : 'ml-20'}`}>
        {renderPage()}
      </main>
    </div>
  );
}

export default App;