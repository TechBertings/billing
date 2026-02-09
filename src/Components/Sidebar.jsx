    import React, { useState } from 'react';
    import {
        FaTachometerAlt,
        FaFileInvoiceDollar,
        FaUsers,
        FaMoneyBillWave,
        FaBoxOpen,
        FaChartBar,
        FaCog,
        FaReceipt,
        FaBell,
        FaChevronDown,
        FaFileAlt,
        FaCreditCard,
        FaHistory,
        FaUserPlus,
        FaUserCog,
        FaTags,
        FaWarehouse,
        FaFileContract,
        FaMoneyCheck,
        FaCalendarAlt,
        FaPercentage,
        FaTruck,
        FaExclamationTriangle,
        FaClipboardList
    } from 'react-icons/fa';

    const Sidebar = ({ isOpen, onNavigate, currentPage }) => {
        const [expandedMenus, setExpandedMenus] = useState({});

        const toggleSubmenu = (path) => {
            setExpandedMenus(prev => ({
                ...prev,
                [path]: !prev[path]
            }));
        };

        const handleNavigation = (path) => {
            onNavigate(path);
        };

        const menuItems = [
            {
                icon: <FaTachometerAlt />,
                label: 'Dashboard',
                path: 'dashboard'
            },
            {
                icon: <FaFileInvoiceDollar />,
                label: 'Invoices',
                path: 'invoices',
                submenu: [
                    { icon: <FaFileAlt />, label: 'All Invoices', path: 'AllInvoices' },
                    { icon: <FaFileAlt />, label: 'Create Invoice', path: 'create-invoice' },
                    { icon: <FaFileAlt />, label: 'Pending', path: 'Status' },
                    { icon: <FaFileAlt />, label: 'Paid', path: 'invoices-paid' },
                    { icon: <FaFileAlt />, label: 'Overdue', path: 'invoices-overdue' },
                    { icon: <FaFileAlt />, label: 'Draft', path: 'invoices-draft' },
                ]
            },
            {
                icon: <FaReceipt />,
                label: 'Receipts',
                path: 'receipts',
                submenu: [
                    { icon: <FaReceipt />, label: 'All Receipts', path: 'AllReceipts' },
                    { icon: <FaReceipt />, label: 'Generate Receipt', path: 'GenerateReceipt' },
                    { icon: <FaReceipt />, label: 'Official Receipts', path: 'OfficialReceipts' },
                ]
            },
            {
                icon: <FaMoneyBillWave />,
                label: 'Payments',
                path: 'payments',
                submenu: [
                    { icon: <FaCreditCard />, label: 'All Payments', path: 'payments-all' },
                    { icon: <FaCreditCard />, label: 'Record Payment', path: 'payments-record' },
                    { icon: <FaHistory />, label: 'Payment History', path: 'payments-history' },
                    { icon: <FaMoneyCheck />, label: 'Payment Methods', path: 'payments-methods' },
                ]
            },
            {
                icon: <FaUsers />,
                label: 'Customers',
                path: 'customers',
                submenu: [
                    { icon: <FaUsers />, label: 'All Customers', path: 'customers-all' },
                    { icon: <FaUserPlus />, label: 'Add Customer', path: 'customers-add' },
                    { icon: <FaUserCog />, label: 'Customer Groups', path: 'CustomerGroups' },
                ]
            },
            {
                icon: <FaBoxOpen />,
                label: 'Products/Services',
                path: 'products',
                submenu: [
                    { icon: <FaBoxOpen />, label: 'All Products', path: 'ProductList' },
                    { icon: <FaTags />, label: 'Add Product', path: 'AddProduct' },
                    { icon: <FaWarehouse />, label: 'Inventory', path: 'Inventory' },
                    { icon: <FaTags />, label: 'Categories', path: 'Categories' },
                ]
            },
            {
                icon: <FaFileContract />,
                label: 'Quotations',
                path: 'quotations',
                submenu: [
                    { icon: <FaFileContract />, label: 'All Quotations', path: 'quotations-all' },
                    { icon: <FaFileContract />, label: 'Create Quotation', path: 'quotations-create' },
                    { icon: <FaFileContract />, label: 'Approved', path: 'quotations-approved' },
                ]
            },
            {
                icon: <FaPercentage />,
                label: 'Expenses',
                path: 'expenses',
                submenu: [
                    { icon: <FaMoneyBillWave />, label: 'All Expenses', path: 'expenses-all' },
                    { icon: <FaMoneyBillWave />, label: 'Add Expense', path: 'expenses-add' },
                    { icon: <FaTags />, label: 'Categories', path: 'expenses-categories' },
                ]
            },
            {
                icon: <FaTruck />,
                label: 'Delivery Notes',
                path: 'delivery',
                submenu: [
                    { icon: <FaTruck />, label: 'All Deliveries', path: 'delivery-all' },
                    { icon: <FaTruck />, label: 'Create Note', path: 'delivery-create' },
                ]
            },
            {
                icon: <FaChartBar />,
                label: 'Reports',
                path: 'reports',
                submenu: [
                    { icon: <FaChartBar />, label: 'Sales Report', path: 'reports-sales' },
                    { icon: <FaChartBar />, label: 'Payment Report', path: 'reports-payments' },
                    { icon: <FaChartBar />, label: 'Customer Report', path: 'reports-customers' },
                    { icon: <FaChartBar />, label: 'Product Report', path: 'reports-products' },
                    { icon: <FaChartBar />, label: 'Tax Report', path: 'reports-tax' },
                    { icon: <FaChartBar />, label: 'Profit & Loss', path: 'reports-profit-loss' },
                    { icon: <FaClipboardList />, label: 'Audit Trail', path: 'AuditTrail' },
                ]
            },
            {
                icon: <FaCalendarAlt />,
                label: 'Recurring Invoices',
                path: 'recurring'
            },
            {
                icon: <FaExclamationTriangle />,
                label: 'Credit Notes',
                path: 'credit-notes'
            },
            {
                icon: <FaBell />,
                label: 'Notifications',
                path: 'notifications'
            },
            {
                icon: <FaCog />,
                label: 'Settings',
                path: 'settings',
                submenu: [
                    { icon: <FaCog />, label: 'General Settings', path: 'settings-general' },
                    { icon: <FaCog />, label: 'Company Profile', path: 'settings-company' },
                    { icon: <FaCog />, label: 'Tax Settings', path: 'settings-tax' },
                    { icon: <FaCog />, label: 'Email Templates', path: 'settings-email' },
                    { icon: <FaCog />, label: 'Maintenance', path: 'Maintenance' },
                    { icon: <FaCog />, label: 'User Management', path: 'settings-users' },
                ]
            },
        ];

        return (
            <aside className={`fixed top-16 left-0 h-[calc(100vh-4rem)] bg-gradient-to-b from-slate-50 to-white transition-all duration-300 z-20 shadow-xl border-r border-slate-200/60 overflow-hidden ${isOpen ? 'w-72' : 'w-20'}`}>
                {/* Decorative top border */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500"></div>
                
                <div className="h-full overflow-x-hidden overflow-y-auto custom-scrollbar">
                    <nav className="px-3 py-6">
                        <ul className="space-y-1.5">
                            {menuItems.map((item, index) => (
                                <li key={index}>
                                    <div
                                        className={`
                                            group relative flex items-center justify-between px-3.5 py-3 rounded-xl cursor-pointer
                                            transition-all duration-300 ease-in-out
                                            ${currentPage === item.path
                                                ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/30 scale-[1.02]'
                                                : 'hover:bg-white text-slate-700 hover:text-slate-900 hover:shadow-md hover:scale-[1.01]'
                                            }
                                        `}
                                        onClick={(e) => {
                                            e.preventDefault();
                                            if (item.submenu) {
                                                toggleSubmenu(item.path);
                                            } else {
                                                handleNavigation(item.path);
                                            }
                                        }}
                                    >
                                        <div className="flex items-center flex-1 min-w-0">
                                            <div className={`
                                                flex items-center justify-center w-9 h-9 rounded-lg flex-shrink-0
                                                transition-all duration-300
                                                ${currentPage === item.path 
                                                    ? 'bg-white/20 text-white' 
                                                    : 'bg-slate-100 text-slate-600 group-hover:bg-blue-50 group-hover:text-blue-600'
                                                }
                                            `}>
                                                <span className="text-base">{item.icon}</span>
                                            </div>

                                            <span className={`
                                                ml-3.5 font-medium whitespace-nowrap
                                                transition-all duration-300
                                                ${isOpen ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4'}
                                            `}>
                                                {item.label}
                                            </span>
                                        </div>

                                        {item.submenu && isOpen && (
                                            <div className={`
                                                transition-transform duration-300 flex-shrink-0
                                                ${expandedMenus[item.path] ? 'rotate-0' : '-rotate-90'}
                                                ${currentPage === item.path ? 'text-white' : 'text-slate-400'}
                                            `}>
                                                <FaChevronDown size={11} />
                                            </div>
                                        )}

                                        {/* Tooltip for collapsed state */}
                                        {!isOpen && (
                                            <div className="
                                                absolute left-full ml-6 px-4 py-2.5 bg-slate-900 text-white text-sm font-medium
                                                rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 
                                                group-hover:visible transition-all duration-200 whitespace-nowrap z-50
                                                pointer-events-none
                                            ">
                                                {item.label}
                                                <div className="absolute right-full top-1/2 -translate-y-1/2 border-[6px] border-transparent border-r-slate-900"></div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Submenu with smooth animation */}
                                    {item.submenu && (
                                        <div 
                                            className={`
                                                overflow-hidden transition-all duration-300 ease-in-out
                                                ${expandedMenus[item.path] && isOpen ? 'max-h-96 opacity-100 mt-1.5' : 'max-h-0 opacity-0'}
                                            `}
                                        >
                                            <ul className="ml-4 pl-4 border-l-2 border-slate-200 space-y-0.5">
                                                {item.submenu.map((subitem, subindex) => (
                                                    <li key={subindex}>
                                                        <div
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                handleNavigation(subitem.path);
                                                            }}
                                                            className={`
                                                                flex items-center px-3 py-2.5 rounded-lg text-sm font-medium cursor-pointer
                                                                transition-all duration-200 group/sub
                                                                ${currentPage === subitem.path
                                                                    ? 'bg-blue-50 text-blue-600 shadow-sm'
                                                                    : 'hover:bg-slate-50 text-slate-600 hover:text-slate-900'
                                                                }
                                                            `}
                                                        >
                                                            <span className={`
                                                                text-xs mr-3 transition-colors duration-200
                                                                ${currentPage === subitem.path ? 'text-blue-500' : 'text-slate-400 group-hover/sub:text-slate-600'}
                                                            `}>
                                                                {subitem.icon}
                                                            </span>
                                                            <span className="flex-1">{subitem.label}</span>

                                                            {currentPage === subitem.path && (
                                                                <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"></div>
                                                            )}
                                                        </div>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                </li>
                            ))}
                        </ul>
                    </nav>
                </div>

                {/* Custom Scrollbar Styles */}
                <style jsx>{`
                    .custom-scrollbar::-webkit-scrollbar {
                        width: 6px;
                    }
                    .custom-scrollbar::-webkit-scrollbar-track {
                        background: transparent;
                    }
                    .custom-scrollbar::-webkit-scrollbar-thumb {
                        background: #cbd5e1;
                        border-radius: 10px;
                    }
                    .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                        background: #94a3b8;
                    }
                `}</style>
            </aside>
        );
    };

    export default Sidebar;