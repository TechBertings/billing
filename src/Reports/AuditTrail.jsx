import React, { useState } from 'react';
import {
    FaUser,
    FaFileInvoice,
    FaMoneyBillWave,
    FaUserPlus,
    FaEdit,
    FaTrash,
    FaCog,
    FaSignInAlt,
    FaSignOutAlt,
    FaFilter,
    FaCalendarAlt,
    FaSearch,
    FaDownload,
    FaPrint,
    FaCheckCircle,
    FaTimesCircle,
    FaExclamationTriangle
} from 'react-icons/fa';

const AuditTrail = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [filterAction, setFilterAction] = useState('all');
    const [filterUser, setFilterUser] = useState('all');
    const [dateRange, setDateRange] = useState('all');

    // Hardcoded audit log data
    const auditLogs = [
        {
            id: 1,
            timestamp: '2024-02-09 14:30:25',
            user: 'Admin User',
            action: 'Created Invoice',
            module: 'Invoices',
            details: 'Created invoice INV-2024-005 for customer Juan dela Cruz',
            ipAddress: '192.168.1.100',
            status: 'Success',
            icon: <FaFileInvoice />
        },
        {
            id: 2,
            timestamp: '2024-02-09 14:15:10',
            user: 'Maria Santos',
            action: 'Payment Recorded',
            module: 'Payments',
            details: 'Recorded payment of ₱50,000.00 for invoice INV-2024-001',
            ipAddress: '192.168.1.105',
            status: 'Success',
            icon: <FaMoneyBillWave />
        },
        {
            id: 3,
            timestamp: '2024-02-09 13:45:33',
            user: 'Admin User',
            action: 'Customer Added',
            module: 'Customers',
            details: 'Added new customer: ABC Corporation',
            ipAddress: '192.168.1.100',
            status: 'Success',
            icon: <FaUserPlus />
        },
        {
            id: 4,
            timestamp: '2024-02-09 13:30:18',
            user: 'John Reyes',
            action: 'Updated Invoice',
            module: 'Invoices',
            details: 'Modified invoice INV-2024-003 - Changed due date',
            ipAddress: '192.168.1.102',
            status: 'Success',
            icon: <FaEdit />
        },
        {
            id: 5,
            timestamp: '2024-02-09 12:20:55',
            user: 'Admin User',
            action: 'Login',
            module: 'Authentication',
            details: 'User logged into the system',
            ipAddress: '192.168.1.100',
            status: 'Success',
            icon: <FaSignInAlt />
        },
        {
            id: 6,
            timestamp: '2024-02-09 11:45:22',
            user: 'Maria Santos',
            action: 'Failed Login',
            module: 'Authentication',
            details: 'Failed login attempt - Invalid password',
            ipAddress: '192.168.1.105',
            status: 'Failed',
            icon: <FaTimesCircle />
        },
        {
            id: 7,
            timestamp: '2024-02-09 11:30:40',
            user: 'John Reyes',
            action: 'Settings Changed',
            module: 'Settings',
            details: 'Updated company tax settings',
            ipAddress: '192.168.1.102',
            status: 'Success',
            icon: <FaCog />
        },
        {
            id: 8,
            timestamp: '2024-02-09 10:15:08',
            user: 'Admin User',
            action: 'Deleted Customer',
            module: 'Customers',
            details: 'Deleted customer: Old Company Ltd',
            ipAddress: '192.168.1.100',
            status: 'Warning',
            icon: <FaTrash />
        },
        {
            id: 9,
            timestamp: '2024-02-09 09:50:12',
            user: 'Maria Santos',
            action: 'Created Receipt',
            module: 'Receipts',
            details: 'Generated official receipt OR-2024-050',
            ipAddress: '192.168.1.105',
            status: 'Success',
            icon: <FaFileInvoice />
        },
        {
            id: 10,
            timestamp: '2024-02-09 09:20:45',
            user: 'John Reyes',
            action: 'Logout',
            module: 'Authentication',
            details: 'User logged out of the system',
            ipAddress: '192.168.1.102',
            status: 'Success',
            icon: <FaSignOutAlt />
        },
        {
            id: 11,
            timestamp: '2024-02-08 16:35:20',
            user: 'Admin User',
            action: 'Payment Voided',
            module: 'Payments',
            details: 'Voided payment PAY-2024-025 - Duplicate entry',
            ipAddress: '192.168.1.100',
            status: 'Warning',
            icon: <FaExclamationTriangle />
        },
        {
            id: 12,
            timestamp: '2024-02-08 15:10:33',
            user: 'Maria Santos',
            action: 'Updated Customer',
            module: 'Customers',
            details: 'Modified customer details for XYZ Corp',
            ipAddress: '192.168.1.105',
            status: 'Success',
            icon: <FaEdit />
        }
    ];

    // Filter logs
    const filteredLogs = auditLogs.filter(log => {
        const matchesSearch = log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            log.user.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            log.details.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesAction = filterAction === 'all' || log.module.toLowerCase() === filterAction.toLowerCase();
        const matchesUser = filterUser === 'all' || log.user === filterUser;
        
        return matchesSearch && matchesAction && matchesUser;
    });

    const getStatusColor = (status) => {
        switch (status.toLowerCase()) {
            case 'success':
                return 'bg-green-100 text-green-700 border-green-200';
            case 'failed':
                return 'bg-red-100 text-red-700 border-red-200';
            case 'warning':
                return 'bg-yellow-100 text-yellow-700 border-yellow-200';
            default:
                return 'bg-gray-100 text-gray-700 border-gray-200';
        }
    };

    const getStatusIcon = (status) => {
        switch (status.toLowerCase()) {
            case 'success':
                return <FaCheckCircle className="text-green-600" />;
            case 'failed':
                return <FaTimesCircle className="text-red-600" />;
            case 'warning':
                return <FaExclamationTriangle className="text-yellow-600" />;
            default:
                return null;
        }
    };

    const getActionColor = (module) => {
        switch (module.toLowerCase()) {
            case 'invoices':
                return 'bg-blue-100 text-blue-600';
            case 'payments':
                return 'bg-green-100 text-green-600';
            case 'customers':
                return 'bg-purple-100 text-purple-600';
            case 'authentication':
                return 'bg-orange-100 text-orange-600';
            case 'settings':
                return 'bg-gray-100 text-gray-600';
            case 'receipts':
                return 'bg-indigo-100 text-indigo-600';
            default:
                return 'bg-slate-100 text-slate-600';
        }
    };

    const uniqueUsers = [...new Set(auditLogs.map(log => log.user))];

    return (
        <div className="min-h-screen p-6 bg-gradient-to-br from-slate-50 to-slate-100">
            <div className="mx-auto max-w-7xl">
                {/* Header */}
                <div className="p-8 mb-6 bg-white shadow-lg rounded-2xl">
                    <div className="flex items-start justify-between mb-6">
                        <div>
                            <h1 className="mb-2 text-3xl font-bold text-slate-800">Audit Trail</h1>
                            <p className="text-slate-600">Track all system activities and user actions</p>
                        </div>
                        <div className="flex gap-3">
                            <button className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-md hover:shadow-lg">
                                <FaPrint className="text-sm" />
                                <span className="font-medium">Print</span>
                            </button>
                            <button className="flex items-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors shadow-md hover:shadow-lg">
                                <FaDownload className="text-sm" />
                                <span className="font-medium">Export</span>
                            </button>
                        </div>
                    </div>

                    {/* Summary Stats */}
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                        <div className="p-4 border border-blue-200 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl">
                            <div className="mb-1 text-sm font-medium text-blue-600">Total Activities</div>
                            <div className="text-2xl font-bold text-blue-700">{auditLogs.length}</div>
                        </div>
                        <div className="p-4 border border-green-200 bg-gradient-to-br from-green-50 to-green-100 rounded-xl">
                            <div className="mb-1 text-sm font-medium text-green-600">Successful</div>
                            <div className="text-2xl font-bold text-green-700">
                                {auditLogs.filter(log => log.status === 'Success').length}
                            </div>
                        </div>
                        <div className="p-4 border border-red-200 bg-gradient-to-br from-red-50 to-red-100 rounded-xl">
                            <div className="mb-1 text-sm font-medium text-red-600">Failed</div>
                            <div className="text-2xl font-bold text-red-700">
                                {auditLogs.filter(log => log.status === 'Failed').length}
                            </div>
                        </div>
                        <div className="p-4 border border-yellow-200 bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-xl">
                            <div className="mb-1 text-sm font-medium text-yellow-600">Warnings</div>
                            <div className="text-2xl font-bold text-yellow-700">
                                {auditLogs.filter(log => log.status === 'Warning').length}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Filters */}
                <div className="p-6 mb-6 bg-white shadow-lg rounded-2xl">
                    <h2 className="mb-4 text-lg font-semibold text-slate-800">Filters</h2>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                        <div className="relative">
                            <FaSearch className="absolute -translate-y-1/2 left-3 top-1/2 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search activities..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                            />
                        </div>

                        <div className="relative">
                            <FaFilter className="absolute -translate-y-1/2 pointer-events-none left-3 top-1/2 text-slate-400" />
                            <select
                                value={filterAction}
                                onChange={(e) => setFilterAction(e.target.value)}
                                className="w-full pl-10 pr-8 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none appearance-none bg-white cursor-pointer transition-all"
                            >
                                <option value="all">All Modules</option>
                                <option value="invoices">Invoices</option>
                                <option value="payments">Payments</option>
                                <option value="customers">Customers</option>
                                <option value="receipts">Receipts</option>
                                <option value="authentication">Authentication</option>
                                <option value="settings">Settings</option>
                            </select>
                        </div>

                        <div className="relative">
                            <FaUser className="absolute -translate-y-1/2 pointer-events-none left-3 top-1/2 text-slate-400" />
                            <select
                                value={filterUser}
                                onChange={(e) => setFilterUser(e.target.value)}
                                className="w-full pl-10 pr-8 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none appearance-none bg-white cursor-pointer transition-all"
                            >
                                <option value="all">All Users</option>
                                {uniqueUsers.map((user, index) => (
                                    <option key={index} value={user}>{user}</option>
                                ))}
                            </select>
                        </div>

                        <div className="relative">
                            <FaCalendarAlt className="absolute -translate-y-1/2 pointer-events-none left-3 top-1/2 text-slate-400" />
                            <select
                                value={dateRange}
                                onChange={(e) => setDateRange(e.target.value)}
                                className="w-full pl-10 pr-8 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none appearance-none bg-white cursor-pointer transition-all"
                            >
                                <option value="all">All Time</option>
                                <option value="today">Today</option>
                                <option value="week">This Week</option>
                                <option value="month">This Month</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Activity Log */}
                <div className="p-6 bg-white shadow-lg rounded-2xl">
                    <h2 className="mb-6 text-xl font-bold text-slate-800">Activity Log</h2>
                    
                    <div className="space-y-3">
                        {filteredLogs.map((log) => (
                            <div
                                key={log.id}
                                className="p-5 transition-all duration-200 border border-slate-200 rounded-xl hover:shadow-md hover:border-blue-300"
                            >
                                <div className="flex items-start gap-4">
                                    {/* Icon */}
                                    <div className={`flex items-center justify-center w-12 h-12 rounded-lg flex-shrink-0 ${getActionColor(log.module)}`}>
                                        <span className="text-xl">{log.icon}</span>
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between gap-4 mb-2">
                                            <div>
                                                <h3 className="mb-1 text-lg font-semibold text-slate-800">{log.action}</h3>
                                                <p className="text-sm text-slate-600">{log.details}</p>
                                            </div>
                                            <div className={`px-3 py-1.5 rounded-full text-xs font-semibold border flex items-center gap-1.5 whitespace-nowrap ${getStatusColor(log.status)}`}>
                                                {getStatusIcon(log.status)}
                                                {log.status}
                                            </div>
                                        </div>
                                        
                                        <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-slate-500">
                                            <div className="flex items-center gap-1.5">
                                                <FaUser className="text-slate-400" />
                                                <span className="font-medium">{log.user}</span>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <FaCalendarAlt className="text-slate-400" />
                                                <span>{log.timestamp}</span>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-slate-400">IP:</span>
                                                <span className="font-mono">{log.ipAddress}</span>
                                            </div>
                                            <div className={`px-2 py-1 rounded text-xs font-medium ${getActionColor(log.module)}`}>
                                                {log.module}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {filteredLogs.length === 0 && (
                        <div className="py-12 text-center">
                            <div className="mb-4 text-6xl text-slate-400">🔍</div>
                            <p className="text-lg text-slate-500">No activities found</p>
                            <p className="mt-2 text-sm text-slate-400">Try adjusting your filters</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AuditTrail;