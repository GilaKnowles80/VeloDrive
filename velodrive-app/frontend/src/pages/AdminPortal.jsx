import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert, LayoutDashboard, Users, Car } from 'lucide-react';

const AdminPortal = () => (
  <div className="page-shell py-12 px-4">
    <div className="max-w-3xl mx-auto">
      <div className="card bg-white/95 backdrop-blur">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 rounded-xl bg-blue-100 text-blue-700"><ShieldAlert className="w-6 h-6" /></div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Admin Portal</h1>
            <p className="text-sm text-gray-600">VeloDrive administration home</p>
          </div>
        </div>
        <p className="text-gray-700 mb-6">
          Admin accounts are provisioned by VeloDrive. Sign in with your admin credentials to manage users, vehicles, bookings, transactions, and platform operations.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6 text-sm">
          <div className="rounded-lg border border-gray-200 p-3 flex items-center gap-2"><LayoutDashboard className="w-4 h-4 text-blue-600" /> Admin Dashboard</div>
          <div className="rounded-lg border border-gray-200 p-3 flex items-center gap-2"><Users className="w-4 h-4 text-blue-600" /> Renters & Owners</div>
          <div className="rounded-lg border border-gray-200 p-3 flex items-center gap-2"><Car className="w-4 h-4 text-blue-600" /> Vehicles & Bookings</div>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link to="/login" className="btn-primary inline-flex items-center gap-2">Sign in as Admin</Link>
          <Link to="/" className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50">Back to Home</Link>
        </div>
      </div>
    </div>
  </div>
);

export default AdminPortal;