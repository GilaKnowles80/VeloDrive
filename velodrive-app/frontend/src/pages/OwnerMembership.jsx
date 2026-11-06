import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../utils/api';
import { ShieldCheck } from 'lucide-react';

const OwnerMembership = () => {
  const [loading, setLoading] = useState(false);
  const [paymentUrl, setPaymentUrl] = useState(null);
  const [message, setMessage] = useState('');

  const handleMembershipPay = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    try {
      const resp = await api.post('/api/owners/membership', {
        amount: 1000,
        currency: 'PHP'
      });

      if (resp.data.success && resp.data.approvalUrl) {
        setPaymentUrl(resp.data.approvalUrl);
      }
    } catch (err) {
      setMessage(err.response?.data?.message || 'Membership payment failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-sm border border-gray-200 p-8">
        <div className="flex items-center gap-3 mb-6">
          <ShieldCheck className="w-6 h-6 text-blue-600" />
          <h1 className="text-2xl font-bold text-gray-900">VeloDrive Membership</h1>
        </div>

        <div className="bg-blue-50 p-6 rounded-lg mb-8">
          <h2 className="text-lg font-bold text-gray-900 mb-2">One-Time Yearly Membership</h2>
          <p className="text-gray-600 mb-4">
            Pay Php 1,000 once per year to become a VeloDrive member. This charge applies regardless of how many vehicles you own.
          </p>
          <div className="text-2xl font-bold text-blue-600 mb-4">Php 1,000 / year</div>
          <p className="text-sm text-gray-500">
            Payment is processed securely via PayPal. Your membership is valid for 1 year from the payment date.
          </p>
        </div>

        <form onSubmit={handleMembershipPay} className="space-y-4">
          <button
            type="submit"
            className="w-full btn-primary py-3 disabled:opacity-50"
            disabled={loading || paymentUrl}
          >
            {loading ? 'Processing...' : paymentUrl ? 'Payment Ready - Click Below' : 'Pay Membership Fee (Php 1,000)'}
          </button>

          {paymentUrl && (
            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
              <p className="text-sm text-green-800 mb-3">
                Membership payment order created! Click below to complete payment via PayPal.
              </p>
              <button
                onClick={() => { window.location.href = paymentUrl; }}
                className="w-full btn-primary py-3"
              >
                Complete PayPal Payment
              </button>
            </div>
          )}

          {message && (
            <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
              {message}
            </div>
          )}
        </form>

        <div className="mt-8 pt-6 border-t border-gray-200 text-center">
          <p className="text-sm text-gray-500 mb-2">
            Already a member? Your membership is valid for 1 year.
          </p>
          <Link to="/owner/dashboard" className="text-blue-600 hover:underline text-sm">
            ← Back to Owner Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
};

export default OwnerMembership;