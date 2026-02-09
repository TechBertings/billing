import React, { useState, useEffect } from 'react';

import {
    FaWarehouse,
    FaPlus,
    FaMinus,
    FaExchangeAlt,
    FaSearch,
    FaBox,
    FaHistory,
    FaSave,
    FaTimes,
    FaCheckCircle,
    FaSpinner,
    FaExclamationTriangle
} from 'react-icons/fa';
import { getFromLocalStorage, saveToLocalStorage, generateId } from '../utils/localStorage';

const Inventory = () => {
    const [products, setProducts] = useState([]);
    const [movements, setMovements] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [showAdjustModal, setShowAdjustModal] = useState(false);
    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [saving, setSaving] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);

    // Adjustment form
    const [adjustment, setAdjustment] = useState({
        type: 'add', // add, remove, adjust
        quantity: 0,
        reason: '',
        notes: ''
    });

    // Load products and movements from Firebase
    useEffect(() => {
        const productsData = getFromLocalStorage('products') || {};
        const movementsData = getFromLocalStorage('inventory_movements') || {};
        
        const productsList = Object.keys(productsData).map(key => ({
            id: key,
            ...productsData[key]
        }));
        
        const movementsList = Object.keys(movementsData).map(key => ({
            id: key,
            ...movementsData[key]
        })).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        
        setProducts(productsList);
        setMovements(movementsList);
        setLoading(false);
    }, []);

    // Open adjustment modal
    const openAdjustModal = (product) => {
        setSelectedProduct(product);
        setAdjustment({
            type: 'add',
            quantity: 0,
            reason: '',
            notes: ''
        });
        setShowAdjustModal(true);
    };

    // Open history modal
    const openHistoryModal = (product) => {
        setSelectedProduct(product);
        setShowHistoryModal(true);
    };

    // Close modals
    const closeModals = () => {
        setShowAdjustModal(false);
        setShowHistoryModal(false);
        setSelectedProduct(null);
        setAdjustment({
            type: 'add',
            quantity: 0,
            reason: '',
            notes: ''
        });
    };

    // Save adjustment
    const saveAdjustment = async () => {
        if (!adjustment.quantity || adjustment.quantity === 0) {
            alert('Please enter a valid quantity!');
            return;
        }
        if (!adjustment.reason.trim()) {
            alert('Please enter a reason for this adjustment!');
            return;
        }

        setSaving(true);
        try {
            const currentStock = selectedProduct.stockQuantity || 0;
            let newStock = currentStock;

            // Calculate new stock based on adjustment type
            switch (adjustment.type) {
                case 'add':
                    newStock = currentStock + parseInt(adjustment.quantity);
                    break;
                case 'remove':
                    newStock = currentStock - parseInt(adjustment.quantity);
                    if (newStock < 0) {
                        alert('Cannot remove more than current stock!');
                        setSaving(false);
                        return;
                    }
                    break;
                case 'adjust':
                    newStock = parseInt(adjustment.quantity);
                    break;
                default:
                    break;
            }

            // Update product stock
            const existingProducts = getFromLocalStorage('products') || {};
            existingProducts[selectedProduct.id] = {
                ...existingProducts[selectedProduct.id],
                stockQuantity: newStock,
                updatedAt: new Date().toISOString()
            };
            saveToLocalStorage('products', existingProducts);
            
            // Reload products
            const productsList = Object.keys(existingProducts).map(key => ({
                id: key,
                ...existingProducts[key]
            }));
            setProducts(productsList);

            // Record movement
            const existingMovements = getFromLocalStorage('inventory_movements') || {};
            const movementId = generateId();
            existingMovements[movementId] = {
                productId: selectedProduct.id,
                productName: selectedProduct.name,
                productSku: selectedProduct.sku,
                type: adjustment.type,
                quantity: parseInt(adjustment.quantity),
                previousStock: currentStock,
                newStock: newStock,
                reason: adjustment.reason,
                notes: adjustment.notes,
                createdAt: new Date().toISOString()
            };
            saveToLocalStorage('inventory_movements', existingMovements);
            
            // Reload movements
            const movementsList = Object.keys(existingMovements).map(key => ({
                id: key,
                ...existingMovements[key]
            })).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            setMovements(movementsList);

            setShowSuccess(true);
            setTimeout(() => {
                setShowSuccess(false);
                closeModals();
            }, 2000);
        } catch (error) {
            console.error('Error saving adjustment:', error);
            alert('Error saving adjustment. Please try again.');
        } finally {
            setSaving(false);
        }
    };
    // Filter products
    const filteredProducts = products.filter(product =>
        product.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.sku?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.barcode?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Get stock status
    const getStockStatus = (product) => {
        if (product.stockQuantity === 0) {
            return { text: 'Out of Stock', color: 'red', bgColor: 'bg-red-50', borderColor: 'border-red-200' };
        } else if (product.stockQuantity <= product.minStockLevel) {
            return { text: 'Low Stock', color: 'orange', bgColor: 'bg-orange-50', borderColor: 'border-orange-200' };
        } else {
            return { text: 'In Stock', color: 'green', bgColor: 'bg-green-50', borderColor: 'border-green-200' };
        }
    };

    // Filter movements for selected product
    const productMovements = selectedProduct 
        ? movements.filter(m => m.productId === selectedProduct.id)
        : [];

    // Get movement icon
    const getMovementIcon = (type) => {
        switch (type) {
            case 'add':
                return <FaPlus className="text-green-600" />;
            case 'remove':
                return <FaMinus className="text-red-600" />;
            case 'adjust':
                return <FaExchangeAlt className="text-blue-600" />;
            default:
                return <FaWarehouse className="text-gray-600" />;
        }
    };

    return (
        <div className="p-6">
            <div className="mx-auto max-w-7xl">
                {/* Header */}
                <div className="p-6 mb-6 bg-white border border-gray-200 rounded-lg shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-800">Inventory Management</h1>
                            <p className="mt-1 text-sm text-gray-600">
                                Total Products: <span className="font-semibold">{products.length}</span>
                                {' | '}
                                Low Stock Items: <span className="font-semibold text-orange-600">
                                    {products.filter(p => p.stockQuantity > 0 && p.stockQuantity <= p.minStockLevel).length}
                                </span>
                                {' | '}
                                Out of Stock: <span className="font-semibold text-red-600">
                                    {products.filter(p => p.stockQuantity === 0).length}
                                </span>
                            </p>
                        </div>
                    </div>

                    {/* Search */}
                    <div className="relative">
                        <FaSearch className="absolute text-gray-400 -translate-y-1/2 left-4 top-1/2" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Search by product name, SKU, or barcode..."
                            className="w-full py-3 pl-12 pr-4 border border-gray-300 rounded-lg focus:outline-none focus:border-gray-500 focus:ring-1 focus:ring-gray-500"
                        />
                    </div>
                </div>

                {/* Products Grid */}
                {loading ? (
                    <div className="p-12 text-center bg-white border border-gray-200 rounded-lg shadow-sm">
                        <div className="inline-block w-8 h-8 border-b-2 border-gray-800 rounded-full animate-spin"></div>
                        <p className="mt-4 text-gray-600">Loading inventory...</p>
                    </div>
                ) : filteredProducts.length === 0 ? (
                    <div className="p-12 text-center bg-white border border-gray-200 rounded-lg shadow-sm">
                        <FaWarehouse className="mx-auto mb-4 text-5xl text-gray-300" />
                        <p className="text-lg text-gray-600">No products found</p>
                        <p className="mt-2 text-sm text-gray-500">
                            {searchTerm ? 'Try a different search term' : 'Start by adding products'}
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {filteredProducts.map((product) => {
                            const status = getStockStatus(product);
                            return (
                                <div
                                    key={product.id}
                                    className={`bg-white rounded-lg shadow-sm border-2 ${status.borderColor} p-6 hover:shadow-lg transition-all`}
                                >
                                    <div className="flex items-start justify-between mb-4">
                                        <div className="flex-1">
                                            <h3 className="mb-1 text-lg font-bold text-gray-800">
                                                {product.name}
                                            </h3>
                                            <p className="text-sm text-gray-500">{product.sku}</p>
                                        </div>
                                        <div className="flex items-center justify-center w-12 h-12 bg-blue-100 rounded-lg">
                                            <FaBox className="text-blue-600" />
                                        </div>
                                    </div>

                                    {/* Stock Status */}
                                    <div className={`${status.bgColor} rounded-lg p-4 mb-4`}>
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-sm font-semibold text-gray-700">Current Stock</span>
                                            <span className={`px-3 py-1 text-xs font-bold rounded-full bg-${status.color}-100 text-${status.color}-800`}>
                                                {status.text}
                                            </span>
                                        </div>
                                        <div className="flex items-baseline space-x-2">
                                            <span className="text-3xl font-bold text-gray-900">
                                                {product.stockQuantity}
                                            </span>
                                            <span className="text-sm text-gray-600">{product.unit}</span>
                                        </div>
                                        <div className="mt-2 text-xs text-gray-600">
                                            Min Level: {product.minStockLevel} {product.unit}
                                        </div>
                                    </div>

                                    {/* Low Stock Warning */}
                                    {product.stockQuantity > 0 && product.stockQuantity <= product.minStockLevel && (
                                        <div className="flex items-center p-3 mb-4 space-x-2 border border-orange-200 rounded-lg bg-orange-50">
                                            <FaExclamationTriangle className="flex-shrink-0 text-orange-600" />
                                            <span className="text-xs font-semibold text-orange-700">
                                                Stock is running low! Reorder soon.
                                            </span>
                                        </div>
                                    )}

                                    {/* Actions */}
                                    <div className="flex space-x-2">
                                        <button
                                            onClick={() => openAdjustModal(product)}
                                            className="flex items-center justify-center flex-1 px-4 py-2 space-x-2 text-sm font-semibold text-white transition-colors bg-blue-600 rounded-lg hover:bg-blue-700"
                                        >
                                            <FaExchangeAlt />
                                            <span>Adjust</span>
                                        </button>
                                        <button
                                            onClick={() => openHistoryModal(product)}
                                            className="px-4 py-2 text-sm font-semibold text-gray-700 transition-colors border-2 border-gray-300 rounded-lg hover:bg-gray-50"
                                            title="View History"
                                        >
                                            <FaHistory />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Adjustment Modal */}
            {showAdjustModal && selectedProduct && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
                    <div className="w-full max-w-2xl bg-white rounded-lg shadow-xl">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                            <div>
                                <h2 className="text-xl font-bold text-gray-800">Adjust Stock</h2>
                                <p className="mt-1 text-sm text-gray-600">{selectedProduct.name} - {selectedProduct.sku}</p>
                            </div>
                            <button
                                onClick={closeModals}
                                className="p-2 transition-colors rounded-lg hover:bg-gray-100"
                            >
                                <FaTimes className="text-gray-600" />
                            </button>
                        </div>

                        {/* Modal Content */}
                        <div className="p-6 space-y-6">
                            {/* Current Stock */}
                            <div className="p-4 border-2 border-blue-200 rounded-lg bg-blue-50">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-semibold text-blue-700">Current Stock:</span>
                                    <span className="text-2xl font-bold text-blue-900">
                                        {selectedProduct.stockQuantity} {selectedProduct.unit}
                                    </span>
                                </div>
                            </div>

                            {/* Adjustment Type */}
                            <div>
                                <label className="block mb-3 text-sm font-semibold text-gray-700">
                                    Adjustment Type
                                </label>
                                <div className="grid grid-cols-3 gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setAdjustment(prev => ({ ...prev, type: 'add' }))}
                                        className={`px-4 py-3 rounded-lg border-2 transition-all font-semibold ${
                                            adjustment.type === 'add'
                                                ? 'border-green-500 bg-green-50 text-green-700'
                                                : 'border-gray-200 hover:border-gray-300 text-gray-600'
                                        }`}
                                    >
                                        <FaPlus className="inline mr-2" />
                                        Add Stock
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setAdjustment(prev => ({ ...prev, type: 'remove' }))}
                                        className={`px-4 py-3 rounded-lg border-2 transition-all font-semibold ${
                                            adjustment.type === 'remove'
                                                ? 'border-red-500 bg-red-50 text-red-700'
                                                : 'border-gray-200 hover:border-gray-300 text-gray-600'
                                        }`}
                                    >
                                        <FaMinus className="inline mr-2" />
                                        Remove
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setAdjustment(prev => ({ ...prev, type: 'adjust' }))}
                                        className={`px-4 py-3 rounded-lg border-2 transition-all font-semibold ${
                                            adjustment.type === 'adjust'
                                                ? 'border-blue-500 bg-blue-50 text-blue-700'
                                                : 'border-gray-200 hover:border-gray-300 text-gray-600'
                                        }`}
                                    >
                                        <FaExchangeAlt className="inline mr-2" />
                                        Set To
                                    </button>
                                </div>
                            </div>

                            {/* Quantity */}
                            <div>
                                <label className="block mb-2 text-sm font-semibold text-gray-700">
                                    {adjustment.type === 'adjust' ? 'New Stock Quantity' : 'Quantity'}
                                </label>
                                <input
                                    type="number"
                                    value={adjustment.quantity}
                                    onChange={(e) => setAdjustment(prev => ({ ...prev, quantity: e.target.value }))}
                                    min="0"
                                    className="w-full px-4 py-3 text-lg font-semibold transition-all border-2 border-gray-200 rounded-lg outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                                    placeholder="0"
                                />
                            </div>

                            {/* Preview */}
                            {adjustment.quantity > 0 && (
                                <div className="p-4 border border-gray-200 rounded-lg bg-gray-50">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm font-semibold text-gray-700">New Stock After Adjustment:</span>
                                        <span className="text-xl font-bold text-gray-900">
                                            {adjustment.type === 'add' 
                                                ? selectedProduct.stockQuantity + parseInt(adjustment.quantity)
                                                : adjustment.type === 'remove'
                                                ? selectedProduct.stockQuantity - parseInt(adjustment.quantity)
                                                : parseInt(adjustment.quantity)
                                            } {selectedProduct.unit}
                                        </span>
                                    </div>
                                </div>
                            )}

                            {/* Reason */}
                            <div>
                                <label className="block mb-2 text-sm font-semibold text-gray-700">
                                    Reason *
                                </label>
                                <select
                                    value={adjustment.reason}
                                    onChange={(e) => setAdjustment(prev => ({ ...prev, reason: e.target.value }))}
                                    className="w-full px-4 py-3 transition-all border-2 border-gray-200 rounded-lg outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                                >
                                    <option value="">Select reason</option>
                                    <option value="Purchase">Purchase/Restock</option>
                                    <option value="Sale">Sale/Order</option>
                                    <option value="Return">Customer Return</option>
                                    <option value="Damage">Damaged/Defective</option>
                                    <option value="Loss">Loss/Theft</option>
                                    <option value="Correction">Stock Correction</option>
                                    <option value="Transfer">Transfer</option>
                                    <option value="Other">Other</option>
                                </select>
                            </div>

                            {/* Notes */}
                            <div>
                                <label className="block mb-2 text-sm font-semibold text-gray-700">
                                    Notes (Optional)
                                </label>
                                <textarea
                                    value={adjustment.notes}
                                    onChange={(e) => setAdjustment(prev => ({ ...prev, notes: e.target.value }))}
                                    rows="3"
                                    className="w-full px-4 py-3 transition-all border-2 border-gray-200 rounded-lg outline-none resize-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                                    placeholder="Add any additional notes..."
                                />
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="flex px-6 py-4 space-x-3 border-t border-gray-200">
                            <button
                                onClick={saveAdjustment}
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
                                        <span>Save Adjustment</span>
                                    </>
                                )}
                            </button>
                            <button
                                onClick={closeModals}
                                disabled={saving}
                                className="px-6 py-3 font-semibold text-gray-700 transition-colors border-2 border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* History Modal */}
            {showHistoryModal && selectedProduct && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
                    <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                        {/* Modal Header */}
                        <div className="sticky top-0 flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200">
                            <div>
                                <h2 className="text-xl font-bold text-gray-800">Stock Movement History</h2>
                                <p className="mt-1 text-sm text-gray-600">{selectedProduct.name} - {selectedProduct.sku}</p>
                            </div>
                            <button
                                onClick={closeModals}
                                className="p-2 transition-colors rounded-lg hover:bg-gray-100"
                            >
                                <FaTimes className="text-gray-600" />
                            </button>
                        </div>

                        {/* Modal Content */}
                        <div className="p-6">
                            {productMovements.length === 0 ? (
                                <div className="py-12 text-center">
                                    <FaHistory className="mx-auto mb-4 text-5xl text-gray-300" />
                                    <p className="text-gray-600">No movement history yet</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {productMovements.map((movement) => (
                                        <div key={movement.id} className="p-4 border border-gray-200 rounded-lg bg-gray-50">
                                            <div className="flex items-start justify-between">
                                                <div className="flex items-start space-x-3">
                                                    <div className="flex items-center justify-center w-10 h-10 bg-white border-2 border-gray-200 rounded-lg">
                                                        {getMovementIcon(movement.type)}
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center mb-1 space-x-2">
                                                            <span className="font-bold text-gray-900">
                                                                {movement.type === 'add' ? 'Added' : movement.type === 'remove' ? 'Removed' : 'Adjusted'}
                                                            </span>
                                                            <span className="text-lg font-bold text-gray-900">
                                                                {movement.quantity} {selectedProduct.unit}
                                                            </span>
                                                        </div>
                                                        <p className="text-sm text-gray-600">
                                                            {movement.previousStock} → {movement.newStock} {selectedProduct.unit}
                                                        </p>
                                                        <p className="mt-2 text-sm font-semibold text-gray-700">
                                                            Reason: {movement.reason}
                                                        </p>
                                                        {movement.notes && (
                                                            <p className="mt-1 text-sm text-gray-600">
                                                                Notes: {movement.notes}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-xs text-gray-500">
                                                        {new Date(movement.createdAt).toLocaleDateString('en-US', {
                                                            year: 'numeric',
                                                            month: 'short',
                                                            day: 'numeric'
                                                        })}
                                                    </p>
                                                    <p className="text-xs text-gray-500">
                                                        {new Date(movement.createdAt).toLocaleTimeString('en-US', {
                                                            hour: '2-digit',
                                                            minute: '2-digit'
                                                        })}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="sticky bottom-0 px-6 py-4 bg-white border-t border-gray-200">
                            <button
                                onClick={closeModals}
                                className="w-full px-6 py-3 font-semibold text-gray-700 transition-colors border border-gray-300 rounded-lg hover:bg-gray-50"
                            >
                                Close
                            </button>
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
                            <h3 className="mb-2 text-2xl font-bold text-gray-800">Stock Updated!</h3>
                            <p className="text-gray-600">Inventory has been adjusted successfully.</p>
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

export default Inventory;