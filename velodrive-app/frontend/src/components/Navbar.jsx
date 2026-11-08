import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard, User, Wallet, LogOut, Search,
  CreditCard, LogIn, UserPlus, ShieldAlert
} from 'lucide-react';
import logo from '../assets/logo.jpg';

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

            {!user && (
              <div className="flex items-center gap-2 flex-wrap justify-end">
                <Link to="/admin" className="text-sm font-medium text-amber-700 hover:text-amber-800 flex items-center gap-2 border border-amber-300 bg-amber-50 px-3 py-1.5 rounded-lg">
                  <ShieldAlert className="w-4 h-4" /> Admin
                </Link>
                <Link to="/login" className="text-sm font-medium text-gray-600 hover:text-blue-600 flex items-center gap-2">
                  <LogIn className="w-4 h-4" /> Login
                </Link>
                <Link to="/register" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 text-sm font-medium rounded-lg transition flex items-center gap-2">
                  <UserPlus className="w-4 h-4" /> Sign Up
                </Link>
              </div>
            )}

            {user && (
              <>
                <div className="hidden md:flex items-center gap-6 text-sm">
                  {/* Admin Dashboard Links - admin can navigate to all role views */}
                  {isAdmin && (
                    <>
                      <Link to="/admin/dashboard" className="text-gray-600 hover:text-blue-600 flex items-center gap-2 font-semibold">
                        <ShieldAlert className="w-4 h-4 text-blue-600" /> Admin Dashboard
                      </Link>
                      <Link to="/owner/dashboard" className="text-gray-600 hover:text-blue-600 flex items-center gap-2 text-sm">
                        <User className="w-4 h-4" /> Vehicle Owners
                      </Link>
                      <Link to="/renter/dashboard" className="text-gray-600 hover:text-blue-600 flex items-center gap-2 text-sm">
                        <LayoutDashboard className="w-4 h-4" /> Renter Dashboard
                      </Link>
                    </>
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

                  <Link to="/profile" className="text-gray-600 hover:text-blue-600 flex items-center gap-2">
                    <User className="w-4 h-4" /> Profile
                  </Link>
                  <Link to="/wallet" className="text-gray-600 hover:text-blue-600 flex items-center gap-2">
                    <Wallet className="w-4 h-4" /> Wallet
                  </Link>
                </div>

                <div className="flex items-center gap-3 pl-4 border-l border-gray-200">
                  <Link to="/profile" className="text-sm text-gray-600 hidden md:block hover:text-blue-600 font-medium" title="Edit profile">
                    {user.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : user.name || user.email}
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-2 text-sm text-red-600 hover:text-red-700 cursor-pointer"
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