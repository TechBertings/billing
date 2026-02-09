import React, { useState, useEffect } from 'react';

import {
    FaBox,
    FaBarcode,
    FaDollarSign,
    FaLayerGroup,
    FaImage,
    FaSave,
    FaTimes,
    FaCheckCircle,
    FaSpinner,
    FaWarehouse,
    FaPercent,
    FaTags
} from 'react-icons/fa';
import { getFromLocalStorage, saveToLocalStorage, generateId } from '../utils/localStorage';

const AddProduct = () => {
    const [loading, setLoading] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [categories, setCategories] = useState([]);

    // Product form state
    const [product, setProduct] = useState({
        name: '',
        sku: `SKU-${Date.now()}`,
        barcode: '',
        description: '',
        category: '',
        price: '',
        cost: '',
        taxRate: 12,
        stockQuantity: 0,
        minStockLevel: 5,
        unit: 'pcs',
        supplier: '',
        imageUrl: '',
        status: 'active',
        createdAt: new Date().toISOString()
    });

  useEffect(() => {
        const categoriesData = getFromLocalStorage('categories') || {};
        const categoriesList = Object.keys(categoriesData).map(key => ({
            id: key,
            ...categoriesData[key]
        }));
        setCategories(categoriesList);
    }, []);


    // Handle input change
    const handleChange = (e) => {
        const { name, value } = e.target;
        setProduct(prev => ({
            ...prev,
            [name]: value
        }));
    };

 // Save product to localStorage
    const saveProduct = async () => {
        // Validation
        if (!product.name.trim()) {
            alert('Please enter product name!');
            return;
        }
        if (!product.price || parseFloat(product.price) <= 0) {
            alert('Please enter a valid price!');
            return;
        }
        if (!product.category) {
            alert('Please select a category!');
            return;
        }

        setLoading(true);
        try {
            const existingProducts = getFromLocalStorage('products') || {};
            
            const productId = generateId();
            const productData = {
                ...product,
                id: productId,
                price: parseFloat(product.price),
                cost: parseFloat(product.cost) || 0,
                taxRate: parseFloat(product.taxRate),
                stockQuantity: parseInt(product.stockQuantity) || 0,
                minStockLevel: parseInt(product.minStockLevel) || 0,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            existingProducts[productId] = productData;
            saveToLocalStorage('products', existingProducts);

            setShowSuccess(true);
            setTimeout(() => {
                setShowSuccess(false);
                resetForm();
            }, 2000);
        } catch (error) {
            console.error('Error saving product:', error);
            alert('Error saving product. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    // Reset form
    const resetForm = () => {
        setProduct({
            name: '',
            sku: `SKU-${Date.now()}`,
            barcode: '',
            description: '',
            category: '',
            price: '',
            cost: '',
            taxRate: 12,
            stockQuantity: 0,
            minStockLevel: 5,
            unit: 'pcs',
            supplier: '',
            imageUrl: '',
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
                        <div className="flex items-center justify-center shadow-lg w-14 h-14 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl">
                            <FaBox className="text-2xl text-white" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold text-transparent bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text">
                                Add New Product
                            </h1>
                            <p className="mt-1 text-slate-500">Create a new product or service</p>
                        </div>
                    </div>
                </div>

                {/* Main Form */}
                <div className="p-8 bg-white border shadow-xl rounded-2xl border-slate-200">
                    <div className="space-y-8">
                        {/* Basic Information */}
                        <div>
                            <h3 className="flex items-center mb-4 text-lg font-bold text-slate-800">
                                <div className="flex items-center justify-center w-8 h-8 mr-3 bg-blue-100 rounded-lg">
                                    <FaBox className="text-sm text-blue-600" />
                                </div>
                                Basic Information
                            </h3>
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                <div className="md:col-span-2">
                                    <label className="block mb-2 text-sm font-semibold text-slate-700">
                                        Product Name *
                                    </label>
                                    <div className="relative">
                                        <FaBox className="absolute -translate-y-1/2 left-4 top-1/2 text-slate-400" />
                                        <input
                                            type="text"
                                            name="name"
                                            value={product.name}
                                            onChange={handleChange}
                                            className="w-full py-3 pl-12 pr-4 transition-all border-2 outline-none border-slate-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                                            placeholder="Enter product name"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block mb-2 text-sm font-semibold text-slate-700">
                                        SKU *
                                    </label>
                                    <div className="relative">
                                        <FaTags className="absolute -translate-y-1/2 left-4 top-1/2 text-slate-400" />
                                        <input
                                            type="text"
                                            name="sku"
                                            value={product.sku}
                                            onChange={handleChange}
                                            className="w-full py-3 pl-12 pr-4 transition-all border-2 outline-none border-slate-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                                            placeholder="SKU-12345"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block mb-2 text-sm font-semibold text-slate-700">
                                        Barcode
                                    </label>
                                    <div className="relative">
                                        <FaBarcode className="absolute -translate-y-1/2 left-4 top-1/2 text-slate-400" />
                                        <input
                                            type="text"
                                            name="barcode"
                                            value={product.barcode}
                                            onChange={handleChange}
                                            className="w-full py-3 pl-12 pr-4 transition-all border-2 outline-none border-slate-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                                            placeholder="123456789012"
                                        />
                                    </div>
                                </div>

                                <div className="md:col-span-2">
                                    <label className="block mb-2 text-sm font-semibold text-slate-700">
                                        Description
                                    </label>
                                    <textarea
                                        name="description"
                                        value={product.description}
                                        onChange={handleChange}
                                        rows="3"
                                        className="w-full px-4 py-3 transition-all border-2 outline-none resize-none border-slate-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                                        placeholder="Product description..."
                                    />
                                </div>

                                <div>
                                    <label className="block mb-2 text-sm font-semibold text-slate-700">
                                        Category *
                                    </label>
                                    <div className="relative">
                                        <FaLayerGroup className="absolute -translate-y-1/2 left-4 top-1/2 text-slate-400" />
                                        <select
                                            name="category"
                                            value={product.category}
                                            onChange={handleChange}
                                            className="w-full py-3 pl-12 pr-4 transition-all border-2 outline-none appearance-none border-slate-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                                        >
                                            <option value="">Select category</option>
                                            {categories.map(cat => (
                                                <option key={cat.id} value={cat.name}>
                                                    {cat.name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label className="block mb-2 text-sm font-semibold text-slate-700">
                                        Unit
                                    </label>
                                    <select
                                        name="unit"
                                        value={product.unit}
                                        onChange={handleChange}
                                        className="w-full px-4 py-3 transition-all border-2 outline-none border-slate-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                                    >
                                        <option value="pcs">Pieces</option>
                                        <option value="box">Box</option>
                                        <option value="pack">Pack</option>
                                        <option value="set">Set</option>
                                        <option value="dozen">Dozen</option>
                                        <option value="kg">Kilogram</option>
                                        <option value="liter">Liter</option>
                                        <option value="meter">Meter</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Pricing Information */}
                        <div>
                            <h3 className="flex items-center mb-4 text-lg font-bold text-slate-800">
                                <div className="flex items-center justify-center w-8 h-8 mr-3 bg-green-100 rounded-lg">
                                    <FaDollarSign className="text-sm text-green-600" />
                                </div>
                                Pricing Information
                            </h3>
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                                <div>
                                    <label className="block mb-2 text-sm font-semibold text-slate-700">
                                        Selling Price *
                                    </label>
                                    <div className="relative">
                                        <span className="absolute font-bold -translate-y-1/2 left-4 top-1/2 text-slate-400">
                                            ₱
                                        </span>
                                        <input
                                            type="number"
                                            name="price"
                                            value={product.price}
                                            onChange={handleChange}
                                            step="0.01"
                                            min="0"
                                            className="w-full py-3 pl-10 pr-4 transition-all border-2 outline-none border-slate-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                                            placeholder="0.00"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block mb-2 text-sm font-semibold text-slate-700">
                                        Cost Price
                                    </label>
                                    <div className="relative">
                                        <span className="absolute font-bold -translate-y-1/2 left-4 top-1/2 text-slate-400">
                                            ₱
                                        </span>
                                        <input
                                            type="number"
                                            name="cost"
                                            value={product.cost}
                                            onChange={handleChange}
                                            step="0.01"
                                            min="0"
                                            className="w-full py-3 pl-10 pr-4 transition-all border-2 outline-none border-slate-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                                            placeholder="0.00"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block mb-2 text-sm font-semibold text-slate-700">
                                        Tax Rate (%)
                                    </label>
                                    <div className="relative">
                                        <FaPercent className="absolute -translate-y-1/2 left-4 top-1/2 text-slate-400" />
                                        <input
                                            type="number"
                                            name="taxRate"
                                            value={product.taxRate}
                                            onChange={handleChange}
                                            step="0.01"
                                            min="0"
                                            max="100"
                                            className="w-full py-3 pl-12 pr-4 transition-all border-2 outline-none border-slate-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                                            placeholder="12"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Profit Margin Display */}
                            {product.price && product.cost && (
                                <div className="p-4 mt-4 border-2 border-green-200 bg-green-50 rounded-xl">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm font-semibold text-green-700">
                                            Profit Margin:
                                        </span>
                                        <span className="text-lg font-bold text-green-600">
                                            ₱{(parseFloat(product.price) - parseFloat(product.cost)).toFixed(2)}
                                            {' '}
                                            ({(((parseFloat(product.price) - parseFloat(product.cost)) / parseFloat(product.price)) * 100).toFixed(1)}%)
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Inventory Information */}
                        <div>
                            <h3 className="flex items-center mb-4 text-lg font-bold text-slate-800">
                                <div className="flex items-center justify-center w-8 h-8 mr-3 bg-purple-100 rounded-lg">
                                    <FaWarehouse className="text-sm text-purple-600" />
                                </div>
                                Inventory Information
                            </h3>
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                <div>
                                    <label className="block mb-2 text-sm font-semibold text-slate-700">
                                        Initial Stock Quantity
                                    </label>
                                    <div className="relative">
                                        <FaWarehouse className="absolute -translate-y-1/2 left-4 top-1/2 text-slate-400" />
                                        <input
                                            type="number"
                                            name="stockQuantity"
                                            value={product.stockQuantity}
                                            onChange={handleChange}
                                            min="0"
                                            className="w-full py-3 pl-12 pr-4 transition-all border-2 outline-none border-slate-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                                            placeholder="0"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block mb-2 text-sm font-semibold text-slate-700">
                                        Minimum Stock Level
                                    </label>
                                    <input
                                        type="number"
                                        name="minStockLevel"
                                        value={product.minStockLevel}
                                        onChange={handleChange}
                                        min="0"
                                        className="w-full px-4 py-3 transition-all border-2 outline-none border-slate-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                                        placeholder="5"
                                    />
                                </div>

                                <div className="md:col-span-2">
                                    <label className="block mb-2 text-sm font-semibold text-slate-700">
                                        Supplier
                                    </label>
                                    <input
                                        type="text"
                                        name="supplier"
                                        value={product.supplier}
                                        onChange={handleChange}
                                        className="w-full px-4 py-3 transition-all border-2 outline-none border-slate-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                                        placeholder="Supplier name"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Additional Information */}
                        <div>
                            <h3 className="flex items-center mb-4 text-lg font-bold text-slate-800">
                                <div className="flex items-center justify-center w-8 h-8 mr-3 bg-indigo-100 rounded-lg">
                                    <FaImage className="text-sm text-indigo-600" />
                                </div>
                                Additional Information
                            </h3>
                            <div className="grid grid-cols-1 gap-4">
                                <div>
                                    <label className="block mb-2 text-sm font-semibold text-slate-700">
                                        Image URL
                                    </label>
                                    <div className="relative">
                                        <FaImage className="absolute -translate-y-1/2 left-4 top-1/2 text-slate-400" />
                                        <input
                                            type="url"
                                            name="imageUrl"
                                            value={product.imageUrl}
                                            onChange={handleChange}
                                            className="w-full py-3 pl-12 pr-4 transition-all border-2 outline-none border-slate-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                                            placeholder="https://example.com/image.jpg"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block mb-2 text-sm font-semibold text-slate-700">
                                        Status
                                    </label>
                                    <select
                                        name="status"
                                        value={product.status}
                                        onChange={handleChange}
                                        className="w-full px-4 py-3 transition-all border-2 outline-none border-slate-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                                    >
                                        <option value="active">Active</option>
                                        <option value="inactive">Inactive</option>
                                        <option value="discontinued">Discontinued</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex pt-4 space-x-4">
                            <button
                                onClick={saveProduct}
                                disabled={loading}
                                className="flex items-center justify-center flex-1 px-6 py-4 space-x-2 text-lg font-bold text-white transition-all transform bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl hover:shadow-2xl hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                            >
                                {loading ? (
                                    <>
                                        <FaSpinner className="animate-spin" />
                                        <span>Saving...</span>
                                    </>
                                ) : (
                                    <>
                                        <FaSave />
                                        <span>Save Product</span>
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
                            <h3 className="mb-2 text-2xl font-bold text-slate-800">Product Added!</h3>
                            <p className="text-slate-600">Product has been saved successfully.</p>
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

export default AddProduct;