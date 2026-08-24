import React from 'react';
import { FaBars, FaBell, FaEnvelope, FaSearch } from 'react-icons/fa';

const Header = ({ toggleSidebar, isSidebarOpen }) => {
  return (
    <header className="fixed top-0 left-0 right-0 z-30 flex items-center h-16 px-6 bg-white border-b text-slate-700 border-slate-100">
      {/* Menu Toggle */}
      <button 
        onClick={toggleSidebar}
        className="p-2 mr-6 text-lg transition-colors duration-150 rounded-lg text-slate-400 hover:bg-slate-50 hover:text-slate-600"
      >
        <FaBars />
      </button>
      
      {/* Logo & Title */}
      <div className="flex items-center gap-2.5">
        <img src="/DATS_LOGO.png" alt="DATS" className="object-contain w-8 h-8" />
        <h1 className="text-base font-semibold text-slate-800">
          DATS
        </h1>
      </div>

      {/* Search Bar - Hidden on mobile */}
      <div className="items-center flex-1 hidden max-w-md ml-8 md:flex">
        <div className="relative w-full">
          <FaSearch className="absolute text-xs -translate-y-1/2 text-slate-400 left-3 top-1/2" />
          <input 
            type="text" 
            placeholder="Search invoices, customers..." 
            className="w-full py-2 pr-4 text-sm transition-colors border rounded-lg pl-9 text-slate-700 placeholder-slate-400 border-slate-100 bg-slate-50 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 focus:bg-white"
          />
        </div>
      </div>
      
      {/* Right Section */}
      <div className="flex items-center gap-1 ml-auto">
        {/* Notifications */}
        <button className="relative p-2.5 hover:bg-slate-50 rounded-lg transition-colors duration-150 group">
          <FaBell className="text-base text-slate-400 group-hover:text-slate-600" />
          <span className="absolute w-1.5 h-1.5 bg-emerald-500 rounded-full top-2.5 right-2.5" />
          <span className="absolute right-0 px-2 py-1 text-xs text-white transition-opacity rounded opacity-0 pointer-events-none bg-slate-800 -bottom-8 group-hover:opacity-100 whitespace-nowrap">
            3 notifications
          </span>
        </button>

        {/* Messages */}
        <button className="relative p-2.5 hover:bg-slate-50 rounded-lg transition-colors duration-150 group">
          <FaEnvelope className="text-base text-slate-400 group-hover:text-slate-600" />
          <span className="absolute w-1.5 h-1.5 bg-emerald-500 rounded-full top-2.5 right-2.5" />
          <span className="absolute right-0 px-2 py-1 text-xs text-white transition-opacity rounded opacity-0 pointer-events-none bg-slate-800 -bottom-8 group-hover:opacity-100 whitespace-nowrap">
            5 messages
          </span>
        </button>

        {/* Divider */}
        <div className="w-px h-6 mx-2 bg-slate-100" />

        {/* Sidebar toggle switch */}
        <button
          onClick={toggleSidebar}
          className={`relative w-10 rounded-full transition-colors duration-200 ${
            isSidebarOpen ? 'bg-emerald-500' : 'bg-slate-200'
          }`}
          style={{ height: '22px' }}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-[18px] h-[18px] bg-white rounded-full shadow-sm transition-transform duration-200 ${
              isSidebarOpen ? 'translate-x-[18px]' : 'translate-x-0'
            }`}
          />
        </button>
      </div>
    </header>
  );
};

export default Header;