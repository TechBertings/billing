import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import * as XLSX from 'xlsx';
import {
    FaEye,
    FaTimes,
    FaUser,
    FaEnvelope,
    FaPhone,
    FaMapMarkerAlt,
    FaBuilding,
    FaGlobe,
    FaIdCard,
    FaSearch,
    FaFileExport,
    FaFileImport,
    FaDownload,
    FaUpload
} from 'react-icons/fa';

const CustomerList = () => {
    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [importing, setImporting] = useState(false);

    // Load customers from Supabase
    useEffect(() => {
        fetchCustomers();
    }, []);

    const fetchCustomers = async () => {
        try {
            setLoading(true);
            setError(null);

            const { data, error: fetchError } = await supabase
                .from('customers')
                .select('*')
                .eq('is_active', true)
                .order('created_at', { ascending: false });

            if (fetchError) throw fetchError;

            setCustomers(data || []);
        } catch (err) {
            console.error('Error fetching customers:', err);
            setError(err.message);
            setCustomers([]);
        } finally {
            setLoading(false);
        }
    };

    // Export to Excel
    const exportToExcel = () => {
        try {
            // Prepare data for export
            const exportData = customers.map(customer => ({
                'Customer Code': customer.customer_code || '',
                'Full Name': customer.full_name || '',
                'Email': customer.email || '',
                'Phone': customer.phone || '',
                'Company': customer.company_name || '',
                'Address': customer.address || '',
                'City': customer.city || '',
                'Province': customer.province || '',
                'ZIP Code': customer.postal_code || '',
                'Country': customer.country || '',
                'Tax ID': customer.tax_id || '',
                'Website': customer.website || '',
                'Credit Limit': customer.credit_limit || '',
                'Status': customer.is_active ? 'Active' : 'Inactive',
                'Notes': customer.notes || '',
                'Created At': customer.created_at ? new Date(customer.created_at).toLocaleString() : ''
            }));

            // Create worksheet
            const ws = XLSX.utils.json_to_sheet(exportData);

            // Set column widths
            const columnWidths = [
                { wch: 15 }, // Customer Code
                { wch: 25 }, // Full Name
                { wch: 30 }, // Email
                { wch: 15 }, // Phone
                { wch: 25 }, // Company
                { wch: 40 }, // Address
                { wch: 15 }, // City
                { wch: 15 }, // Province
                { wch: 10 }, // ZIP Code
                { wch: 15 }, // Country
                { wch: 20 }, // Tax ID
                { wch: 30 }, // Website
                { wch: 15 }, // Credit Limit
                { wch: 10 }, // Status
                { wch: 40 }, // Notes
                { wch: 20 }  // Created At
            ];
            ws['!cols'] = columnWidths;

            // Create workbook
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Customers');

            // Generate filename with timestamp
            const filename = `customers_export_${new Date().toISOString().split('T')[0]}.xlsx`;

            // Download file
            XLSX.writeFile(wb, filename);

            alert(`Successfully exported ${customers.length} customers!`);
        } catch (error) {
            console.error('Export error:', error);
            alert('Error exporting customers. Please try again.');
        }
    };

    // Import from Excel
    const importFromExcel = (event) => {
        const file = event.target.files[0];
        if (!file) return;

        setImporting(true);

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });

                // Get first sheet
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];

                // Convert to JSON
                const jsonData = XLSX.utils.sheet_to_json(worksheet);

                if (jsonData.length === 0) {
                    alert('No data found in the Excel file!');
                    setImporting(false);
                    return;
                }

                // Import to Supabase
                let successCount = 0;
                let errorCount = 0;
                const customersToInsert = [];

                for (const row of jsonData) {
                    try {
                        // Validate required fields
                        if (!row['Full Name'] || !row['Email'] || !row['Phone']) {
                            errorCount++;
                            continue;
                        }

                        // Generate customer code if not provided
                        const customerCode = row['Customer Code'] || `CUST-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

                        // Prepare customer data
                        const customerData = {
                            customer_code: customerCode,
                            full_name: row['Full Name'] || '',
                            email: row['Email'] || '',
                            phone: row['Phone'] || '',
                            company_name: row['Company'] || '',
                            address: row['Address'] || '',
                            city: row['City'] || '',
                            province: row['Province'] || '',
                            postal_code: row['ZIP Code'] || '',
                            country: row['Country'] || 'Philippines',
                            tax_id: row['Tax ID'] || '',
                            website: row['Website'] || '',
                            credit_limit: row['Credit Limit'] ? parseFloat(row['Credit Limit']) : null,
                            is_active: row['Status']?.toLowerCase() !== 'inactive',
                            notes: row['Notes'] || '',
                            created_at: new Date().toISOString(),
                            updated_at: new Date().toISOString()
                        };

                        customersToInsert.push(customerData);
                        successCount++;
                    } catch (err) {
                        console.error('Error processing row:', err);
                        errorCount++;
                    }
                }

                // Batch insert to Supabase
                if (customersToInsert.length > 0) {
                    const { error: insertError } = await supabase
                        .from('customers')
                        .insert(customersToInsert);

                    if (insertError) {
                        console.error('Insert error:', insertError);
                        alert('Error inserting customers. Some data may not have been imported.');
                    }
                }

                setImporting(false);
                event.target.value = ''; // Reset file input

                // Refresh customer list
                await fetchCustomers();

                // Show result
                alert(
                    `Import completed!\n\nSuccessfully imported: ${successCount}\nFailed: ${errorCount}`
                );
            } catch (error) {
                console.error('Import error:', error);
                alert('Error importing file. Please check the file format and try again.');
                setImporting(false);
                event.target.value = '';
            }
        };

        reader.readAsArrayBuffer(file);
    };

    // Download template
    const downloadTemplate = () => {
        const templateData = [
            {
                'Customer Code': 'CUST-001',
                'Full Name': 'Juan Dela Cruz',
                'Email': 'juan@example.com',
                'Phone': '+63 912 345 6789',
                'Company': 'ABC Corporation',
                'Address': '123 Main Street, Building A',
                'City': 'Manila',
                'Province': 'Metro Manila',
                'ZIP Code': '1000',
                'Country': 'Philippines',
                'Tax ID': '123-456-789-000',
                'Website': 'https://example.com',
                'Credit Limit': '100000',
                'Status': 'Active',
                'Notes': 'VIP Customer'
            },
            {
                'Customer Code': 'CUST-002',
                'Full Name': 'Maria Santos',
                'Email': 'maria@example.com',
                'Phone': '+63 917 123 4567',
                'Company': '',
                'Address': '456 Oak Street',
                'City': 'Quezon City',
                'Province': 'Metro Manila',
                'ZIP Code': '1100',
                'Country': 'Philippines',
                'Tax ID': '',
                'Website': '',
                'Credit Limit': '',
                'Status': 'Active',
                'Notes': ''
            }
        ];

        const ws = XLSX.utils.json_to_sheet(templateData);

        // Set column widths
        const columnWidths = [
            { wch: 15 }, { wch: 25 }, { wch: 30 }, { wch: 15 },
            { wch: 25 }, { wch: 40 }, { wch: 15 }, { wch: 15 },
            { wch: 10 }, { wch: 15 }, { wch: 20 }, { wch: 30 },
            { wch: 15 }, { wch: 10 }, { wch: 40 }
        ];
        ws['!cols'] = columnWidths;

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Customer Template');

        XLSX.writeFile(wb, 'customer_import_template.xlsx');
    };

    // Filter customers based on search
    const filteredCustomers = customers.filter(customer => {
        const searchLower = searchTerm.toLowerCase();
        return (
            customer.full_name?.toLowerCase().includes(searchLower) ||
            customer.email?.toLowerCase().includes(searchLower) ||
            customer.phone?.toLowerCase().includes(searchLower) ||
            customer.company_name?.toLowerCase().includes(searchLower)
        );
    });

    // View customer details
    const viewCustomer = (customer) => {
        setSelectedCustomer(customer);
        setShowModal(true);
    };

    // Close modal
    const closeModal = () => {
        setShowModal(false);
        setSelectedCustomer(null);
    };

    return (
        <div className="p-6">
            <div className="mx-auto max-w-7xl">
                {/* Header */}
                <div className="p-6 mb-6 bg-white border border-gray-200 rounded-lg shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-800">Customer List</h1>
                            <p className="mt-1 text-sm text-gray-600">
                                Total Customers: <span className="font-semibold">{customers.length}</span>
                            </p>
                        </div>

                        {/* Import/Export Buttons */}
                        <div className="flex space-x-3">
                            {/* Download Template */}
                            <button
                                onClick={downloadTemplate}
                                className="flex items-center px-4 py-2 space-x-2 text-sm font-medium text-gray-700 transition-colors bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                                title="Download Excel Template"
                            >
                                <FaDownload />
                                <span>Template</span>
                            </button>

                            {/* Import Button */}
                            <label className="flex items-center px-4 py-2 space-x-2 text-sm font-medium text-gray-700 transition-colors bg-white border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
                                <input
                                    type="file"
                                    accept=".xlsx, .xls"
                                    onChange={importFromExcel}
                                    className="hidden"
                                    disabled={importing}
                                />
                                <FaFileImport />
                                <span>{importing ? 'Importing...' : 'Import'}</span>
                            </label>

                            {/* Export Button */}
                            <button
                                onClick={exportToExcel}
                                disabled={customers.length === 0}
                                className="flex items-center px-4 py-2 space-x-2 text-sm font-medium text-gray-700 transition-colors bg-white border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50"
                            >
                                <FaFileExport />
                                <span>Export</span>
                            </button>
                        </div>
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="p-4 mb-4 border border-red-200 rounded-lg bg-red-50">
                            <p className="text-sm text-red-800">Error loading customers: {error}</p>
                        </div>
                    )}

                    {/* Search Bar */}
                    <div className="relative">
                        <FaSearch className="absolute text-gray-400 -translate-y-1/2 left-4 top-1/2" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Search by name, email, phone, or company..."
                            className="w-full py-3 pl-12 pr-4 border border-gray-300 rounded-lg focus:outline-none focus:border-gray-500 focus:ring-1 focus:ring-gray-500"
                        />
                    </div>
                </div>

                {/* Table */}
                <div className="overflow-hidden bg-white border border-gray-200 rounded-lg shadow-sm">
                    {loading ? (
                        <div className="p-12 text-center">
                            <div className="inline-block w-8 h-8 border-b-2 border-gray-800 rounded-full animate-spin"></div>
                            <p className="mt-4 text-gray-600">Loading customers...</p>
                        </div>
                    ) : filteredCustomers.length === 0 ? (
                        <div className="p-12 text-center">
                            <FaUser className="mx-auto mb-4 text-5xl text-gray-300" />
                            <p className="text-lg text-gray-600">No customers found</p>
                            <p className="mt-2 text-sm text-gray-500">
                                {searchTerm ? 'Try a different search term' : 'Start by importing customers or adding a new one'}
                            </p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="border-b border-gray-200 bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-4 text-xs font-semibold tracking-wider text-left text-gray-700 uppercase">
                                            Name
                                        </th>
                                        <th className="px-6 py-4 text-xs font-semibold tracking-wider text-left text-gray-700 uppercase">
                                            Email
                                        </th>
                                        <th className="px-6 py-4 text-xs font-semibold tracking-wider text-left text-gray-700 uppercase">
                                            Phone
                                        </th>
                                        <th className="px-6 py-4 text-xs font-semibold tracking-wider text-left text-gray-700 uppercase">
                                            Company
                                        </th>
                                        <th className="px-6 py-4 text-xs font-semibold tracking-wider text-left text-gray-700 uppercase">
                                            City
                                        </th>
                                        <th className="px-6 py-4 text-xs font-semibold tracking-wider text-center text-gray-700 uppercase">
                                            Action
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                    {filteredCustomers.map((customer) => (
                                        <tr key={customer.id} className="transition-colors hover:bg-gray-50">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center">
                                                    <div className="flex items-center justify-center w-10 h-10 mr-3 bg-gray-100 rounded-full">
                                                        <FaUser className="text-sm text-gray-600" />
                                                    </div>
                                                    <div>
                                                        <div className="text-sm font-semibold text-gray-900">
                                                            {customer.full_name}
                                                        </div>
                                                        <div className="text-xs text-gray-500">
                                                            {customer.customer_code}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm text-gray-700">{customer.email}</div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm text-gray-700">{customer.phone}</div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm text-gray-700">
                                                    {customer.company_name || '-'}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm text-gray-700">
                                                    {customer.city || '-'}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-center whitespace-nowrap">
                                                <button
                                                    onClick={() => viewCustomer(customer)}
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
                {!loading && filteredCustomers.length > 0 && (
                    <div className="mt-4 text-sm text-center text-gray-600">
                        Showing {filteredCustomers.length} of {customers.length} customers
                    </div>
                )}
            </div>

            {/* View Modal */}
            {showModal && selectedCustomer && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
                    <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
                        {/* Modal Header */}
                        <div className="sticky top-0 flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200">
                            <h2 className="text-xl font-bold text-gray-800">Customer Details</h2>
                            <button
                                onClick={closeModal}
                                className="p-2 transition-colors rounded-lg hover:bg-gray-100"
                            >
                                <FaTimes className="text-gray-600" />
                            </button>
                        </div>

                        {/* Modal Content */}
                        <div className="p-6 space-y-6">
                            {/* Customer Code Badge */}
                            <div>
                                <span className="inline-flex px-4 py-2 text-sm font-semibold text-blue-800 bg-blue-100 rounded-lg">
                                    {selectedCustomer.customer_code}
                                </span>
                            </div>

                            {/* Basic Information */}
                            <div>
                                <h3 className="flex items-center mb-4 text-sm font-semibold tracking-wider text-gray-500 uppercase">
                                    <FaIdCard className="mr-2" />
                                    Basic Information
                                </h3>
                                <div className="p-4 space-y-3 rounded-lg bg-gray-50">
                                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                        <div>
                                            <p className="mb-1 text-xs font-semibold text-gray-500 uppercase">
                                                Full Name
                                            </p>
                                            <p className="text-sm font-medium text-gray-900">{selectedCustomer.full_name}</p>
                                        </div>

                                        {selectedCustomer.company_name && (
                                            <div>
                                                <p className="mb-1 text-xs font-semibold text-gray-500 uppercase">Company Name</p>
                                                <p className="text-sm font-medium text-gray-900">{selectedCustomer.company_name}</p>
                                            </div>
                                        )}

                                        <div>
                                            <p className="flex items-center mb-1 text-xs font-semibold text-gray-500 uppercase">
                                                <FaEnvelope className="mr-1" />
                                                Email
                                            </p>
                                            <p className="text-sm text-gray-900">{selectedCustomer.email}</p>
                                        </div>

                                        <div>
                                            <p className="flex items-center mb-1 text-xs font-semibold text-gray-500 uppercase">
                                                <FaPhone className="mr-1" />
                                                Phone
                                            </p>
                                            <p className="text-sm text-gray-900">{selectedCustomer.phone}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Address Information */}
                            {(selectedCustomer.address || selectedCustomer.city || selectedCustomer.province) && (
                                <div>
                                    <h3 className="flex items-center mb-4 text-sm font-semibold tracking-wider text-gray-500 uppercase">
                                        <FaMapMarkerAlt className="mr-2" />
                                        Address Information
                                    </h3>
                                    <div className="p-4 space-y-3 rounded-lg bg-gray-50">
                                        {selectedCustomer.address && (
                                            <div>
                                                <p className="mb-1 text-xs font-semibold text-gray-500 uppercase">Street Address</p>
                                                <p className="text-sm text-gray-900">{selectedCustomer.address}</p>
                                            </div>
                                        )}

                                        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                                            {selectedCustomer.city && (
                                                <div>
                                                    <p className="mb-1 text-xs font-semibold text-gray-500 uppercase">City</p>
                                                    <p className="text-sm text-gray-900">{selectedCustomer.city}</p>
                                                </div>
                                            )}

                                            {selectedCustomer.province && (
                                                <div>
                                                    <p className="mb-1 text-xs font-semibold text-gray-500 uppercase">Province</p>
                                                    <p className="text-sm text-gray-900">{selectedCustomer.province}</p>
                                                </div>
                                            )}

                                            {selectedCustomer.postal_code && (
                                                <div>
                                                    <p className="mb-1 text-xs font-semibold text-gray-500 uppercase">ZIP Code</p>
                                                    <p className="text-sm text-gray-900">{selectedCustomer.postal_code}</p>
                                                </div>
                                            )}
                                        </div>

                                        {selectedCustomer.country && (
                                            <div>
                                                <p className="mb-1 text-xs font-semibold text-gray-500 uppercase">Country</p>
                                                <p className="text-sm text-gray-900">{selectedCustomer.country}</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Additional Information */}
                            {(selectedCustomer.tax_id || selectedCustomer.website || selectedCustomer.credit_limit || selectedCustomer.notes) && (
                                <div>
                                    <h3 className="flex items-center mb-4 text-sm font-semibold tracking-wider text-gray-500 uppercase">
                                        <FaBuilding className="mr-2" />
                                        Additional Information
                                    </h3>
                                    <div className="p-4 space-y-3 rounded-lg bg-gray-50">
                                        {selectedCustomer.tax_id && (
                                            <div>
                                                <p className="mb-1 text-xs font-semibold text-gray-500 uppercase">Tax ID / TIN</p>
                                                <p className="text-sm text-gray-900">{selectedCustomer.tax_id}</p>
                                            </div>
                                        )}

                                        {selectedCustomer.website && (
                                            <div>
                                                <p className="flex items-center mb-1 text-xs font-semibold text-gray-500 uppercase">
                                                    <FaGlobe className="mr-1" />
                                                    Website
                                                </p>
                                                <a
                                                    href={selectedCustomer.website}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-sm text-blue-600 hover:underline"
                                                >
                                                    {selectedCustomer.website}
                                                </a>
                                            </div>
                                        )}

                                        {selectedCustomer.credit_limit && (
                                            <div>
                                                <p className="mb-1 text-xs font-semibold text-gray-500 uppercase">Credit Limit</p>
                                                <p className="text-sm font-medium text-gray-900">₱{selectedCustomer.credit_limit.toFixed(2)}</p>
                                            </div>
                                        )}

                                        {selectedCustomer.notes && (
                                            <div>
                                                <p className="mb-1 text-xs font-semibold text-gray-500 uppercase">Notes</p>
                                                <p className="text-sm text-gray-900">{selectedCustomer.notes}</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Metadata */}
                            <div>
                                <h3 className="mb-4 text-sm font-semibold tracking-wider text-gray-500 uppercase">
                                    Record Information
                                </h3>
                                <div className="p-4 space-y-2 rounded-lg bg-gray-50">
                                    {selectedCustomer.created_at && (
                                        <div className="flex items-center justify-between">
                                            <p className="text-xs font-semibold text-gray-500 uppercase">Created At</p>
                                            <p className="text-sm text-gray-900">
                                                {new Date(selectedCustomer.created_at).toLocaleString('en-US', {
                                                    year: 'numeric',
                                                    month: 'long',
                                                    day: 'numeric',
                                                    hour: '2-digit',
                                                    minute: '2-digit'
                                                })}
                                            </p>
                                        </div>
                                    )}
                                    {selectedCustomer.updated_at && (
                                        <div className="flex items-center justify-between">
                                            <p className="text-xs font-semibold text-gray-500 uppercase">Last Updated</p>
                                            <p className="text-sm text-gray-900">
                                                {new Date(selectedCustomer.updated_at).toLocaleString('en-US', {
                                                    year: 'numeric',
                                                    month: 'long',
                                                    day: 'numeric',
                                                    hour: '2-digit',
                                                    minute: '2-digit'
                                                })}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
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

export default CustomerList;