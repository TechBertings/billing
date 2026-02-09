import React, { useState } from 'react';
import {
    FaUser,
    FaEnvelope,
    FaPhone,
    FaMapMarkerAlt,
    FaBuilding,
    FaSave,
    FaTimes,
    FaCheckCircle,
    FaSpinner,
    FaIdCard,
    FaGlobe,
    FaCity
} from 'react-icons/fa';
import { getFromLocalStorage, saveToLocalStorage, generateId } from '../utils/localStorage';

const CreateCustomer = () => {
    const [loading, setLoading] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);

    // Customer form state
    const [customer, setCustomer] = useState({
        name: '',
        email: '',
        phone: '',
        company: '',
        address: '',
        city: '',
        province: '',
        zipCode: '',
        country: 'Philippines',
        taxId: '',
        website: '',
        notes: '',
        customerType: 'individual',
        status: 'active',
        createdAt: new Date().toISOString()
    });

    // Handle input change
    const handleChange = (e) => {
        const { name, value } = e.target;
        setCustomer(prev => ({
            ...prev,
            [name]: value
        }));
    };

  
    // Save customer to localStorage
    const saveCustomer = async () => {
        // Validation
        if (!customer.name.trim()) {
            alert('Please enter customer name!');
            return;
        }
        if (!customer.email.trim()) {
            alert('Please enter customer email!');
            return;
        }
        if (!customer.phone.trim()) {
            alert('Please enter customer phone number!');
            return;
        }

        setLoading(true);
        try {
            // Get existing customers
            const existingCustomers = getFromLocalStorage('customers') || {};
            
            // Create new customer with ID
            const customerId = generateId();
            const customerData = {
                ...customer,
                id: customerId,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            // Add to customers object
            existingCustomers[customerId] = customerData;
            
            // Save to localStorage
            saveToLocalStorage('customers', existingCustomers);

            setShowSuccess(true);
            setTimeout(() => {
                setShowSuccess(false);
                resetForm();
            }, 2000);
        } catch (error) {
            console.error('Error saving customer:', error);
            alert('Error saving customer. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    // Reset form
    const resetForm = () => {
        setCustomer({
            name: '',
            email: '',
            phone: '',
            company: '',
            address: '',
            city: '',
            province: '',
            zipCode: '',
            country: 'Philippines',
            taxId: '',
            website: '',
            notes: '',
            customerType: 'individual',
            status: 'active',
            createdAt: new Date().toISOString()
        });
    };

    return (
        <div className="min-h-screen p-6 bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
            <div className="max-w-5xl mx-auto">
                {/* Header */}
                <div className="p-8 mb-6 bg-white border shadow-xl rounded-2xl border-slate-200">
                    <div className="flex items-center space-x-4">
                        <div className="flex items-center justify-center shadow-lg w-14 h-14 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl">
                            <FaUser className="text-2xl text-white" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold text-transparent bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text">
                                Add New Customer
                            </h1>
                            <p className="mt-1 text-slate-500">Create a new customer profile</p>
                        </div>
                    </div>
                </div>

                {/* Main Form */}
                <div className="p-8 bg-white border shadow-xl rounded-2xl border-slate-200">
                    <div className="space-y-8">
                        {/* Customer Type */}
                        <div>
                            <label className="block mb-3 text-sm font-semibold text-slate-700">
                                Customer Type
                            </label>
                            <div className="flex space-x-4">
                                <button
                                    type="button"
                                    onClick={() => setCustomer(prev => ({ ...prev, customerType: 'individual' }))}
                                    className={`flex-1 px-6 py-4 rounded-xl border-2 transition-all font-semibold ${
                                        customer.customerType === 'individual'
                                            ? 'border-blue-500 bg-blue-50 text-blue-700'
                                            : 'border-slate-200 hover:border-slate-300 text-slate-600'
                                    }`}
                                >
                                    <FaUser className="inline mr-2" />
                                    Individual
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setCustomer(prev => ({ ...prev, customerType: 'business' }))}
                                    className={`flex-1 px-6 py-4 rounded-xl border-2 transition-all font-semibold ${
                                        customer.customerType === 'business'
                                            ? 'border-blue-500 bg-blue-50 text-blue-700'
                                            : 'border-slate-200 hover:border-slate-300 text-slate-600'
                                    }`}
                                >
                                    <FaBuilding className="inline mr-2" />
                                    Business
                                </button>
                            </div>
                        </div>

                        {/* Basic Information */}
                        <div>
                            <h3 className="flex items-center mb-4 text-lg font-bold text-slate-800">
                                <div className="flex items-center justify-center w-8 h-8 mr-3 bg-blue-100 rounded-lg">
                                    <FaIdCard className="text-sm text-blue-600" />
                                </div>
                                Basic Information
                            </h3>
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                <div className={customer.customerType === 'individual' ? 'md:col-span-2' : ''}>
                                    <label className="block mb-2 text-sm font-semibold text-slate-700">
                                        {customer.customerType === 'business' ? 'Contact Person Name' : 'Full Name'} *
                                    </label>
                                    <div className="relative">
                                        <FaUser className="absolute -translate-y-1/2 left-4 top-1/2 text-slate-400" />
                                        <input
                                            type="text"
                                            name="name"
                                            value={customer.name}
                                            onChange={handleChange}
                                            className="w-full py-3 pl-12 pr-4 transition-all border-2 outline-none border-slate-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                                            placeholder="Enter full name"
                                        />
                                    </div>
                                </div>

                                {customer.customerType === 'business' && (
                                    <div>
                                        <label className="block mb-2 text-sm font-semibold text-slate-700">
                                            Company Name *
                                        </label>
                                        <div className="relative">
                                            <FaBuilding className="absolute -translate-y-1/2 left-4 top-1/2 text-slate-400" />
                                            <input
                                                type="text"
                                                name="company"
                                                value={customer.company}
                                                onChange={handleChange}
                                                className="w-full py-3 pl-12 pr-4 transition-all border-2 outline-none border-slate-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                                                placeholder="Enter company name"
                                            />
                                        </div>
                                    </div>
                                )}

                                <div>
                                    <label className="block mb-2 text-sm font-semibold text-slate-700">
                                        Email Address *
                                    </label>
                                    <div className="relative">
                                        <FaEnvelope className="absolute -translate-y-1/2 left-4 top-1/2 text-slate-400" />
                                        <input
                                            type="email"
                                            name="email"
                                            value={customer.email}
                                            onChange={handleChange}
                                            className="w-full py-3 pl-12 pr-4 transition-all border-2 outline-none border-slate-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                                            placeholder="email@example.com"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block mb-2 text-sm font-semibold text-slate-700">
                                        Phone Number *
                                    </label>
                                    <div className="relative">
                                        <FaPhone className="absolute -translate-y-1/2 left-4 top-1/2 text-slate-400" />
                                        <input
                                            type="tel"
                                            name="phone"
                                            value={customer.phone}
                                            onChange={handleChange}
                                            className="w-full py-3 pl-12 pr-4 transition-all border-2 outline-none border-slate-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                                            placeholder="+63 912 345 6789"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Address Information */}
                        <div>
                            <h3 className="flex items-center mb-4 text-lg font-bold text-slate-800">
                                <div className="flex items-center justify-center w-8 h-8 mr-3 bg-purple-100 rounded-lg">
                                    <FaMapMarkerAlt className="text-sm text-purple-600" />
                                </div>
                                Address Information
                            </h3>
                            <div className="grid grid-cols-1 gap-4">
                                <div>
                                    <label className="block mb-2 text-sm font-semibold text-slate-700">
                                        Street Address
                                    </label>
                                    <div className="relative">
                                        <FaMapMarkerAlt className="absolute left-4 top-4 text-slate-400" />
                                        <textarea
                                            name="address"
                                            value={customer.address}
                                            onChange={handleChange}
                                            rows="2"
                                            className="w-full py-3 pl-12 pr-4 transition-all border-2 outline-none resize-none border-slate-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                                            placeholder="Street address, building, floor, etc."
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                                    <div>
                                        <label className="block mb-2 text-sm font-semibold text-slate-700">
                                            City
                                        </label>
                                        <div className="relative">
                                            <FaCity className="absolute -translate-y-1/2 left-4 top-1/2 text-slate-400" />
                                            <input
                                                type="text"
                                                name="city"
                                                value={customer.city}
                                                onChange={handleChange}
                                                className="w-full py-3 pl-12 pr-4 transition-all border-2 outline-none border-slate-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                                                placeholder="City"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block mb-2 text-sm font-semibold text-slate-700">
                                            Province/State
                                        </label>
                                        <input
                                            type="text"
                                            name="province"
                                            value={customer.province}
                                            onChange={handleChange}
                                            className="w-full px-4 py-3 transition-all border-2 outline-none border-slate-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                                            placeholder="Province"
                                        />
                                    </div>

                                    <div>
                                        <label className="block mb-2 text-sm font-semibold text-slate-700">
                                            ZIP Code
                                        </label>
                                        <input
                                            type="text"
                                            name="zipCode"
                                            value={customer.zipCode}
                                            onChange={handleChange}
                                            className="w-full px-4 py-3 transition-all border-2 outline-none border-slate-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                                            placeholder="ZIP"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block mb-2 text-sm font-semibold text-slate-700">
                                        Country
                                    </label>
                                    <div className="relative">
                                        <FaGlobe className="absolute -translate-y-1/2 left-4 top-1/2 text-slate-400" />
                                        <input
                                            type="text"
                                            name="country"
                                            value={customer.country}
                                            onChange={handleChange}
                                            className="w-full py-3 pl-12 pr-4 transition-all border-2 outline-none border-slate-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                                            placeholder="Country"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Additional Information */}
                        <div>
                            <h3 className="flex items-center mb-4 text-lg font-bold text-slate-800">
                                <div className="flex items-center justify-center w-8 h-8 mr-3 bg-indigo-100 rounded-lg">
                                    <FaBuilding className="text-sm text-indigo-600" />
                                </div>
                                Additional Information
                            </h3>
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                {customer.customerType === 'business' && (
                                    <div>
                                        <label className="block mb-2 text-sm font-semibold text-slate-700">
                                            Tax ID / TIN
                                        </label>
                                        <input
                                            type="text"
                                            name="taxId"
                                            value={customer.taxId}
                                            onChange={handleChange}
                                            className="w-full px-4 py-3 transition-all border-2 outline-none border-slate-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                                            placeholder="000-000-000-000"
                                        />
                                    </div>
                                )}

                                <div className={customer.customerType === 'individual' ? 'md:col-span-2' : ''}>
                                    <label className="block mb-2 text-sm font-semibold text-slate-700">
                                        Website
                                    </label>
                                    <div className="relative">
                                        <FaGlobe className="absolute -translate-y-1/2 left-4 top-1/2 text-slate-400" />
                                        <input
                                            type="url"
                                            name="website"
                                            value={customer.website}
                                            onChange={handleChange}
                                            className="w-full py-3 pl-12 pr-4 transition-all border-2 outline-none border-slate-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                                            placeholder="https://example.com"
                                        />
                                    </div>
                                </div>

                                <div className="md:col-span-2">
                                    <label className="block mb-2 text-sm font-semibold text-slate-700">
                                        Notes
                                    </label>
                                    <textarea
                                        name="notes"
                                        value={customer.notes}
                                        onChange={handleChange}
                                        rows="3"
                                        className="w-full px-4 py-3 transition-all border-2 outline-none resize-none border-slate-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                                        placeholder="Add any additional notes about this customer..."
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex pt-4 space-x-4">
                            <button
                                onClick={saveCustomer}
                                disabled={loading}
                                className="flex items-center justify-center flex-1 px-6 py-4 space-x-2 text-lg font-bold text-white transition-all transform bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl hover:shadow-2xl hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                            >
                                {loading ? (
                                    <>
                                        <FaSpinner className="animate-spin" />
                                        <span>Saving...</span>
                                    </>
                                ) : (
                                    <>
                                        <FaSave />
                                        <span>Save Customer</span>
                                    </>
                                )}
                            </button>

                            <button
                                onClick={resetForm}
                                disabled={loading}
                                className="px-6 py-4 font-semibold transition-all border-2 border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50 hover:border-slate-400 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <FaTimes className="inline mr-2" />
                                Clear Form
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
                            <h3 className="mb-2 text-2xl font-bold text-slate-800">Customer Added!</h3>
                            <p className="text-slate-600">Customer has been saved successfully.</p>
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

export default CreateCustomer;