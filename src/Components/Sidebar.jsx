import React, { useState, useEffect, useRef } from 'react';
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
import ReactDOM from 'react-dom';
import Swal from 'sweetalert2';
import { filterMenuByRole, loadPermissionsForRole } from '../Maintenance/RolePermission';

export const getAllMenuItems = () => [
    {
        icon: <FaTachometerAlt />,
        label: 'Dashboard',
        path: 'dashboard'
    },
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
    {
        icon: <FaClipboardCheck />,
        label: 'For Approval',
        path: 'for-approval',
        category: 'For Approval',
        submenu: [
            { icon: <FaUser />, label: 'Client Profile', path: 'ClientApproval', badge: true },
            { icon: <FaUsers />, label: 'Employee Profile', path: 'approval-employee-profile', badge: true },
            { icon: <FaClipboardList />, label: 'Payroll Processing', path: 'approval-payroll', badge: true },
            { icon: <FaFileInvoiceDollar />, label: 'Billing', path: 'approval-billing', badge: true },
            { icon: <FaCreditCard />, label: 'Record Payment', path: 'approval-payment', badge: true },
            { icon: <FaMoneyBillWave />, label: 'Remittances', path: 'approval-remittances', badge: true },
            { icon: <FaHistory />, label: 'Bank Reconciliation', path: 'approval-bank-recon', badge: true },
            { icon: <FaFileAlt />, label: 'Transmittal Form', path: 'approval-transmittal', badge: true },
        ]
    },
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

// ─── Floating popup rendered via React Portal ────────────────────────────────
// This escapes the sidebar's overflow-hidden so it's never clipped.
const CollapsedSubmenuPopup = ({ item, anchorRect, onNavigate, currentPage, onMouseEnter, onMouseLeave }) => {
    const POPUP_LEFT = anchorRect.right + 10;
    const POPUP_TOP  = anchorRect.top;

    return ReactDOM.createPortal(
        <div
            style={{ position: 'fixed', top: POPUP_TOP, left: POPUP_LEFT, zIndex: 9999 }}
            className="overflow-hidden bg-white border shadow-2xl rounded-xl border-slate-200 min-w-52"
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
        >
            {/* Header */}
            <div className="px-4 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-600 text-white text-sm font-semibold flex items-center gap-2">
                <span className="text-base">{item.icon}</span>
                {item.label}
            </div>

            {/* Left arrow */}
            <div
                style={{ position: 'absolute', top: 14, left: -11 }}
                className="border-[6px] border-transparent border-r-white"
            />

            {/* Menu items */}
            <ul className="py-1.5">
                {item.submenu.map((subitem, i) => (
                    <li key={i}>
                        <div
                            onClick={() => onNavigate(subitem.path)}
                            className={`
                                flex items-center gap-3 px-4 py-2.5 text-sm cursor-pointer
                                transition-colors duration-150
                                ${currentPage === subitem.path
                                    ? 'bg-blue-50 text-blue-600 font-semibold'
                                    : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
                                }
                            `}
                        >
                            <span className={`text-xs flex-shrink-0 ${currentPage === subitem.path ? 'text-blue-500' : 'text-slate-400'}`}>
                                {subitem.icon}
                            </span>
                            {subitem.label}
                            {currentPage === subitem.path && (
                                <div className="w-2 h-2 ml-auto bg-blue-500 rounded-full animate-pulse" />
                            )}
                        </div>
                    </li>
                ))}
            </ul>
        </div>,
        document.body
    );
};

// ─── Main Sidebar ─────────────────────────────────────────────────────────────
const Sidebar = ({ isOpen, onNavigate, currentPage, currentUser }) => {
    const [expandedMenus, setExpandedMenus]     = useState({});
    const [filteredMenuItems, setFilteredMenuItems] = useState([]);
    const [hoveredItem, setHoveredItem]         = useState(null);
    const [anchorRect, setAnchorRect]           = useState(null);
    const hideTimer = useRef(null);

    useEffect(() => {
        const loadAndFilterMenu = async () => {
            if (currentUser && currentUser.role) {
                await loadPermissionsForRole(currentUser.role);
                const filtered = filterMenuByRole(getAllMenuItems(), currentUser.role);
                setFilteredMenuItems(filtered);
            } else {
                setFilteredMenuItems([{ icon: <FaSignInAlt />, label: 'Login', path: 'login' }]);
            }
        };
        loadAndFilterMenu();
    }, [currentUser]);

    // Close popup when sidebar expands
    useEffect(() => {
        if (isOpen) closePopup();
    }, [isOpen]);

    const closePopup = () => {
        clearTimeout(hideTimer.current);
        setHoveredItem(null);
        setAnchorRect(null);
    };

    const scheduleClose = () => {
        hideTimer.current = setTimeout(closePopup, 120);
    };

    const cancelClose = () => {
        clearTimeout(hideTimer.current);
    };

    const toggleSubmenu = (path) => {
        setExpandedMenus(prev => {
            if (prev[path]) return { ...prev, [path]: false };
            return {
                ...Object.keys(prev).reduce((acc, key) => { acc[key] = false; return acc; }, {}),
                [path]: true
            };
        });
    };

    const handleLogout = async () => {
        const result = await Swal.fire({
            title: 'Log Out?',
            text: 'Are you sure you want to log out?',
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#3b82f6',
            cancelButtonColor: '#94a3b8',
            confirmButtonText: 'Yes, log out',
            cancelButtonText: 'Cancel',
            reverseButtons: true,
        });
        if (result.isConfirmed) {
            onNavigate('login');
        }
        // Cancelled → do nothing, stay on current page
    };

    const handleRowMouseEnter = (e, item) => {
        if (isOpen || !item.submenu) return;
        cancelClose();
        setHoveredItem(item);
        setAnchorRect(e.currentTarget.getBoundingClientRect());
    };

    return (
        <>
            <aside className={`
                fixed top-16 left-0 h-[calc(100vh-4rem)]
                bg-gradient-to-b from-slate-50 to-white
                transition-all duration-300 z-20
                shadow-xl border-r border-slate-200/60
                ${isOpen ? 'w-72' : 'w-20'}
            `}>
                {/* Top accent bar */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500" />

                <div className="h-full overflow-x-hidden overflow-y-auto custom-scrollbar">
                    <nav className="px-3 py-6">
                        <ul className="space-y-1.5">
                            {filteredMenuItems.map((item, index) => (
                                <li key={index}>
                                    {/* Category label */}
                                    {item.category && isOpen && index > 0 && filteredMenuItems[index - 1]?.category !== item.category && (
                                        <div className="px-3.5 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider mt-4">
                                            {item.category}
                                        </div>
                                    )}

                                    {/* Row */}
                                    <div
                                        onMouseEnter={(e) => handleRowMouseEnter(e, item)}
                                        onMouseLeave={scheduleClose}
                                        onClick={() => {
                                            if (item.submenu) {
                                                if (isOpen) toggleSubmenu(item.path);
                                            } else if (item.path === 'login') {
                                                handleLogout();
                                            } else {
                                                onNavigate(item.path);
                                            }
                                        }}
                                        className={`
                                            group relative flex items-center justify-between rounded-xl cursor-pointer
                                            transition-all duration-300 ease-in-out
                                            ${isOpen ? 'px-3.5 py-3' : 'p-2.5'}
                                            ${currentPage === item.path
                                                ? isOpen
                                                    ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/30 scale-[1.02]'
                                                    : 'bg-blue-500 text-white shadow-lg shadow-blue-500/30'
                                                : isOpen
                                                    ? 'hover:bg-white text-slate-700 hover:text-slate-900 hover:shadow-md hover:scale-[1.01]'
                                                    : 'text-slate-600 hover:bg-blue-50 hover:shadow-md'
                                            }
                                        `}
                                    >
                                        <div className={`flex items-center flex-1 min-w-0 ${isOpen ? '' : 'justify-center w-full'}`}>
                                            {/* Icon box */}
                                            <div className={`
                                                flex items-center justify-center rounded-lg flex-shrink-0
                                                transition-all duration-300
                                                ${isOpen ? 'w-9 h-9' : 'w-10 h-10'}
                                                ${currentPage === item.path
                                                    ? isOpen
                                                        ? 'bg-white/20 text-white'
                                                        : 'bg-blue-500 text-white shadow-lg shadow-blue-500/40'
                                                    : isOpen
                                                        ? 'bg-slate-100 text-slate-600 group-hover:bg-blue-50 group-hover:text-blue-600'
                                                        : 'bg-slate-100 text-slate-700 group-hover:bg-blue-100 group-hover:text-blue-600'
                                                }
                                            `}>
                                                <span className="text-lg">{item.icon}</span>
                                            </div>

                                            {/* Label */}
                                            <span className={`
                                                ml-3.5 font-medium whitespace-nowrap
                                                transition-all duration-300
                                                ${isOpen ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4 w-0'}
                                            `}>
                                                {item.label}
                                            </span>
                                        </div>

                                        {/* Chevron (expanded mode) */}
                                        {item.submenu && isOpen && (
                                            <div className={`
                                                transition-transform duration-300 flex-shrink-0
                                                ${expandedMenus[item.path] ? 'rotate-0' : '-rotate-90'}
                                                ${currentPage === item.path ? 'text-white' : 'text-slate-400'}
                                            `}>
                                                <FaChevronDown size={11} />
                                            </div>
                                        )}

                                        {/* Simple tooltip for collapsed items WITHOUT submenu */}
                                        {!isOpen && !item.submenu && (
                                            <div className="absolute z-50 invisible px-3 py-2 ml-4 text-sm font-medium text-white transition-all duration-200 rounded-lg shadow-xl opacity-0 pointer-events-none  left-full bg-slate-900 group-hover:opacity-100 group-hover:visible whitespace-nowrap">
                                                {item.label}
                                                <div className="absolute right-full top-1/2 -translate-y-1/2 border-[6px] border-transparent border-r-slate-900" />
                                            </div>
                                        )}
                                    </div>

                                    {/* Expanded sidebar — click-toggle submenu */}
                                    {item.submenu && isOpen && (
                                        <div className={`
                                            overflow-hidden transition-all duration-300 ease-in-out
                                            ${expandedMenus[item.path] ? 'max-h-96 opacity-100 mt-1.5' : 'max-h-0 opacity-0'}
                                        `}>
                                            <ul className="ml-4 pl-4 border-l-2 border-slate-200 space-y-0.5">
                                                {item.submenu.map((subitem, si) => (
                                                    <li key={si}>
                                                        <div
                                                            onClick={() => onNavigate(subitem.path)}
                                                            className={`
                                                                flex items-center px-3 py-2.5 rounded-lg text-sm font-medium cursor-pointer
                                                                transition-all duration-200 group/sub
                                                                ${currentPage === subitem.path
                                                                    ? 'bg-blue-50 text-blue-600 shadow-sm'
                                                                    : 'hover:bg-slate-50 text-slate-600 hover:text-slate-900'
                                                                }
                                                            `}
                                                        >
                                                            <span className={`text-xs mr-3 ${currentPage === subitem.path ? 'text-blue-500' : 'text-slate-400 group-hover/sub:text-slate-600'}`}>
                                                                {subitem.icon}
                                                            </span>
                                                            <span className="flex-1">{subitem.label}</span>
                                                            {currentPage === subitem.path && (
                                                                <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse" />
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

                <style jsx>{`
                    .custom-scrollbar::-webkit-scrollbar { width: 6px; }
                    .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                    .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
                    .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
                `}</style>
            </aside>

            {/* Portal popup — rendered directly on <body>, never clipped by sidebar */}
            {!isOpen && hoveredItem && anchorRect && (
                <CollapsedSubmenuPopup
                    item={hoveredItem}
                    anchorRect={anchorRect}
                    currentPage={currentPage}
                    onNavigate={(path) => { onNavigate(path); closePopup(); }}
                    onMouseEnter={cancelClose}
                    onMouseLeave={scheduleClose}
                />
            )}
        </>
    );
};

export default Sidebar;