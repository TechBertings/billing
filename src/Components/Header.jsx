import React from 'react';
import { FaBars, FaBell, FaEnvelope, FaSearch } from 'react-icons/fa';

const Header = ({ toggleSidebar }) => {
  return (
    <header className="bg-white text-gray-700 h-16 flex items-center px-6 fixed top-0 left-0 right-0 z-30 shadow-sm border-b border-gray-200">
      {/* Menu Toggle */}
      <button 
        onClick={toggleSidebar}
        className="text-xl mr-6 hover:bg-gray-100 p-2 rounded-lg transition-all duration-200"
      >
        <FaBars />
      </button>
      
      {/* Logo & Title */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-white text-lg">
          B
        </div>
        <h1 className="text-lg font-semibold text-gray-800">
          Billing System
        </h1>
      </div>

      {/* Search Bar - Hidden on mobile */}
      <div className="hidden md:flex items-center ml-8 flex-1 max-w-md">
        <div className="relative w-full">
          <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
          <input 
            type="text" 
            placeholder="Search invoices, customers..." 
            className="w-full bg-gray-50 border border-gray-200 rounded-lg pl-10 pr-4 py-2 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
          />
        </div>
      </div>
      
      {/* Right Section */}
      <div className="ml-auto flex items-center gap-1">
        {/* Notifications */}
        <button className="relative p-2.5 hover:bg-gray-100 rounded-lg transition-all duration-200 group">
          <FaBell className="text-lg text-gray-600" />
          <span className="absolute top-2 right-2 w-2 h-2 bg-blue-600 rounded-full" />
          <span className="absolute -bottom-8 right-0 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
            3 notifications
          </span>
        </button>

        {/* Messages */}
        <button className="relative p-2.5 hover:bg-gray-100 rounded-lg transition-all duration-200 group">
          <FaEnvelope className="text-lg text-gray-600" />
          <span className="absolute top-2 right-2 w-2 h-2 bg-green-500 rounded-full" />
          <span className="absolute -bottom-8 right-0 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
            5 messages
          </span>
        </button>

        {/* Divider */}
        <div className="w-px h-8 bg-gray-200 mx-2" />

        {/* User Profile */}
        <div className="flex items-center gap-3 hover:bg-gray-50 px-3 py-2 rounded-lg cursor-pointer transition-all duration-200">
          <div className="hidden md:block text-right">
            <p className="text-sm font-medium text-gray-800">Admin User</p>
            <p className="text-xs text-gray-500">Administrator</p>
          </div>
          <div className="relative">
            <div className="w-9 h-9 bg-blue-600 text-white rounded-full flex items-center justify-center font-semibold text-sm">
              A
            </div>
            <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white" />
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;