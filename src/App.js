import React, { useState, useEffect } from 'react';
import { FaChartLine, FaFileInvoiceDollar, FaUsers, FaMoneyBillWave, FaClock, FaLock } from 'react-icons/fa';
import Login from './page/LogIn';
import Header from './Components/Header';
import Sidebar from './Components/Sidebar';
import CreateInvoice from './Invoices/CreateInvoice';
import CreateCustomer from './Customer/Createcustomer';
import CustomerList from './Customer/Customerlist';
import CustomerGroups from './Customer/CustomerGroups';
import AllInvoices from './Invoices/AllInvoices';
import Status from './Invoices/InvoicesByStatus';
import PaidInvoices from './Invoices/Paidinvoices ';
import OverdueInvoices from './Invoices/Overdueinvoices';
import DraftInvoices from './Invoices/Draftinvoices';
import AllReceipts from './Receipts/Allreceipts';
import GenerateReceipt from './Receipts/Generatereceipt';
import OfficialReceipts from './Receipts/Officialreceipts';
import CustomerReport from './Reports/CustomerReports';
import AuditTrail from './Reports/AuditTrail';
import Maintenance from './page/SystemSettings/Maintenance';
import UserManagement from './page/SystemSettings/UserManagement';
import { canAccessPage, loadPermissionsForRole, clearPermissionsCache } from './Maintenance/RolePermission';
import ClientProfile from './page/ClientManagement/ClientProfile';
import ClientProfileList from './page/ClientManagement/ClientProfileList';
import ClientApproval from './page/Approval/ClientProfileApproval';

function App() {
  // Initialize state from localStorage
  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    const saved = localStorage.getItem('isLoggedIn');
    return saved === 'true';
  });
  
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem('currentUser');
    return saved ? JSON.parse(saved) : null;
  });
  
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    const saved = localStorage.getItem('sidebarOpen');
    return saved !== null ? saved === 'true' : true;
  });
  
  const [currentPage, setCurrentPage] = useState(() => {
    const saved = localStorage.getItem('currentPage');
    return saved || 'dashboard';
  });

  // Persist state to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('isLoggedIn', isLoggedIn);
  }, [isLoggedIn]);

  useEffect(() => {
    localStorage.setItem('currentUser', JSON.stringify(currentUser));
  }, [currentUser]);

  useEffect(() => {
    localStorage.setItem('sidebarOpen', sidebarOpen);
  }, [sidebarOpen]);

  useEffect(() => {
    localStorage.setItem('currentPage', currentPage);
  }, [currentPage]);

 const handleLogin = async (userData) => {
  setIsLoggedIn(true);
  setCurrentUser(userData);
  await loadPermissionsForRole(userData.role); // ← idagdag ito
  setCurrentPage('dashboard');
};

  const handleLogout = () => {
    clearPermissionsCache();
    setIsLoggedIn(false);
    setCurrentUser(null);
    setCurrentPage('login');
    // Clear localStorage on logout
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('currentUser');
    localStorage.removeItem('currentPage');
  };

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const handleNavigation = (page) => {
    // If navigating to login and already logged in, log out first
    if (page === 'login' && isLoggedIn) {
      handleLogout();
    } else if (page === 'login' && !isLoggedIn) {
      setCurrentPage('login');
      setIsLoggedIn(false);
    } else {
      // Check if user has permission to access this page
      if (currentUser && !canAccessPage(currentUser.role, page)) {
        alert('You do not have permission to access this page.');
        return;
      }
      setCurrentPage(page);
    }
  };

  // Access Denied Component
  const AccessDenied = () => (
    <div className="px-6">
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="flex items-center justify-center w-24 h-24 mx-auto mb-6 text-red-600 bg-red-100 rounded-full">
            <FaLock className="text-4xl" />
          </div>
          <h2 className="mb-3 text-3xl font-bold text-gray-800">Access Denied</h2>
          <p className="mb-6 text-gray-600">
            You do not have permission to access this page.
          </p>
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

  // Dashboard Component
  const Dashboard = () => {
    const stats = [
      { icon: <FaChartLine />, label: 'Total Revenue', value: '₱1,234,567', change: '+12.5%', positive: true },
      { icon: <FaFileInvoiceDollar />, label: 'Invoices', value: '156', change: '+8.2%', positive: true },
      { icon: <FaUsers />, label: 'Customers', value: '89', change: '+5.1%', positive: true },
      { icon: <FaMoneyBillWave />, label: 'Pending Payments', value: '₱45,890', change: '-3.2%', positive: false },
    ];

    return (
      <div className="px-6 mx-auto max-w-7xl">
        {/* Welcome Section */}
        <div className="mb-6">
          <h2 className="mb-1 text-2xl font-semibold text-gray-800">
            Welcome back, {currentUser?.fullName || currentUser?.username}!
          </h2>
          <p className="text-sm text-gray-600">
            Here's what's happening with your business today.
            <span className="ml-2 text-xs text-gray-500">
              (Role: <span className="font-semibold text-blue-600">{currentUser?.role}</span>)
            </span>
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 gap-5 mb-6 md:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat, index) => (
            <div
              key={index}
              className="transition-all duration-200 bg-white border border-gray-100 rounded-lg shadow-sm hover:shadow-md"
            >
              <div className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center justify-center text-xl text-blue-600 rounded-lg w-11 h-11 bg-blue-50">
                    {stat.icon}
                  </div>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${stat.positive ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                    {stat.change}
                  </span>
                </div>
                <p className="mb-1 text-xs tracking-wide text-gray-500 uppercase">{stat.label}</p>
                <p className="text-2xl font-semibold text-gray-800">{stat.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Content Cards */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {/* Recent Activity */}
          <div className="p-5 bg-white border border-gray-100 rounded-lg shadow-sm">
            <h3 className="mb-4 text-lg font-semibold text-gray-800">Recent Activity</h3>
            <div className="space-y-3">
              {[1, 2, 3].map((item) => (
                <div key={item} className="flex items-center gap-3 p-3 transition-colors rounded-lg hover:bg-gray-50">
                  <div className="flex items-center justify-center text-sm font-semibold text-blue-600 bg-blue-100 rounded-full w-9 h-9">
                    {item}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-800">Invoice #{1000 + item} created</p>
                    <p className="text-xs text-gray-500">2 hours ago</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="p-5 bg-white border border-gray-100 rounded-lg shadow-sm">
            <h3 className="mb-4 text-lg font-semibold text-gray-800">Quick Actions</h3>
            <div className="grid grid-cols-2 gap-3">
              {canAccessPage(currentUser?.role, 'create-invoice') && (
                <button
                  onClick={() => handleNavigation('create-invoice')}
                  className="p-4 text-sm font-medium text-gray-700 transition-all duration-200 border border-gray-200 rounded-lg bg-gray-50 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600"
                >
                  New Invoice
                </button>
              )}
              {canAccessPage(currentUser?.role, 'customers-add') && (
                <button
                  onClick={() => handleNavigation('customers-add')}
                  className="p-4 text-sm font-medium text-gray-700 transition-all duration-200 border border-gray-200 rounded-lg bg-gray-50 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600"
                >
                  Add Customer
                </button>
              )}
              {canAccessPage(currentUser?.role, 'reports-sales') && (
                <button
                  onClick={() => handleNavigation('reports-sales')}
                  className="p-4 text-sm font-medium text-gray-700 transition-all duration-200 border border-gray-200 rounded-lg bg-gray-50 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600"
                >
                  View Reports
                </button>
              )}
              {canAccessPage(currentUser?.role, 'UserManagement') && (
                <button
                  onClick={() => handleNavigation('UserManagement')}
                  className="p-4 text-sm font-medium text-gray-700 transition-all duration-200 border border-gray-200 rounded-lg bg-gray-50 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600"
                >
                  Manage Users
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Render page content based on currentPage state
  const renderPage = () => {
    // If on login page, show login regardless of auth state
    if (currentPage === 'login') {
      return <Login onLogin={handleLogin} />;
    }

    // For all other pages, check if logged in
    if (!isLoggedIn) {
      return <Login onLogin={handleLogin} />;
    }

    // Check permission before rendering page
    if (!canAccessPage(currentUser?.role, currentPage)) {
      return <AccessDenied />;
    }

    switch (currentPage) {
      case 'dashboard':
        return <Dashboard />;

      case 'create-invoice':
        return <CreateInvoice />;
      case 'customers-add':
        return <CreateCustomer />;
      case 'customers-all':
        return <CustomerList />;
      case 'CustomerGroups':
        return <CustomerGroups />;

      case 'AllInvoices':
        return <AllInvoices />;
      case 'AllReceipts':
        return <AllReceipts />;

      case 'GenerateReceipt':
        return <GenerateReceipt />;
      case 'OfficialReceipts':
        return <OfficialReceipts />;

      case 'Maintenance':
        return <Maintenance />;

      // User Management Page (now in Settings)
      case 'UserManagement':
        return <UserManagement />;
        
      case 'ClientProfile':
        return <ClientProfile />;
      case 'ClientProfileList':
        return <ClientProfileList />;
      case 'ClientApproval':
        return <ClientApproval />;

      // Reports Pages
      case 'CustomerReport':
        return <CustomerReport />;

      case 'AuditTrail':
        return <AuditTrail />;

      // Invoice Status Pages
      case 'Status':
        return <Status
          statusFilter="pending"
          title="Pending Invoices"
          icon={FaClock}
          color="from-orange-500 to-amber-600"
        />;

      case 'invoices-paid':
        return <PaidInvoices />;

      case 'invoices-overdue':
        return <OverdueInvoices />;

      case 'invoices-draft':
        return <DraftInvoices />;

      case 'invoices-all':
        return (
          <div className="px-6">
            <h2 className="mb-4 text-2xl font-bold text-gray-800">All Invoices</h2>
            <div className="p-8 text-center bg-white border border-gray-100 rounded-lg shadow-sm">
              <p className="text-gray-600">All Invoices page - Coming soon!</p>
            </div>
          </div>
        );

      case 'invoices-pending':
        return (
          <div className="px-6">
            <h2 className="mb-4 text-2xl font-bold text-gray-800">Pending Invoices</h2>
            <div className="p-8 text-center bg-white border border-gray-100 rounded-lg shadow-sm">
              <p className="text-gray-600">Pending Invoices page - Coming soon!</p>
            </div>
          </div>
        );


      case 'reports-sales':
        return (
          <div className="px-6">
            <h2 className="mb-4 text-2xl font-bold text-gray-800">Sales Report</h2>
            <div className="p-8 text-center bg-white border border-gray-100 rounded-lg shadow-sm">
              <p className="text-gray-600">Sales Report page - Coming soon!</p>
            </div>
          </div>
        );

      case 'settings-general':
        return (
          <div className="px-6">
            <h2 className="mb-4 text-2xl font-bold text-gray-800">General Settings</h2>
            <div className="p-8 text-center bg-white border border-gray-100 rounded-lg shadow-sm">
              <p className="text-gray-600">General Settings page - Coming soon!</p>
            </div>
          </div>
        );

      // Add more cases for other pages as needed
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

  // If not logged in and not on login page, show login
  if (!isLoggedIn && currentPage !== 'login') {
    return <Login onLogin={handleLogin} />;
  }

  // If on login page, just show login component
  if (currentPage === 'login') {
    return <Login onLogin={handleLogin} />;
  }

  // Main app layout (when logged in)
  return (
    <div className="min-h-screen bg-gray-50">
      <Header toggleSidebar={toggleSidebar} currentUser={currentUser} onLogout={handleLogout} />
      <Sidebar
        isOpen={sidebarOpen}
        onNavigate={handleNavigation}
        currentPage={currentPage}
        currentUser={currentUser}
      />

      {/* Main Content */}
      <main
        className={`
          pt-20 pb-8 transition-all duration-300
          ${sidebarOpen ? 'ml-72' : 'ml-20'}
        `}
      >
        {renderPage()}
      </main>
    </div>
  );
}

export default App;