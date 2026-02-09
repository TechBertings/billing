import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import {
    FaReceipt,
    FaEye,
    FaDownload,
    FaPrint,
    FaCheckCircle,
    FaClock,
    FaTimes,
    FaSearch,
    FaFileAlt
} from 'react-icons/fa';

const AllReceipts = () => {
    const [receipts, setReceipts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedReceipt, setSelectedReceipt] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [error, setError] = useState(null);

    // Load receipts from Supabase
    useEffect(() => {
        fetchReceipts();
    }, []);

    const fetchReceipts = async () => {
        try {
            setLoading(true);
            setError(null);

            const { data, error: fetchError } = await supabase
                .from('receipts')
                .select('*')
                .order('created_at', { ascending: false });

            if (fetchError) throw fetchError;

            setReceipts(data || []);
        } catch (err) {
            console.error('Error fetching receipts:', err);
            setError(err.message);
            setReceipts([]);
        } finally {
            setLoading(false);
        }
    };

    // Filter receipts based on search
    const filteredReceipts = receipts.filter(receipt =>
        receipt.receipt_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        receipt.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        receipt.invoice_number?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Get status badge
    const getStatusBadge = (status) => {
        const badges = {
            issued: { bg: 'bg-green-100', text: 'text-green-800', icon: FaCheckCircle, label: 'Issued' },
            pending: { bg: 'bg-yellow-100', text: 'text-yellow-800', icon: FaClock, label: 'Pending' },
            cancelled: { bg: 'bg-red-100', text: 'text-red-800', icon: FaTimes, label: 'Cancelled' }
        };
        const badge = badges[status] || badges.issued;
        const BadgeIcon = badge.icon;
        
        return (
            <span className={`px-3 py-1 inline-flex items-center text-xs leading-5 font-semibold rounded-full ${badge.bg} ${badge.text}`}>
                <BadgeIcon className="mr-1" />
                {badge.label}
            </span>
        );
    };

    // View receipt details
    const viewReceipt = (receipt) => {
        setSelectedReceipt(receipt);
        setShowModal(true);
    };

    // Close modal
    const closeModal = () => {
        setShowModal(false);
        setSelectedReceipt(null);
    };

    // Calculate total amount
    const totalAmount = filteredReceipts.reduce((sum, receipt) => sum + (receipt.amount || 0), 0);

    return (
        <div className="p-6">
            <div className="mx-auto max-w-7xl">
                {/* Header */}
                <div className="p-6 mb-6 bg-white border border-gray-200 rounded-lg shadow-sm">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center space-x-4">
                            <div className="flex items-center justify-center shadow-lg w-14 h-14 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl">
                                <FaReceipt className="text-2xl text-white" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-gray-800">All Receipts</h1>
                                <p className="mt-1 text-sm text-gray-600">
                                    {filteredReceipts.length} {filteredReceipts.length === 1 ? 'receipt' : 'receipts'}
                                    {' • '}
                                    <span className="font-semibold">₱{totalAmount.toFixed(2)}</span>
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Search Bar */}
                    <div className="relative">
                        <FaSearch className="absolute text-gray-400 -translate-y-1/2 left-4 top-1/2" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Search by receipt #, customer name or invoice #..."
                            className="w-full py-3 pl-12 pr-4 border border-gray-300 rounded-lg focus:outline-none focus:border-gray-500 focus:ring-1 focus:ring-gray-500"
                        />
                    </div>
                </div>

                {/* Error Message */}
                {error && (
                    <div className="p-4 mb-6 border border-red-200 rounded-lg bg-red-50">
                        <p className="text-sm text-red-800">Error loading receipts: {error}</p>
                    </div>
                )}

                {/* Table */}
                <div className="overflow-hidden bg-white border border-gray-200 rounded-lg shadow-sm">
                    {loading ? (
                        <div className="p-12 text-center">
                            <div className="inline-block w-8 h-8 border-b-2 border-gray-800 rounded-full animate-spin"></div>
                            <p className="mt-4 text-gray-600">Loading receipts...</p>
                        </div>
                    ) : filteredReceipts.length === 0 ? (
                        <div className="p-12 text-center">
                            <FaReceipt className="mx-auto mb-4 text-5xl text-gray-300" />
                            <p className="text-lg text-gray-600">No receipts found</p>
                            <p className="mt-2 text-sm text-gray-500">
                                {searchTerm ? 'Try a different search term' : 'No receipts available yet'}
                            </p>
                        </div>
                    ) : (
                        <>
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="border-b border-gray-200 bg-gray-50">
                                        <tr>
                                            <th className="px-6 py-4 text-xs font-semibold tracking-wider text-left text-gray-700 uppercase">
                                                Receipt #
                                            </th>
                                            <th className="px-6 py-4 text-xs font-semibold tracking-wider text-left text-gray-700 uppercase">
                                                Invoice #
                                            </th>
                                            <th className="px-6 py-4 text-xs font-semibold tracking-wider text-left text-gray-700 uppercase">
                                                Customer
                                            </th>
                                            <th className="px-6 py-4 text-xs font-semibold tracking-wider text-left text-gray-700 uppercase">
                                                Date
                                            </th>
                                            <th className="px-6 py-4 text-xs font-semibold tracking-wider text-right text-gray-700 uppercase">
                                                Amount
                                            </th>
                                            <th className="px-6 py-4 text-xs font-semibold tracking-wider text-center text-gray-700 uppercase">
                                                Status
                                            </th>
                                            <th className="px-6 py-4 text-xs font-semibold tracking-wider text-center text-gray-700 uppercase">
                                                Actions
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200">
                                        {filteredReceipts.map((receipt) => (
                                            <tr key={receipt.id} className="transition-colors hover:bg-gray-50">
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="text-sm font-bold text-gray-900">
                                                        {receipt.receipt_number}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="text-sm text-gray-700">
                                                        {receipt.invoice_number}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="text-sm font-semibold text-gray-900">
                                                        {receipt.customer_name}
                                                    </div>
                                                    <div className="text-xs text-gray-500">
                                                        {receipt.customer_email}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="text-sm text-gray-700">
                                                        {new Date(receipt.receipt_date || receipt.created_at).toLocaleDateString()}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-right whitespace-nowrap">
                                                    <div className="text-sm font-bold text-gray-900">
                                                        ₱{receipt.amount.toFixed(2)}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-center whitespace-nowrap">
                                                    {getStatusBadge(receipt.status || 'issued')}
                                                </td>
                                                <td className="px-6 py-4 text-center whitespace-nowrap">
                                                    <div className="flex items-center justify-center space-x-2">
                                                        <button
                                                            onClick={() => viewReceipt(receipt)}
                                                            className="p-2 text-blue-600 transition-colors rounded-lg hover:bg-blue-50"
                                                            title="View"
                                                        >
                                                            <FaEye />
                                                        </button>
                                                        <button
                                                            className="p-2 text-green-600 transition-colors rounded-lg hover:bg-green-50"
                                                            title="Download"
                                                        >
                                                            <FaDownload />
                                                        </button>
                                                        <button
                                                            className="p-2 text-purple-600 transition-colors rounded-lg hover:bg-purple-50"
                                                            title="Print"
                                                        >
                                                            <FaPrint />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Results count */}
                            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
                                <p className="text-sm text-center text-gray-600">
                                    Showing {filteredReceipts.length} of {receipts.length} receipts
                                </p>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* View Modal */}
            {showModal && selectedReceipt && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
                    <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        {/* Modal Header */}
                        <div className="sticky top-0 flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200">
                            <div>
                                <h2 className="text-xl font-bold text-gray-800">Receipt Details</h2>
                                <p className="text-sm text-gray-600">{selectedReceipt.receipt_number}</p>
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
                            {/* Status Badge */}
                            <div className="flex justify-center">
                                {getStatusBadge(selectedReceipt.status || 'issued')}
                            </div>

                            {/* Receipt Info */}
                            <div className="p-4 space-y-3 rounded-lg bg-gray-50">
                                <div className="flex justify-between">
                                    <span className="text-sm text-gray-600">Receipt Number:</span>
                                    <span className="text-sm font-semibold">{selectedReceipt.receipt_number}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-sm text-gray-600">Invoice Number:</span>
                                    <span className="text-sm font-semibold">{selectedReceipt.invoice_number}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-sm text-gray-600">Date:</span>
                                    <span className="text-sm font-semibold">
                                        {new Date(selectedReceipt.receipt_date || selectedReceipt.created_at).toLocaleDateString()}
                                    </span>
                                </div>
                            </div>

                            {/* Customer Info */}
                            <div>
                                <h3 className="mb-3 text-sm font-semibold tracking-wider text-gray-500 uppercase">
                                    Customer Information
                                </h3>
                                <div className="p-4 space-y-2 rounded-lg bg-gray-50">
                                    <p className="text-sm"><span className="font-semibold">Name:</span> {selectedReceipt.customer_name}</p>
                                    <p className="text-sm"><span className="font-semibold">Email:</span> {selectedReceipt.customer_email}</p>
                                    {selectedReceipt.customer_phone && (
                                        <p className="text-sm"><span className="font-semibold">Phone:</span> {selectedReceipt.customer_phone}</p>
                                    )}
                                </div>
                            </div>

                            {/* Amount */}
                            <div className="p-4 rounded-lg bg-purple-50">
                                <div className="flex items-center justify-between">
                                    <span className="text-lg font-bold text-gray-700">Amount Received:</span>
                                    <span className="text-2xl font-bold text-purple-600">₱{selectedReceipt.amount.toFixed(2)}</span>
                                </div>
                            </div>

                            {/* Payment Method */}
                            {selectedReceipt.payment_method && (
                                <div className="p-4 rounded-lg bg-gray-50">
                                    <p className="text-sm"><span className="font-semibold">Payment Method:</span> {selectedReceipt.payment_method}</p>
                                </div>
                            )}

                            {/* Notes */}
                            {selectedReceipt.notes && (
                                <div>
                                    <h3 className="mb-2 text-sm font-semibold tracking-wider text-gray-500 uppercase">Notes</h3>
                                    <p className="p-3 text-sm text-gray-700 rounded-lg bg-gray-50">{selectedReceipt.notes}</p>
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="sticky bottom-0 flex px-6 py-4 space-x-3 bg-white border-t border-gray-200">
                            <button
                                className="flex items-center justify-center flex-1 px-6 py-3 font-semibold text-white transition-colors bg-purple-600 rounded-lg hover:bg-purple-700"
                            >
                                <FaPrint className="mr-2" />
                                Print
                            </button>
                            <button
                                onClick={closeModal}
                                className="flex-1 px-6 py-3 font-semibold text-gray-700 transition-colors border border-gray-300 rounded-lg hover:bg-gray-50"
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

export default AllReceipts;