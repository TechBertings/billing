import React, { useState } from 'react';
import {
    FaUsers,
    FaFileInvoiceDollar,
    FaMoneyBillWave,
    FaPercent,
    FaBoxOpen,
    FaTags,
    FaCreditCard,
    FaReceipt,
    FaFileContract,
    FaTruck,
    FaCog,
    FaBuilding
} from 'react-icons/fa';

const Maintenance = () => {
    const [sortBy, setSortBy] = useState('all');

    const modules = [
        {
            id: 1,
            icon: <FaUsers />,
            title: 'CUSTOMER TYPES',
            description: 'Manage customer categories and classifications'
        },
        {
            id: 2,
            icon: <FaFileInvoiceDollar />,
            title: 'INVOICE TEMPLATES',
            description: 'Configure invoice layouts and formats'
        },
        {
            id: 3,
            icon: <FaMoneyBillWave />,
            title: 'PAYMENT TERMS',
            description: 'Define payment conditions and due dates'
        },
        {
            id: 4,
            icon: <FaPercent />,
            title: 'TAX RATES',
            description: 'Setup and manage tax configurations'
        },
        {
            id: 5,
            icon: <FaBoxOpen />,
            title: 'PRODUCT CATEGORIES',
            description: 'Organize products by categories'
        },
        {
            id: 6,
            icon: <FaTags />,
            title: 'DISCOUNT TYPES',
            description: 'Configure discount rules and types'
        },
        {
            id: 7,
            icon: <FaCreditCard />,
            title: 'PAYMENT METHODS',
            description: 'Manage accepted payment options'
        },
        {
            id: 8,
            icon: <FaReceipt />,
            title: 'RECEIPT SERIES',
            description: 'Configure receipt numbering sequences'
        },
        {
            id: 9,
            icon: <FaFileContract />,
            title: 'QUOTATION VALIDITY',
            description: 'Set quotation expiration periods'
        },
        {
            id: 10,
            icon: <FaTruck />,
            title: 'DELIVERY STATUS',
            description: 'Define delivery tracking statuses'
        },
        {
            id: 11,
            icon: <FaCog />,
            title: 'INVOICE STATUS',
            description: 'Manage invoice workflow statuses'
        },
        {
            id: 12,
            icon: <FaBuilding />,
            title: 'COMPANY BRANCHES',
            description: 'Setup multiple business locations'
        }
    ];

    return (
        <div className="px-6 mx-auto max-w-7xl">
            {/* Header Section */}
            <div className="mb-8">
                <div className="flex items-start justify-between">
                    <div>
                        <h1 className="mb-2 text-3xl font-bold text-gray-800">Reference Modules</h1>
                        <p className="text-sm text-gray-600">Manage and configure your system modules</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <label className="text-sm font-medium text-gray-700">Sort by:</label>
                        <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value)}
                            className="px-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="all">All Modules</option>
                            <option value="customer">Customer</option>
                            <option value="invoice">Invoice</option>
                            <option value="payment">Payment</option>
                            <option value="product">Product</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Modules Grid */}
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {modules.map((module) => (
                    <div
                        key={module.id}
                        className="relative p-6 transition-all duration-200 bg-white border border-gray-200 cursor-pointer rounded-xl hover:shadow-lg hover:border-blue-300 group"
                    >
                        {/* Icon Container */}
                        <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 text-2xl text-blue-600 transition-colors rounded-2xl bg-blue-50 group-hover:bg-blue-100">
                            {module.icon}
                        </div>

                        {/* Title */}
                        <h3 className="mb-2 text-sm font-bold tracking-wide text-center text-gray-800 uppercase">
                            {module.title}
                        </h3>

                        {/* Description */}
                        <p className="text-xs leading-relaxed text-center text-gray-500">
                            {module.description}
                        </p>

                        {/* Hover Effect Border */}
                        <div className="absolute inset-0 transition-opacity duration-200 border-2 border-blue-500 opacity-0 rounded-xl group-hover:opacity-100"></div>
                    </div>
                ))}
            </div>

            {/* Footer Info */}
            <div className="p-4 mt-8 border border-blue-200 rounded-lg bg-blue-50">
                <p className="text-sm text-center text-blue-800">
                    <span className="font-semibold">{modules.length}</span> modules available for configuration
                </p>
            </div>
        </div>
    );
};

export default Maintenance;