import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { Car, Calendar, Wallet, Truck } from 'lucide-react';

const RenterDashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState({ totalRentals: 0, activeRentals: 0, completedRentals: 0, totalSpent: 0 });
  const [bookings, setBookings] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [bookingForm, setBookingForm] = useState({ vehicleId: '', numberOfDays: '1', pickupPoint: '', returnPoint: '', destinationPoint: '' });
  const [bookingLoading, setBookingLoading] = useState(false);
  const [paypalApprovalUrl, setPaypalApprovalUrl] = useState(null);

  const handleBookVehicle = async (e) => {
    e.preventDefault();
    setBookingLoading(true);
    try {
      const resp = await api.post('/bookings/', {
        vehicleId: bookingForm.vehicleId,
        rentalStartDate: new Date().toISOString().split('T')[0],
        rentalEndDate: new Date(Date.now() + 86400000 * parseInt(bookingForm.numberOfDays)).toISOString().split('T')[0],
        numberOfDays: parseInt(bookingForm.numberOfDays),
        pickupPoint: bookingForm.pickupPoint,
        returnPoint: bookingForm.returnPoint,
        destinationPoint: bookingForm.destinationPoint
      });
      if (resp.data.success && resp.data.paypalOrder) setPaypalApprovalUrl(resp.data.paypalOrder.approvalUrl);
    } catch (err) {
      alert(err.response?.data?.message || 'Booking failed');
    } finally { setBookingLoading(false); }
  };

  useEffect(() => {
    api.get('/bookings/my-rentals').then(r => setBookings(r.data.bookings || []));
    api.get('/vehicles/').then(r => setVehicles(r.data.vehicles || []));
    api.get('/bookings/my-rentals').then(r => {
      const b = r.data.bookings || [];
      setStats({
        totalRentals: b.length,
        activeRentals: b.filter(x => x.status === 'active').length,
        completedRentals: b.filter(x => x.status === 'completed').length,
        totalSpent: b.reduce((sum, x) => sum + parseFloat(x.totalAmount || 0), 0)
      });
    }).finally(() => setLoading(false));
  }, []);
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Renter Dashboard</h1>
            <p className="text-gray-600">Browse vehicles and manage your rentals</p>
          </div>
          <span className="mt-4 md:mt-0 px-3 py-1 bg-blue-100 text-blue-700 text-xs rounded-full font-medium">
            {user ? `${user.firstName || ''} ${user.lastName || ''}` : 'Guest'}
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {[
            { label: 'Total Rentals', icon: Calendar, value: stats.totalRentals },
            { label: 'Active Rentals', icon: Car, value: stats.activeRentals },
            { label: 'Completed', icon: Truck, value: stats.completedRentals },
            { label: 'Total Spent (PHP)', icon: Wallet, value: stats.totalSpent }
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
          <h2 className="text-lg font-bold text-gray-900 mb-4">My Rentals</h2>
          {loading ? <div className="h-64 flex items-center justify-center">Loading...</div> : bookings.length > 0 ? (
            <div className="space-y-3">
              {bookings.map(b => (
                <div key={b.id} className="p-4 border border-gray-200 rounded-lg bg-white">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-gray-900">{b.bookingReference}</p>
                      <p className="text-sm text-gray-500">{b.Vehicle?.make || ''} {b.Vehicle?.model || ''}</p>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${b.status === 'completed' ? 'bg-green-100 text-green-700' : b.status === 'active' ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700'}`}>{b.status || 'Unknown'}</span>
                      <span className="text-gray-600">Php {b.totalAmount || 0}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : <div className="h-64 flex items-center justify-center text-gray-500">No rentals yet</div>}
        </div>
        <div className="card mt-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Rental Form</h2>
          <form onSubmit={handleBookVehicle} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Vehicle</label>
              <select className="input-field" value={bookingForm.vehicleId} onChange={e => setBookingForm({...bookingForm, vehicleId: e.target.value})}>
                <option value="">Select a vehicle</option>
                {vehicles.map(v => <option key={v.id} value={v.id}>{v.make} {v.model} ({v.type}) - Php {v.pricePerDay}/day</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Days</label>
              <input className="input-field" type="number" value={bookingForm.numberOfDays} onChange={e => setBookingForm({...bookingForm, numberOfDays: e.target.value})} min="1" />
            </div>
            <div className="md:col-span-2 space-y-2">
              <label className="text-sm font-medium text-gray-700">Pickup Point</label>
              <input className="input-field" value={bookingForm.pickupPoint} onChange={e => setBookingForm({...bookingForm, pickupPoint: e.target.value})} />
            </div>
            <div className="md:col-span-2 space-y-2">
              <label className="text-sm font-medium text-gray-700">Return Point</label>
              <input className="input-field" value={bookingForm.returnPoint} onChange={e => setBookingForm({...bookingForm, returnPoint: e.target.value})} />
            </div>
            <div className="md:col-span-2 space-y-2">
              <label className="text-sm font-medium text-gray-700">Destination</label>
              <input className="input-field" value={bookingForm.destinationPoint} onChange={e => setBookingForm({...bookingForm, destinationPoint: e.target.value})} />
            </div>
            <div className="md:col-span-2">
              <button type="submit" className="btn-primary w-full md:w-auto" disabled={bookingLoading || !bookingForm.vehicleId}>
                {bookingLoading ? 'Creating PayPal Order...' : 'Book Vehicle'}
              </button>
            </div>
          </form>
          {paypalApprovalUrl && (
            <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm text-blue-800 mb-2">Payment created! Continue to PayPal:</p>
              <button onClick={() => window.location.href = paypalApprovalUrl} className="btn-primary w-full text-sm">Pay with PayPal</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RenterDashboard;