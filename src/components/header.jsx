import React from 'react';
import { FaBars, FaBell, FaEnvelope, FaSearch } from 'react-icons/fa';

const Header = ({ toggleSidebar }) => {
  return (
    <header className="fixed top-0 left-0 right-0 z-30 flex items-center h-16 px-6 text-gray-700 bg-white border-b border-gray-200 shadow-sm">
      {/* Menu Toggle */}
      <button 
        onClick={toggleSidebar}
        className="p-2 mr-6 text-xl transition-all duration-200 rounded-lg hover:bg-gray-100"
      >
        <FaBars />
      </button>
      
      {/* Logo & Title */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center text-lg font-bold text-white bg-blue-600 rounded-lg w-9 h-9">
          D
        </div>
        <h1 className="text-lg font-semibold text-gray-800">
          DATS
        </h1>
      </div>

      {/* Search Bar - Hidden on mobile */}
      <div className="items-center flex-1 hidden max-w-md ml-8 md:flex">
        <div className="relative w-full">
          <FaSearch className="absolute text-sm text-gray-400 -translate-y-1/2 left-3 top-1/2" />
          <input 
            type="text" 
            placeholder="Search invoices, customers..." 
            className="w-full py-2 pl-10 pr-4 text-sm text-gray-700 placeholder-gray-400 transition-all border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>
      
      {/* Right Section */}
      <div className="flex items-center gap-1 ml-auto">
        {/* Notifications */}
        <button className="relative p-2.5 hover:bg-gray-100 rounded-lg transition-all duration-200 group">
          <FaBell className="text-lg text-gray-600" />
          <span className="absolute w-2 h-2 bg-blue-600 rounded-full top-2 right-2" />
          <span className="absolute right-0 px-2 py-1 text-xs text-white transition-opacity bg-gray-900 rounded opacity-0 -bottom-8 group-hover:opacity-100 whitespace-nowrap">
            3 notifications
          </span>
        </button>

        {/* Messages */}
        <button className="relative p-2.5 hover:bg-gray-100 rounded-lg transition-all duration-200 group">
          <FaEnvelope className="text-lg text-gray-600" />
          <span className="absolute w-2 h-2 bg-green-500 rounded-full top-2 right-2" />
          <span className="absolute right-0 px-2 py-1 text-xs text-white transition-opacity bg-gray-900 rounded opacity-0 -bottom-8 group-hover:opacity-100 whitespace-nowrap">
            5 messages
          </span>
        </button>

        {/* Divider */}
        <div className="w-px h-8 mx-2 bg-gray-200" />

 
      </div>
    </header>
  );
};

export default Header;