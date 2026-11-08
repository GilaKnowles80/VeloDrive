import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { Car, Calendar, Wallet, Truck } from 'lucide-react';

const todayISO = () => new Date().toISOString().split('T')[0];
const addDaysISO = (start, days) => {
  const d = new Date(start);
  d.setDate(d.getDate() + Number(days || 1));
  return d.toISOString().split('T')[0];
};

const RenterDashboard = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [stats, setStats] = useState({ totalRentals: 0, activeRentals: 0, completedRentals: 0, totalSpent: 0 });
  const [bookings, setBookings] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [bookingForm, setBookingForm] = useState({
    vehicleId: '', rentalStartDate: todayISO(), numberOfDays: '1',
    pickupPoint: '', returnPoint: '', destinationPoint: '',
  });
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingError, setBookingError] = useState('');
  const [paypalApprovalUrl, setPaypalApprovalUrl] = useState(null);

  const handleBookVehicle = async (e) => {
    e.preventDefault();
    setBookingError('');
    setPaypalApprovalUrl(null);
    const days = parseInt(bookingForm.numberOfDays, 10);
    if (!bookingForm.vehicleId || !bookingForm.rentalStartDate || !days || days < 1 || days > 365) {
      setBookingError('Select a vehicle, valid start date, and 1–365 days.');
      return;
    }
    if (!bookingForm.pickupPoint.trim() || !bookingForm.returnPoint.trim()) {
      setBookingError('Pickup and return points are required.');
      return;
    }
    setBookingLoading(true);
    try {
      const rentalStartDate = bookingForm.rentalStartDate;
      const rentalEndDate = addDaysISO(rentalStartDate, days);
      const resp = await api.post('/bookings/', {
        vehicleId: bookingForm.vehicleId,
        rentalStartDate,
        rentalEndDate,
        numberOfDays: days,
        pickupPoint: bookingForm.pickupPoint.trim(),
        returnPoint: bookingForm.returnPoint.trim(),
        destinationPoint: (bookingForm.destinationPoint || '').trim(),
      });
      const approvalUrl = resp.data?.paypalOrder?.approvalUrl || resp.data?.approvalUrl;
      if (resp.data?.success && approvalUrl) setPaypalApprovalUrl(approvalUrl);
      else setBookingError(resp.data?.message || 'Booking created, but no PayPal approval URL was returned.');
    } catch (err) {
      setBookingError(err.response?.data?.message || 'Booking failed');
    } finally {
      setBookingLoading(false);
    }
  };

  useEffect(() => {
    const vid = searchParams.get('vehicleId');
    if (vid) setBookingForm((f) => ({ ...f, vehicleId: vid }));
  }, [searchParams]);

  useEffect(() => {
    const load = async () => {
      try {
        const [bResp, vResp] = await Promise.all([api.get('/bookings/my-rentals'), api.get('/vehicles/')]);
        const b = bResp.data?.bookings || [];
        setBookings(b);
        setVehicles(vResp.data?.vehicles || []);
        setStats({
          totalRentals: b.length,
          activeRentals: b.filter((x) => x.status === 'active').length,
          completedRentals: b.filter((x) => x.status === 'completed').length,
          totalSpent: b.reduce((sum, x) => sum + parseFloat(x.totalAmount || 0), 0),
        });
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);
  return (
    <div className="page-shell">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Renter Dashboard</h1>
            <p className="text-gray-600">Browse vehicles and manage your rentals</p>
          </div>
          <Link to="/profile" className="mt-4 md:mt-0 px-3 py-1 bg-blue-100 text-blue-700 text-xs rounded-full font-medium hover:bg-blue-200 inline-block" title="Edit your profile">
            {user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email : 'Guest'}
          </Link>
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
              <select className="input-field" value={bookingForm.vehicleId} onChange={e => setBookingForm({...bookingForm, vehicleId: e.target.value})} required>
                <option value="">Select a vehicle</option>
                {vehicles.map(v => <option key={v.id} value={v.id}>{v.make} {v.model} ({v.type}) - Php {v.pricePerDay}/day</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Start date</label>
              <input className="input-field" type="date" value={bookingForm.rentalStartDate} min={todayISO()} onChange={e => setBookingForm({...bookingForm, rentalStartDate: e.target.value})} required />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Days</label>
              <input className="input-field" type="number" value={bookingForm.numberOfDays} onChange={e => setBookingForm({...bookingForm, numberOfDays: e.target.value})} min="1" max="365" required />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Est. return</label>
              <input className="input-field" type="date" value={addDaysISO(bookingForm.rentalStartDate, bookingForm.numberOfDays)} readOnly />
            </div>
            <div className="md:col-span-2 space-y-2">
              <label className="text-sm font-medium text-gray-700">Pickup Point</label>
              <input className="input-field" value={bookingForm.pickupPoint} onChange={e => setBookingForm({...bookingForm, pickupPoint: e.target.value})} required />
            </div>
            <div className="md:col-span-2 space-y-2">
              <label className="text-sm font-medium text-gray-700">Return Point</label>
              <input className="input-field" value={bookingForm.returnPoint} onChange={e => setBookingForm({...bookingForm, returnPoint: e.target.value})} required />
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
          {bookingError && <p className="mt-3 text-sm text-red-600">{bookingError}</p>}
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