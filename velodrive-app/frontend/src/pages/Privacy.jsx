import React from 'react';
import { Link } from 'react-router-dom';

const Privacy = () => (
  <div className="page-shell py-10 px-4">
    <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-sm border border-gray-200 p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">GDPR Privacy Policy</h1>
      <p className="text-gray-600 leading-relaxed mb-4">
        VeloDrive is committed to protecting your personal data in accordance with the General Data Protection Regulation (GDPR) and applicable Philippine data privacy laws.
      </p>
      <h2 className="text-lg font-bold text-gray-900 mt-6 mb-2">1. Data We Collect</h2>
      <ul className="list-disc list-inside text-gray-600 leading-relaxed mb-4">
        <li>Full name, address, email address, contact numbers</li>
        <li>NBI clearance, tax certificates, valid ID, driver's license</li>
        <li>Vehicle certificates of registration, proof of ownership, original certificates</li>
        <li>Bank account and e-wallet details for payouts and refunds</li>
        <li>GPS location data of rented vehicles</li>
      </ul>
      <h2 className="text-lg font-bold text-gray-900 mt-6 mb-2">2. Your Rights</h2>
      <ul className="list-disc list-inside text-gray-600 leading-relaxed mb-4">
        <li>Right to access and export your data</li>
        <li>Right to rectify inaccurate data</li>
        <li>Right to erasure (right to be forgotten)</li>
        <li>Right to withdraw consent at any time</li>
        <li>Right to object to processing</li>
      </ul>
      <h2 className="text-lg font-bold text-gray-900 mt-6 mb-2">3. Data Retention</h2>
      <p className="text-gray-600 leading-relaxed mb-4">
        We retain personal data for as long as necessary to fulfill the purposes for which it was collected, including for legal, tax, and accounting obligations.
      </p>
      <h2 className="text-lg font-bold text-gray-900 mt-6 mb-2">4. Contact</h2>
      <p className="text-gray-600 leading-relaxed mb-4">
        For GDPR requests, contact: privacy@veodrive.com
      </p>
      <div className="mt-8 pt-6 border-t border-gray-200 text-sm text-gray-500">
        <Link to="/" className="text-blue-600 hover:underline">← Back to Home</Link>
      </div>
    </div>
  </div>
);

export default Privacy;