import React, { useState, useEffect } from 'react';
import { FaCheck, FaTimes, FaEye, FaChevronDown, FaClock } from 'react-icons/fa';
import { supabase } from '../../lib/supabaseClient';

export default function ClientApproval() {
    const [pendingClients, setPendingClients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedClient, setSelectedClient] = useState(null);
    const [approvalNotes, setApprovalNotes] = useState('');
    const [processingId, setProcessingId] = useState(null);
    const [message, setMessage] = useState('');
    const [messageType, setMessageType] = useState('');

    // Fetch pending clients
    useEffect(() => {
        fetchPendingClients();
    }, []);

    const fetchPendingClients = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('client_profile')
                .select('*')
                .eq('status', 'pending')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setPendingClients(data || []);
        } catch (error) {
            setMessage(`Error fetching pending clients: ${error.message}`);
            setMessageType('error');
        } finally {
            setLoading(false);
        }
    };

    const handleApprove = async (clientId) => {
        if (!clientId) return;
        
        setProcessingId(clientId);
        setMessage('');

        try {
            console.log('Approving client:', clientId);
            
            // Update pending client to approved
            const { data, error } = await supabase
                .from('client_profile')
                .update({
                    status: 'approved',
                    approval_notes: approvalNotes || 'Approved',
                    approved_date: new Date().toISOString().split('T')[0],
                    approved_by: 'Admin'
                })
                .eq('id', clientId)
                .select();

            console.log('Update response:', { data, error });

            if (error) throw error;

            setMessage('✅ Client approved successfully!');
            setMessageType('success');
            setApprovalNotes('');
            setSelectedClient(null);

            // Refresh list
            setTimeout(() => {
                fetchPendingClients();
            }, 1500);
        } catch (error) {
            console.error('Approval error:', error);
            setMessage(`❌ Error: ${error.message}`);
            setMessageType('error');
        } finally {
            setProcessingId(null);
        }
    };

    const handleReject = async (clientId) => {
        if (!clientId || !approvalNotes.trim()) {
            setMessage('Please provide rejection notes');
            setMessageType('error');
            return;
        }

        setProcessingId(clientId);
        setMessage('');

        try {
            console.log('Rejecting client:', clientId);

            const { data, error } = await supabase
                .from('client_profile')
                .update({
                    status: 'rejected',
                    approval_notes: approvalNotes,
                    approved_date: new Date().toISOString().split('T')[0],
                    approved_by: 'Admin'
                })
                .eq('id', clientId)
                .select();

            console.log('Rejection response:', { data, error });

            if (error) throw error;

            setMessage('✅ Client profile rejected');
            setMessageType('success');
            setApprovalNotes('');
            setSelectedClient(null);

            setTimeout(() => {
                fetchPendingClients();
            }, 1500);
        } catch (error) {
            console.error('Rejection error:', error);
            setMessage(`❌ Error: ${error.message}`);
            setMessageType('error');
        } finally {
            setProcessingId(null);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
                <div className="text-center">
                    <div className="w-12 h-12 mx-auto mb-4 border-b-2 border-blue-600 rounded-full animate-spin"></div>
                    <p className="text-slate-600">Loading pending approvals...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen p-6 bg-gradient-to-br from-slate-50 to-slate-100">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="mb-2 text-4xl font-bold text-slate-900">Client Approval Management</h1>
                    <p className="text-slate-600">Review and approve pending client profiles</p>
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
                <div className="grid grid-cols-1 gap-4 mb-8 md:grid-cols-3">
                    <div className="p-6 bg-white rounded-lg shadow">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-yellow-100 rounded-lg">
                                <FaClock className="text-2xl text-yellow-600" />
                            </div>
                            <div>
                                <p className="text-sm text-slate-600">Pending Approval</p>
                                <p className="text-3xl font-bold text-slate-900">{pendingClients.length}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Main Content */}
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                    {/* Pending List */}
                    <div className="lg:col-span-2">
                        <div className="overflow-hidden bg-white shadow-lg rounded-xl">
                            <div className="p-6 border-b border-slate-200">
                                <h2 className="text-xl font-semibold text-slate-900">Pending Clients</h2>
                            </div>

                            {pendingClients.length === 0 ? (
                                <div className="p-12 text-center">
                                    <p className="text-slate-600">No pending approvals at the moment</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-slate-200">
                                    {pendingClients.map(client => (
                                        <div key={client.id} className="p-6 transition hover:bg-slate-50">
                                            <div className="flex items-center justify-between mb-4">
                                                <div className="flex-1">
                                                    <h3 className="text-lg font-semibold text-slate-900">{client.company_name}</h3>
                                                    <p className="text-sm text-slate-600">ID: {client.customer_id} | Type: {client.customer_type}</p>
                                                </div>
                                                <button
                                                    onClick={() => setSelectedClient(selectedClient?.id === client.id ? null : client)}
                                                    className="p-2 transition rounded-lg hover:bg-slate-200"
                                                >
                                                    <FaChevronDown className={`transition transform ${selectedClient?.id === client.id ? 'rotate-180' : ''}`} />
                                                </button>
                                            </div>

                                            {selectedClient?.id === client.id && (
                                                <div className="pt-6 mt-6 space-y-4 border-t border-slate-200">
                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div>
                                                            <p className="text-xs font-semibold uppercase text-slate-600">Contact Person</p>
                                                            <p className="text-slate-900">{client.contact_person}</p>
                                                        </div>
                                                        <div>
                                                            <p className="text-xs font-semibold uppercase text-slate-600">Email</p>
                                                            <p className="text-slate-900">{client.email_address}</p>
                                                        </div>
                                                        <div>
                                                            <p className="text-xs font-semibold uppercase text-slate-600">Mobile</p>
                                                            <p className="text-slate-900">{client.mobile_number}</p>
                                                        </div>
                                                        <div>
                                                            <p className="text-xs font-semibold uppercase text-slate-600">Region</p>
                                                            <p className="text-slate-900">{client.region || 'N/A'}</p>
                                                        </div>
                                                    </div>

                                                    {client.address && (
                                                        <div>
                                                            <p className="text-xs font-semibold uppercase text-slate-600">Address</p>
                                                            <p className="text-slate-900">{client.address}</p>
                                                        </div>
                                                    )}

                                                    <div>
                                                        <label className="block mb-2 text-sm font-semibold text-slate-700">
                                                            Approval Notes
                                                        </label>
                                                        <textarea
                                                            value={approvalNotes}
                                                            onChange={(e) => setApprovalNotes(e.target.value)}
                                                            placeholder="Add approval or rejection notes..."
                                                            className="w-full px-4 py-3 border-2 rounded-lg border-slate-300 focus:border-blue-500 focus:outline-none"
                                                            rows="3"
                                                        />
                                                    </div>

                                                    <div className="flex gap-3 pt-4">
                                                        <button
                                                            onClick={() => handleApprove(client.id)}
                                                            disabled={processingId === client.id}
                                                            className="flex items-center justify-center flex-1 gap-2 px-4 py-3 font-semibold text-white transition bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50"
                                                        >
                                                            <FaCheck /> Approve
                                                        </button>
                                                        <button
                                                            onClick={() => handleReject(client.id)}
                                                            disabled={processingId === client.id || !approvalNotes.trim()}
                                                            className="flex items-center justify-center flex-1 gap-2 px-4 py-3 font-semibold text-white transition bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
                                                        >
                                                            <FaTimes /> Reject
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Summary Panel */}
                    <div className="p-6 bg-white shadow-lg rounded-xl">
                        <h3 className="mb-6 text-lg font-semibold text-slate-900">Approval Summary</h3>
                        
                        {selectedClient ? (
                            <div className="space-y-4">
                                <div className="p-4 rounded-lg bg-blue-50">
                                    <p className="mb-2 text-sm text-slate-600">Currently Reviewing</p>
                                    <p className="font-semibold text-slate-900">{selectedClient.company_name}</p>
                                </div>

                                <div className="space-y-3">
                                    <div>
                                        <p className="text-xs font-semibold uppercase text-slate-600">Submitted</p>
                                        <p className="text-slate-900">{new Date(selectedClient.created_at).toLocaleDateString()}</p>
                                    </div>
                                </div>

                                <button
                                    onClick={() => setSelectedClient(null)}
                                    className="w-full px-4 py-2 text-sm transition border rounded-lg text-slate-600 border-slate-300 hover:bg-slate-50"
                                >
                                    Clear Selection
                                </button>
                            </div>
                        ) : (
                            <div className="py-8 text-center">
                                <p className="mb-4 text-slate-600">Select a client to view details</p>
                                <FaEye className="mx-auto text-4xl text-slate-300" />
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}