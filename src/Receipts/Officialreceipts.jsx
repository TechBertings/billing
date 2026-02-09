import React, { useState, useEffect } from 'react';

import {
    FaFileAlt,
    FaEye,
    FaDownload,
    FaPrint,
    FaCheckCircle,
    FaTimes,
    FaSearch,
    FaStamp
} from 'react-icons/fa';
import { getFromLocalStorage } from '../utils/localStorage';

const OfficialReceipts = () => {
    const [receipts, setReceipts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedReceipt, setSelectedReceipt] = useState(null);
    const [showModal, setShowModal] = useState(false);

   // Load official receipts from localStorage
    useEffect(() => {
        const receiptsData = getFromLocalStorage('receipts') || {};
        
        // Filter only official receipts (you can add a flag 'isOfficial' in your data)
        const receiptsList = Object.keys(receiptsData)
            .map(key => ({
                id: key,
                ...receiptsData[key]
            }))
            .filter(receipt => receipt.isOfficial === true || receipt.type === 'official');

        receiptsList.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        setReceipts(receiptsList);
        setLoading(false);
    }, []);

    // Filter receipts based on search
    const filteredReceipts = receipts.filter(receipt =>
        receipt.receiptNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        receipt.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        receipt.orNumber?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Get status badge
    const getStatusBadge = (status) => {
        const badges = {
            issued: { bg: 'bg-green-100', text: 'text-green-800', icon: FaCheckCircle, label: 'Issued' },
            cancelled: { bg: 'bg-red-100', text: 'text-red-800', icon: FaTimes, label: 'Cancelled' },
            verified: { bg: 'bg-blue-100', text: 'text-blue-800', icon: FaStamp, label: 'Verified' }
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
                            <div className="flex items-center justify-center shadow-lg w-14 h-14 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-xl">
                                <FaFileAlt className="text-2xl text-white" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-gray-800">Official Receipts</h1>
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
                            placeholder="Search by receipt #, OR #, or customer name..."
                            className="w-full py-3 pl-12 pr-4 border border-gray-300 rounded-lg focus:outline-none focus:border-gray-500 focus:ring-1 focus:ring-gray-500"
                        />
                    </div>
                </div>

                {/* Table */}
                <div className="overflow-hidden bg-white border border-gray-200 rounded-lg shadow-sm">
                    {loading ? (
                        <div className="p-12 text-center">
                            <div className="inline-block w-8 h-8 border-b-2 border-gray-800 rounded-full animate-spin"></div>
                            <p className="mt-4 text-gray-600">Loading official receipts...</p>
                        </div>
                    ) : filteredReceipts.length === 0 ? (
                        <div className="p-12 text-center">
                            <FaFileAlt className="mx-auto mb-4 text-5xl text-gray-300" />
                            <p className="text-lg text-gray-600">No official receipts found</p>
                            <p className="mt-2 text-sm text-gray-500">
                                {searchTerm ? 'Try a different search term' : 'No official receipts available yet'}
                            </p>
                        </div>
                    ) : (
                        <>
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="border-b border-gray-200 bg-gray-50">
                                        <tr>
                                            <th className="px-6 py-4 text-xs font-semibold tracking-wider text-left text-gray-700 uppercase">
                                                OR Number
                                            </th>
                                            <th className="px-6 py-4 text-xs font-semibold tracking-wider text-left text-gray-700 uppercase">
                                                Receipt #
                                            </th>
                                            <th className="px-6 py-4 text-xs font-semibold tracking-wider text-left text-gray-700 uppercase">
                                                Customer
                                            </th>
                                            <th className="px-6 py-4 text-xs font-semibold tracking-wider text-left text-gray-700 uppercase">
                                                Date Issued
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
                                                    <div className="text-sm font-bold text-indigo-600">
                                                        {receipt.orNumber || receipt.receiptNumber}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="text-sm text-gray-700">
                                                        {receipt.receiptNumber}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="text-sm font-semibold text-gray-900">
                                                        {receipt.customerName}
                                                    </div>
                                                    <div className="text-xs text-gray-500">
                                                        {receipt.customerEmail}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="text-sm text-gray-700">
                                                        {new Date(receipt.receiptDate || receipt.createdAt).toLocaleDateString()}
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
                                    Showing {filteredReceipts.length} of {receipts.length} official receipts
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
                                <h2 className="text-xl font-bold text-gray-800">Official Receipt</h2>
                                <p className="text-sm text-gray-600">{selectedReceipt.orNumber || selectedReceipt.receiptNumber}</p>
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

                            {/* Official Receipt Info */}
                            <div className="p-4 space-y-3 border-2 border-indigo-200 rounded-lg bg-indigo-50">
                                <div className="flex items-center justify-center mb-2">
                                    <FaStamp className="text-2xl text-indigo-600" />
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-sm text-gray-600">OR Number:</span>
                                    <span className="text-sm font-bold text-indigo-600">{selectedReceipt.orNumber || selectedReceipt.receiptNumber}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-sm text-gray-600">Receipt Number:</span>
                                    <span className="text-sm font-semibold">{selectedReceipt.receiptNumber}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-sm text-gray-600">Date Issued:</span>
                                    <span className="text-sm font-semibold">
                                        {new Date(selectedReceipt.receiptDate || selectedReceipt.createdAt).toLocaleDateString()}
                                    </span>
                                </div>
                            </div>

                            {/* Customer Info */}
                            <div>
                                <h3 className="mb-3 text-sm font-semibold tracking-wider text-gray-500 uppercase">
                                    Received From
                                </h3>
                                <div className="p-4 space-y-2 rounded-lg bg-gray-50">
                                    <p className="text-sm"><span className="font-semibold">Name:</span> {selectedReceipt.customerName}</p>
                                    <p className="text-sm"><span className="font-semibold">Email:</span> {selectedReceipt.customerEmail}</p>
                                    {selectedReceipt.customerPhone && (
                                        <p className="text-sm"><span className="font-semibold">Phone:</span> {selectedReceipt.customerPhone}</p>
                                    )}
                                    {selectedReceipt.customerAddress && (
                                        <p className="text-sm"><span className="font-semibold">Address:</span> {selectedReceipt.customerAddress}</p>
                                    )}
                                </div>
                            </div>

                            {/* Amount */}
                            <div className="p-4 border-2 border-indigo-200 rounded-lg bg-indigo-50">
                                <div className="text-center">
                                    <p className="mb-1 text-sm text-gray-600">Amount Received</p>
                                    <p className="text-3xl font-bold text-indigo-600">₱{selectedReceipt.amount.toFixed(2)}</p>
                                </div>
                            </div>

                            {/* Payment Details */}
                            {selectedReceipt.paymentMethod && (
                                <div className="p-4 space-y-2 rounded-lg bg-gray-50">
                                    <p className="text-sm"><span className="font-semibold">Payment Method:</span> {selectedReceipt.paymentMethod}</p>
                                    {selectedReceipt.invoiceNumber && (
                                        <p className="text-sm"><span className="font-semibold">Invoice Reference:</span> {selectedReceipt.invoiceNumber}</p>
                                    )}
                                </div>
                            )}

                            {/* Notes */}
                            {selectedReceipt.notes && (
                                <div>
                                    <h3 className="mb-2 text-sm font-semibold tracking-wider text-gray-500 uppercase">Notes</h3>
                                    <p className="p-3 text-sm text-gray-700 rounded-lg bg-gray-50">{selectedReceipt.notes}</p>
                                </div>
                            )}

                            {/* Official Stamp */}
                            <div className="text-xs italic text-center text-gray-500">
                                This is an official receipt issued by the company
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="sticky bottom-0 flex px-6 py-4 space-x-3 bg-white border-t border-gray-200">
                            <button
                                className="flex items-center justify-center flex-1 px-6 py-3 font-semibold text-white transition-colors bg-indigo-600 rounded-lg hover:bg-indigo-700"
                            >
                                <FaPrint className="mr-2" />
                                Print OR
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

export default OfficialReceipts;