import React, { useState, useEffect } from 'react';
import {
    FaUsers,
    FaPlus,
    FaEdit,
    FaTrash,
    FaSave,
    FaTimes,
    FaCheckCircle,
    FaSpinner,
    FaExclamationTriangle,
    FaUser,
    FaTag,
    FaPercent
} from 'react-icons/fa';
import { getFromLocalStorage, saveToLocalStorage, generateId } from '../utils/localStorage';

const CustomerGroups = () => {
    const [groups, setGroups] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [saving, setSaving] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [groupToDelete, setGroupToDelete] = useState(null);

    // Group form state
    const [group, setGroup] = useState({
        id: '',
        name: '',
        description: '',
        color: '#3B82F6',
        discount: 0,
        benefits: '',
        status: 'active',
        createdAt: ''
    });

  useEffect(() => {
        const loadData = () => {
            const groupsData = getFromLocalStorage('customer_groups') || {};
            const customersData = getFromLocalStorage('customers') || {};
            
            const groupsList = Object.keys(groupsData).map(key => ({
                id: key,
                ...groupsData[key]
            }));
            
            const customersList = Object.keys(customersData).map(key => ({
                id: key,
                ...customersData[key]
            }));
            
            setGroups(groupsList);
            setCustomers(customersList);
            setLoading(false);
        };
        
        loadData();
    }, []);


    // Open modal for new group
    const openNewModal = () => {
        setGroup({
            id: '',
            name: '',
            description: '',
            color: '#3B82F6',
            discount: 0,
            benefits: '',
            status: 'active',
            createdAt: ''
        });
        setEditMode(false);
        setShowModal(true);
    };

    // Open modal for editing
    const openEditModal = (grp) => {
        setGroup(grp);
        setEditMode(true);
        setShowModal(true);
    };

    // Close modal
    const closeModal = () => {
        setShowModal(false);
        setEditMode(false);
        setGroup({
            id: '',
            name: '',
            description: '',
            color: '#3B82F6',
            discount: 0,
            benefits: '',
            status: 'active',
            createdAt: ''
        });
    };

    // Handle input change
    const handleChange = (e) => {
        const { name, value } = e.target;
        setGroup(prev => ({
            ...prev,
            [name]: value
        }));
    };

    // Save group
   const saveGroup = async () => {
        if (!group.name.trim()) {
            alert('Please enter group name!');
            return;
        }

        setSaving(true);
        try {
            const existingGroups = getFromLocalStorage('customer_groups') || {};
            
            if (editMode) {
                // Update existing group
                existingGroups[group.id] = {
                    ...existingGroups[group.id],
                    name: group.name,
                    description: group.description,
                    color: group.color,
                    discount: parseFloat(group.discount) || 0,
                    benefits: group.benefits,
                    status: group.status,
                    updatedAt: new Date().toISOString()
                };
            } else {
                // Create new group
                const groupId = generateId();
                existingGroups[groupId] = {
                    name: group.name,
                    description: group.description,
                    color: group.color,
                    discount: parseFloat(group.discount) || 0,
                    benefits: group.benefits,
                    status: group.status,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };
            }
            
            saveToLocalStorage('customer_groups', existingGroups);
            
            // Reload groups
            const groupsList = Object.keys(existingGroups).map(key => ({
                id: key,
                ...existingGroups[key]
            }));
            setGroups(groupsList);

            setShowSuccess(true);
            setTimeout(() => {
                setShowSuccess(false);
                closeModal();
            }, 2000);
        } catch (error) {
            console.error('Error saving group:', error);
            alert('Error saving group. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    // Open delete confirmation
    const openDeleteConfirm = (grp) => {
        setGroupToDelete(grp);
        setShowDeleteConfirm(true);
    };

    // Close delete confirmation
    const closeDeleteConfirm = () => {
        setShowDeleteConfirm(false);
        setGroupToDelete(null);
    };

    // Delete group
     const deleteGroup = async () => {
        // Check if group has customers
        const customersInGroup = customers.filter(c => c.customerGroup === groupToDelete.name);
        
        if (customersInGroup.length > 0) {
            alert(`Cannot delete this group! It has ${customersInGroup.length} customer(s) assigned to it. Please reassign or remove the customers first.`);
            closeDeleteConfirm();
            return;
        }

        setSaving(true);
        try {
            const existingGroups = getFromLocalStorage('customer_groups') || {};
            delete existingGroups[groupToDelete.id];
            saveToLocalStorage('customer_groups', existingGroups);
            
            // Reload groups
            const groupsList = Object.keys(existingGroups).map(key => ({
                id: key,
                ...existingGroups[key]
            }));
            setGroups(groupsList);

            setShowSuccess(true);
            setTimeout(() => {
                setShowSuccess(false);
                closeDeleteConfirm();
            }, 2000);
        } catch (error) {
            console.error('Error deleting group:', error);
            alert('Error deleting group. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    // Get customer count per group
    const getCustomerCount = (groupName) => {
        return customers.filter(c => c.customerGroup === groupName).length;
    };

    // Color presets
    const colorPresets = [
        { name: 'Blue', value: '#3B82F6' },
        { name: 'Green', value: '#10B981' },
        { name: 'Purple', value: '#8B5CF6' },
        { name: 'Red', value: '#EF4444' },
        { name: 'Orange', value: '#F59E0B' },
        { name: 'Pink', value: '#EC4899' },
        { name: 'Indigo', value: '#6366F1' },
        { name: 'Teal', value: '#14B8A6' },
        { name: 'Yellow', value: '#EAB308' },
        { name: 'Cyan', value: '#06B6D4' },
        { name: 'Emerald', value: '#059669' },
        { name: 'Rose', value: '#F43F5E' }
    ];

    return (
        <div className="p-6">
            <div className="mx-auto max-w-7xl">
                {/* Header */}
                <div className="p-6 mb-6 bg-white border border-gray-200 rounded-lg shadow-sm">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-800">Customer Groups</h1>
                            <p className="mt-1 text-sm text-gray-600">
                                Total Groups: <span className="font-semibold">{groups.length}</span>
                                {' | '}
                                Total Customers: <span className="font-semibold">{customers.length}</span>
                            </p>
                        </div>
                        <button
                            onClick={openNewModal}
                            className="flex items-center px-6 py-3 space-x-2 font-semibold text-white transition-all transform bg-blue-600 rounded-lg hover:bg-blue-700 hover:shadow-lg hover:scale-105"
                        >
                            <FaPlus />
                            <span>Add Group</span>
                        </button>
                    </div>
                </div>

                {/* Groups Grid */}
                {loading ? (
                    <div className="p-12 text-center bg-white border border-gray-200 rounded-lg shadow-sm">
                        <div className="inline-block w-8 h-8 border-b-2 border-gray-800 rounded-full animate-spin"></div>
                        <p className="mt-4 text-gray-600">Loading groups...</p>
                    </div>
                ) : groups.length === 0 ? (
                    <div className="p-12 text-center bg-white border border-gray-200 rounded-lg shadow-sm">
                        <FaUsers className="mx-auto mb-4 text-5xl text-gray-300" />
                        <p className="text-lg text-gray-600">No customer groups yet</p>
                        <p className="mt-2 text-sm text-gray-500">Create groups to organize and segment your customers</p>
                        <button
                            onClick={openNewModal}
                            className="inline-flex items-center px-6 py-3 mt-6 space-x-2 font-semibold text-white transition-colors bg-blue-600 rounded-lg hover:bg-blue-700"
                        >
                            <FaPlus />
                            <span>Add Group</span>
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                        {groups.map((grp) => {
                            const customerCount = getCustomerCount(grp.name);
                            return (
                                <div
                                    key={grp.id}
                                    className="overflow-hidden transition-all bg-white border-2 shadow-lg rounded-2xl hover:shadow-2xl"
                                    style={{ borderColor: grp.color }}
                                >
                                    {/* Card Header */}
                                    <div 
                                        className="p-6 text-white"
                                        style={{ backgroundColor: grp.color }}
                                    >
                                        <div className="flex items-start justify-between mb-4">
                                            <div className="flex items-center justify-center text-3xl shadow-lg w-14 h-14 bg-white/20 backdrop-blur-sm rounded-xl">
                                                <FaUsers />
                                            </div>
                                            <span className={`px-3 py-1 text-xs font-semibold rounded-full ${
                                                grp.status === 'active' 
                                                    ? 'bg-white/30 text-white' 
                                                    : 'bg-black/20 text-white/70'
                                            }`}>
                                                {grp.status}
                                            </span>
                                        </div>

                                        <h3 className="mb-2 text-2xl font-bold">
                                            {grp.name}
                                        </h3>
                                        
                                        {grp.description && (
                                            <p className="text-sm text-white/80 line-clamp-2">
                                                {grp.description}
                                            </p>
                                        )}
                                    </div>

                                    {/* Card Body */}
                                    <div className="p-6 space-y-4">
                                        {/* Customer Count */}
                                        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                                            <div className="flex items-center space-x-2 text-gray-700">
                                                <FaUser />
                                                <span className="text-sm font-semibold">Customers</span>
                                            </div>
                                            <span className="text-2xl font-bold text-gray-900">
                                                {customerCount}
                                            </span>
                                        </div>

                                        {/* Discount */}
                                        {grp.discount > 0 && (
                                            <div className="flex items-center justify-between p-4 border border-green-200 bg-green-50 rounded-xl">
                                                <div className="flex items-center space-x-2 text-green-700">
                                                    <FaPercent />
                                                    <span className="text-sm font-semibold">Group Discount</span>
                                                </div>
                                                <span className="text-xl font-bold text-green-600">
                                                    {grp.discount}%
                                                </span>
                                            </div>
                                        )}

                                        {/* Benefits */}
                                        {grp.benefits && (
                                            <div className="p-4 border border-blue-200 bg-blue-50 rounded-xl">
                                                <div className="flex items-center mb-2 space-x-2 text-blue-700">
                                                    <FaTag />
                                                    <span className="text-sm font-semibold">Benefits</span>
                                                </div>
                                                <p className="text-sm text-gray-700 line-clamp-3">
                                                    {grp.benefits}
                                                </p>
                                            </div>
                                        )}

                                        {/* Actions */}
                                        <div className="flex pt-2 space-x-2">
                                            <button
                                                onClick={() => openEditModal(grp)}
                                                className="flex items-center justify-center flex-1 px-4 py-3 space-x-2 font-semibold text-gray-700 transition-all border-2 border-gray-300 rounded-xl hover:bg-gray-50 hover:border-gray-400"
                                            >
                                                <FaEdit />
                                                <span>Edit</span>
                                            </button>
                                            <button
                                                onClick={() => openDeleteConfirm(grp)}
                                                className="px-4 py-3 font-semibold text-red-600 transition-all border-2 border-red-300 rounded-xl hover:bg-red-50 hover:border-red-400"
                                            >
                                                <FaTrash />
                                            </button>
                                        </div>

                                        {grp.createdAt && (
                                            <p className="pt-2 text-xs text-center text-gray-500 border-t border-gray-200">
                                                Created: {new Date(grp.createdAt).toLocaleDateString()}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Add/Edit Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
                    <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        {/* Modal Header */}
                        <div className="sticky top-0 flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200">
                            <h2 className="text-xl font-bold text-gray-800">
                                {editMode ? 'Edit Customer Group' : 'Add New Customer Group'}
                            </h2>
                            <button
                                onClick={closeModal}
                                className="p-2 transition-colors rounded-lg hover:bg-gray-100"
                            >
                                <FaTimes className="text-gray-600" />
                            </button>
                        </div>

                        {/* Modal Content */}
                        <div className="p-6 space-y-6">
                            <div>
                                <label className="block mb-2 text-sm font-semibold text-gray-700">
                                    Group Name *
                                </label>
                                <input
                                    type="text"
                                    name="name"
                                    value={group.name}
                                    onChange={handleChange}
                                    className="w-full px-4 py-3 transition-all border-2 border-gray-200 rounded-lg outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                                    placeholder="e.g., VIP Customers, Wholesale, Regular"
                                />
                            </div>

                            <div>
                                <label className="block mb-2 text-sm font-semibold text-gray-700">
                                    Description
                                </label>
                                <textarea
                                    name="description"
                                    value={group.description}
                                    onChange={handleChange}
                                    rows="3"
                                    className="w-full px-4 py-3 transition-all border-2 border-gray-200 rounded-lg outline-none resize-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                                    placeholder="Describe this customer group..."
                                />
                            </div>

                            <div>
                                <label className="block mb-2 text-sm font-semibold text-gray-700">
                                    Group Discount (%)
                                </label>
                                <div className="relative">
                                    <FaPercent className="absolute text-gray-400 -translate-y-1/2 left-4 top-1/2" />
                                    <input
                                        type="number"
                                        name="discount"
                                        value={group.discount}
                                        onChange={handleChange}
                                        min="0"
                                        max="100"
                                        step="0.1"
                                        className="w-full py-3 pl-12 pr-4 transition-all border-2 border-gray-200 rounded-lg outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                                        placeholder="0"
                                    />
                                </div>
                                <p className="mt-1 text-xs text-gray-500">
                                    Automatic discount applied to all customers in this group
                                </p>
                            </div>

                            <div>
                                <label className="block mb-2 text-sm font-semibold text-gray-700">
                                    Benefits & Perks
                                </label>
                                <textarea
                                    name="benefits"
                                    value={group.benefits}
                                    onChange={handleChange}
                                    rows="3"
                                    className="w-full px-4 py-3 transition-all border-2 border-gray-200 rounded-lg outline-none resize-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                                    placeholder="e.g., Free shipping, Priority support, Early access to new products..."
                                />
                            </div>

                            <div>
                                <label className="block mb-3 text-sm font-semibold text-gray-700">
                                    Group Color
                                </label>
                                <div className="grid grid-cols-6 gap-3 mb-3">
                                    {colorPresets.map((preset) => (
                                        <button
                                            key={preset.value}
                                            type="button"
                                            onClick={() => setGroup(prev => ({ ...prev, color: preset.value }))}
                                            className={`h-12 rounded-lg transition-all ${
                                                group.color === preset.value 
                                                    ? 'ring-4 ring-blue-300 scale-110' 
                                                    : 'hover:scale-105'
                                            }`}
                                            style={{ backgroundColor: preset.value }}
                                            title={preset.name}
                                        />
                                    ))}
                                </div>
                                <div className="flex items-center space-x-3">
                                    <input
                                        type="color"
                                        name="color"
                                        value={group.color}
                                        onChange={handleChange}
                                        className="w-20 h-12 border-2 border-gray-200 rounded-lg cursor-pointer"
                                    />
                                    <span className="font-mono text-sm text-gray-600">
                                        {group.color}
                                    </span>
                                </div>
                            </div>

                            <div>
                                <label className="block mb-2 text-sm font-semibold text-gray-700">
                                    Status
                                </label>
                                <select
                                    name="status"
                                    value={group.status}
                                    onChange={handleChange}
                                    className="w-full px-4 py-3 transition-all border-2 border-gray-200 rounded-lg outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                                >
                                    <option value="active">Active</option>
                                    <option value="inactive">Inactive</option>
                                </select>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="sticky bottom-0 flex px-6 py-4 space-x-3 bg-white border-t border-gray-200">
                            <button
                                onClick={saveGroup}
                                disabled={saving}
                                className="flex items-center justify-center flex-1 px-6 py-3 space-x-2 font-semibold text-white transition-colors bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {saving ? (
                                    <>
                                        <FaSpinner className="animate-spin" />
                                        <span>Saving...</span>
                                    </>
                                ) : (
                                    <>
                                        <FaSave />
                                        <span>{editMode ? 'Update' : 'Save'} Group</span>
                                    </>
                                )}
                            </button>
                            <button
                                onClick={closeModal}
                                disabled={saving}
                                className="px-6 py-3 font-semibold text-gray-700 transition-colors border-2 border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {showDeleteConfirm && groupToDelete && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
                    <div className="w-full max-w-md bg-white rounded-lg shadow-xl">
                        <div className="p-6">
                            <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full">
                                <FaExclamationTriangle className="text-3xl text-red-600" />
                            </div>
                            <h3 className="mb-2 text-xl font-bold text-center text-gray-800">
                                Delete Customer Group?
                            </h3>
                            <p className="mb-6 text-center text-gray-600">
                                Are you sure you want to delete "<span className="font-semibold">{groupToDelete.name}</span>"? 
                                This action cannot be undone.
                            </p>

                            {getCustomerCount(groupToDelete.name) > 0 && (
                                <div className="p-4 mb-6 border border-orange-200 rounded-lg bg-orange-50">
                                    <div className="flex items-start space-x-2">
                                        <FaExclamationTriangle className="text-orange-600 mt-0.5 flex-shrink-0" />
                                        <div>
                                            <p className="text-sm font-semibold text-orange-800">Warning!</p>
                                            <p className="text-sm text-orange-700">
                                                This group has {getCustomerCount(groupToDelete.name)} customer(s). 
                                                You cannot delete it until all customers are reassigned or removed.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="flex space-x-3">
                                <button
                                    onClick={closeDeleteConfirm}
                                    disabled={saving}
                                    className="flex-1 px-6 py-3 font-semibold text-gray-700 transition-colors border-2 border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={deleteGroup}
                                    disabled={saving || getCustomerCount(groupToDelete.name) > 0}
                                    className="flex items-center justify-center flex-1 px-6 py-3 space-x-2 font-semibold text-white transition-colors bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {saving ? (
                                        <>
                                            <FaSpinner className="animate-spin" />
                                            <span>Deleting...</span>
                                        </>
                                    ) : (
                                        <>
                                            <FaTrash />
                                            <span>Delete</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Success Modal */}
            {showSuccess && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fadeIn">
                    <div className="p-8 transform bg-white shadow-2xl rounded-2xl animate-scaleIn">
                        <div className="text-center">
                            <div className="flex items-center justify-center w-20 h-20 mx-auto mb-4 bg-green-100 rounded-full">
                                <FaCheckCircle className="text-4xl text-green-500" />
                            </div>
                            <h3 className="mb-2 text-2xl font-bold text-gray-800">Success!</h3>
                            <p className="text-gray-600">Customer group has been saved successfully.</p>
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

export default CustomerGroups;