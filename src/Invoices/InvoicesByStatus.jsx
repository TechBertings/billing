import React, { useState, useEffect } from 'react';
import { FaTimes } from 'react-icons/fa';

const InvoiceDashboard = () => {
    const sampleInvoices = [
        {
            id: '1',
            invoice_number: 'INV-001',
            invoice_date: '2026-02-05',
            due_date: '2026-03-05',
            subtotal: 10000,
            tax_amount: 1200,
            discount_amount: 1000,
            total_amount: 10200,
            status: 'paid',
            payment_status: 'paid',
            notes: 'Thank you for your business',
            terms_conditions: 'Payment is due within 30 days',
            customers: {
                full_name: 'Albert Molina',
                email: 'albertantoniomolinajr@gmail.com',
                phone: '+63912345678',
                address: '123 Main Street',
                city: 'Manila'
            },
            items: [
                {
                    product_name: 'Web Development Service',
                    description: 'Professional web development',
                    quantity: 1,
                    unit_price: 10000,
                    discount: 10,
                    tax_rate: 12,
                    line_total: 10200
                }
            ]
        },
        {
            id: '2',
            invoice_number: 'INV-002',
            invoice_date: '2026-02-06',
            due_date: '2026-03-06',
            subtotal: 8000,
            tax_amount: 960,
            discount_amount: 0,
            total_amount: 8960,
            status: 'sent',
            payment_status: 'unpaid',
            notes: '',
            terms_conditions: 'Payment is due within 30 days',
            customers: {
                full_name: 'Jane Smith',
                email: 'jane@example.com',
                phone: '+63912345679',
                address: '456 Oak Avenue',
                city: 'Quezon City'
            },
            items: [
                {
                    product_name: 'Mobile App Development',
                    description: 'iOS and Android development',
                    quantity: 1,
                    unit_price: 8000,
                    discount: 0,
                    tax_rate: 12,
                    line_total: 8960
                }
            ]
        },
        {
            id: '3',
            invoice_number: 'INV-003',
            invoice_date: '2026-02-03',
            due_date: '2026-03-03',
            subtotal: 5000,
            tax_amount: 600,
            discount_amount: 500,
            total_amount: 5100,
            status: 'overdue',
            payment_status: 'unpaid',
            notes: 'Urgent payment required',
            terms_conditions: 'Payment is due within 30 days',
            customers: {
                full_name: 'Robert Johnson',
                email: 'robert@example.com',
                phone: '+63912345680',
                address: '789 Pine Road',
                city: 'Makati'
            },
            items: [
                {
                    product_name: 'UI/UX Design',
                    description: 'User interface design',
                    quantity: 1,
                    unit_price: 5000,
                    discount: 10,
                    tax_rate: 12,
                    line_total: 5100
                }
            ]
        },
        {
            id: '4',
            invoice_number: 'INV-004',
            invoice_date: '2026-02-07',
            due_date: '2026-03-07',
            subtotal: 3000,
            tax_amount: 360,
            discount_amount: 0,
            total_amount: 3360,
            status: 'draft',
            payment_status: 'unpaid',
            notes: '',
            terms_conditions: 'Payment is due within 30 days',
            customers: {
                full_name: 'Maria Garcia',
                email: 'maria@example.com',
                phone: '+63912345681',
                address: '321 Maple Lane',
                city: 'Taguig'
            },
            items: [
                {
                    product_name: 'Consulting',
                    description: 'Business consulting services',
                    quantity: 3,
                    unit_price: 1000,
                    discount: 0,
                    tax_rate: 12,
                    line_total: 3360
                }
            ]
        },
        {
            id: '5',
            invoice_number: 'INV-005',
            invoice_date: '2026-02-04',
            due_date: '2026-03-04',
            subtotal: 4500,
            tax_amount: 540,
            discount_amount: 450,
            total_amount: 4590,
            status: 'sent',
            payment_status: 'partially_paid',
            notes: 'Partial payment received',
            terms_conditions: 'Payment is due within 30 days',
            customers: {
                full_name: 'Carlos Ramos',
                email: 'carlos@example.com',
                phone: '+63912345682',
                address: '654 Cedar Street',
                city: 'Cebu'
            },
            items: [
                {
                    product_name: 'Website Maintenance',
                    description: 'Monthly maintenance',
                    quantity: 1,
                    unit_price: 4500,
                    discount: 10,
                    tax_rate: 12,
                    line_total: 4590
                }
            ]
        }
    ];

    const [invoices] = useState(sampleInvoices);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedInvoice, setSelectedInvoice] = useState(null);
    const [showModal, setShowModal] = useState(false);

    const filteredInvoices = invoices.filter(invoice =>
        invoice.invoice_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        invoice.customers?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        invoice.customers?.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getStatusColor = (status) => {
        if (status === 'paid') return 'green';
        if (status === 'sent') return 'blue';
        if (status === 'overdue') return 'red';
        return 'gray';
    };

    const getPaymentColor = (status) => {
        if (status === 'paid') return 'green';
        if (status === 'unpaid') return 'orange';
        if (status === 'partially_paid') return 'yellow';
        return 'gray';
    };

    return (
        <div className="min-h-screen p-6 bg-white">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="mb-2 text-3xl font-bold text-black">Invoices</h1>
                    <p className="text-gray-600">Manage your invoices</p>
                </div>

                {/* Search */}
                <div className="mb-6">
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Search invoices..."
                        className="w-full px-4 py-2 text-black border border-gray-300 rounded"
                    />
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                    <table className="w-full border border-collapse border-gray-300">
                        <thead className="bg-gray-100">
                            <tr>
                                <th className="px-4 py-2 font-bold text-left border border-gray-300">Invoice #</th>
                                <th className="px-4 py-2 font-bold text-left border border-gray-300">Customer</th>
                                <th className="px-4 py-2 font-bold text-left border border-gray-300">Email</th>
                                <th className="px-4 py-2 font-bold text-left border border-gray-300">Date</th>
                                <th className="px-4 py-2 font-bold text-left border border-gray-300">Due Date</th>
                                <th className="px-4 py-2 font-bold text-right border border-gray-300">Amount</th>
                                <th className="px-4 py-2 font-bold text-left border border-gray-300">Status</th>
                                <th className="px-4 py-2 font-bold text-left border border-gray-300">Payment</th>
                                <th className="px-4 py-2 font-bold text-left border border-gray-300">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredInvoices.map((invoice) => (
                                <tr key={invoice.id} className="hover:bg-gray-50">
                                    <td className="px-4 py-2 border border-gray-300">{invoice.invoice_number}</td>
                                    <td className="px-4 py-2 border border-gray-300">{invoice.customers?.full_name}</td>
                                    <td className="px-4 py-2 text-sm border border-gray-300">{invoice.customers?.email}</td>
                                    <td className="px-4 py-2 text-sm border border-gray-300">
                                        {new Date(invoice.invoice_date).toLocaleDateString()}
                                    </td>
                                    <td className="px-4 py-2 text-sm border border-gray-300">
                                        {new Date(invoice.due_date).toLocaleDateString()}
                                    </td>
                                    <td className="px-4 py-2 font-semibold text-right border border-gray-300">
                                        ₱{invoice.total_amount?.toFixed(2)}
                                    </td>
                                    <td className="px-4 py-2 border border-gray-300">
                                        <span
                                            style={{
                                                padding: '4px 8px',
                                                borderRadius: '4px',
                                                fontSize: '12px',
                                                fontWeight: 'bold',
                                                backgroundColor: getStatusColor(invoice.status) === 'green' ? '#dcfce7' : 
                                                                getStatusColor(invoice.status) === 'blue' ? '#dbeafe' : 
                                                                getStatusColor(invoice.status) === 'red' ? '#fee2e2' : '#f3f4f6',
                                                color: getStatusColor(invoice.status) === 'green' ? '#166534' : 
                                                       getStatusColor(invoice.status) === 'blue' ? '#1e40af' : 
                                                       getStatusColor(invoice.status) === 'red' ? '#991b1b' : '#374151'
                                            }}
                                        >
                                            {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                                        </span>
                                    </td>
                                    <td className="px-4 py-2 border border-gray-300">
                                        <span
                                            style={{
                                                padding: '4px 8px',
                                                borderRadius: '4px',
                                                fontSize: '12px',
                                                fontWeight: 'bold',
                                                backgroundColor: getPaymentColor(invoice.payment_status) === 'green' ? '#dcfce7' : 
                                                                getPaymentColor(invoice.payment_status) === 'orange' ? '#fed7aa' : 
                                                                getPaymentColor(invoice.payment_status) === 'yellow' ? '#fef08a' : '#f3f4f6',
                                                color: getPaymentColor(invoice.payment_status) === 'green' ? '#166534' : 
                                                       getPaymentColor(invoice.payment_status) === 'orange' ? '#92400e' : 
                                                       getPaymentColor(invoice.payment_status) === 'yellow' ? '#713f12' : '#374151'
                                            }}
                                        >
                                            {invoice.payment_status === 'partially_paid' ? 'Partial' : 
                                             invoice.payment_status.charAt(0).toUpperCase() + invoice.payment_status.slice(1)}
                                        </span>
                                    </td>
                                    <td className="px-4 py-2 border border-gray-300">
                                        <button
                                            onClick={() => {
                                                setSelectedInvoice(invoice);
                                                setShowModal(true);
                                            }}
                                            className="px-3 py-1 text-sm text-white bg-blue-600 rounded cursor-pointer hover:bg-blue-700"
                                        >
                                            View
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {filteredInvoices.length === 0 && (
                    <div className="py-8 text-center text-gray-500">
                        No invoices found
                    </div>
                )}
            </div>

            {/* Modal */}
            {showModal && selectedInvoice && (
                <div
                    style={{
                        position: 'fixed',
                        inset: 0,
                        backgroundColor: 'rgba(0, 0, 0, 0.5)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 50
                    }}
                >
                    <div
                        style={{
                            backgroundColor: 'white',
                            borderRadius: '8px',
                            maxWidth: '800px',
                            width: '90%',
                            maxHeight: '90vh',
                            overflowY: 'auto',
                            padding: '20px'
                        }}
                    >
                        {/* Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #e5e7eb', paddingBottom: '10px' }}>
                            <div>
                                <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: 'black' }}>Invoice Details</h2>
                                <p style={{ fontSize: '14px', color: '#6b7280' }}>{selectedInvoice.invoice_number}</p>
                            </div>
                            <button
                                onClick={() => setShowModal(false)}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    fontSize: '20px',
                                    cursor: 'pointer',
                                    color: '#6b7280'
                                }}
                            >
                                <FaTimes />
                            </button>
                        </div>

                        {/* Content */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            {/* Invoice Info */}
                            <div style={{ padding: '10px', backgroundColor: '#f9fafb', borderRadius: '4px' }}>
                                <p><strong>Invoice Date:</strong> {new Date(selectedInvoice.invoice_date).toLocaleDateString()}</p>
                                <p><strong>Due Date:</strong> {new Date(selectedInvoice.due_date).toLocaleDateString()}</p>
                            </div>

                            {/* Customer Info */}
                            <div>
                                <h3 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '10px', color: 'black' }}>Customer Information</h3>
                                <div style={{ padding: '10px', backgroundColor: '#f9fafb', borderRadius: '4px' }}>
                                    <p><strong>Name:</strong> {selectedInvoice.customers?.full_name}</p>
                                    <p><strong>Email:</strong> {selectedInvoice.customers?.email}</p>
                                    <p><strong>Phone:</strong> {selectedInvoice.customers?.phone}</p>
                                    <p><strong>Address:</strong> {selectedInvoice.customers?.address}</p>
                                </div>
                            </div>

                            {/* Items Table */}
                            <div>
                                <h3 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '10px', color: 'black' }}>Items</h3>
                                <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #e5e7eb' }}>
                                    <thead style={{ backgroundColor: '#f9fafb' }}>
                                        <tr>
                                            <th style={{ border: '1px solid #e5e7eb', padding: '8px', textAlign: 'left', fontWeight: 'bold' }}>Description</th>
                                            <th style={{ border: '1px solid #e5e7eb', padding: '8px', textAlign: 'center', fontWeight: 'bold' }}>Qty</th>
                                            <th style={{ border: '1px solid #e5e7eb', padding: '8px', textAlign: 'right', fontWeight: 'bold' }}>Price</th>
                                            <th style={{ border: '1px solid #e5e7eb', padding: '8px', textAlign: 'center', fontWeight: 'bold' }}>Disc%</th>
                                            <th style={{ border: '1px solid #e5e7eb', padding: '8px', textAlign: 'center', fontWeight: 'bold' }}>Tax%</th>
                                            <th style={{ border: '1px solid #e5e7eb', padding: '8px', textAlign: 'right', fontWeight: 'bold' }}>Total</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {selectedInvoice.items.map((item, i) => (
                                            <tr key={i}>
                                                <td style={{ border: '1px solid #e5e7eb', padding: '8px' }}>
                                                    <p style={{ fontWeight: 'bold', margin: '0 0 4px 0' }}>{item.product_name}</p>
                                                    <p style={{ fontSize: '12px', color: '#6b7280', margin: 0 }}>{item.description}</p>
                                                </td>
                                                <td style={{ border: '1px solid #e5e7eb', padding: '8px', textAlign: 'center' }}>{item.quantity}</td>
                                                <td style={{ border: '1px solid #e5e7eb', padding: '8px', textAlign: 'right' }}>₱{item.unit_price?.toFixed(2)}</td>
                                                <td style={{ border: '1px solid #e5e7eb', padding: '8px', textAlign: 'center' }}>{item.discount}%</td>
                                                <td style={{ border: '1px solid #e5e7eb', padding: '8px', textAlign: 'center' }}>{item.tax_rate}%</td>
                                                <td style={{ border: '1px solid #e5e7eb', padding: '8px', textAlign: 'right', fontWeight: 'bold' }}>₱{item.line_total?.toFixed(2)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Totals */}
                            <div style={{ padding: '10px', backgroundColor: '#f9fafb', borderRadius: '4px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                    <span><strong>Subtotal:</strong></span>
                                    <span>₱{selectedInvoice.subtotal?.toFixed(2)}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                    <span><strong>Discount:</strong></span>
                                    <span>-₱{selectedInvoice.discount_amount?.toFixed(2)}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                    <span><strong>Tax:</strong></span>
                                    <span>₱{selectedInvoice.tax_amount?.toFixed(2)}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '8px', borderTop: '1px solid #d1d5db', fontSize: '18px', fontWeight: 'bold' }}>
                                    <span>Grand Total:</span>
                                    <span style={{ color: '#0066cc' }}>₱{selectedInvoice.total_amount?.toFixed(2)}</span>
                                </div>
                            </div>

                            {/* Notes */}
                            {selectedInvoice.notes && (
                                <div>
                                    <h3 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '8px', color: 'black' }}>Notes</h3>
                                    <p style={{ padding: '10px', backgroundColor: '#f9fafb', borderRadius: '4px', margin: 0 }}>{selectedInvoice.notes}</p>
                                </div>
                            )}
                        </div>

                        {/* Close Button */}
                        <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
                            <button
                                onClick={() => setShowModal(false)}
                                style={{
                                    flex: 1,
                                    padding: '10px',
                                    backgroundColor: '#0066cc',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontWeight: 'bold'
                                }}
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

export default InvoiceDashboard;