import React, { useState, useEffect } from 'react';
import { FaMapMarkerAlt, FaPhone, FaEnvelope, FaBuilding, FaPaperPlane, FaTimes, FaIdCard } from 'react-icons/fa';
import { supabase } from '../../lib/supabaseClient';

export default function ClientProfile() {
    const [formData, setFormData] = useState({
        customer_id: '',
        company_name: '',
        customer_type: 'SME',
        contact_person: '',
        email_address: '',
        mobile_number: '',
        tin_number: '',
        region: '',
        province: '',
        city: '',
        district: '',
        street: '',
        address: '',
        zip_code: ''
    });

    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [messageType, setMessageType] = useState('');

    const customerTypes = ['Single Proprietorship', 'SME', 'Corporation'];
    const regions = ['NCR', 'Calabarzon', 'SOCCSKSARGEN', 'Davao Region', 'Ilocos Region', 'Cagayan Valley', 'Central Luzon', 'Bicol Region', 'Western Visayas', 'Central Visayas', 'Eastern Visayas', 'Zamboanga Peninsula', 'Northern Mindanao', 'ARMM', 'CARAGA'];

    // Auto-generate Customer ID
    useEffect(() => {
        const generateCustomerID = () => {
            const timestamp = Date.now().toString().slice(-6);
            const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
            return `CUST-${timestamp}-${random}`;
        };
        setFormData(prev => ({ ...prev, customer_id: generateCustomerID() }));
    }, []);

    // Auto-fill address based on location fields
    useEffect(() => {
        const autoFillAddress = () => {
            const parts = [
                formData.street,
                formData.district,
                formData.city,
                formData.province,
                formData.region,
                formData.zip_code
            ].filter(part => part && part.trim() !== '');

            const fullAddress = parts.length > 0 ? parts.join(', ') : '';
            setFormData(prev => ({ ...prev, address: fullAddress }));
        };

        autoFillAddress();
    }, [formData.street, formData.district, formData.city, formData.province, formData.region, formData.zip_code]);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        
        // Auto-format TIN number with hyphens
        if (name === 'tin_number') {
            let formatted = value.replace(/[^0-9]/g, ''); // Remove non-digits
            formatted = formatted.slice(0, 12); // Limit to 12 digits maximum
            
            if (formatted.length > 0) {
                if (formatted.length <= 3) {
                    formatted = formatted;
                } else if (formatted.length <= 6) {
                    formatted = formatted.slice(0, 3) + '-' + formatted.slice(3);
                } else if (formatted.length <= 9) {
                    formatted = formatted.slice(0, 3) + '-' + formatted.slice(3, 6) + '-' + formatted.slice(6);
                } else if (formatted.length <= 12) {
                    formatted = formatted.slice(0, 3) + '-' + formatted.slice(3, 6) + '-' + formatted.slice(6, 9) + '-' + formatted.slice(9, 12);
                }
            }
            setFormData(prev => ({ ...prev, [name]: formatted }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage('');

        try {
            // Validate required fields
            if (!formData.company_name.trim() || !formData.contact_person.trim() || !formData.email_address.trim() || !formData.mobile_number.trim() || !formData.tin_number.trim()) {
                setMessage('Please fill in all required fields');
                setMessageType('error');
                setLoading(false);
                return;
            }

            // Validate email format
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(formData.email_address)) {
                setMessage('Please enter a valid email address');
                setMessageType('error');
                setLoading(false);
                return;
            }

            // Validate TIN format (12 digits with hyphens: XXX-XXX-XXX-XXXX)
            const tinRegex = /^\d{3}-\d{3}-\d{3}-\d{3}$/;
            if (!tinRegex.test(formData.tin_number)) {
                setMessage('TIN format should be: XXX-XXX-XXX-XXXX (12 digits)');
                setMessageType('error');
                setLoading(false);
                return;
            }

            // Insert to Supabase pending table
            const { data, error } = await supabase
                .from('client_profile')
                .insert([
                    {
                        customer_id: formData.customer_id,
                        company_name: formData.company_name.trim(),
                        customer_type: formData.customer_type,
                        contact_person: formData.contact_person.trim(),
                        email_address: formData.email_address.trim(),
                        mobile_number: formData.mobile_number.trim(),
                        tin_number: formData.tin_number,
                        region: formData.region,
                        province: formData.province.trim(),
                        city: formData.city.trim(),
                        district: formData.district.trim(),
                        street: formData.street.trim(),
                        address: formData.address,
                        zip_code: formData.zip_code.trim(),
                        status: 'pending',
                        created_at: new Date().toISOString()
                    }
                ])
                .select();

            if (error) throw error;

            setMessage(`✅ Client profile submitted for approval! Customer ID: ${formData.customer_id}`);
            setMessageType('success');
            
            // Reset form after 2 seconds
            setTimeout(() => {
                const newID = `CUST-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
                setFormData({
                    customer_id: newID,
                    company_name: '',
                    customer_type: 'SME',
                    contact_person: '',
                    email_address: '',
                    mobile_number: '',
                    tin_number: '',
                    region: '',
                    province: '',
                    city: '',
                    district: '',
                    street: '',
                    address: '',
                    zip_code: ''
                });
                setMessage('');
            }, 2000);
        } catch (error) {
            setMessage(`❌ Error: ${error.message}`);
            setMessageType('error');
        } finally {
            setLoading(false);
        }
    };

    const handleReset = () => {
        const newID = `CUST-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
        setFormData({
            customer_id: newID,
            company_name: '',
            customer_type: 'SME',
            contact_person: '',
            email_address: '',
            mobile_number: '',
            tin_number: '',
            region: '',
            province: '',
            city: '',
            district: '',
            street: '',
            address: '',
            zip_code: ''
        });
        setMessage('');
    };

    return (
        <div className="min-h-screen p-6 bg-gradient-to-br from-slate-50 to-slate-100">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="mb-2 text-4xl font-bold text-slate-900">Client Profile</h1>
                    <p className="text-slate-600">Create and submit client information for approval</p>
                </div>

                {/* Form Container */}
                <div className="p-8 bg-white shadow-lg rounded-xl">
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

                    <form onSubmit={handleSubmit}>
                        {/* Customer ID Section */}
                        <div className="p-5 mb-8 border-2 border-blue-200 rounded-lg bg-gradient-to-r from-blue-50 to-indigo-50">
                            <label className="block mb-3 text-xs font-semibold tracking-wide uppercase text-slate-700">
                                Customer ID (Auto Generated)
                            </label>
                            <input
                                type="text"
                                value={formData.customer_id}
                                disabled
                                className="w-full px-4 py-3 font-semibold text-blue-600 bg-white border-2 border-blue-300 rounded-lg cursor-not-allowed focus:outline-none"
                            />
                        </div>

                        {/* Basic Info Section */}
                        <h3 className="flex items-center gap-2 mt-8 mb-4 text-lg font-semibold text-slate-900">
                            <FaBuilding className="text-blue-600" />
                            Basic Information
                        </h3>
                        
                        <div className="grid grid-cols-1 gap-6 mb-8 md:grid-cols-2">
                            {/* Company Name */}
                            <div>
                                <label className="block mb-2 text-sm font-semibold text-slate-700">
                                    Company Name <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    name="company_name"
                                    value={formData.company_name}
                                    onChange={handleInputChange}
                                    placeholder="Enter company name"
                                    required
                                    className="w-full px-4 py-3 transition border-2 rounded-lg border-slate-300 focus:border-blue-500 focus:outline-none"
                                />
                            </div>

                            {/* Customer Type */}
                            <div>
                                <label className="block mb-2 text-sm font-semibold text-slate-700">
                                    Customer Type <span className="text-red-500">*</span>
                                </label>
                                <select
                                    name="customer_type"
                                    value={formData.customer_type}
                                    onChange={handleInputChange}
                                    className="w-full px-4 py-3 transition border-2 rounded-lg cursor-pointer border-slate-300 focus:border-blue-500 focus:outline-none"
                                >
                                    {customerTypes.map(type => (
                                        <option key={type} value={type}>{type}</option>
                                    ))}
                                </select>
                            </div>

                            {/* TIN Number */}
                            <div className="md:col-span-2">
                                <label className="block mb-2 text-sm font-semibold text-slate-700">
                                    TIN Number <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    name="tin_number"
                                    value={formData.tin_number}
                                    onChange={handleInputChange}
                                    placeholder="XXX-XXX-XXX-XXXX"
                                    required
                                    maxLength="16"
                                    className="w-full px-4 py-3 font-mono transition border-2 rounded-lg border-slate-300 focus:border-blue-500 focus:outline-none"
                                />
                                <p className="mt-1 text-xs text-slate-500">Format: XXX-XXX-XXX-XXXX (12 digits total, auto-formatted)</p>
                            </div>
                        </div>

                        {/* Contact Information Section */}
                        <h3 className="flex items-center gap-2 mt-8 mb-4 text-lg font-semibold text-slate-900">
                            <FaEnvelope className="text-blue-600" />
                            Contact Information
                        </h3>
                        
                        <div className="grid grid-cols-1 gap-6 mb-8 md:grid-cols-3">
                            {/* Contact Person */}
                            <div>
                                <label className="block mb-2 text-sm font-semibold text-slate-700">
                                    Contact Person <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    name="contact_person"
                                    value={formData.contact_person}
                                    onChange={handleInputChange}
                                    placeholder="Enter contact person name"
                                    required
                                    className="w-full px-4 py-3 transition border-2 rounded-lg border-slate-300 focus:border-blue-500 focus:outline-none"
                                />
                            </div>

                            {/* Email */}
                            <div>
                                <label className="block mb-2 text-sm font-semibold text-slate-700">
                                    Email Address <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="email"
                                    name="email_address"
                                    value={formData.email_address}
                                    onChange={handleInputChange}
                                    placeholder="Enter email address"
                                    required
                                    className="w-full px-4 py-3 transition border-2 rounded-lg border-slate-300 focus:border-blue-500 focus:outline-none"
                                />
                            </div>

                            {/* Mobile Number */}
                            <div>
                                <label className="block mb-2 text-sm font-semibold text-slate-700">
                                    Mobile Number <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="tel"
                                    name="mobile_number"
                                    value={formData.mobile_number}
                                    onChange={handleInputChange}
                                    placeholder="Enter mobile number"
                                    required
                                    className="w-full px-4 py-3 transition border-2 rounded-lg border-slate-300 focus:border-blue-500 focus:outline-none"
                                />
                            </div>
                        </div>

                        {/* Address Section */}
                        <h3 className="flex items-center gap-2 mt-8 mb-4 text-lg font-semibold text-slate-900">
                            <FaMapMarkerAlt className="text-blue-600" />
                            Address Information
                        </h3>
                        
                        <div className="grid grid-cols-1 gap-6 mb-8 md:grid-cols-2">
                            {/* Region */}
                            <div>
                                <label className="block mb-2 text-sm font-semibold text-slate-700">
                                    Region
                                </label>
                                <select
                                    name="region"
                                    value={formData.region}
                                    onChange={handleInputChange}
                                    className="w-full px-4 py-3 transition border-2 rounded-lg cursor-pointer border-slate-300 focus:border-blue-500 focus:outline-none"
                                >
                                    <option value="">Select Region</option>
                                    {regions.map(region => (
                                        <option key={region} value={region}>{region}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Province */}
                            <div>
                                <label className="block mb-2 text-sm font-semibold text-slate-700">
                                    Province
                                </label>
                                <input
                                    type="text"
                                    name="province"
                                    value={formData.province}
                                    onChange={handleInputChange}
                                    placeholder="Enter province"
                                    className="w-full px-4 py-3 transition border-2 rounded-lg border-slate-300 focus:border-blue-500 focus:outline-none"
                                />
                            </div>

                            {/* City */}
                            <div>
                                <label className="block mb-2 text-sm font-semibold text-slate-700">
                                    City
                                </label>
                                <input
                                    type="text"
                                    name="city"
                                    value={formData.city}
                                    onChange={handleInputChange}
                                    placeholder="Enter city"
                                    className="w-full px-4 py-3 transition border-2 rounded-lg border-slate-300 focus:border-blue-500 focus:outline-none"
                                />
                            </div>

                            {/* District */}
                            <div>
                                <label className="block mb-2 text-sm font-semibold text-slate-700">
                                    District
                                </label>
                                <input
                                    type="text"
                                    name="district"
                                    value={formData.district}
                                    onChange={handleInputChange}
                                    placeholder="Enter district"
                                    className="w-full px-4 py-3 transition border-2 rounded-lg border-slate-300 focus:border-blue-500 focus:outline-none"
                                />
                            </div>

                            {/* Street */}
                            <div>
                                <label className="block mb-2 text-sm font-semibold text-slate-700">
                                    Street
                                </label>
                                <input
                                    type="text"
                                    name="street"
                                    value={formData.street}
                                    onChange={handleInputChange}
                                    placeholder="Enter street address"
                                    className="w-full px-4 py-3 transition border-2 rounded-lg border-slate-300 focus:border-blue-500 focus:outline-none"
                                />
                            </div>

                            {/* Zip Code */}
                            <div>
                                <label className="block mb-2 text-sm font-semibold text-slate-700">
                                    Zip Code
                                </label>
                                <input
                                    type="text"
                                    name="zip_code"
                                    value={formData.zip_code}
                                    onChange={handleInputChange}
                                    placeholder="Enter zip code"
                                    className="w-full px-4 py-3 transition border-2 rounded-lg border-slate-300 focus:border-blue-500 focus:outline-none"
                                />
                            </div>
                        </div>

                        {/* Full Address (Auto-filled) */}
                        <div className="mb-8">
                            <label className="block mb-2 text-sm font-semibold text-slate-700">
                                Complete Address (Auto-filled)
                            </label>
                            <textarea
                                value={formData.address}
                                disabled
                                className="w-full px-4 py-3 border-2 rounded-lg cursor-not-allowed border-slate-300 bg-slate-100 text-slate-600 focus:outline-none resize-vertical min-h-24"
                            />
                        </div>

                        {/* Buttons */}
                        <div className="flex gap-4 mt-10">
                            <button
                                type="button"
                                onClick={handleReset}
                                className="flex items-center justify-center flex-1 gap-2 px-6 py-3 font-semibold transition duration-200 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-800"
                            >
                                <FaTimes /> Reset
                            </button>
                            <button
                                type="submit"
                                disabled={loading}
                                className="flex items-center justify-center flex-1 gap-2 px-6 py-3 font-semibold text-white transition duration-200 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <FaPaperPlane /> {loading ? 'Submitting...' : 'Submit for Approval'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}