import React, { useState, useEffect } from 'react';

import { FaReceipt, FaSave, FaTimes, FaSearch } from 'react-icons/fa';
import { getFromLocalStorage, saveToLocalStorage, generateId } from '../utils/localStorage';

const GenerateReceipt = () => {
    const [formData, setFormData] = useState({
        receiptNumber: '',
        invoiceNumber: '',
        customerName: '',
        customerEmail: '',
        customerPhone: '',
        amount: '',
        paymentMethod: 'Cash',
        receiptDate: new Date().toISOString().split('T')[0],
        notes: '',
        status: 'issued'
    });

    const [invoices, setInvoices] = useState([]);
    const [showInvoiceSearch, setShowInvoiceSearch] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [saving, setSaving] = useState(false);
    const [success, setSuccess] = useState(false);

        // Load invoices from localStorage

  useEffect(() => {
        const invoicesData = getFromLocalStorage('invoices') || {};
        const invoicesList = Object.keys(invoicesData)
            .map(key => ({
                id: key,
                ...invoicesData[key]
            }))
            .filter(inv => inv.paymentStatus !== 'paid'); // Only unpaid or partial
        setInvoices(invoicesList);
    }, []);

   useEffect(() => {
        const receiptsData = getFromLocalStorage('receipts') || {};
        const count = Object.keys(receiptsData).length;
        setFormData(prev => ({
            ...prev,
            receiptNumber: `REC-${String(count + 1).padStart(5, '0')}`
        }));
    }, []);

    // Filter invoices
    const filteredInvoices = invoices.filter(invoice =>
        invoice.invoiceNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        invoice.customerName?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Select invoice
    const selectInvoice = (invoice) => {
        setFormData(prev => ({
            ...prev,
            invoiceNumber: invoice.invoiceNumber,
            customerName: invoice.customerName,
            customerEmail: invoice.customerEmail,
            customerPhone: invoice.customerPhone,
            amount: invoice.grandTotal.toString()
        }));
        setShowInvoiceSearch(false);
        setSearchTerm('');
    };

    // Handle input change
    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

     // Handle submit
    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);

        try {
            const existingReceipts = getFromLocalStorage('receipts') || {};
            const receiptId = generateId();
            
            existingReceipts[receiptId] = {
                ...formData,
                id: receiptId,
                amount: parseFloat(formData.amount),
                createdAt: new Date().toISOString()
            };
            
            saveToLocalStorage('receipts', existingReceipts);

            setSuccess(true);
            setTimeout(() => {
                setSuccess(false);
                // Reset form
                const receiptsData = getFromLocalStorage('receipts') || {};
                const count = Object.keys(receiptsData).length;
                setFormData({
                    receiptNumber: `REC-${String(count + 1).padStart(5, '0')}`,
                    invoiceNumber: '',
                    customerName: '',
                    customerEmail: '',
                    customerPhone: '',
                    amount: '',
                    paymentMethod: 'Cash',
                    receiptDate: new Date().toISOString().split('T')[0],
                    notes: '',
                    status: 'issued'
                });
            }, 2000);
        } catch (error) {
            console.error('Error saving receipt:', error);
            alert('Failed to generate receipt. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="p-6">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="p-6 mb-6 bg-white border border-gray-200 rounded-lg shadow-sm">
                    <div className="flex items-center space-x-4">
                        <div className="flex items-center justify-center shadow-lg w-14 h-14 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl">
                            <FaReceipt className="text-2xl text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-800">Generate Receipt</h1>
                            <p className="mt-1 text-sm text-gray-600">Create a new receipt for payment received</p>
                        </div>
                    </div>
                </div>

                {/* Success Message */}
                {success && (
                    <div className="flex items-center p-4 mb-6 border border-green-200 rounded-lg bg-green-50">
                        <div className="mr-3 text-green-600">
                            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                        </div>
                        <p className="font-semibold text-green-800">Receipt generated successfully!</p>
                    </div>
                )}

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 bg-white border border-gray-200 rounded-lg shadow-sm">
                    <div className="space-y-6">
                        {/* Receipt Number & Date */}
                        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                            <div>
                                <label className="block mb-2 text-sm font-semibold text-gray-700">
                                    Receipt Number
                                </label>
                                <input
                                    type="text"
                                    name="receiptNumber"
                                    value={formData.receiptNumber}
                                    readOnly
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-50"
                                />
                            </div>
                            <div>
                                <label className="block mb-2 text-sm font-semibold text-gray-700">
                                    Receipt Date
                                </label>
                                <input
                                    type="date"
                                    name="receiptDate"
                                    value={formData.receiptDate}
                                    onChange={handleChange}
                                    required
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                                />
                            </div>
                        </div>

                        {/* Invoice Selection */}
                        <div>
                            <label className="block mb-2 text-sm font-semibold text-gray-700">
                                Invoice Number
                            </label>
                            <div className="relative">
                                <input
                                    type="text"
                                    name="invoiceNumber"
                                    value={formData.invoiceNumber}
                                    onChange={handleChange}
                                    onFocus={() => setShowInvoiceSearch(true)}
                                    placeholder="Type or select an invoice..."
                                    required
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowInvoiceSearch(!showInvoiceSearch)}
                                    className="absolute text-gray-400 -translate-y-1/2 right-3 top-1/2 hover:text-gray-600"
                                >
                                    <FaSearch />
                                </button>
                            </div>

                            {/* Invoice Search Dropdown */}
                            {showInvoiceSearch && (
                                <div className="absolute z-10 w-full max-w-md mt-2 overflow-y-auto bg-white border border-gray-300 rounded-lg shadow-lg max-h-64">
                                    <div className="p-3 border-b">
                                        <input
                                            type="text"
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            placeholder="Search invoices..."
                                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
                                        />
                                    </div>
                                    <div className="overflow-y-auto max-h-48">
                                        {filteredInvoices.map((invoice) => (
                                            <div
                                                key={invoice.id}
                                                onClick={() => selectInvoice(invoice)}
                                                className="p-3 border-b border-gray-100 cursor-pointer hover:bg-gray-50"
                                            >
                                                <div className="flex justify-between">
                                                    <span className="text-sm font-semibold">{invoice.invoiceNumber}</span>
                                                    <span className="text-sm font-semibold text-purple-600">₱{invoice.grandTotal.toFixed(2)}</span>
                                                </div>
                                                <p className="text-xs text-gray-600">{invoice.customerName}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Customer Information */}
                        <div className="space-y-4">
                            <h3 className="text-lg font-semibold text-gray-800">Customer Information</h3>
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                <div>
                                    <label className="block mb-2 text-sm font-semibold text-gray-700">
                                        Customer Name
                                    </label>
                                    <input
                                        type="text"
                                        name="customerName"
                                        value={formData.customerName}
                                        onChange={handleChange}
                                        required
                                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                                    />
                                </div>
                                <div>
                                    <label className="block mb-2 text-sm font-semibold text-gray-700">
                                        Email
                                    </label>
                                    <input
                                        type="email"
                                        name="customerEmail"
                                        value={formData.customerEmail}
                                        onChange={handleChange}
                                        required
                                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block mb-2 text-sm font-semibold text-gray-700">
                                    Phone Number
                                </label>
                                <input
                                    type="tel"
                                    name="customerPhone"
                                    value={formData.customerPhone}
                                    onChange={handleChange}
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                                />
                            </div>
                        </div>

                        {/* Payment Details */}
                        <div className="space-y-4">
                            <h3 className="text-lg font-semibold text-gray-800">Payment Details</h3>
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                <div>
                                    <label className="block mb-2 text-sm font-semibold text-gray-700">
                                        Amount Received
                                    </label>
                                    <div className="relative">
                                        <span className="absolute text-gray-500 -translate-y-1/2 left-4 top-1/2">₱</span>
                                        <input
                                            type="number"
                                            name="amount"
                                            value={formData.amount}
                                            onChange={handleChange}
                                            required
                                            step="0.01"
                                            className="w-full py-3 pl-8 pr-4 border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block mb-2 text-sm font-semibold text-gray-700">
                                        Payment Method
                                    </label>
                                    <select
                                        name="paymentMethod"
                                        value={formData.paymentMethod}
                                        onChange={handleChange}
                                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                                    >
                                        <option value="Cash">Cash</option>
                                        <option value="Credit Card">Credit Card</option>
                                        <option value="Debit Card">Debit Card</option>
                                        <option value="Bank Transfer">Bank Transfer</option>
                                        <option value="Check">Check</option>
                                        <option value="GCash">GCash</option>
                                        <option value="PayMaya">PayMaya</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Notes */}
                        <div>
                            <label className="block mb-2 text-sm font-semibold text-gray-700">
                                Notes (Optional)
                            </label>
                            <textarea
                                name="notes"
                                value={formData.notes}
                                onChange={handleChange}
                                rows="3"
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                                placeholder="Add any additional notes..."
                            />
                        </div>

                        {/* Action Buttons */}
                        <div className="flex pt-4 space-x-4">
                            <button
                                type="submit"
                                disabled={saving}
                                className="flex items-center justify-center flex-1 px-6 py-3 font-semibold text-white transition-colors bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <FaSave className="mr-2" />
                                {saving ? 'Generating...' : 'Generate Receipt'}
                            </button>
                            <button
                                type="button"
                                className="flex items-center px-6 py-3 font-semibold text-gray-700 transition-colors border border-gray-300 rounded-lg hover:bg-gray-50"
                            >
                                <FaTimes className="mr-2" />
                                Cancel
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default GenerateReceipt;