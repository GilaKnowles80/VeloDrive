import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { Wallet, Send, ArrowDown } from 'lucide-react';

const WalletPage = () => {
  const { user } = useAuth();
  const [wallet, setWallet] = useState({ balance: 0, bankAccountName: '', bankAccountNumber: '', bankName: '' });
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ amount: '' });

  const loadData = async () => {
    try {
      const resp = await api.get('/wallet/');
      setWallet(resp.data.wallet || {});
      setTransactions(resp.data.transactions || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openTopup = () => { setModal('topup'); setForm({ amount: '' }); };
  const openWithdraw = () => { setModal('withdraw'); setForm({ amount: '' }); };
  const closeModal = () => setModal(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (modal === 'topup') {
        await api.post('/wallet/topup', { amount: form.amount });
      } else {
        await api.post('/wallet/withdraw', { amount: form.amount });
      }
      closeModal();
      loadData();
    } catch (err) {
      alert(err.response?.data?.message || 'Transaction failed');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">E-Wallet</h1>
            <p className="text-gray-600">Connected to your bank account. Withdrawable & refundable.</p>
          </div>
          <span className="mt-4 md:mt-0 px-3 py-1 bg-blue-100 text-blue-700 text-xs rounded-full font-medium">
            {user.firstName} {user.lastName}
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="card bg-blue-600 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100 text-sm uppercase tracking-wider">Available Balance</p>
                <p className="text-4xl font-bold">Php {wallet.balance || 0}</p>
              </div>
              <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center">
                <Wallet className="w-7 h-7" />
              </div>
            </div>
            <div className="mt-4 flex gap-3">
              <button className="flex-1 bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg text-sm flex items-center justify-center gap-2 text-white transition" onClick={openTopup}>
                <ArrowDown className="w-4 h-4" /> Top Up
              </button>
              <button className="flex-1 bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg text-sm flex items-center justify-center gap-2 text-white transition" onClick={openWithdraw}>
                <Send className="w-4 h-4" /> Withdraw
              </button>
            </div>
          </div>

          <div className="card">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Bank Account</h3>
            <p className="text-gray-600">{wallet.bankAccountName || 'Not set'}</p>
            <p className="text-gray-600 text-sm">{wallet.bankAccountNumber || 'Not set'}</p>
            <p className="text-gray-600 text-sm">{wallet.bankName || 'Not set'}</p>
            <p className="mt-3 text-xs text-gray-500">Update your bank details in Profile to enable withdrawals.</p>
          </div>

          <div className="card">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Platform Fee Info</h3>
            <p className="text-gray-600">Owners: Php 1,000/month subscription + 10% commission per booking.</p>
            <p className="text-gray-600">Renters pay for fuel, damages, and delay charges.</p>
            <p className="text-gray-600">Admin wallet holds escrow and processes refunds.</p>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900">Transaction History</h2>
          </div>
          {loading ? (
            <div className="h-64 flex items-center justify-center">Loading...</div>
          ) : transactions.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="pb-3 text-sm font-semibold text-gray-600">Reference</th>
                    <th className="pb-3 text-sm font-semibold text-gray-600">Type</th>
                    <th className="pb-3 text-sm font-semibold text-gray-600">Amount (PHP)</th>
                    <th className="pb-3 text-sm font-semibold text-gray-600">Status</th>
                    <th className="pb-3 text-sm font-semibold text-gray-600">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((t) => (
                    <tr key={t.id} className="border-b border-gray-100">
                      <td className="py-3 text-sm text-gray-900 font-mono">{t.reference}</td>
                      <td className="py-3 text-sm text-gray-900">{t.type}</td>
                      <td className="py-3 text-sm text-gray-900">{t.amount}</td>
                      <td className="py-3 text-sm">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${t.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                          {t.status}
                        </span>
                      </td>
                      <td className="py-3 text-sm text-gray-500">{new Date(t.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-500">No transactions yet</div>
          )}
        </div>
      </div>

      {modal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-lg">
            <h2 className="text-lg font-bold text-gray-900 mb-4">{modal === 'topup' ? 'Top Up Wallet' : 'Withdraw to Bank'}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Amount (PHP)</label>
                <input
                  className="input-field"
                  type="number"
                  value={form.amount}
                  onChange={(e) => setForm({...form, amount: e.target.value})}
                  required
                />
                {modal === 'withdraw' && (
                  <p className="text-xs text-gray-500">Withdrawal sent to your linked bank account.</p>
                )}
              </div>
              <div className="flex gap-3">
                <button type="button" className="btn-secondary flex-1" onClick={closeModal}>Cancel</button>
                <button type="submit" className="btn-primary flex-1">{modal === 'topup' ? 'Top Up' : 'Withdraw'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default WalletPage;