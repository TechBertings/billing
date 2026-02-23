import React, { useState, useEffect } from 'react';
import {
    FaTachometerAlt,
    FaFileInvoiceDollar,
    FaUsers,
    FaMoneyBillWave,
    FaCalculator,
    FaFolder,
    FaCheck,
    FaChartBar,
    FaCog,
    FaChevronDown,
    FaFileAlt,
    FaCreditCard,
    FaHistory,
    FaClipboardList,
    FaSignInAlt,
    FaUserShield,
    FaTools,
    FaUser,
    FaClipboardCheck
} from 'react-icons/fa';
import { filterMenuByRole, loadPermissionsForRole } from '../Maintenance/RolePermission';

// All menu items (unfiltered) - exported for use in RolePermission
export const getAllMenuItems = () => [
   
    {
        icon: <FaTachometerAlt />,
        label: 'Dashboard',
        path: 'dashboard'
    },

    // ========== PORTALS SECTION ==========
    {
        icon: <FaUser />,
        label: 'Client Management',
        path: 'client-management',
        category: 'Portals',
        submenu: [
            { icon: <FaUser />, label: 'Create Client Profile', path: 'ClientProfile' },
            { icon: <FaUser />, label: 'Client Profile List', path: 'ClientProfileList' },
            { icon: <FaUsers />, label: 'Create Employees Profile', path: 'employees' },
            { icon: <FaUsers />, label: 'Employees Profile List', path: 'employees-list' },
            { icon: <FaClipboardList />, label: 'Processing', path: 'processing' },
        ]
    },
    {
        icon: <FaMoneyBillWave />,
        label: 'Accounting Management',
        path: 'accounting-management',
        category: 'Portals',
        submenu: [
            { icon: <FaChartBar />, label: 'Account Summary', path: 'account-summary' },
            { icon: <FaHistory />, label: 'Bank Reconciliation', path: 'bank-reconciliation' },
            { icon: <FaFileInvoiceDollar />, label: 'Create Billing', path: 'create-billing' },
            { icon: <FaCreditCard />, label: 'Record Payment', path: 'record-payment' },
            { icon: <FaMoneyBillWave />, label: 'Remittances', path: 'remittances' },
        ]
    },

    // ========== TOOLS SECTION ==========
    {
        icon: <FaTools />,
        label: 'Tools',
        path: 'tools',
        category: 'Tools',
        description: 'All business tools in one place',
        submenu: [
            { icon: <FaFileAlt />, label: 'Transmittal Form', path: 'tools-transmittal' },
            { icon: <FaFolder />, label: 'File Smart', path: 'tools-file-smart' },
            { icon: <FaCheck />, label: 'Data Verifier', path: 'tools-data-verifier' },
            { icon: <FaCalculator />, label: 'Calculator', path: 'tools-calculator' },
        ]
    },

    // ========== FOR APPROVAL SECTION ==========
    {
        icon: <FaClipboardCheck />,
        label: 'For Approval',
        path: 'for-approval',
        category: 'For Approval',
        submenu: [
            { 
                icon: <FaUser />, 
                label: 'Client Profile', 
                path: 'ClientApproval',
                badge: true   // para sa notification count
            },
            { 
                icon: <FaUsers />, 
                label: 'Employee Profile', 
                path: 'approval-employee-profile',
                badge: true 
            },
            { 
                icon: <FaClipboardList />, 
                label: 'Payroll Processing', 
                path: 'approval-payroll',
                badge: true 
            },
            { 
                icon: <FaFileInvoiceDollar />, 
                label: 'Billing', 
                path: 'approval-billing',
                badge: true 
            },
            { 
                icon: <FaCreditCard />, 
                label: 'Record Payment', 
                path: 'approval-payment',
                badge: true 
            },
            { 
                icon: <FaMoneyBillWave />, 
                label: 'Remittances', 
                path: 'approval-remittances',
                badge: true 
            },
            { 
                icon: <FaHistory />, 
                label: 'Bank Reconciliation', 
                path: 'approval-bank-recon',
                badge: true 
            },
            { 
                icon: <FaFileAlt />, 
                label: 'Transmittal Form', 
                path: 'approval-transmittal',
                badge: true 
            },
        ]
    },

    // ========== ADDITIONAL FEATURES ==========
    {
        icon: <FaHistory />,
        label: 'Transaction History',
        path: 'transaction-history'
    },

    {
        icon: <FaCog />,
        label: 'System Settings',
        path: 'settings',
        submenu: [
            { icon: <FaCog />, label: 'Maintenance', path: 'Maintenance' },
            { icon: <FaUserShield />, label: 'User Management', path: 'UserManagement' },
        ]
    },
    {
        icon: <FaSignInAlt />,
        label: 'Logout',
        path: 'login'
    },
];

const Sidebar = ({ isOpen, onNavigate, currentPage, currentUser }) => {
    const [expandedMenus, setExpandedMenus] = useState({});
    const [filteredMenuItems, setFilteredMenuItems] = useState([]);

    // Load permissions and filter menu when user changes
    useEffect(() => {
        const loadAndFilterMenu = async () => {
            if (currentUser && currentUser.role) {
                // Load permissions for this role
                await loadPermissionsForRole(currentUser.role);
                
                // Get all menu items
                const allMenuItems = getAllMenuItems();
                
                // Filter based on role
                const filtered = filterMenuByRole(allMenuItems, currentUser.role);
                setFilteredMenuItems(filtered);
            } else {
                // If not logged in, only show Login
                setFilteredMenuItems([{
                    icon: <FaSignInAlt />,
                    label: 'Login',
                    path: 'login'
                }]);
            }
        };
        
        loadAndFilterMenu();
    }, [currentUser]);

    const toggleSubmenu = (path) => {
        setExpandedMenus(prev => ({
            ...prev,
            [path]: !prev[path]
        }));
    };

    const handleNavigation = (path) => {
        onNavigate(path);
    };

    return (
        <aside className={`fixed top-16 left-0 h-[calc(100vh-4rem)] bg-gradient-to-b from-slate-50 to-white transition-all duration-300 z-20 shadow-xl border-r border-slate-200/60 overflow-hidden ${isOpen ? 'w-72' : 'w-20'}`}>
            {/* Decorative top border */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500"></div>
            
            <div className="h-full overflow-x-hidden overflow-y-auto custom-scrollbar">
                <nav className="px-3 py-6">
                    <ul className="space-y-1.5">
                        {filteredMenuItems.map((item, index) => (
                            <li key={index}>
                                {/* Section Category Label - Only show when sidebar is open */}
                                {item.category && isOpen && index > 0 && filteredMenuItems[index - 1]?.category !== item.category && (
                                    <div className="px-3.5 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider mt-4">
                                        {item.category}
                                    </div>
                                )}

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
                                    title={!isOpen ? item.label : ''}
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
                                            {item.description && (
                                                <div className="mt-1 text-xs font-normal text-slate-300">
                                                    {item.description}
                                                </div>
                                            )}
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