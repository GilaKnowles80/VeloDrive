import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../utils/api';
import { ShieldCheck } from 'lucide-react';

const MEMBERSHIP_PLANS = [
  { id: 'monthly', label: 'Monthly', amount: 499, period: '/month' },
  { id: 'yearly', label: 'Yearly', amount: 4999, period: '/year' },
];

const OwnerMembership = () => {
  const [loading, setLoading] = useState(false);
  const [paymentUrl, setPaymentUrl] = useState(null);
  const [message, setMessage] = useState('');
  const [selectedPlan, setSelectedPlan] = useState('yearly');
  const [payingPlan, setPayingPlan] = useState(null);

  const plan = MEMBERSHIP_PLANS.find((p) => p.id === selectedPlan);

  const handleMembershipPay = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setPayingPlan(selectedPlan);
    try {
      const resp = await api.post('/owners/membership', {
        amount: plan.amount,
        currency: 'PHP',
        billingCycle: selectedPlan,
      });

      if (resp.data.success && resp.data.approvalUrl) {
        setPaymentUrl(resp.data.approvalUrl);
      }
    } catch (err) {
      setPayingPlan(null);
      setMessage(err.response?.data?.message || 'Membership payment failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-shell py-10 px-4">
      <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-sm border border-gray-200 p-8">
        <div className="flex items-center gap-3 mb-6">
          <ShieldCheck className="w-6 h-6 text-blue-600" />
          <h1 className="text-2xl font-bold text-gray-900">VeloDrive Membership</h1>
        </div>

        <div className="bg-blue-50 p-6 rounded-lg mb-8">
          <h2 className="text-lg font-bold text-gray-900 mb-3">Owner Membership Plans</h2>
          <p className="text-gray-600 mb-6">
            Choose your subscription plan. Membership is required to list vehicles on VeloDrive.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {MEMBERSHIP_PLANS.map((p) => (
              <div
                key={p.id}
                className={`p-4 rounded-lg border-2 ${
                  selectedPlan === p.id
                    ? 'border-blue-600 bg-blue-50'
                    : 'border-gray-200 bg-white hover:border-gray-400'
                } cursor-pointer transition`}
                onClick={() => setSelectedPlan(p.id)}
              >
                <div className="flex justify-between items-start mb-2">
                  <span className="font-semibold text-gray-900">{p.label}</span>
                  <span className="text-sm text-gray-500">{p.period}</span>
                </div>
                <div className="text-2xl font-bold text-blue-600">Php {p.amount}</div>
                <p className="text-xs text-gray-500 mt-2">
                  {p.id === 'yearly' ? 'Best value — save Php 989/year' : 'Flexible monthly billing'}
                </p>
              </div>
            ))}
          </div>
          <div className="text-sm text-gray-500">
            Payment is processed securely via PayPal to gctravelandtours2021@gmail.com.
          </div>
        </div>

        <form onSubmit={handleMembershipPay} className="space-y-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-700">Selected Plan</span>
            <span className="text-sm font-bold text-blue-600">
              {plan.label} — Php {plan.amount}{plan.period}
            </span>
          </div>
          <button
            type="submit"
            className="w-full btn-primary py-3 disabled:opacity-50"
            disabled={loading || paymentUrl || payingPlan}
          >
            {loading ? 'Processing...' : payingPlan ? 'Creating Payment...' : `Pay Membership Fee (Php ${plan.amount})`}
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
            Already a member? Your membership is valid for your subscribed period.
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
