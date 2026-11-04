import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard, User, Wallet, LogOut, Search,
  CreditCard
} from 'lucide-react';
import logo from '../assets/logo.svg';

const Navbar = () => {
  const { user, logout, isAdmin, isOwner, isRenter } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200 sticky z-50 top-0">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <img src={logo} alt="VeloDrive Logo" className="w-8 h-8" />
            <Link to="/" className="text-xl font-bold text-gray-900 tracking-tight">
              Ve<span className="text-blue-600">lo</span>Drive
            </Link>
          </div>

          <div className="flex items-center gap-4">
            <Link to="/vehicles" className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-blue-600">
              <Search className="w-4 h-4" /> Browse Vehicles
            </Link>

            {user && (
              <>
                <div className="hidden md:flex items-center gap-6 text-sm">
                  {isAdmin && (
                    <Link to="/admin/dashboard" className="text-gray-600 hover:text-blue-600 flex items-center gap-2">
                      <LayoutDashboard className="w-4 h-4" /> Admin
                    </Link>
                  )}
                  {isOwner && (
                    <>
                      <Link to="/owner/dashboard" className="text-gray-600 hover:text-blue-600 flex items-center gap-2">
                        <User className="w-4 h-4" /> Owner Dashboard
                      </Link>
                      <Link to="/owner/membership" className="text-gray-600 hover:text-blue-600 flex items-center gap-2 text-xs px-2 py-1 border border-gray-300 rounded">
                        <CreditCard className="w-3 h-3" /> Membership
                      </Link>
                    </>
                  )}
                  {isRenter && (
                    <Link to="/renter/dashboard" className="text-gray-600 hover:text-blue-600 flex items-center gap-2">
                      <LayoutDashboard className="w-4 h-4" /> Renter Dashboard
                    </Link>
                  )}
                  <Link to="/wallet" className="text-gray-600 hover:text-blue-600 flex items-center gap-2">
                    <Wallet className="w-4 h-4" /> Wallet
                  </Link>
                </div>

                <div className="flex items-center gap-3 pl-4 border-l border-gray-200">
                  <span className="text-sm text-gray-600 hidden md:block">{user.firstName} {user.lastName}</span>
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-2 text-sm text-red-600 hover:text-red-700"
                  >
                    <LogOut className="w-4 h-4" /> Logout
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;