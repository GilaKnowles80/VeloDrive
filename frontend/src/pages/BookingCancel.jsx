import React from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';

const BookingCancel = () => (
  <div className="page-shell py-20 px-4">
    <div className="max-w-md mx-auto bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
      <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-6">
        <AlertCircle className="w-8 h-8 text-yellow-600" />
      </div>
      <h1 className="text-2xl font-bold text-gray-900 mb-4">Booking Cancelled</h1>
      <p className="text-gray-600 mb-6">
        Your booking was not completed. No payment was charged.
      </p>
      <div className="flex gap-3">
        <Link to="/vehicles" className="flex-1 btn-primary text-center">
          Browse Vehicles Again
        </Link>
        <Link to="/" className="flex-1 btn-secondary text-center">Back to Home</Link>
      </div>
    </div>
  </div>
);

export default BookingCancel;