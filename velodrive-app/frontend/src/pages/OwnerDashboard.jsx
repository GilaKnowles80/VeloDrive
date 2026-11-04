import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { Car, Wallet, Calendar, Truck, MapPin } from 'lucide-react';
import GPSMap from '../components/GPSMap';

const OwnerDashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState({ totalVehicles: 0, totalBookings: 0, totalEarnings: 0, pendingBookings: 0 });
  const [vehicles, setVehicles] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [vResp, bResp] = await Promise.all([
          api.get('/vehicles/my-vehicles'),
          api.get('/bookings/my-bookings')
        ]);
        setVehicles(vResp.data.vehicles || []);
        setBookings(bResp.data.bookings || []);
        setStats({
          totalVehicles: (vResp.data.vehicles || []).length,
          totalBookings: (bResp.data.bookings || []).length,
          totalEarnings: (bResp.data.bookings || []).reduce((sum, b) => sum + parseFloat(b.ownerPayout || 0), 0),
          pendingBookings: (bResp.data.bookings || []).filter(b => b.status === 'pending').length
        });
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
            <h1 className="text-2xl font-bold text-gray-900">Owner Dashboard</h1>
            <p className="text-gray-600">Manage your vehicles and track rentals</p>
          </div>
          <span className="mt-4 md:mt-0 px-3 py-1 bg-blue-100 text-blue-700 text-xs rounded-full font-medium">
            {user ? `${user.firstName || ''} ${user.lastName || ''}` : 'Guest'}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {[
            { label: 'Vehicles', icon: Car, value: stats.totalVehicles },
            { label: 'Bookings', icon: Calendar, value: stats.totalBookings },
            { label: 'Earnings (PHP)', icon: Wallet, value: stats.totalEarnings },
            { label: 'Pending', icon: Truck, value: stats.pendingBookings }
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">My Vehicles</h2>
            </div>
            {loading || vehicles.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-gray-500">
                {loading ? 'Loading...' : 'No vehicles registered yet'}
              </div>
            ) : (
              <div className="space-y-3">
                {vehicles.map((v) => (
                  <div key={v.id} className="flex items-center gap-4 p-3 border border-gray-200 rounded-lg bg-white">
                    <div className="w-16 h-16 bg-gray-200 rounded-lg flex items-center justify-center">
                      <Car className="w-8 h-8 text-gray-500" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{v.make} {v.model}</p>
                      <p className="text-xs text-gray-500">{v.type} • Php {v.pricePerDay}/day</p>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${v.isVerified ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                      {v.isVerified ? 'Verified' : 'Pending'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">Recent Bookings</h2>
            </div>
            {loading || bookings.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-gray-500">
                {loading ? 'Loading...' : 'No bookings yet'}
              </div>
            ) : (
              <div className="space-y-3">
                {bookings.slice(0, 10).map((b) => (
                  <div key={b.id} className="p-3 border border-gray-200 rounded-lg bg-white">
                    <p className="font-medium text-gray-900 text-sm">{b.bookingReference}</p>
                    <p className="text-xs text-gray-500">{b.renter?.firstName || ''} {b.renter?.lastName || ''}</p>
                    <div className="mt-2 flex items-center gap-2 text-xs">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${b.status === 'completed' ? 'bg-green-100 text-green-700' : b.status === 'active' ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700'}`}>
                        {b.status || 'Unknown'}
                      </span>
                      <span className="text-gray-400">• Php {b.totalAmount || 0}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="card mt-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900">Vehicle Location Tracking</h2>
            <p className="text-sm text-gray-500">Real-time GPS tracking on Google Maps / Waze</p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {vehicles.map((v) => (
              <div key={v.id} className="h-80">
                <GPSMap vehicleId={v.id} title={`${v.make} ${v.model} (${v.licensePlate})`} />
              </div>
            ))}
            {vehicles.length === 0 && (
              <div className="h-80 flex flex-col items-center justify-center text-gray-500">
                <MapPin className="w-10 h-10 mb-2 opacity-50" />
                <p>No vehicles to track</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OwnerDashboard;