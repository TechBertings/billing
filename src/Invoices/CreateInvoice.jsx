import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import {
    FaPlus,
    FaTrash,
    FaSave,
    FaFileInvoice,
    FaUserTie,
    FaCalendarAlt,
    FaMoneyBillWave,
    FaPercentage,
    FaTimes,
    FaCheckCircle,
    FaSearch,
    FaSpinner
} from 'react-icons/fa';

const CreateInvoice = () => {
    const [customers, setCustomers] = useState([]);
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [searchCustomer, setSearchCustomer] = useState('');
    const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);

    // Invoice form state
    const [invoice, setInvoice] = useState({
        invoice_number: `INV-${Date.now()}`,
        invoice_date: new Date().toISOString().split('T')[0],
        due_date: '',
        customer_id: '',
        items: [
            {
                product_id: '',
                description: '',
                quantity: 1,
                unit_price: 0,
                discount: 0,
                tax_rate: 12,
                line_total: 0
            }
        ],
        subtotal: 0,
        discount_amount: 0,
        tax_amount: 0,
        total_amount: 0,
        notes: '',
        terms_conditions: 'Payment is due within 30 days',
        status: 'draft',
        payment_status: 'unpaid'
    });

    // Load customers and products from Supabase
    useEffect(() => {
        loadCustomers();
        loadProducts();
    }, []);

    const loadCustomers = async () => {
        try {
            const { data, error } = await supabase
                .from('customers')
                .select('id, full_name, email, phone, address, city')
                .order('full_name');

            if (error) throw error;
            setCustomers(data || []);
        } catch (error) {
            console.error('Error loading customers:', error);
        }
    };

    const loadProducts = async () => {
        try {
            const { data, error } = await supabase
                .from('products')
                .select('id, product_name, description, unit_price')
                .order('product_name');

            if (error) throw error;
            setProducts(data || []);
        } catch (error) {
            console.error('Error loading products:', error);
        }
    };

    // Handle customer selection
    const handleCustomerSelect = (customer) => {
        setInvoice(prev => ({
            ...prev,
            customer_id: customer.id
        }));
        setSearchCustomer(customer.full_name || '');
        setShowCustomerDropdown(false);
    };

    // Handle product selection for item
    const handleProductSelect = (index, productId) => {
        const product = products.find(p => p.id === productId);
        if (product) {
            const newItems = [...invoice.items];
            newItems[index] = {
                ...newItems[index],
                product_id: productId,
                description: product.product_name || product.description || '',
                unit_price: parseFloat(product.unit_price) || 0
            };
            updateItem(index, newItems);
        }
    };

    // Add new item row
    const addItem = () => {
        setInvoice(prev => ({
            ...prev,
            items: [
                ...prev.items,
                {
                    product_id: '',
                    description: '',
                    quantity: 1,
                    unit_price: 0,
                    discount: 0,
                    tax_rate: 12,
                    line_total: 0
                }
            ]
        }));
    };

    // Remove item row
    const removeItem = (index) => {
        if (invoice.items.length > 1) {
            const newItems = invoice.items.filter((_, i) => i !== index);
            setInvoice(prev => ({ ...prev, items: newItems }));
            calculateTotals(newItems);
        }
    };

    // Update item field
    const updateItemField = (index, field, value) => {
        const newItems = [...invoice.items];
        newItems[index] = {
            ...newItems[index],
            [field]: field === 'quantity' || field === 'unit_price' || field === 'discount' || field === 'tax_rate' 
                ? parseFloat(value) || 0 
                : value
        };
        updateItem(index, newItems);
    };

    // Update item and recalculate
    const updateItem = (index, items) => {
        const item = items[index];
        const subtotal = item.quantity * item.unit_price;
        const discountAmount = (subtotal * item.discount) / 100;
        const taxableAmount = subtotal - discountAmount;
        const taxAmount = (taxableAmount * item.tax_rate) / 100;
        const lineTotal = taxableAmount + taxAmount;

        items[index] = {
            ...item,
            line_total: parseFloat(lineTotal.toFixed(2))
        };

        setInvoice(prev => ({ ...prev, items }));
        calculateTotals(items);
    };

    // Calculate totals
    const calculateTotals = (items) => {
        let subtotal = 0;
        let totalDiscount = 0;
        let totalTax = 0;

        items.forEach(item => {
            const itemSubtotal = item.quantity * item.unit_price;
            const discountAmount = (itemSubtotal * item.discount) / 100;
            const taxableAmount = itemSubtotal - discountAmount;
            const taxAmount = (taxableAmount * item.tax_rate) / 100;

            subtotal += itemSubtotal;
            totalDiscount += discountAmount;
            totalTax += taxAmount;
        });

        const grandTotal = subtotal - totalDiscount + totalTax;

        setInvoice(prev => ({
            ...prev,
            subtotal: parseFloat(subtotal.toFixed(2)),
            discount_amount: parseFloat(totalDiscount.toFixed(2)),
            tax_amount: parseFloat(totalTax.toFixed(2)),
            total_amount: parseFloat(grandTotal.toFixed(2))
        }));
    };

    // Save invoice to Supabase
    const saveInvoice = async (status) => {
        setLoading(true);
        try {
            if (!invoice.customer_id) {
                alert('Please select a customer');
                setLoading(false);
                return;
            }

            if (invoice.items.length === 0 || invoice.items.every(item => !item.product_id)) {
                alert('Please add at least one item to the invoice');
                setLoading(false);
                return;
            }

            // Save invoice
            const { data: invoiceData, error: invoiceError } = await supabase
                .from('invoices')
                .insert([
                    {
                        invoice_number: invoice.invoice_number,
                        customer_id: invoice.customer_id,
                        invoice_date: invoice.invoice_date,
                        due_date: invoice.due_date || null,
                        subtotal: invoice.subtotal,
                        discount_amount: invoice.discount_amount,
                        tax_amount: invoice.tax_amount,
                        total_amount: invoice.total_amount,
                        status: status,
                        payment_status: invoice.payment_status,
                        notes: invoice.notes,
                        terms_conditions: invoice.terms_conditions
                    }
                ])
                .select();

            if (invoiceError) throw invoiceError;

            const newInvoiceId = invoiceData[0].id;

            // Save invoice items
            const itemsToInsert = invoice.items.map(item => ({
                invoice_id: newInvoiceId,
                product_id: item.product_id,
                quantity: item.quantity,
                unit_price: item.unit_price,
                discount: item.discount,
                tax_rate: item.tax_rate,
                line_total: item.line_total
            }));

            const { error: itemsError } = await supabase
                .from('invoice_items')
                .insert(itemsToInsert);

            if (itemsError) throw itemsError;

            setShowSuccess(true);
            setTimeout(() => {
                setShowSuccess(false);
                resetForm();
            }, 2000);
        } catch (error) {
            console.error('Error saving invoice:', error);
            alert('Error saving invoice. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    // Reset form
    const resetForm = () => {
        setInvoice({
            invoice_number: `INV-${Date.now()}`,
            invoice_date: new Date().toISOString().split('T')[0],
            due_date: '',
            customer_id: '',
            items: [
                {
                    product_id: '',
                    description: '',
                    quantity: 1,
                    unit_price: 0,
                    discount: 0,
                    tax_rate: 12,
                    line_total: 0
                }
            ],
            subtotal: 0,
            discount_amount: 0,
            tax_amount: 0,
            total_amount: 0,
            notes: '',
            terms_conditions: 'Payment is due within 30 days',
            status: 'draft',
            payment_status: 'unpaid'
        });
        setSearchCustomer('');
    };

    // Filtered customers for search
    const filteredCustomers = customers.filter(customer =>
        customer.full_name?.toLowerCase().includes(searchCustomer.toLowerCase()) ||
        customer.email?.toLowerCase().includes(searchCustomer.toLowerCase())
    );

    return (
        <div className="min-h-screen p-6 bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
            <div className="mx-auto max-w-7xl">
                {/* Header */}
                <div className="p-8 mb-6 bg-white border shadow-xl rounded-2xl border-slate-200">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                            <div className="flex items-center justify-center shadow-lg w-14 h-14 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl">
                                <FaFileInvoice className="text-2xl text-white" />
                            </div>
                            <div>
                                <h1 className="text-3xl font-bold text-transparent bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text">
                                    Create Invoice
                                </h1>
                                <p className="mt-1 text-slate-500">Generate a new invoice for your customer</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="text-sm text-slate-500">Invoice Number</p>
                            <p className="text-xl font-bold text-slate-800">{invoice.invoice_number}</p>
                        </div>
                    </div>
                </div>

                {/* Main Form */}
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                    {/* Left Column - Customer & Date Info */}
                    <div className="space-y-6 lg:col-span-2">
                        {/* Customer Information */}
                        <div className="p-6 bg-white border shadow-xl rounded-2xl border-slate-200">
                            <div className="flex items-center mb-6 space-x-3">
                                <div className="flex items-center justify-center w-10 h-10 bg-blue-100 rounded-lg">
                                    <FaUserTie className="text-blue-600" />
                                </div>
                                <h2 className="text-xl font-bold text-slate-800">Customer Information</h2>
                            </div>

                            <div className="space-y-4">
                                {/* Customer Search */}
                                <div className="relative">
                                    <label className="block mb-2 text-sm font-semibold text-slate-700">
                                        Select Customer
                                    </label>
                                    <div className="relative">
                                        <FaSearch className="absolute -translate-y-1/2 left-4 top-1/2 text-slate-400" />
                                        <input
                                            type="text"
                                            value={searchCustomer}
                                            onChange={(e) => {
                                                setSearchCustomer(e.target.value);
                                                setShowCustomerDropdown(true);
                                            }}
                                            onFocus={() => setShowCustomerDropdown(true)}
                                            placeholder="Search customer by name or email..."
                                            className="w-full py-3 pl-12 pr-4 transition-all border-2 outline-none border-slate-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                                        />
                                    </div>

                                    {/* Customer Dropdown */}
                                    {showCustomerDropdown && filteredCustomers.length > 0 && (
                                        <div className="absolute z-10 w-full mt-2 overflow-y-auto bg-white border-2 shadow-2xl border-slate-200 rounded-xl max-h-64">
                                            {filteredCustomers.map(customer => (
                                                <div
                                                    key={customer.id}
                                                    onClick={() => handleCustomerSelect(customer)}
                                                    className="p-4 transition-colors border-b cursor-pointer hover:bg-blue-50 border-slate-100 last:border-0"
                                                >
                                                    <p className="font-semibold text-slate-800">{customer.full_name}</p>
                                                    <p className="text-sm text-slate-500">{customer.email}</p>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block mb-2 text-sm font-semibold text-slate-700">
                                            Customer Name
                                        </label>
                                        <input
                                            type="text"
                                            value={searchCustomer}
                                            readOnly
                                            className="w-full px-4 py-3 border-2 outline-none border-slate-200 rounded-xl bg-slate-50 text-slate-600"
                                            placeholder="Select customer first"
                                        />
                                    </div>
                                    <div>
                                        <label className="block mb-2 text-sm font-semibold text-slate-700">
                                            Email
                                        </label>
                                        <input
                                            type="email"
                                            value={customers.find(c => c.id === invoice.customer_id)?.email || ''}
                                            readOnly
                                            className="w-full px-4 py-3 border-2 outline-none border-slate-200 rounded-xl bg-slate-50 text-slate-600"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block mb-2 text-sm font-semibold text-slate-700">
                                        Address
                                    </label>
                                    <textarea
                                        value={customers.find(c => c.id === invoice.customer_id)?.address || ''}
                                        readOnly
                                        rows="2"
                                        className="w-full px-4 py-3 border-2 outline-none resize-none border-slate-200 rounded-xl bg-slate-50 text-slate-600"
                                    />
                                </div>

                                <div>
                                    <label className="block mb-2 text-sm font-semibold text-slate-700">
                                        Phone Number
                                    </label>
                                    <input
                                        type="tel"
                                        value={customers.find(c => c.id === invoice.customer_id)?.phone || ''}
                                        readOnly
                                        className="w-full px-4 py-3 border-2 outline-none border-slate-200 rounded-xl bg-slate-50 text-slate-600"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Invoice Items */}
                        <div className="p-6 bg-white border shadow-xl rounded-2xl border-slate-200">
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center space-x-3">
                                    <div className="flex items-center justify-center w-10 h-10 bg-indigo-100 rounded-lg">
                                        <FaMoneyBillWave className="text-indigo-600" />
                                    </div>
                                    <h2 className="text-xl font-bold text-slate-800">Invoice Items</h2>
                                </div>
                                <button
                                    onClick={addItem}
                                    className="flex items-center px-4 py-2 space-x-2 text-white transition-all transform bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl hover:shadow-lg hover:scale-105"
                                >
                                    <FaPlus />
                                    <span className="font-semibold">Add Item</span>
                                </button>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b-2 border-slate-200">
                                            <th className="px-2 py-3 text-sm font-bold text-left text-slate-700">Product/Service</th>
                                            <th className="px-2 py-3 text-sm font-bold text-left text-slate-700">Description</th>
                                            <th className="px-2 py-3 text-sm font-bold text-center text-slate-700">Qty</th>
                                            <th className="px-2 py-3 text-sm font-bold text-right text-slate-700">Unit Price</th>
                                            <th className="px-2 py-3 text-sm font-bold text-center text-slate-700">Disc %</th>
                                            <th className="px-2 py-3 text-sm font-bold text-center text-slate-700">Tax %</th>
                                            <th className="px-2 py-3 text-sm font-bold text-right text-slate-700">Amount</th>
                                            <th className="px-2 py-3 text-sm font-bold text-center text-slate-700">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {invoice.items.map((item, index) => (
                                            <tr key={index} className="transition-colors border-b border-slate-100 hover:bg-slate-50">
                                                <td className="px-2 py-3">
                                                    <select
                                                        value={item.product_id}
                                                        onChange={(e) => handleProductSelect(index, e.target.value)}
                                                        className="w-full px-3 py-2 text-sm border-2 rounded-lg outline-none border-slate-200 focus:border-blue-500"
                                                    >
                                                        <option value="">Select...</option>
                                                        {products.map(product => (
                                                            <option key={product.id} value={product.id}>
                                                                {product.product_name}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </td>
                                                <td className="px-2 py-3">
                                                    <input
                                                        type="text"
                                                        value={item.description}
                                                        onChange={(e) => updateItemField(index, 'description', e.target.value)}
                                                        className="w-full px-3 py-2 text-sm border-2 rounded-lg outline-none border-slate-200 focus:border-blue-500"
                                                        placeholder="Description"
                                                    />
                                                </td>
                                                <td className="px-2 py-3">
                                                    <input
                                                        type="number"
                                                        value={item.quantity}
                                                        onChange={(e) => updateItemField(index, 'quantity', e.target.value)}
                                                        min="1"
                                                        className="w-20 px-3 py-2 text-sm text-center border-2 rounded-lg outline-none border-slate-200 focus:border-blue-500"
                                                    />
                                                </td>
                                                <td className="px-2 py-3">
                                                    <input
                                                        type="number"
                                                        value={item.unit_price}
                                                        onChange={(e) => updateItemField(index, 'unit_price', e.target.value)}
                                                        min="0"
                                                        step="0.01"
                                                        className="px-3 py-2 text-sm text-right border-2 rounded-lg outline-none w-28 border-slate-200 focus:border-blue-500"
                                                    />
                                                </td>
                                                <td className="px-2 py-3">
                                                    <input
                                                        type="number"
                                                        value={item.discount}
                                                        onChange={(e) => updateItemField(index, 'discount', e.target.value)}
                                                        min="0"
                                                        max="100"
                                                        className="w-20 px-3 py-2 text-sm text-center border-2 rounded-lg outline-none border-slate-200 focus:border-blue-500"
                                                    />
                                                </td>
                                                <td className="px-2 py-3">
                                                    <input
                                                        type="number"
                                                        value={item.tax_rate}
                                                        onChange={(e) => updateItemField(index, 'tax_rate', e.target.value)}
                                                        min="0"
                                                        max="100"
                                                        className="w-20 px-3 py-2 text-sm text-center border-2 rounded-lg outline-none border-slate-200 focus:border-blue-500"
                                                    />
                                                </td>
                                                <td className="px-2 py-3 text-right">
                                                    <span className="font-bold text-slate-800">
                                                        ₱{item.line_total.toFixed(2)}
                                                    </span>
                                                </td>
                                                <td className="px-2 py-3 text-center">
                                                    <button
                                                        onClick={() => removeItem(index)}
                                                        disabled={invoice.items.length === 1}
                                                        className="p-2 text-red-500 transition-colors rounded-lg hover:bg-red-50 disabled:opacity-30 disabled:cursor-not-allowed"
                                                    >
                                                        <FaTrash />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Notes and Terms */}
                        <div className="p-6 bg-white border shadow-xl rounded-2xl border-slate-200">
                            <div className="space-y-4">
                                <div>
                                    <label className="block mb-2 text-sm font-semibold text-slate-700">
                                        Notes (Optional)
                                    </label>
                                    <textarea
                                        value={invoice.notes}
                                        onChange={(e) => setInvoice(prev => ({ ...prev, notes: e.target.value }))}
                                        rows="3"
                                        className="w-full px-4 py-3 transition-all border-2 outline-none resize-none border-slate-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                                        placeholder="Add any additional notes or special instructions..."
                                    />
                                </div>
                                <div>
                                    <label className="block mb-2 text-sm font-semibold text-slate-700">
                                        Terms & Conditions
                                    </label>
                                    <textarea
                                        value={invoice.terms_conditions}
                                        onChange={(e) => setInvoice(prev => ({ ...prev, terms_conditions: e.target.value }))}
                                        rows="3"
                                        className="w-full px-4 py-3 transition-all border-2 outline-none resize-none border-slate-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                                        placeholder="Payment terms and conditions..."
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Column - Date & Summary */}
                    <div className="space-y-6">
                        {/* Date Information */}
                        <div className="p-6 bg-white border shadow-xl rounded-2xl border-slate-200">
                            <div className="flex items-center mb-6 space-x-3">
                                <div className="flex items-center justify-center w-10 h-10 bg-purple-100 rounded-lg">
                                    <FaCalendarAlt className="text-purple-600" />
                                </div>
                                <h2 className="text-xl font-bold text-slate-800">Dates</h2>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block mb-2 text-sm font-semibold text-slate-700">
                                        Invoice Date
                                    </label>
                                    <input
                                        type="date"
                                        value={invoice.invoice_date}
                                        onChange={(e) => setInvoice(prev => ({ ...prev, invoice_date: e.target.value }))}
                                        className="w-full px-4 py-3 transition-all border-2 outline-none border-slate-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                                    />
                                </div>
                                <div>
                                    <label className="block mb-2 text-sm font-semibold text-slate-700">
                                        Due Date
                                    </label>
                                    <input
                                        type="date"
                                        value={invoice.due_date}
                                        onChange={(e) => setInvoice(prev => ({ ...prev, due_date: e.target.value }))}
                                        className="w-full px-4 py-3 transition-all border-2 outline-none border-slate-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Summary */}
                        <div className="p-6 text-white shadow-xl bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl">
                            <h2 className="mb-6 text-xl font-bold">Invoice Summary</h2>

                            <div className="space-y-3">
                                <div className="flex items-center justify-between pb-3 border-b border-white/20">
                                    <span className="text-blue-100">Subtotal</span>
                                    <span className="text-lg font-bold">₱{invoice.subtotal.toFixed(2)}</span>
                                </div>
                                <div className="flex items-center justify-between pb-3 border-b border-white/20">
                                    <span className="text-blue-100">Discount</span>
                                    <span className="text-lg font-bold">-₱{invoice.discount_amount.toFixed(2)}</span>
                                </div>
                                <div className="flex items-center justify-between pb-3 border-b border-white/20">
                                    <span className="text-blue-100">Tax</span>
                                    <span className="text-lg font-bold">₱{invoice.tax_amount.toFixed(2)}</span>
                                </div>
                                <div className="flex items-center justify-between pt-3">
                                    <span className="text-xl font-bold">Total Amount</span>
                                    <span className="text-3xl font-bold">₱{invoice.total_amount.toFixed(2)}</span>
                                </div>
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="space-y-3">
                            <button
                                onClick={() => saveInvoice('sent')}
                                disabled={loading || !invoice.customer_id || invoice.items.length === 0}
                                className="flex items-center justify-center w-full px-6 py-4 space-x-2 text-lg font-bold text-white transition-all transform bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl hover:shadow-2xl hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                            >
                                {loading ? (
                                    <>
                                        <FaSpinner className="animate-spin" />
                                        <span>Saving...</span>
                                    </>
                                ) : (
                                    <>
                                        <FaSave />
                                        <span>Save & Send Invoice</span>
                                    </>
                                )}
                            </button>

                            <button
                                onClick={() => saveInvoice('draft')}
                                disabled={loading}
                                className="flex items-center justify-center w-full px-6 py-4 space-x-2 font-bold transition-all transform bg-slate-200 text-slate-700 rounded-xl hover:bg-slate-300 hover:shadow-lg hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                            >
                                <FaFileInvoice />
                                <span>Save as Draft</span>
                            </button>

                            <button
                                onClick={resetForm}
                                disabled={loading}
                                className="flex items-center justify-center w-full px-6 py-4 space-x-2 font-semibold transition-all border-2 border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50 hover:border-slate-400 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <FaTimes />
                                <span>Clear Form</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Success Modal */}
            {showSuccess && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fadeIn">
                    <div className="p-8 transform bg-white shadow-2xl rounded-2xl animate-scaleIn">
                        <div className="text-center">
                            <div className="flex items-center justify-center w-20 h-20 mx-auto mb-4 bg-green-100 rounded-full">
                                <FaCheckCircle className="text-4xl text-green-500" />
                            </div>
                            <h3 className="mb-2 text-2xl font-bold text-slate-800">Invoice Created!</h3>
                            <p className="text-slate-600">Your invoice has been saved successfully.</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Animations */}
            <style jsx>{`
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes scaleIn {
                    from { transform: scale(0.9); opacity: 0; }
                    to { transform: scale(1); opacity: 1; }
                }
                .animate-fadeIn {
                    animation: fadeIn 0.3s ease-out;
                }
                .animate-scaleIn {
                    animation: scaleIn 0.3s ease-out;
                }
            `}</style>
        </div>
    );
};

export default CreateInvoice;