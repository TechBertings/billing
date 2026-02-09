import React, { useState } from 'react';
import { 
    FaUser, 
    FaEnvelope, 
    FaPhone, 
    FaMapMarkerAlt, 
    FaCalendarAlt,
    FaFileInvoice,
    FaPrint,
    FaDownload,
    FaSearch,
    FaFilter
} from 'react-icons/fa';

const CustomerReport = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');

    // Hardcoded customer data
    const customerInfo = {
        id: 'CUST-001',
        name: 'Juan dela Cruz',
        email: 'juan.delacruz@email.com',
        phone: '+63 912 345 6789',
        address: '123 Rizal Street, Quezon City, Metro Manila',
        tin: '123-456-789-000',
        accountSince: 'January 15, 2024'
    };

    // Hardcoded transactions
    const transactions = [
        {
            id: 'INV-2024-001',
            date: '2024-02-01',
            description: 'Website Development Services',
            type: 'Invoice',
            amount: 50000,
            paid: 50000,
            balance: 0,
            status: 'Paid',
            dueDate: '2024-02-15'
        },
        {
            id: 'INV-2024-002',
            date: '2024-02-05',
            description: 'Monthly Maintenance Fee',
            type: 'Invoice',
            amount: 15000,
            paid: 15000,
            balance: 0,
            status: 'Paid',
            dueDate: '2024-02-20'
        },
        {
            id: 'INV-2024-003',
            date: '2024-02-10',
            description: 'Custom Module Development',
            type: 'Invoice',
            amount: 75000,
            paid: 30000,
            balance: 45000,
            status: 'Partial',
            dueDate: '2024-02-25'
        },
        {
            id: 'INV-2024-004',
            date: '2024-02-12',
            description: 'SEO Optimization Services',
            type: 'Invoice',
            amount: 20000,
            paid: 0,
            balance: 20000,
            status: 'Unpaid',
            dueDate: '2024-02-27'
        },
        {
            id: 'INV-2024-005',
            date: '2024-01-28',
            description: 'Mobile App Development',
            type: 'Invoice',
            amount: 100000,
            paid: 0,
            balance: 100000,
            status: 'Overdue',
            dueDate: '2024-02-08'
        }
    ];

    // Calculate summary
    const summary = {
        totalInvoiced: transactions.reduce((sum, t) => sum + t.amount, 0),
        totalPaid: transactions.reduce((sum, t) => sum + t.paid, 0),
        totalOutstanding: transactions.reduce((sum, t) => sum + t.balance, 0),
        overdueAmount: transactions.filter(t => t.status === 'Overdue').reduce((sum, t) => sum + t.balance, 0)
    };

    // Filter transactions
    const filteredTransactions = transactions.filter(transaction => {
        const matchesSearch = transaction.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            transaction.id.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesFilter = filterStatus === 'all' || transaction.status.toLowerCase() === filterStatus.toLowerCase();
        return matchesSearch && matchesFilter;
    });

    const getStatusColor = (status) => {
        switch (status.toLowerCase()) {
            case 'paid':
                return 'bg-green-100 text-green-700 border-green-200';
            case 'partial':
                return 'bg-yellow-100 text-yellow-700 border-yellow-200';
            case 'unpaid':
                return 'bg-blue-100 text-blue-700 border-blue-200';
            case 'overdue':
                return 'bg-red-100 text-red-700 border-red-200';
            default:
                return 'bg-gray-100 text-gray-700 border-gray-200';
        }
    };

    const formatCurrency = (amount) => {
        return `₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    return (
        <div className="min-h-screen p-6 bg-gradient-to-br from-slate-50 to-slate-100">
            <div className="mx-auto max-w-7xl">
                {/* Header */}
                <div className="p-8 mb-6 bg-white shadow-lg rounded-2xl">
                    <div className="flex items-start justify-between mb-6">
                        <div>
                            <h1 className="mb-2 text-3xl font-bold text-slate-800">Statement of Account</h1>
                            <p className="text-slate-600">Generated on {new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
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

                    {/* Customer Information */}
                    <div className="grid grid-cols-1 gap-6 p-6 border border-blue-100 md:grid-cols-2 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl">
                        <div>
                            <h2 className="flex items-center gap-2 mb-4 text-lg font-semibold text-slate-800">
                                <FaUser className="text-blue-600" />
                                Customer Information
                            </h2>
                            <div className="space-y-3">
                                <div className="flex items-start gap-3">
                                    <div className="w-32 font-medium text-slate-600">Customer ID:</div>
                                    <div className="font-semibold text-slate-800">{customerInfo.id}</div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <div className="w-32 font-medium text-slate-600">Name:</div>
                                    <div className="font-semibold text-slate-800">{customerInfo.name}</div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <FaEnvelope className="mt-1 text-slate-400" />
                                    <div className="text-slate-700">{customerInfo.email}</div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <FaPhone className="mt-1 text-slate-400" />
                                    <div className="text-slate-700">{customerInfo.phone}</div>
                                </div>
                            </div>
                        </div>
                        <div>
                            <h2 className="flex items-center gap-2 mb-4 text-lg font-semibold text-slate-800">
                                <FaMapMarkerAlt className="text-blue-600" />
                                Additional Details
                            </h2>
                            <div className="space-y-3">
                                <div className="flex items-start gap-3">
                                    <div className="w-32 font-medium text-slate-600">Address:</div>
                                    <div className="text-slate-700">{customerInfo.address}</div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <div className="w-32 font-medium text-slate-600">TIN:</div>
                                    <div className="text-slate-700">{customerInfo.tin}</div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <FaCalendarAlt className="mt-1 text-slate-400" />
                                    <div className="text-slate-700">Customer since {customerInfo.accountSince}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-1 gap-4 mb-6 md:grid-cols-2 lg:grid-cols-4">
                    <div className="p-6 bg-white border-l-4 border-blue-500 shadow-md rounded-xl">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-sm font-medium text-slate-600">Total Invoiced</h3>
                            <FaFileInvoice className="text-xl text-blue-500" />
                        </div>
                        <p className="text-2xl font-bold text-slate-800">{formatCurrency(summary.totalInvoiced)}</p>
                    </div>
                    <div className="p-6 bg-white border-l-4 border-green-500 shadow-md rounded-xl">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-sm font-medium text-slate-600">Total Paid</h3>
                            <div className="text-2xl text-green-500">✓</div>
                        </div>
                        <p className="text-2xl font-bold text-green-600">{formatCurrency(summary.totalPaid)}</p>
                    </div>
                    <div className="p-6 bg-white border-l-4 border-orange-500 shadow-md rounded-xl">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-sm font-medium text-slate-600">Outstanding</h3>
                            <div className="text-2xl text-orange-500">⚠</div>
                        </div>
                        <p className="text-2xl font-bold text-orange-600">{formatCurrency(summary.totalOutstanding)}</p>
                    </div>
                    <div className="p-6 bg-white border-l-4 border-red-500 shadow-md rounded-xl">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-sm font-medium text-slate-600">Overdue</h3>
                            <div className="text-2xl text-red-500">⚡</div>
                        </div>
                        <p className="text-2xl font-bold text-red-600">{formatCurrency(summary.overdueAmount)}</p>
                    </div>
                </div>

                {/* Transaction List */}
                <div className="p-6 bg-white shadow-lg rounded-2xl">
                    <div className="flex flex-col items-start justify-between gap-4 mb-6 md:flex-row md:items-center">
                        <h2 className="text-xl font-bold text-slate-800">Transaction History</h2>
                        <div className="flex flex-col w-full gap-3 md:flex-row md:w-auto">
                            <div className="relative flex-1 md:flex-initial">
                                <FaSearch className="absolute -translate-y-1/2 left-3 top-1/2 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Search transactions..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full md:w-64 pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                                />
                            </div>
                            <div className="relative">
                                <FaFilter className="absolute -translate-y-1/2 pointer-events-none left-3 top-1/2 text-slate-400" />
                                <select
                                    value={filterStatus}
                                    onChange={(e) => setFilterStatus(e.target.value)}
                                    className="w-full md:w-auto pl-10 pr-8 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none appearance-none bg-white cursor-pointer transition-all"
                                >
                                    <option value="all">All Status</option>
                                    <option value="paid">Paid</option>
                                    <option value="partial">Partial</option>
                                    <option value="unpaid">Unpaid</option>
                                    <option value="overdue">Overdue</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Table */}
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="bg-gradient-to-r from-slate-50 to-slate-100 border-y border-slate-200">
                                    <th className="px-4 py-4 text-sm font-semibold text-left text-slate-700">Invoice #</th>
                                    <th className="px-4 py-4 text-sm font-semibold text-left text-slate-700">Date</th>
                                    <th className="px-4 py-4 text-sm font-semibold text-left text-slate-700">Description</th>
                                    <th className="px-4 py-4 text-sm font-semibold text-left text-slate-700">Due Date</th>
                                    <th className="px-4 py-4 text-sm font-semibold text-right text-slate-700">Amount</th>
                                    <th className="px-4 py-4 text-sm font-semibold text-right text-slate-700">Paid</th>
                                    <th className="px-4 py-4 text-sm font-semibold text-right text-slate-700">Balance</th>
                                    <th className="px-4 py-4 text-sm font-semibold text-center text-slate-700">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredTransactions.map((transaction, index) => (
                                    <tr key={index} className="transition-colors hover:bg-slate-50">
                                        <td className="px-4 py-4">
                                            <div className="font-semibold text-blue-600">{transaction.id}</div>
                                        </td>
                                        <td className="px-4 py-4 text-slate-700">
                                            {new Date(transaction.date).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })}
                                        </td>
                                        <td className="px-4 py-4 text-slate-700">{transaction.description}</td>
                                        <td className="px-4 py-4 text-slate-700">
                                            {new Date(transaction.dueDate).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })}
                                        </td>
                                        <td className="px-4 py-4 font-semibold text-right text-slate-800">
                                            {formatCurrency(transaction.amount)}
                                        </td>
                                        <td className="px-4 py-4 font-semibold text-right text-green-600">
                                            {formatCurrency(transaction.paid)}
                                        </td>
                                        <td className="px-4 py-4 font-semibold text-right text-orange-600">
                                            {formatCurrency(transaction.balance)}
                                        </td>
                                        <td className="px-4 py-4">
                                            <div className="flex justify-center">
                                                <span className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${getStatusColor(transaction.status)}`}>
                                                    {transaction.status}
                                                </span>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr className="border-t-2 bg-gradient-to-r from-slate-100 to-slate-50 border-slate-300">
                                    <td colSpan="4" className="px-4 py-4 font-bold text-right text-slate-800">TOTAL:</td>
                                    <td className="px-4 py-4 font-bold text-right text-slate-800">{formatCurrency(summary.totalInvoiced)}</td>
                                    <td className="px-4 py-4 font-bold text-right text-green-700">{formatCurrency(summary.totalPaid)}</td>
                                    <td className="px-4 py-4 font-bold text-right text-orange-700">{formatCurrency(summary.totalOutstanding)}</td>
                                    <td></td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>

                    {filteredTransactions.length === 0 && (
                        <div className="py-12 text-center">
                            <div className="mb-4 text-6xl text-slate-400">📄</div>
                            <p className="text-lg text-slate-500">No transactions found</p>
                        </div>
                    )}
                </div>

                {/* Footer Notes */}
                <div className="p-6 mt-6 bg-white shadow-md rounded-xl">
                    <h3 className="mb-3 font-semibold text-slate-800">Payment Terms & Notes:</h3>
                    <ul className="space-y-2 text-sm text-slate-600">
                        <li className="flex items-start gap-2">
                            <span className="mt-1 text-blue-500">•</span>
                            <span>Payment is due within 15 days of invoice date unless otherwise specified.</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="mt-1 text-blue-500">•</span>
                            <span>Late payments may incur additional charges as per our agreement.</span>
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="mt-1 text-blue-500">•</span>
                            <span>For any discrepancies, please contact us within 7 days of receiving this statement.</span>
                        </li>
                    </ul>
                </div>
            </div>
        </div>
    );
};

export default CustomerReport;