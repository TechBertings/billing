import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import {
    FaEye,
    FaTimes,
    FaBox,
    FaBarcode,
    FaDollarSign,
    FaLayerGroup,
    FaWarehouse,
    FaSearch,
    FaFileExport,
    FaFileImport,
    FaDownload,
    FaFilter,
    FaTags
} from 'react-icons/fa';
import { getFromLocalStorage, saveToLocalStorage, generateId } from '../utils/localStorage';

const ProductList = () => {
    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [importing, setImporting] = useState(false);
    const [filterCategory, setFilterCategory] = useState('all');
    const [filterStatus, setFilterStatus] = useState('all');

    // Load products and categories from Firebase
   useEffect(() => {
        const productsData = getFromLocalStorage('products') || {};
        const categoriesData = getFromLocalStorage('categories') || {};
        
        const productsList = Object.keys(productsData).map(key => ({
            id: key,
            ...productsData[key]
        }));
        
        const categoriesList = Object.keys(categoriesData).map(key => ({
            id: key,
            ...categoriesData[key]
        }));
        
        setProducts(productsList);
        setCategories(categoriesList);
        setLoading(false);
    }, []);

    // Export to Excel
  const exportToExcel = () => {
        try {
            const exportData = products.map(product => ({
                'SKU': product.sku || '',
                'Product Name': product.name || '',
                'Barcode': product.barcode || '',
                'Description': product.description || '',
                'Category': product.category || '',
                'Unit': product.unit || '',
                'Selling Price': product.price || 0,
                'Cost Price': product.cost || 0,
                'Tax Rate (%)': product.taxRate || 0,
                'Stock Quantity': product.stockQuantity || 0,
                'Min Stock Level': product.minStockLevel || 0,
                'Supplier': product.supplier || '',
                'Image URL': product.imageUrl || '',
                'Status': product.status || 'active',
                'Created At': product.createdAt ? new Date(product.createdAt).toLocaleString() : ''
            }));

            const ws = XLSX.utils.json_to_sheet(exportData);

            const columnWidths = [
                { wch: 15 }, // SKU
                { wch: 30 }, // Product Name
                { wch: 15 }, // Barcode
                { wch: 40 }, // Description
                { wch: 20 }, // Category
                { wch: 10 }, // Unit
                { wch: 15 }, // Selling Price
                { wch: 15 }, // Cost Price
                { wch: 12 }, // Tax Rate
                { wch: 15 }, // Stock Quantity
                { wch: 15 }, // Min Stock Level
                { wch: 25 }, // Supplier
                { wch: 40 }, // Image URL
                { wch: 12 }, // Status
                { wch: 20 }  // Created At
            ];
            ws['!cols'] = columnWidths;

            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Products');

            const filename = `products_export_${new Date().toISOString().split('T')[0]}.xlsx`;
            XLSX.writeFile(wb, filename);

            alert(`Successfully exported ${products.length} products!`);
        } catch (error) {
            console.error('Export error:', error);
            alert('Error exporting products. Please try again.');
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

                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const jsonData = XLSX.utils.sheet_to_json(worksheet);

                if (jsonData.length === 0) {
                    alert('No data found in the Excel file!');
                    setImporting(false);
                    return;
                }

                const existingProducts = getFromLocalStorage('products') || {};
                let successCount = 0;
                let errorCount = 0;

                for (const row of jsonData) {
                    try {
                        if (!row['Product Name'] || !row['Selling Price'] || !row.Category) {
                            errorCount++;
                            continue;
                        }

                        const productId = generateId();
                        existingProducts[productId] = {
                            id: productId,
                            sku: row.SKU || `SKU-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                            name: row['Product Name'] || '',
                            barcode: row.Barcode || '',
                            description: row.Description || '',
                            category: row.Category || '',
                            unit: row.Unit || 'pcs',
                            price: parseFloat(row['Selling Price']) || 0,
                            cost: parseFloat(row['Cost Price']) || 0,
                            taxRate: parseFloat(row['Tax Rate (%)']) || 12,
                            stockQuantity: parseInt(row['Stock Quantity']) || 0,
                            minStockLevel: parseInt(row['Min Stock Level']) || 5,
                            supplier: row.Supplier || '',
                            imageUrl: row['Image URL'] || '',
                            status: row.Status?.toLowerCase() || 'active',
                            createdAt: new Date().toISOString(),
                            updatedAt: new Date().toISOString()
                        };
                        successCount++;
                    } catch (err) {
                        console.error('Error importing row:', err);
                        errorCount++;
                    }
                }

                saveToLocalStorage('products', existingProducts);
                
                // Reload products
                const productsList = Object.keys(existingProducts).map(key => ({
                    id: key,
                    ...existingProducts[key]
                }));
                setProducts(productsList);

                setImporting(false);
                event.target.value = '';

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
                'SKU': 'SKU-001',
                'Product Name': 'Sample Product 1',
                'Barcode': '1234567890',
                'Description': 'High-quality product description',
                'Category': 'Electronics',
                'Unit': 'pcs',
                'Selling Price': 1500.00,
                'Cost Price': 1000.00,
                'Tax Rate (%)': 12,
                'Stock Quantity': 100,
                'Min Stock Level': 10,
                'Supplier': 'ABC Supplier Inc.',
                'Image URL': 'https://example.com/image.jpg',
                'Status': 'active'
            },
            {
                'SKU': 'SKU-002',
                'Product Name': 'Sample Product 2',
                'Barcode': '0987654321',
                'Description': 'Premium quality product',
                'Category': 'Accessories',
                'Unit': 'box',
                'Selling Price': 2500.00,
                'Cost Price': 1800.00,
                'Tax Rate (%)': 12,
                'Stock Quantity': 50,
                'Min Stock Level': 5,
                'Supplier': 'XYZ Trading Co.',
                'Image URL': '',
                'Status': 'active'
            }
        ];

        const ws = XLSX.utils.json_to_sheet(templateData);
        
        const columnWidths = [
            { wch: 15 }, { wch: 30 }, { wch: 15 }, { wch: 40 },
            { wch: 20 }, { wch: 10 }, { wch: 15 }, { wch: 15 },
            { wch: 12 }, { wch: 15 }, { wch: 15 }, { wch: 25 },
            { wch: 40 }, { wch: 12 }
        ];
        ws['!cols'] = columnWidths;

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Product Template');

        XLSX.writeFile(wb, 'product_import_template.xlsx');
    };

    // Filter products
    const filteredProducts = products.filter(product => {
        const matchesSearch = 
            product.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            product.sku?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            product.barcode?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            product.category?.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesCategory = filterCategory === 'all' || product.category === filterCategory;
        const matchesStatus = filterStatus === 'all' || product.status === filterStatus;

        return matchesSearch && matchesCategory && matchesStatus;
    });

    // View product details
    const viewProduct = (product) => {
        setSelectedProduct(product);
        setShowModal(true);
    };

    // Close modal
    const closeModal = () => {
        setShowModal(false);
        setSelectedProduct(null);
    };

    // Get stock status
    const getStockStatus = (product) => {
        if (product.stockQuantity === 0) {
            return { text: 'Out of Stock', color: 'red' };
        } else if (product.stockQuantity <= product.minStockLevel) {
            return { text: 'Low Stock', color: 'orange' };
        } else {
            return { text: 'In Stock', color: 'green' };
        }
    };

    return (
        <div className="p-6">
            <div className="mx-auto max-w-7xl">
                {/* Header */}
                <div className="p-6 mb-6 bg-white border border-gray-200 rounded-lg shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-800">Product List</h1>
                            <p className="mt-1 text-sm text-gray-600">
                                Total Products: <span className="font-semibold">{products.length}</span>
                                {' | '}
                                Showing: <span className="font-semibold">{filteredProducts.length}</span>
                            </p>
                        </div>

                        {/* Import/Export Buttons */}
                        <div className="flex space-x-3">
                            <button
                                onClick={downloadTemplate}
                                className="flex items-center px-4 py-2 space-x-2 text-sm font-medium text-gray-700 transition-colors bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                                title="Download Excel Template"
                            >
                                <FaDownload />
                                <span>Template</span>
                            </button>

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

                            <button
                                onClick={exportToExcel}
                                disabled={products.length === 0}
                                className="flex items-center px-4 py-2 space-x-2 text-sm font-medium text-white transition-colors bg-gray-800 rounded-lg hover:bg-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <FaFileExport />
                                <span>Export</span>
                            </button>
                        </div>
                    </div>

                    {/* Search and Filters */}
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                        <div className="relative md:col-span-1">
                            <FaSearch className="absolute text-gray-400 -translate-y-1/2 left-4 top-1/2" />
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Search by name, SKU, barcode..."
                                className="w-full py-3 pl-12 pr-4 border border-gray-300 rounded-lg focus:outline-none focus:border-gray-500 focus:ring-1 focus:ring-gray-500"
                            />
                        </div>

                        <div className="relative">
                            <FaLayerGroup className="absolute text-gray-400 -translate-y-1/2 left-4 top-1/2" />
                            <select
                                value={filterCategory}
                                onChange={(e) => setFilterCategory(e.target.value)}
                                className="w-full py-3 pl-12 pr-4 border border-gray-300 rounded-lg focus:outline-none focus:border-gray-500 focus:ring-1 focus:ring-gray-500"
                            >
                                <option value="all">All Categories</option>
                                {categories.map(cat => (
                                    <option key={cat.id} value={cat.name}>
                                        {cat.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="relative">
                            <FaFilter className="absolute text-gray-400 -translate-y-1/2 left-4 top-1/2" />
                            <select
                                value={filterStatus}
                                onChange={(e) => setFilterStatus(e.target.value)}
                                className="w-full py-3 pl-12 pr-4 border border-gray-300 rounded-lg focus:outline-none focus:border-gray-500 focus:ring-1 focus:ring-gray-500"
                            >
                                <option value="all">All Status</option>
                                <option value="active">Active</option>
                                <option value="inactive">Inactive</option>
                                <option value="discontinued">Discontinued</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Table */}
                <div className="overflow-hidden bg-white border border-gray-200 rounded-lg shadow-sm">
                    {loading ? (
                        <div className="p-12 text-center">
                            <div className="inline-block w-8 h-8 border-b-2 border-gray-800 rounded-full animate-spin"></div>
                            <p className="mt-4 text-gray-600">Loading products...</p>
                        </div>
                    ) : filteredProducts.length === 0 ? (
                        <div className="p-12 text-center">
                            <FaBox className="mx-auto mb-4 text-5xl text-gray-300" />
                            <p className="text-lg text-gray-600">No products found</p>
                            <p className="mt-2 text-sm text-gray-500">
                                {searchTerm || filterCategory !== 'all' || filterStatus !== 'all' 
                                    ? 'Try adjusting your filters' 
                                    : 'Start by adding a new product'}
                            </p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="border-b border-gray-200 bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-4 text-xs font-semibold tracking-wider text-left text-gray-700 uppercase">
                                            Product
                                        </th>
                                        <th className="px-6 py-4 text-xs font-semibold tracking-wider text-left text-gray-700 uppercase">
                                            SKU/Barcode
                                        </th>
                                        <th className="px-6 py-4 text-xs font-semibold tracking-wider text-left text-gray-700 uppercase">
                                            Category
                                        </th>
                                        <th className="px-6 py-4 text-xs font-semibold tracking-wider text-right text-gray-700 uppercase">
                                            Price
                                        </th>
                                        <th className="px-6 py-4 text-xs font-semibold tracking-wider text-center text-gray-700 uppercase">
                                            Stock
                                        </th>
                                        <th className="px-6 py-4 text-xs font-semibold tracking-wider text-center text-gray-700 uppercase">
                                            Status
                                        </th>
                                        <th className="px-6 py-4 text-xs font-semibold tracking-wider text-center text-gray-700 uppercase">
                                            Action
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                    {filteredProducts.map((product) => {
                                        const stockStatus = getStockStatus(product);
                                        return (
                                            <tr key={product.id} className="transition-colors hover:bg-gray-50">
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="flex items-center">
                                                        <div className="flex items-center justify-center w-10 h-10 mr-3 bg-blue-100 rounded-lg">
                                                            <FaBox className="text-sm text-blue-600" />
                                                        </div>
                                                        <div>
                                                            <div className="text-sm font-semibold text-gray-900">
                                                                {product.name}
                                                            </div>
                                                            <div className="text-xs text-gray-500">
                                                                {product.unit}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="text-sm text-gray-700">{product.sku}</div>
                                                    {product.barcode && (
                                                        <div className="text-xs text-gray-500">{product.barcode}</div>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <span className="inline-flex px-3 py-1 text-xs font-semibold leading-5 text-blue-800 bg-blue-100 rounded-full">
                                                        {product.category}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-right whitespace-nowrap">
                                                    <div className="text-sm font-bold text-gray-900">
                                                        ₱{parseFloat(product.price).toFixed(2)}
                                                    </div>
                                                    {product.cost && (
                                                        <div className="text-xs text-gray-500">
                                                            Cost: ₱{parseFloat(product.cost).toFixed(2)}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 text-center whitespace-nowrap">
                                                    <div className="text-sm font-semibold text-gray-900">
                                                        {product.stockQuantity}
                                                    </div>
                                                    <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-${stockStatus.color}-100 text-${stockStatus.color}-800`}>
                                                        {stockStatus.text}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-center whitespace-nowrap">
                                                    <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                                        product.status === 'active' 
                                                            ? 'bg-green-100 text-green-800' 
                                                            : product.status === 'inactive'
                                                            ? 'bg-gray-100 text-gray-800'
                                                            : 'bg-red-100 text-red-800'
                                                    }`}>
                                                        {product.status}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-center whitespace-nowrap">
                                                    <button
                                                        onClick={() => viewProduct(product)}
                                                        className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 transition-colors bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                                                    >
                                                        <FaEye className="mr-2" />
                                                        View
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Results count */}
                {!loading && filteredProducts.length > 0 && (
                    <div className="mt-4 text-sm text-center text-gray-600">
                        Showing {filteredProducts.length} of {products.length} products
                    </div>
                )}
            </div>

            {/* View Modal */}
            {showModal && selectedProduct && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
                    <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                        {/* Modal Header */}
                        <div className="sticky top-0 flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200">
                            <h2 className="text-xl font-bold text-gray-800">Product Details</h2>
                            <button
                                onClick={closeModal}
                                className="p-2 transition-colors rounded-lg hover:bg-gray-100"
                            >
                                <FaTimes className="text-gray-600" />
                            </button>
                        </div>

                        {/* Modal Content */}
                        <div className="p-6 space-y-6">
                            {/* Product Image */}
                            {selectedProduct.imageUrl && (
                                <div className="flex justify-center">
                                    <img 
                                        src={selectedProduct.imageUrl} 
                                        alt={selectedProduct.name}
                                        className="object-contain h-48 max-w-xs border border-gray-200 rounded-lg"
                                        onError={(e) => e.target.style.display = 'none'}
                                    />
                                </div>
                            )}

                            {/* Basic Information */}
                            <div>
                                <h3 className="flex items-center mb-4 text-sm font-semibold tracking-wider text-gray-500 uppercase">
                                    <FaBox className="mr-2" />
                                    Basic Information
                                </h3>
                                <div className="p-4 space-y-3 rounded-lg bg-gray-50">
                                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                        <div>
                                            <p className="mb-1 text-xs font-semibold text-gray-500 uppercase">Product Name</p>
                                            <p className="text-sm font-medium text-gray-900">{selectedProduct.name}</p>
                                        </div>

                                        <div>
                                            <p className="flex items-center mb-1 text-xs font-semibold text-gray-500 uppercase">
                                                <FaTags className="mr-1" />
                                                SKU
                                            </p>
                                            <p className="text-sm text-gray-900">{selectedProduct.sku}</p>
                                        </div>

                                        {selectedProduct.barcode && (
                                            <div>
                                                <p className="flex items-center mb-1 text-xs font-semibold text-gray-500 uppercase">
                                                    <FaBarcode className="mr-1" />
                                                    Barcode
                                                </p>
                                                <p className="text-sm text-gray-900">{selectedProduct.barcode}</p>
                                            </div>
                                        )}

                                        <div>
                                            <p className="flex items-center mb-1 text-xs font-semibold text-gray-500 uppercase">
                                                <FaLayerGroup className="mr-1" />
                                                Category
                                            </p>
                                            <p className="text-sm text-gray-900">{selectedProduct.category}</p>
                                        </div>

                                        <div>
                                            <p className="mb-1 text-xs font-semibold text-gray-500 uppercase">Unit</p>
                                            <p className="text-sm text-gray-900">{selectedProduct.unit}</p>
                                        </div>

                                        <div>
                                            <p className="mb-1 text-xs font-semibold text-gray-500 uppercase">Status</p>
                                            <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                                selectedProduct.status === 'active' 
                                                    ? 'bg-green-100 text-green-800' 
                                                    : selectedProduct.status === 'inactive'
                                                    ? 'bg-gray-100 text-gray-800'
                                                    : 'bg-red-100 text-red-800'
                                            }`}>
                                                {selectedProduct.status}
                                            </span>
                                        </div>
                                    </div>

                                    {selectedProduct.description && (
                                        <div>
                                            <p className="mb-1 text-xs font-semibold text-gray-500 uppercase">Description</p>
                                            <p className="text-sm text-gray-900">{selectedProduct.description}</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Pricing Information */}
                            <div>
                                <h3 className="flex items-center mb-4 text-sm font-semibold tracking-wider text-gray-500 uppercase">
                                    <FaDollarSign className="mr-2" />
                                    Pricing Information
                                </h3>
                                <div className="p-4 rounded-lg bg-gray-50">
                                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                                        <div>
                                            <p className="mb-1 text-xs font-semibold text-gray-500 uppercase">Selling Price</p>
                                            <p className="text-lg font-bold text-gray-900">₱{parseFloat(selectedProduct.price).toFixed(2)}</p>
                                        </div>

                                        <div>
                                            <p className="mb-1 text-xs font-semibold text-gray-500 uppercase">Cost Price</p>
                                            <p className="text-lg font-bold text-gray-900">₱{parseFloat(selectedProduct.cost || 0).toFixed(2)}</p>
                                        </div>

                                        <div>
                                            <p className="mb-1 text-xs font-semibold text-gray-500 uppercase">Tax Rate</p>
                                            <p className="text-lg font-bold text-gray-900">{selectedProduct.taxRate}%</p>
                                        </div>
                                    </div>

                                    {selectedProduct.cost && (
                                        <div className="pt-4 mt-4 border-t border-gray-200">
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm font-semibold text-gray-700">Profit Margin:</span>
                                                <span className="text-lg font-bold text-green-600">
                                                    ₱{(parseFloat(selectedProduct.price) - parseFloat(selectedProduct.cost)).toFixed(2)}
                                                    {' '}
                                                    ({(((parseFloat(selectedProduct.price) - parseFloat(selectedProduct.cost)) / parseFloat(selectedProduct.price)) * 100).toFixed(1)}%)
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Inventory Information */}
                            <div>
                                <h3 className="flex items-center mb-4 text-sm font-semibold tracking-wider text-gray-500 uppercase">
                                    <FaWarehouse className="mr-2" />
                                    Inventory Information
                                </h3>
                                <div className="p-4 rounded-lg bg-gray-50">
                                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                                        <div>
                                            <p className="mb-1 text-xs font-semibold text-gray-500 uppercase">Stock Quantity</p>
                                            <p className="text-lg font-bold text-gray-900">{selectedProduct.stockQuantity}</p>
                                        </div>

                                        <div>
                                            <p className="mb-1 text-xs font-semibold text-gray-500 uppercase">Min Stock Level</p>
                                            <p className="text-lg font-bold text-gray-900">{selectedProduct.minStockLevel}</p>
                                        </div>

                                        <div>
                                            <p className="mb-1 text-xs font-semibold text-gray-500 uppercase">Stock Status</p>
                                            <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                                getStockStatus(selectedProduct).color === 'green' 
                                                    ? 'bg-green-100 text-green-800' 
                                                    : getStockStatus(selectedProduct).color === 'orange'
                                                    ? 'bg-orange-100 text-orange-800'
                                                    : 'bg-red-100 text-red-800'
                                            }`}>
                                                {getStockStatus(selectedProduct).text}
                                            </span>
                                        </div>
                                    </div>

                                    {selectedProduct.supplier && (
                                        <div className="pt-4 mt-4 border-t border-gray-200">
                                            <p className="mb-1 text-xs font-semibold text-gray-500 uppercase">Supplier</p>
                                            <p className="text-sm text-gray-900">{selectedProduct.supplier}</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Metadata */}
                            <div>
                                <h3 className="mb-4 text-sm font-semibold tracking-wider text-gray-500 uppercase">
                                    Record Information
                                </h3>
                                <div className="p-4 space-y-2 rounded-lg bg-gray-50">
                                    {selectedProduct.createdAt && (
                                        <div className="flex items-center justify-between">
                                            <p className="text-xs font-semibold text-gray-500 uppercase">Created At</p>
                                            <p className="text-sm text-gray-900">
                                                {new Date(selectedProduct.createdAt).toLocaleString('en-US', {
                                                    year: 'numeric',
                                                    month: 'long',
                                                    day: 'numeric',
                                                    hour: '2-digit',
                                                    minute: '2-digit'
                                                })}
                                            </p>
                                        </div>
                                    )}
                                    {selectedProduct.updatedAt && (
                                        <div className="flex items-center justify-between">
                                            <p className="text-xs font-semibold text-gray-500 uppercase">Last Updated</p>
                                            <p className="text-sm text-gray-900">
                                                {new Date(selectedProduct.updatedAt).toLocaleString('en-US', {
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

export default ProductList;