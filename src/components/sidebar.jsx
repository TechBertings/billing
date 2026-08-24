import React, { useState, useEffect, useRef } from 'react';
import {
    FaTachometerAlt,
    FaFileInvoiceDollar,
    FaUsers,
    FaMoneyBillWave,
    FaCalculator,
    FaCoins,
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
    FaClipboardCheck,
    FaExclamationTriangle,
    FaChartLine
} from 'react-icons/fa';
import ReactDOM from 'react-dom';
import Swal from 'sweetalert2';
import { filterMenuByRole, loadPermissionsForRole } from '../Maintenance/role_permission';

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
            { icon: <FaUsers />, label: 'Create Employees Profile', path: 'EmployeeProfile' },
        ]
    },
    {
        icon: <FaMoneyBillWave />,
        label: 'Accounting Management',
        path: 'accounting-management',
        category: 'Portals',
        submenu: [
            { icon: <FaChartBar />, label: 'Account Summary', path: 'StatementOfAccountSummary' },
            { icon: <FaHistory />, label: 'Bank Reconciliation', path: 'BankReconciliation' },
            { icon: <FaFileAlt />, label: 'Chart of Accounts', path: 'ChartOfAccounts' },
            { icon: <FaFileInvoiceDollar />, label: 'Create Billing', path: 'CreateBilling' },
            { icon: <FaClipboardList />, label: 'Receivables List', path: 'ReceivablesList' },
            { icon: <FaCreditCard />, label: 'Record Payment', path: 'RecordPayment' },
            { icon: <FaCoins />, label: 'Undeposited Funds', path: 'UndepositedFunds' },
        ]
    },
    {
        icon: <FaChartBar />,
        label: 'Reports',
        path: 'reports',
        category: 'Portals',
        submenu: [
            { icon: <FaExclamationTriangle />, label: 'Collections & Receivables', path: 'ARAgingReport' },
            { icon: <FaChartLine />, label: 'Financial Reports', path: 'FinancialReports' },
            { icon: <FaFileAlt />, label: 'Transmittal Report', path: 'TransmittalReport' },
            { icon: <FaHistory />, label: 'Audit Trail', path: 'AuditTrail' },
        ]
    },
    {
        icon: <FaClipboardCheck />,
        label: 'For Approval',
        path: 'for-approval',
        category: 'For Approval',
        submenu: [
            { icon: <FaUser />, label: 'Client Profile', path: 'ClientApproval', badge: true },
            { icon: <FaClipboardCheck />, label: 'Statement of Account', path: 'SOAApproval', badge: true },
        ]
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
const CollapsedSubmenuPopup = ({ item, anchorRect, onNavigate, currentPage, onMouseEnter, onMouseLeave }) => {
    const POPUP_LEFT = anchorRect.right + 10;
    const POPUP_TOP  = anchorRect.top;

    return ReactDOM.createPortal(
        <div
            style={{ position: 'fixed', top: POPUP_TOP, left: POPUP_LEFT, zIndex: 9999 }}
            className="overflow-hidden bg-white border shadow-lg rounded-xl border-slate-100 min-w-52"
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
        >
            {/* Header */}
            <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100 text-slate-700 text-xs font-semibold uppercase tracking-wider flex items-center gap-2">
                <span className="text-sm text-emerald-500">{item.icon}</span>
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
                                    ? 'bg-slate-100 text-slate-900 font-semibold'
                                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                                }
                            `}
                        >
                            <span className={`text-xs flex-shrink-0 ${currentPage === subitem.path ? 'text-emerald-500' : 'text-slate-400'}`}>
                                {subitem.icon}
                            </span>
                            {subitem.label}
                            {currentPage === subitem.path && (
                                <div className="w-1.5 h-1.5 ml-auto bg-emerald-500 rounded-full" />
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
            confirmButtonColor: '#10b981',
            cancelButtonColor: '#94a3b8',
            confirmButtonText: 'Yes, log out',
            cancelButtonText: 'Cancel',
            reverseButtons: true,
        });
        if (result.isConfirmed) {
            onNavigate('login');
        }
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
                bg-white
                transition-all duration-300 z-20
                border-r border-slate-100
                ${isOpen ? 'w-72' : 'w-20'}
            `}>
                <div className="h-full overflow-x-hidden overflow-y-auto custom-scrollbar">
                    <nav className="px-3 py-6">
                        <ul className="space-y-0.5">
                            {filteredMenuItems.map((item, index) => (
                                <li key={index}>
                                    {/* Category label */}
                                    {item.category && isOpen && index > 0 && filteredMenuItems[index - 1]?.category !== item.category && (
                                        <div className="px-3.5 py-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider mt-4">
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
                                            group relative flex items-center justify-between rounded-lg cursor-pointer
                                            transition-colors duration-150
                                            ${isOpen ? 'px-3 py-2.5' : 'p-2.5'}
                                            ${currentPage === item.path
                                                ? 'bg-slate-100 text-slate-900 font-medium'
                                                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                                            }
                                        `}
                                    >
                                        <div className={`flex items-center flex-1 min-w-0 ${isOpen ? '' : 'justify-center w-full'}`}>
                                            <span className={`
                                                text-base flex-shrink-0
                                                ${currentPage === item.path ? 'text-emerald-500' : 'text-slate-400 group-hover:text-slate-600'}
                                            `}>
                                                {item.icon}
                                            </span>

                                            {/* Label */}
                                            <span className={`
                                                ml-3 text-sm whitespace-nowrap
                                                transition-all duration-300
                                                ${isOpen ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4 w-0'}
                                            `}>
                                                {item.label}
                                            </span>
                                        </div>

                                        {/* Chevron (expanded mode) */}
                                        {item.submenu && isOpen && (
                                            <div className={`
                                                transition-transform duration-300 flex-shrink-0 text-slate-400
                                                ${expandedMenus[item.path] ? 'rotate-0' : '-rotate-90'}
                                            `}>
                                                <FaChevronDown size={10} />
                                            </div>
                                        )}

                                        {/* "+" badge indicator like reference (only when not showing chevron) */}
                                        {!item.submenu && item.badge && isOpen && (
                                            <span className="text-xs font-medium text-slate-300">+</span>
                                        )}

                                        {/* Simple tooltip for collapsed items WITHOUT submenu */}
                                        {!isOpen && !item.submenu && (
                                            <div className="absolute z-50 invisible px-3 py-2 ml-4 text-sm font-medium text-white transition-all duration-200 rounded-lg shadow-lg opacity-0 pointer-events-none left-full bg-slate-800 group-hover:opacity-100 group-hover:visible whitespace-nowrap">
                                                {item.label}
                                                <div className="absolute right-full top-1/2 -translate-y-1/2 border-[6px] border-transparent border-r-slate-800" />
                                            </div>
                                        )}
                                    </div>

                                    {/* Expanded sidebar — click-toggle submenu */}
                                    {item.submenu && isOpen && (
                                        <div className={`
                                            overflow-hidden transition-all duration-300 ease-in-out
                                            ${expandedMenus[item.path] ? 'max-h-96 opacity-100 mt-1' : 'max-h-0 opacity-0'}
                                        `}>
                                            <ul className="ml-4 pl-4 border-l border-slate-100 space-y-0.5">
                                                {item.submenu.map((subitem, si) => (
                                                    <li key={si}>
                                                        <div
                                                            onClick={() => onNavigate(subitem.path)}
                                                            className={`
                                                                flex items-center px-3 py-2 rounded-lg text-sm cursor-pointer
                                                                transition-colors duration-150 group/sub
                                                                ${currentPage === subitem.path
                                                                    ? 'bg-slate-100 text-slate-900 font-medium'
                                                                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                                                                }
                                                            `}
                                                        >
                                                            <span className={`text-xs mr-3 ${currentPage === subitem.path ? 'text-emerald-500' : 'text-slate-400 group-hover/sub:text-slate-600'}`}>
                                                                {subitem.icon}
                                                            </span>
                                                            <span className="flex-1">{subitem.label}</span>
                                                            {currentPage === subitem.path && (
                                                                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                                                            )}
                                                            {subitem.badge && currentPage !== subitem.path && (
                                                                <span className="text-xs font-medium text-slate-300">+</span>
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
                    .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
                    .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
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