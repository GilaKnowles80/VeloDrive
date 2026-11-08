import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { Users, Car, Wallet, Clock, MapPin } from 'lucide-react';
import GPSMap from '../components/GPSMap';

const AdminDashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState({ totalUsers: 0, totalVehicles: 0, totalBookings: 0, totalRevenue: 0 });
  const [recentBookings, setRecentBookings] = useState([]);
  const [allVehicles, setAllVehicles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [dResp, bResp, vResp] = await Promise.all([
          api.get('/admin/dashboard'),
          api.get('/admin/bookings'),
          api.get('/vehicles/')
        ]);
        setStats(dResp.data.stats);
        setRecentBookings(bResp.data.bookings);
        setAllVehicles(vResp.data.vehicles || []);
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    };
    loadData();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
            <p className="text-gray-600">Monitor all transactions, users, and vehicles</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-4 md:mt-0">
            <span className="px-3 py-1 bg-blue-100 text-blue-700 text-xs rounded-full font-medium">
              {user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email : 'Guest'}
            </span>
            <a href="/owner/dashboard" className="px-3 py-1.5 bg-white border border-gray-200 text-gray-700 text-xs rounded-lg font-medium hover:border-blue-400 hover:text-blue-600">Vehicle Owners Dashboard</a>
            <a href="/renter/dashboard" className="px-3 py-1.5 bg-white border border-gray-200 text-gray-700 text-xs rounded-lg font-medium hover:border-blue-400 hover:text-blue-600">Renter Dashboard</a>
            <a href="mailto:support.velodrive@gctravelandtour.com" className="px-3 py-1.5 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-lg font-medium hover:bg-amber-100">Support</a>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {[
            { label: 'Total Users', icon: Users, value: stats.totalUsers },
            { label: 'Total Vehicles', icon: Car, value: stats.totalVehicles },
            { label: 'Total Bookings', icon: Clock, value: stats.totalBookings },
            { label: 'Platform Revenue (PHP)', icon: Wallet, value: stats.totalRevenue }
          ].map((stat, i) => (
            <div key={i} className="card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 uppercase tracking-wider">{stat.label}</p>
                  <p className="text-3xl font-bold text-gray-900">{stat.value}</p>
                </div>
                <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center text-gray-500">
                  <stat.icon className="w-5 h-5" />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="card">
          <h2 className="text-lg font-bold text-gray-900 mb-4">All Bookings</h2>
          {loading ? (
            <div className="h-64 flex items-center justify-center">Loading...</div>
          ) : recentBookings.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="pb-3 text-sm font-semibold text-gray-600">Reference</th>
                    <th className="pb-3 text-sm font-semibold text-gray-600">Vehicle</th>
                    <th className="pb-3 text-sm font-semibold text-gray-600">Renter</th>
                    <th className="pb-3 text-sm font-semibold text-gray-600">Amount (PHP)</th>
                    <th className="pb-3 text-sm font-semibold text-gray-600">Status</th>
                    <th className="pb-3 text-sm font-semibold text-gray-600">Payment</th>
                  </tr>
                </thead>
                <tbody>
                  {recentBookings.map((b) => (
                    <tr key={b.id} className="border-b border-gray-100">
                      <td className="py-3 text-sm text-gray-900 font-mono">{b.bookingReference}</td>
                      <td className="py-3 text-sm text-gray-900">{b.Vehicle?.make || ''} {b.Vehicle?.model || ''}</td>
                      <td className="py-3 text-sm text-gray-900">{b.renter?.firstName || ''} {b.renter?.lastName || ''}</td>
                      <td className="py-3 text-sm text-gray-900">{b.totalAmount || 0}</td>
                      <td className="py-3 text-sm">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${b.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                          {b.status || 'Unknown'}
                        </span>
                      </td>
                      <td className="py-3 text-sm">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${b.paymentStatus === 'paid' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                          {b.paymentStatus || 'Unknown'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-500">No recent bookings</div>
          )}
        </div>

        <div className="card mt-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900">All Vehicles - Live GPS Tracking</h2>
            <p className="text-sm text-gray-500">Monitor all rental vehicles on Google Maps / Waze</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {loading || allVehicles.length === 0 ? (
              <div className="h-80 flex flex-col items-center justify-center text-gray-500">
                <MapPin className="w-10 h-10 mb-2 opacity-50" />
                <p>{loading ? 'Loading vehicles...' : 'No vehicles registered'}</p>
              </div>
            ) : (
              allVehicles.map((v) => (
                <div key={v.id} className="h-80">
                  <GPSMap vehicleId={v.id} title={`${v.make} ${v.model} (${v.licensePlate})`} />
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;