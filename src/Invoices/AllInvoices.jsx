import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import {
    FaFileInvoice,
    FaEye,
    FaEdit,
    FaTrash,
    FaSearch,
    FaFilter,
    FaClock,
    FaCheckCircle,
    FaExclamationTriangle,
    FaFileAlt,
    FaTimes,
    FaMoneyBillWave
} from 'react-icons/fa';

const AllInvoices = () => {
    const [invoices, setInvoices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [filterPayment, setFilterPayment] = useState('all');
    const [selectedInvoice, setSelectedInvoice] = useState(null);
    const [showModal, setShowModal] = useState(false);

    // Load invoices from Supabase with customer info
    useEffect(() => {
        fetchInvoices();
    }, []);

    const fetchInvoices = async () => {
        try {
            setLoading(true);
            setError(null);

            // Fetch invoices with customer details joined
            const { data, error: fetchError } = await supabase
                .from('invoices')
                .select(`
                    id,
                    invoice_number,
                    invoice_date,
                    due_date,
                    subtotal,
                    tax_amount,
                    discount_amount,
                    total_amount,
                    status,
                    payment_status,
                    notes,
                    terms_conditions,
                    created_at,
                    customers (
                        id,
                        full_name,
                        email,
                        phone,
                        address,
                        city
                    )
                `)
                .order('created_at', { ascending: false });

            if (fetchError) throw fetchError;

            // Fetch invoice items for each invoice
            const invoicesWithItems = await Promise.all(
                (data || []).map(async (invoice) => {
                    const { data: itemsData, error: itemsError } = await supabase
                        .from('invoice_items')
                        .select(`
                            id,
                            quantity,
                            unit_price,
                            tax_rate,
                            line_total,
                            products (
                                product_name,
                                description
                            )
                        `)
                        .eq('invoice_id', invoice.id);

                    if (itemsError) console.error('Error fetching items:', itemsError);

                    return {
                        ...invoice,
                        items: itemsData || []
                    };
                })
            );

            setInvoices(invoicesWithItems);
        } catch (err) {
            console.error('Error fetching invoices:', err);
            setError(err.message);
            setInvoices([]);
        } finally {
            setLoading(false);
        }
    };

    // Filter invoices
    const filteredInvoices = invoices.filter(invoice => {
        const matchesSearch =
            invoice.invoice_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            invoice.customers?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            invoice.customers?.email?.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesStatus = filterStatus === 'all' || invoice.status === filterStatus;
        const matchesPayment = filterPayment === 'all' || invoice.payment_status === filterPayment;

        return matchesSearch && matchesStatus && matchesPayment;
    });

    // Get status badge
    const getStatusBadge = (status) => {
        const badges = {
            draft: { bg: 'bg-gray-100', text: 'text-gray-800', icon: FaFileAlt, label: 'Draft' },
            sent: { bg: 'bg-blue-100', text: 'text-blue-800', icon: FaClock, label: 'Sent' },
            paid: { bg: 'bg-green-100', text: 'text-green-800', icon: FaCheckCircle, label: 'Paid' },
            partially_paid: { bg: 'bg-yellow-100', text: 'text-yellow-800', icon: FaClock, label: 'Partial' },
            overdue: { bg: 'bg-red-100', text: 'text-red-800', icon: FaExclamationTriangle, label: 'Overdue' },
            cancelled: { bg: 'bg-gray-100', text: 'text-gray-800', icon: FaTimes, label: 'Cancelled' }
        };
        const badge = badges[status] || badges.draft;
        const Icon = badge.icon;

        return (
            <span className={`px-3 py-1 inline-flex items-center text-xs leading-5 font-semibold rounded-full ${badge.bg} ${badge.text}`}>
                <Icon className="mr-1" />
                {badge.label}
            </span>
        );
    };

    // Get payment badge
    const getPaymentBadge = (status) => {
        const badges = {
            unpaid: { bg: 'bg-orange-100', text: 'text-orange-800', label: 'Unpaid' },
            partially_paid: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Partial' },
            paid: { bg: 'bg-green-100', text: 'text-green-800', label: 'Paid' }
        };
        const badge = badges[status] || badges.unpaid;

        return (
            <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${badge.bg} ${badge.text}`}>
                {badge.label}
            </span>
        );
    };

    // View invoice details
    const viewInvoice = (invoice) => {
        setSelectedInvoice(invoice);
        setShowModal(true);
    };

    // Close modal
    const closeModal = () => {
        setShowModal(false);
        setSelectedInvoice(null);
    };

    // Get summary stats
    const stats = {
        total: invoices.length,
        draft: invoices.filter(i => i.status === 'draft').length,
        sent: invoices.filter(i => i.status === 'sent').length,
        paid: invoices.filter(i => i.status === 'paid').length,
        overdue: invoices.filter(i => i.status === 'overdue').length,
        totalAmount: invoices.reduce((sum, i) => sum + (i.total_amount || 0), 0),
        unpaidAmount: invoices.filter(i => i.payment_status === 'unpaid').reduce((sum, i) => sum + (i.total_amount || 0), 0)
    };

    return (
        <div className="p-6">
            <div className="mx-auto max-w-7xl">
                {/* Header with Stats */}
                <div className="p-6 mb-6 bg-white border border-gray-200 rounded-lg shadow-sm">
                    <h1 className="mb-6 text-2xl font-bold text-gray-800">All Invoices</h1>

                    {/* Error Message */}
                    {error && (
                        <div className="p-4 mb-6 border border-red-200 rounded-lg bg-red-50">
                            <p className="text-sm text-red-800">Error loading invoices: {error}</p>
                        </div>
                    )}

                    {/* Stats Grid */}
                    <div className="grid grid-cols-1 gap-4 mb-6 md:grid-cols-4">
                        <div className="p-4 border border-blue-200 rounded-lg bg-gradient-to-br from-blue-50 to-blue-100">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-semibold text-blue-600">Total Invoices</p>
                                    <p className="text-3xl font-bold text-blue-900">{stats.total}</p>
                                </div>
                                <FaFileInvoice className="text-3xl text-blue-400" />
                            </div>
                        </div>

                        <div className="p-4 border border-green-200 rounded-lg bg-gradient-to-br from-green-50 to-green-100">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-semibold text-green-600">Total Amount</p>
                                    <p className="text-2xl font-bold text-green-900">₱{stats.totalAmount.toFixed(2)}</p>
                                </div>
                                <FaMoneyBillWave className="text-3xl text-green-400" />
                            </div>
                        </div>

                        <div className="p-4 border border-orange-200 rounded-lg bg-gradient-to-br from-orange-50 to-orange-100">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-semibold text-orange-600">Unpaid</p>
                                    <p className="text-2xl font-bold text-orange-900">₱{stats.unpaidAmount.toFixed(2)}</p>
                                </div>
                                <FaExclamationTriangle className="text-3xl text-orange-400" />
                            </div>
                        </div>

                        <div className="p-4 border border-purple-200 rounded-lg bg-gradient-to-br from-purple-50 to-purple-100">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-semibold text-purple-600">Paid</p>
                                    <p className="text-3xl font-bold text-purple-900">{stats.paid}</p>
                                </div>
                                <FaCheckCircle className="text-3xl text-purple-400" />
                            </div>
                        </div>
                    </div>

                    {/* Search and Filters */}
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                        <div className="relative">
                            <FaSearch className="absolute text-gray-400 -translate-y-1/2 left-4 top-1/2" />
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Search by invoice #, customer..."
                                className="w-full py-3 pl-12 pr-4 border border-gray-300 rounded-lg focus:outline-none focus:border-gray-500 focus:ring-1 focus:ring-gray-500"
                            />
                        </div>

                        <div className="relative">
                            <FaFilter className="absolute text-gray-400 -translate-y-1/2 left-4 top-1/2" />
                            <select
                                value={filterStatus}
                                onChange={(e) => setFilterStatus(e.target.value)}
                                className="w-full py-3 pl-12 pr-4 border border-gray-300 rounded-lg focus:outline-none focus:border-gray-500 focus:ring-1 focus:ring-gray-500"
                            >
                                <option value="all">All Status</option>
                                <option value="draft">Draft</option>
                                <option value="sent">Sent</option>
                                <option value="paid">Paid</option>
                                <option value="partially_paid">Partially Paid</option>
                                <option value="overdue">Overdue</option>
                                <option value="cancelled">Cancelled</option>
                            </select>
                        </div>

                        <div className="relative">
                            <FaFilter className="absolute text-gray-400 -translate-y-1/2 left-4 top-1/2" />
                            <select
                                value={filterPayment}
                                onChange={(e) => setFilterPayment(e.target.value)}
                                className="w-full py-3 pl-12 pr-4 border border-gray-300 rounded-lg focus:outline-none focus:border-gray-500 focus:ring-1 focus:ring-gray-500"
                            >
                                <option value="all">All Payment Status</option>
                                <option value="unpaid">Unpaid</option>
                                <option value="partially_paid">Partial</option>
                                <option value="paid">Paid</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Table */}
                <div className="overflow-hidden bg-white border border-gray-200 rounded-lg shadow-sm">
                    {loading ? (
                        <div className="p-12 text-center">
                            <div className="inline-block w-8 h-8 border-b-2 border-gray-800 rounded-full animate-spin"></div>
                            <p className="mt-4 text-gray-600">Loading invoices...</p>
                        </div>
                    ) : filteredInvoices.length === 0 ? (
                        <div className="p-12 text-center">
                            <FaFileInvoice className="mx-auto mb-4 text-5xl text-gray-300" />
                            <p className="text-lg text-gray-600">No invoices found</p>
                            <p className="mt-2 text-sm text-gray-500">
                                {searchTerm || filterStatus !== 'all' || filterPayment !== 'all'
                                    ? 'Try adjusting your filters'
                                    : 'Start by creating a new invoice'}
                            </p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="border-b border-gray-200 bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-4 text-xs font-semibold tracking-wider text-left text-gray-700 uppercase">
                                            Invoice #
                                        </th>
                                        <th className="px-6 py-4 text-xs font-semibold tracking-wider text-left text-gray-700 uppercase">
                                            Customer
                                        </th>
                                        <th className="px-6 py-4 text-xs font-semibold tracking-wider text-left text-gray-700 uppercase">
                                            Date
                                        </th>
                                        <th className="px-6 py-4 text-xs font-semibold tracking-wider text-left text-gray-700 uppercase">
                                            Due Date
                                        </th>
                                        <th className="px-6 py-4 text-xs font-semibold tracking-wider text-right text-gray-700 uppercase">
                                            Amount
                                        </th>
                                        <th className="px-6 py-4 text-xs font-semibold tracking-wider text-center text-gray-700 uppercase">
                                            Status
                                        </th>
                                        <th className="px-6 py-4 text-xs font-semibold tracking-wider text-center text-gray-700 uppercase">
                                            Payment
                                        </th>
                                        <th className="px-6 py-4 text-xs font-semibold tracking-wider text-center text-gray-700 uppercase">
                                            Action
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                    {filteredInvoices.map((invoice) => (
                                        <tr key={invoice.id} className="transition-colors hover:bg-gray-50">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm font-bold text-gray-900">
                                                    {invoice.invoice_number}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm font-semibold text-gray-900">
                                                    {invoice.customers?.full_name}
                                                </div>
                                                <div className="text-xs text-gray-500">
                                                    {invoice.customers?.email}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm text-gray-700">
                                                    {new Date(invoice.invoice_date).toLocaleDateString()}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm text-gray-700">
                                                    {invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : '-'}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right whitespace-nowrap">
                                                <div className="text-sm font-bold text-gray-900">
                                                    ₱{invoice.total_amount.toFixed(2)}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-center whitespace-nowrap">
                                                {getStatusBadge(invoice.status)}
                                            </td>
                                            <td className="px-6 py-4 text-center whitespace-nowrap">
                                                {getPaymentBadge(invoice.payment_status)}
                                            </td>
                                            <td className="px-6 py-4 text-center whitespace-nowrap">
                                                <button
                                                    onClick={() => viewInvoice(invoice)}
                                                    className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 transition-colors bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                                                >
                                                    <FaEye className="mr-2" />
                                                    View
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Results count */}
                {!loading && filteredInvoices.length > 0 && (
                    <div className="mt-4 text-sm text-center text-gray-600">
                        Showing {filteredInvoices.length} of {invoices.length} invoices
                    </div>
                )}
            </div>

            {/* View Modal */}
            {showModal && selectedInvoice && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
                    <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                        {/* Modal Header */}
                        <div className="sticky top-0 flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200">
                            <div>
                                <h2 className="text-xl font-bold text-gray-800">Invoice Details</h2>
                                <p className="text-sm text-gray-600">{selectedInvoice.invoice_number}</p>
                            </div>
                            <button
                                onClick={closeModal}
                                className="p-2 transition-colors rounded-lg hover:bg-gray-100"
                            >
                                <FaTimes className="text-gray-600" />
                            </button>
                        </div>

                        {/* Modal Content */}
                        <div className="p-6 space-y-6">
                            {/* Status Badges */}
                            <div className="flex space-x-3">
                                {getStatusBadge(selectedInvoice.status)}
                                {getPaymentBadge(selectedInvoice.payment_status)}
                            </div>

                            {/* Invoice Info */}
                            <div className="p-4 space-y-2 rounded-lg bg-gray-50">
                                <div className="flex justify-between">
                                    <span className="text-sm text-gray-600">Invoice Date:</span>
                                    <span className="text-sm font-semibold">{new Date(selectedInvoice.invoice_date).toLocaleDateString()}</span>
                                </div>
                                {selectedInvoice.due_date && (
                                    <div className="flex justify-between">
                                        <span className="text-sm text-gray-600">Due Date:</span>
                                        <span className="text-sm font-semibold">{new Date(selectedInvoice.due_date).toLocaleDateString()}</span>
                                    </div>
                                )}
                            </div>

                            {/* Customer Info */}
                            <div>
                                <h3 className="mb-4 text-sm font-semibold tracking-wider text-gray-500 uppercase">
                                    Customer Information
                                </h3>
                                <div className="p-4 space-y-2 rounded-lg bg-gray-50">
                                    <p className="text-sm"><span className="font-semibold">Name:</span> {selectedInvoice.customers?.full_name}</p>
                                    <p className="text-sm"><span className="font-semibold">Email:</span> {selectedInvoice.customers?.email}</p>
                                    <p className="text-sm"><span className="font-semibold">Phone:</span> {selectedInvoice.customers?.phone}</p>
                                    {selectedInvoice.customers?.address && (
                                        <p className="text-sm"><span className="font-semibold">Address:</span> {selectedInvoice.customers?.address}</p>
                                    )}
                                </div>
                            </div>

                            {/* Invoice Items */}
                            <div>
                                <h3 className="mb-4 text-sm font-semibold tracking-wider text-gray-500 uppercase">
                                    Invoice Items
                                </h3>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="px-4 py-2 font-semibold text-left">Description</th>
                                                <th className="px-4 py-2 font-semibold text-center">Qty</th>
                                                <th className="px-4 py-2 font-semibold text-right">Price</th>
                                                <th className="px-4 py-2 font-semibold text-center">Tax%</th>
                                                <th className="px-4 py-2 font-semibold text-right">Amount</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-200">
                                            {selectedInvoice.items.map((item, index) => (
                                                <tr key={index}>
                                                    <td className="px-4 py-2">
                                                        {item.products?.product_name || 'Product'}
                                                        <div className="text-xs text-gray-500">{item.products?.description}</div>
                                                    </td>
                                                    <td className="px-4 py-2 text-center">{item.quantity}</td>
                                                    <td className="px-4 py-2 text-right">₱{item.unit_price.toFixed(2)}</td>
                                                    <td className="px-4 py-2 text-center">{item.tax_rate}%</td>
                                                    <td className="px-4 py-2 font-semibold text-right">₱{item.line_total.toFixed(2)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Totals */}
                            <div className="p-4 rounded-lg bg-gray-50">
                                <div className="space-y-2">
                                    <div className="flex justify-between">
                                        <span className="text-sm text-gray-600">Subtotal:</span>
                                        <span className="text-sm font-semibold">₱{selectedInvoice.subtotal.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-sm text-gray-600">Discount:</span>
                                        <span className="text-sm font-semibold text-red-600">-₱{selectedInvoice.discount_amount.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-sm text-gray-600">Tax:</span>
                                        <span className="text-sm font-semibold">₱{selectedInvoice.tax_amount.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between pt-2 border-t border-gray-300">
                                        <span className="text-lg font-bold">Grand Total:</span>
                                        <span className="text-lg font-bold text-blue-600">₱{selectedInvoice.total_amount.toFixed(2)}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Notes & Terms */}
                            {(selectedInvoice.notes || selectedInvoice.terms_conditions) && (
                                <div className="space-y-4">
                                    {selectedInvoice.notes && (
                                        <div>
                                            <h3 className="mb-2 text-sm font-semibold tracking-wider text-gray-500 uppercase">Notes</h3>
                                            <p className="p-3 text-sm text-gray-700 rounded-lg bg-gray-50">{selectedInvoice.notes}</p>
                                        </div>
                                    )}
                                    {selectedInvoice.terms_conditions && (
                                        <div>
                                            <h3 className="mb-2 text-sm font-semibold tracking-wider text-gray-500 uppercase">Terms & Conditions</h3>
                                            <p className="p-3 text-sm text-gray-700 rounded-lg bg-gray-50">{selectedInvoice.terms_conditions}</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="sticky bottom-0 px-6 py-4 bg-white border-t border-gray-200">
                            <button
                                onClick={closeModal}
                                className="w-full px-6 py-3 font-semibold text-gray-700 transition-colors border border-gray-300 rounded-lg hover:bg-gray-50"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AllInvoices;