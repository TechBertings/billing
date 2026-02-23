import React, { useState, useEffect } from 'react';
import { FaSearch, FaEye, FaEdit, FaTrashAlt, FaDownload } from 'react-icons/fa';
import { supabase } from '../../lib/supabaseClient';

export default function ClientProfileList() {
    const [clients, setClients] = useState([]);
    const [filteredClients, setFilteredClients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState('all');
    const [selectedClient, setSelectedClient] = useState(null);
    const [message, setMessage] = useState('');
    const [messageType, setMessageType] = useState('');

    const customerTypes = ['all', 'Single Proprietorship', 'SME', 'Corporation'];

    // Fetch approved clients
    useEffect(() => {
        fetchClients();
    }, []);

    // Filter clients based on search and type
    useEffect(() => {
        let filtered = clients;

        // Filter by type
        if (filterType !== 'all') {
            filtered = filtered.filter(c => c.customer_type === filterType);
        }

        // Filter by search term
        if (searchTerm.trim()) {
            const term = searchTerm.toLowerCase();
            filtered = filtered.filter(c =>
                c.company_name.toLowerCase().includes(term) ||
                c.customer_id.toLowerCase().includes(term) ||
                c.email_address.toLowerCase().includes(term) ||
                (c.tin_number && c.tin_number.toLowerCase().includes(term))
            );
        }

        setFilteredClients(filtered);
    }, [searchTerm, filterType, clients]);

    const fetchClients = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('client_profile')
                .select('*')
                .eq('status', 'approved')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setClients(data || []);
        } catch (error) {
            setMessage(`Error fetching clients: ${error.message}`);
            setMessageType('error');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (clientId) => {
        if (!window.confirm('Are you sure you want to deactivate this client?')) return;

        try {
            const { error } = await supabase
                .from('client_profile')
                .update({ status: 'inactive' })
                .eq('id', clientId);

            if (error) throw error;

            setMessage('✅ Client deactivated successfully');
            setMessageType('success');
            fetchClients();
            setSelectedClient(null);
        } catch (error) {
            setMessage(`❌ Error: ${error.message}`);
            setMessageType('error');
        }
    };

    const handleExportCSV = () => {
        const headers = ['Customer ID', 'Company Name', 'Type', 'Contact Person', 'Email', 'Mobile', 'TIN', 'Address'];
        const rows = filteredClients.map(c => [
            c.customer_id,
            c.company_name,
            c.customer_type,
            c.contact_person,
            c.email_address,
            c.mobile_number,
            c.tin_number || '',
            c.address || ''
        ]);

        let csv = headers.join(',') + '\n';
        rows.forEach(row => {
            csv += row.map(cell => `"${cell || ''}"`).join(',') + '\n';
        });

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `client_profiles_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
                <div className="text-center">
                    <div className="w-12 h-12 mx-auto mb-4 border-b-2 border-blue-600 rounded-full animate-spin"></div>
                    <p className="text-slate-600">Loading client profiles...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen p-6 bg-gradient-to-br from-slate-50 to-slate-100">
            <div className="mx-auto max-w-7xl">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="mb-2 text-4xl font-bold text-slate-900">Client Profiles</h1>
                    <p className="text-slate-600">View and manage approved client information</p>
                </div>

                {/* Message Alert */}
                {message && (
                    <div className={`mb-6 p-4 rounded-lg border-l-4 ${
                        messageType === 'success' 
                            ? 'bg-green-50 border-green-500 text-green-700' 
                            : 'bg-red-50 border-red-500 text-red-700'
                    }`}>
                        {message}
                    </div>
                )}

                {/* Stats */}
                <div className="grid grid-cols-1 gap-4 mb-8 md:grid-cols-4">
                    <div className="p-6 bg-white rounded-lg shadow">
                        <p className="text-sm text-slate-600">Total Clients</p>
                        <p className="text-3xl font-bold text-slate-900">{clients.length}</p>
                    </div>
                    <div className="p-6 bg-white rounded-lg shadow">
                        <p className="text-sm text-slate-600">SME</p>
                        <p className="text-3xl font-bold text-blue-600">{clients.filter(c => c.customer_type === 'SME').length}</p>
                    </div>
                    <div className="p-6 bg-white rounded-lg shadow">
                        <p className="text-sm text-slate-600">Corporation</p>
                        <p className="text-3xl font-bold text-purple-600">{clients.filter(c => c.customer_type === 'Corporation').length}</p>
                    </div>
                    <div className="p-6 bg-white rounded-lg shadow">
                        <p className="text-sm text-slate-600">Single Proprietorship</p>
                        <p className="text-3xl font-bold text-green-600">{clients.filter(c => c.customer_type === 'Single Proprietorship').length}</p>
                    </div>
                </div>

                {/* Filters and Search */}
                <div className="p-6 mb-8 bg-white shadow-lg rounded-xl">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                        {/* Search */}
                        <div>
                            <label className="block mb-2 text-sm font-semibold text-slate-700">Search</label>
                            <div className="relative">
                                <FaSearch className="absolute left-3 top-3.5 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Company name, ID, email, TIN..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full px-4 py-2 pl-10 border-2 rounded-lg border-slate-300 focus:border-blue-500 focus:outline-none"
                                />
                            </div>
                        </div>

                        {/* Filter by Type */}
                        <div>
                            <label className="block mb-2 text-sm font-semibold text-slate-700">Customer Type</label>
                            <select
                                value={filterType}
                                onChange={(e) => setFilterType(e.target.value)}
                                className="w-full px-4 py-2 border-2 rounded-lg cursor-pointer border-slate-300 focus:border-blue-500 focus:outline-none"
                            >
                                {customerTypes.map(type => (
                                    <option key={type} value={type}>
                                        {type === 'all' ? 'All Types' : type}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Export Button */}
                        <div className="flex items-end">
                            <button
                                onClick={handleExportCSV}
                                className="flex items-center justify-center w-full gap-2 px-4 py-2 font-semibold text-white transition bg-green-600 rounded-lg hover:bg-green-700"
                            >
                                <FaDownload /> Export CSV
                            </button>
                        </div>
                    </div>
                </div>

                {/* Results Count */}
                <div className="mb-4 text-sm text-slate-600">
                    Showing {filteredClients.length} of {clients.length} clients
                </div>

                {/* Table */}
                <div className="overflow-hidden bg-white shadow-lg rounded-xl">
                    {filteredClients.length === 0 ? (
                        <div className="p-12 text-center">
                            <p className="text-lg text-slate-600">No clients found</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="border-b-2 bg-slate-50 border-slate-200">
                                    <tr>
                                        <th className="px-6 py-4 text-sm font-semibold text-left text-slate-900">Company</th>
                                        <th className="px-6 py-4 text-sm font-semibold text-left text-slate-900">Customer ID</th>
                                        <th className="px-6 py-4 text-sm font-semibold text-left text-slate-900">Type</th>
                                        <th className="px-6 py-4 text-sm font-semibold text-left text-slate-900">Contact</th>
                                        <th className="px-6 py-4 text-sm font-semibold text-left text-slate-900">Email</th>
                                        <th className="px-6 py-4 text-sm font-semibold text-left text-slate-900">TIN</th>
                                        <th className="px-6 py-4 text-sm font-semibold text-center text-slate-900">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200">
                                    {filteredClients.map(client => (
                                        <tr key={client.id} className="transition hover:bg-slate-50">
                                            <td className="px-6 py-4">
                                                <p className="font-semibold text-slate-900">{client.company_name}</p>
                                            </td>
                                            <td className="px-6 py-4">
                                                <p className="font-mono text-sm text-slate-600">{client.customer_id}</p>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                                                    client.customer_type === 'SME' ? 'bg-blue-100 text-blue-800' :
                                                    client.customer_type === 'Corporation' ? 'bg-purple-100 text-purple-800' :
                                                    'bg-green-100 text-green-800'
                                                }`}>
                                                    {client.customer_type}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <p className="text-sm text-slate-600">{client.contact_person}</p>
                                            </td>
                                            <td className="px-6 py-4">
                                                <p className="text-sm text-slate-600">{client.email_address}</p>
                                            </td>
                                            <td className="px-6 py-4">
                                                <p className="font-mono text-sm text-slate-600">{client.tin_number || 'N/A'}</p>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center justify-center gap-2">
                                                    <button
                                                        onClick={() => setSelectedClient(selectedClient?.id === client.id ? null : client)}
                                                        className="p-2 text-blue-600 transition rounded-lg hover:bg-blue-100"
                                                        title="View Details"
                                                    >
                                                        <FaEye />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(client.id)}
                                                        className="p-2 text-red-600 transition rounded-lg hover:bg-red-100"
                                                        title="Deactivate"
                                                    >
                                                        <FaTrashAlt />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Detail Modal */}
                {selectedClient && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
                        <div className="w-full max-w-2xl overflow-y-auto bg-white shadow-2xl rounded-xl max-h-96">
                            <div className="p-8">
                                <div className="flex items-start justify-between mb-6">
                                    <h2 className="text-2xl font-bold text-slate-900">{selectedClient.company_name}</h2>
                                    <button
                                        onClick={() => setSelectedClient(null)}
                                        className="text-slate-600 hover:text-slate-900"
                                    >
                                        ✕
                                    </button>
                                </div>

                                <div className="grid grid-cols-2 gap-6">
                                    <div>
                                        <p className="mb-1 text-xs font-semibold uppercase text-slate-600">Customer ID</p>
                                        <p className="font-mono text-slate-900">{selectedClient.customer_id}</p>
                                    </div>
                                    <div>
                                        <p className="mb-1 text-xs font-semibold uppercase text-slate-600">TIN</p>
                                        <p className="font-mono text-slate-900">{selectedClient.tin_number || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <p className="mb-1 text-xs font-semibold uppercase text-slate-600">Contact Person</p>
                                        <p className="text-slate-900">{selectedClient.contact_person}</p>
                                    </div>
                                    <div>
                                        <p className="mb-1 text-xs font-semibold uppercase text-slate-600">Email</p>
                                        <p className="text-slate-900">{selectedClient.email_address}</p>
                                    </div>
                                    <div>
                                        <p className="mb-1 text-xs font-semibold uppercase text-slate-600">Mobile</p>
                                        <p className="text-slate-900">{selectedClient.mobile_number}</p>
                                    </div>
                                    <div>
                                        <p className="mb-1 text-xs font-semibold uppercase text-slate-600">Type</p>
                                        <p className="text-slate-900">{selectedClient.customer_type}</p>
                                    </div>
                                    {selectedClient.address && (
                                        <div className="col-span-2">
                                            <p className="mb-1 text-xs font-semibold uppercase text-slate-600">Address</p>
                                            <p className="text-slate-900">{selectedClient.address}</p>
                                        </div>
                                    )}
                                    {selectedClient.approved_date && (
                                        <div className="col-span-2">
                                            <p className="mb-1 text-xs font-semibold uppercase text-slate-600">Approved Date</p>
                                            <p className="text-slate-900">{new Date(selectedClient.approved_date).toLocaleDateString()}</p>
                                        </div>
                                    )}
                                </div>

                                <button
                                    onClick={() => setSelectedClient(null)}
                                    className="w-full px-4 py-2 mt-6 font-semibold transition rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-900"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}