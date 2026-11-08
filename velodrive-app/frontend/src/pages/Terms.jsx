import React from 'react';
import { Link } from 'react-router-dom';

const Terms = () => (
  <div className="page-shell py-10 px-4">
    <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-sm border border-gray-200 p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Terms of Service</h1>
      <p className="text-gray-600 leading-relaxed mb-4">
        By using VeloDrive, you agree to these terms and our GDPR Privacy Policy.
      </p>
      <h2 className="text-lg font-bold text-gray-900 mt-6 mb-2">Owner Obligations</h2>
      <ul className="list-disc list-inside text-gray-600 leading-relaxed mb-4">
        <li>Monthly platform fee: Php 1,000</li>
        <li>10% commission fee per booking</li>
        <li>Upload valid vehicle certificates and proof of ownership</li>
        <li>Maintain accurate vehicle descriptions and pricing</li>
      </ul>
      <h2 className="text-lg font-bold text-gray-900 mt-6 mb-2">Renter Obligations</h2>
      <ul className="list-disc list-inside text-gray-600 leading-relaxed mb-4">
        <li>Provide valid ID and driver's license</li>
        <li>Pay for fuel, vehicle damages, and delay charges</li>
        <li>Return vehicle on time; hourly charges apply for late returns</li>
      </ul>
      <h2 className="text-lg font-bold text-gray-900 mt-6 mb-2">Payments & Escrow</h2>
      <p className="text-gray-600 leading-relaxed mb-4">
        Payments are held in escrow and split between the owner (90%) and VeloDrive admin (10% commission) after rental completion. Refunds processed via e-wallet.
      </p>
      <div className="mt-8 pt-6 border-t border-gray-200 text-sm text-gray-500">
        <Link to="/" className="text-blue-600 hover:underline">← Back to Home</Link>
      </div>
    </div>
  </div>
);

export default Terms;