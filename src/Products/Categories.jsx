import React, { useState, useEffect } from 'react';
import {
    FaLayerGroup,
    FaPlus,
    FaEdit,
    FaTrash,
    FaSave,
    FaTimes,
    FaCheckCircle,
    FaSpinner,
    FaExclamationTriangle,
    FaBox
} from 'react-icons/fa';
import { getFromLocalStorage, saveToLocalStorage, generateId } from '../utils/localStorage';

const Categories = () => {
    const [categories, setCategories] = useState([]);
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [saving, setSaving] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [categoryToDelete, setCategoryToDelete] = useState(null);

    // Category form state
    const [category, setCategory] = useState({
        id: '',
        name: '',
        description: '',
        color: '#3B82F6',
        icon: 'box',
        status: 'active',
        createdAt: ''
    });

    // Load categories and products from Firebase
   useEffect(() => {
        const categoriesData = getFromLocalStorage('categories') || {};
        const productsData = getFromLocalStorage('products') || {};
        
        const categoriesList = Object.keys(categoriesData).map(key => ({
            id: key,
            ...categoriesData[key]
        }));
        
        const productsList = Object.keys(productsData).map(key => ({
            id: key,
            ...productsData[key]
        }));
        
        setCategories(categoriesList);
        setProducts(productsList);
        setLoading(false);
    }, []);

    // Open modal for new category
    const openNewModal = () => {
        setCategory({
            id: '',
            name: '',
            description: '',
            color: '#3B82F6',
            icon: 'box',
            status: 'active',
            createdAt: ''
        });
        setEditMode(false);
        setShowModal(true);
    };

    // Open modal for editing
    const openEditModal = (cat) => {
        setCategory(cat);
        setEditMode(true);
        setShowModal(true);
    };

    // Close modal
    const closeModal = () => {
        setShowModal(false);
        setEditMode(false);
        setCategory({
            id: '',
            name: '',
            description: '',
            color: '#3B82F6',
            icon: 'box',
            status: 'active',
            createdAt: ''
        });
    };

    // Handle input change
    const handleChange = (e) => {
        const { name, value } = e.target;
        setCategory(prev => ({
            ...prev,
            [name]: value
        }));
    };

    // Save category
      const saveCategory = async () => {
        if (!category.name.trim()) {
            alert('Please enter category name!');
            return;
        }

        setSaving(true);
        try {
            const existingCategories = getFromLocalStorage('categories') || {};
            
            if (editMode) {
                // Update existing category
                existingCategories[category.id] = {
                    ...existingCategories[category.id],
                    name: category.name,
                    description: category.description,
                    color: category.color,
                    icon: category.icon,
                    status: category.status,
                    updatedAt: new Date().toISOString()
                };
            } else {
                // Create new category
                const categoryId = generateId();
                existingCategories[categoryId] = {
                    name: category.name,
                    description: category.description,
                    color: category.color,
                    icon: category.icon,
                    status: category.status,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };
            }
            
            saveToLocalStorage('categories', existingCategories);
            
            // Reload categories
            const categoriesList = Object.keys(existingCategories).map(key => ({
                id: key,
                ...existingCategories[key]
            }));
            setCategories(categoriesList);

            setShowSuccess(true);
            setTimeout(() => {
                setShowSuccess(false);
                closeModal();
            }, 2000);
        } catch (error) {
            console.error('Error saving category:', error);
            alert('Error saving category. Please try again.');
        } finally {
            setSaving(false);
        }
    };



    // Open delete confirmation
    const openDeleteConfirm = (cat) => {
        setCategoryToDelete(cat);
        setShowDeleteConfirm(true);
    };

    // Close delete confirmation
    const closeDeleteConfirm = () => {
        setShowDeleteConfirm(false);
        setCategoryToDelete(null);
    };

    // Delete category
   const deleteCategory = async () => {
        // Check if category has products
        const productsInCategory = products.filter(p => p.category === categoryToDelete.name);
        
        if (productsInCategory.length > 0) {
            alert(`Cannot delete this category! It has ${productsInCategory.length} product(s) assigned to it. Please reassign or delete the products first.`);
            closeDeleteConfirm();
            return;
        }

        setSaving(true);
        try {
            const existingCategories = getFromLocalStorage('categories') || {};
            delete existingCategories[categoryToDelete.id];
            saveToLocalStorage('categories', existingCategories);
            
            // Reload categories
            const categoriesList = Object.keys(existingCategories).map(key => ({
                id: key,
                ...existingCategories[key]
            }));
            setCategories(categoriesList);

            setShowSuccess(true);
            setTimeout(() => {
                setShowSuccess(false);
                closeDeleteConfirm();
            }, 2000);
        } catch (error) {
            console.error('Error deleting category:', error);
            alert('Error deleting category. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    // Get product count per category
    const getProductCount = (categoryName) => {
        return products.filter(p => p.category === categoryName).length;
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
        { name: 'Teal', value: '#14B8A6' }
    ];

    return (
        <div className="p-6">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="p-6 mb-6 bg-white border border-gray-200 rounded-lg shadow-sm">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-800">Product Categories</h1>
                            <p className="mt-1 text-sm text-gray-600">
                                Total Categories: <span className="font-semibold">{categories.length}</span>
                            </p>
                        </div>
                        <button
                            onClick={openNewModal}
                            className="flex items-center px-6 py-3 space-x-2 font-semibold text-white transition-all transform bg-blue-600 rounded-lg hover:bg-blue-700 hover:shadow-lg hover:scale-105"
                        >
                            <FaPlus />
                            <span>Add Category</span>
                        </button>
                    </div>
                </div>

                {/* Categories Grid */}
                {loading ? (
                    <div className="p-12 text-center bg-white border border-gray-200 rounded-lg shadow-sm">
                        <div className="inline-block w-8 h-8 border-b-2 border-gray-800 rounded-full animate-spin"></div>
                        <p className="mt-4 text-gray-600">Loading categories...</p>
                    </div>
                ) : categories.length === 0 ? (
                    <div className="p-12 text-center bg-white border border-gray-200 rounded-lg shadow-sm">
                        <FaLayerGroup className="mx-auto mb-4 text-5xl text-gray-300" />
                        <p className="text-lg text-gray-600">No categories yet</p>
                        <p className="mt-2 text-sm text-gray-500">Start by creating your first category</p>
                        <button
                            onClick={openNewModal}
                            className="inline-flex items-center px-6 py-3 mt-6 space-x-2 font-semibold text-white transition-colors bg-blue-600 rounded-lg hover:bg-blue-700"
                        >
                            <FaPlus />
                            <span>Add Category</span>
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {categories.map((cat) => {
                            const productCount = getProductCount(cat.name);
                            return (
                                <div
                                    key={cat.id}
                                    className="p-6 transition-all bg-white border-2 border-gray-200 rounded-lg shadow-sm hover:border-blue-300 hover:shadow-lg"
                                >
                                    <div className="flex items-start justify-between mb-4">
                                        <div 
                                            className="flex items-center justify-center text-2xl text-white shadow-lg w-14 h-14 rounded-xl"
                                            style={{ backgroundColor: cat.color }}
                                        >
                                            <FaLayerGroup />
                                        </div>
                                        <span className={`px-3 py-1 text-xs font-semibold rounded-full ${
                                            cat.status === 'active' 
                                                ? 'bg-green-100 text-green-800' 
                                                : 'bg-gray-100 text-gray-800'
                                        }`}>
                                            {cat.status}
                                        </span>
                                    </div>

                                    <h3 className="mb-2 text-xl font-bold text-gray-800">
                                        {cat.name}
                                    </h3>
                                    
                                    {cat.description && (
                                        <p className="mb-4 text-sm text-gray-600 line-clamp-2">
                                            {cat.description}
                                        </p>
                                    )}

                                    <div className="flex items-center pb-4 mb-4 space-x-2 text-sm text-gray-600 border-b border-gray-200">
                                        <FaBox />
                                        <span className="font-semibold">
                                            {productCount} {productCount === 1 ? 'Product' : 'Products'}
                                        </span>
                                    </div>

                                    <div className="flex space-x-2">
                                        <button
                                            onClick={() => openEditModal(cat)}
                                            className="flex items-center justify-center flex-1 px-4 py-2 space-x-2 font-semibold text-gray-700 transition-colors border-2 border-gray-300 rounded-lg hover:bg-gray-50"
                                        >
                                            <FaEdit />
                                            <span>Edit</span>
                                        </button>
                                        <button
                                            onClick={() => openDeleteConfirm(cat)}
                                            className="px-4 py-2 font-semibold text-red-600 transition-colors border-2 border-red-300 rounded-lg hover:bg-red-50"
                                        >
                                            <FaTrash />
                                        </button>
                                    </div>

                                    {cat.createdAt && (
                                        <p className="mt-4 text-xs text-gray-500">
                                            Created: {new Date(cat.createdAt).toLocaleDateString()}
                                        </p>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Add/Edit Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
                    <div className="w-full max-w-2xl bg-white rounded-lg shadow-xl">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                            <h2 className="text-xl font-bold text-gray-800">
                                {editMode ? 'Edit Category' : 'Add New Category'}
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
                                    Category Name *
                                </label>
                                <input
                                    type="text"
                                    name="name"
                                    value={category.name}
                                    onChange={handleChange}
                                    className="w-full px-4 py-3 transition-all border-2 border-gray-200 rounded-lg outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                                    placeholder="Enter category name"
                                />
                            </div>

                            <div>
                                <label className="block mb-2 text-sm font-semibold text-gray-700">
                                    Description
                                </label>
                                <textarea
                                    name="description"
                                    value={category.description}
                                    onChange={handleChange}
                                    rows="3"
                                    className="w-full px-4 py-3 transition-all border-2 border-gray-200 rounded-lg outline-none resize-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                                    placeholder="Enter category description"
                                />
                            </div>

                            <div>
                                <label className="block mb-3 text-sm font-semibold text-gray-700">
                                    Color
                                </label>
                                <div className="grid grid-cols-4 gap-3 mb-3">
                                    {colorPresets.map((preset) => (
                                        <button
                                            key={preset.value}
                                            type="button"
                                            onClick={() => setCategory(prev => ({ ...prev, color: preset.value }))}
                                            className={`h-12 rounded-lg transition-all ${
                                                category.color === preset.value 
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
                                        value={category.color}
                                        onChange={handleChange}
                                        className="w-20 h-12 border-2 border-gray-200 rounded-lg cursor-pointer"
                                    />
                                    <span className="font-mono text-sm text-gray-600">
                                        {category.color}
                                    </span>
                                </div>
                            </div>

                            <div>
                                <label className="block mb-2 text-sm font-semibold text-gray-700">
                                    Status
                                </label>
                                <select
                                    name="status"
                                    value={category.status}
                                    onChange={handleChange}
                                    className="w-full px-4 py-3 transition-all border-2 border-gray-200 rounded-lg outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                                >
                                    <option value="active">Active</option>
                                    <option value="inactive">Inactive</option>
                                </select>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="flex px-6 py-4 space-x-3 border-t border-gray-200">
                            <button
                                onClick={saveCategory}
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
                                        <span>{editMode ? 'Update' : 'Save'} Category</span>
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
            {showDeleteConfirm && categoryToDelete && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
                    <div className="w-full max-w-md bg-white rounded-lg shadow-xl">
                        <div className="p-6">
                            <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full">
                                <FaExclamationTriangle className="text-3xl text-red-600" />
                            </div>
                            <h3 className="mb-2 text-xl font-bold text-center text-gray-800">
                                Delete Category?
                            </h3>
                            <p className="mb-6 text-center text-gray-600">
                                Are you sure you want to delete "<span className="font-semibold">{categoryToDelete.name}</span>"? 
                                This action cannot be undone.
                            </p>

                            {getProductCount(categoryToDelete.name) > 0 && (
                                <div className="p-4 mb-6 border border-orange-200 rounded-lg bg-orange-50">
                                    <div className="flex items-start space-x-2">
                                        <FaExclamationTriangle className="text-orange-600 mt-0.5 flex-shrink-0" />
                                        <div>
                                            <p className="text-sm font-semibold text-orange-800">Warning!</p>
                                            <p className="text-sm text-orange-700">
                                                This category has {getProductCount(categoryToDelete.name)} product(s). 
                                                You cannot delete it until all products are reassigned or deleted.
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
                                    onClick={deleteCategory}
                                    disabled={saving || getProductCount(categoryToDelete.name) > 0}
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
                            <p className="text-gray-600">Category has been saved successfully.</p>
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

export default Categories;