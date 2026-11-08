import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../utils/api';
import { CheckCircle, ArrowRight } from 'lucide-react';

const BookingSuccess = () => {
  const { id } = useParams();
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/bookings/${id}`).then(r => {
      setBooking(r.data.booking);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="page-shell flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="page-shell flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900">Booking Not Found</h2>
          <Link to="/" className="btn-primary mt-4">Back to Home</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell py-20 px-4">
      <div className="max-w-md mx-auto bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="w-8 h-8 text-green-600" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Booking Confirmed!</h1>
        <p className="text-gray-600 mb-6">
          Your vehicle booking <span className="font-mono text-blue-600">{booking.bookingReference}</span> has been created.
        </p>
        <div className="space-y-4 mb-8 text-left">
          <div className="flex justify-between">
            <span className="text-gray-600">Vehicle</span>
            <span className="text-gray-900">{booking.Vehicle?.make} {booking.Vehicle?.model}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Duration</span>
            <span className="text-gray-900">{booking.numberOfDays} day(s)</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Total Amount</span>
            <span className="text-gray-900 font-bold">Php {booking.totalAmount}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Status</span>
            <span className="text-green-600 font-medium">{booking.status}</span>
          </div>
        </div>
        <div className="bg-blue-50 p-4 rounded-lg mb-6">
          <p className="text-sm text-blue-800 mb-2">
            Payment is being processed via PayPal. Funds will be held in escrow and released to the owner after the rental is completed.
          </p>
        </div>
        <div className="flex gap-3">
          <Link to="/renter/dashboard" className="flex-1 btn-primary text-center">
            <ArrowRight className="w-4 h-4 mr-2" /> Go to Dashboard
          </Link>
          <Link to="/" className="flex-1 btn-secondary text-center">Back to Home</Link>
        </div>
      </div>
    </div>
  );
};

export default BookingSuccess;