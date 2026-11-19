import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { useSearchParams } from 'react-router-dom';
import { Wallet, Send, ArrowDown, Banknote } from 'lucide-react';

const WalletPage = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const handledOrder = useRef(null);
  const [wallet, setWallet] = useState({ balance: 0, bankAccountName: '', bankAccountNumber: '', bankName: '' });
  const [paymentAccount, setPaymentAccount] = useState({
    bankAccountName: '', bankAccountNumber: '', bankName: '', gcashNumber: '', paymentPreference: '', paypalEmail: '', paypalVerified: false,
  });
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ amount: '', method: 'paypal', bankName: '', bankAccountName: '', bankAccountNumber: '', gcashNumber: '', paymentPreference: '', paypalEmail: '' });
  const [captureLoading, setCaptureLoading] = useState(false);
  const [topupNotice, setTopupNotice] = useState('');

  const loadData = async () => {
    try {
      const [walletResp, accountResp] = await Promise.all([
        api.get('/wallet/'),
        api.get('/payments/account').catch(() => ({ data: { account: {} } })),
      ]);
      setWallet(walletResp.data.wallet || {});
      setTransactions(walletResp.data.transactions || []);
      setPaymentAccount(accountResp.data.account || {});
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    const topupStatus = searchParams.get('topup');
    const orderId = searchParams.get('token');
    if (topupStatus === 'cancelled') {
      setTopupNotice('PayPal checkout was cancelled. Your wallet was not credited.');
      return;
    }
    if (topupStatus !== 'success' || !orderId || handledOrder.current === orderId) return;

    handledOrder.current = orderId;
    setCaptureLoading(true);
    api.post('/wallet/topup/capture', { orderId })
      .then(async (response) => {
        setTopupNotice(response.data.alreadyProcessed ? 'This PayPal top-up was already credited.' : `PayPal top-up of Php ${Number(response.data.amount).toFixed(2)} completed.`);
        try {
          const walletResponse = await api.get('/wallet/');
          setWallet(walletResponse.data.wallet || {});
          setTransactions(walletResponse.data.transactions || []);
        } catch (error) {
          console.error('Wallet refresh failed after PayPal capture', error);
        }
      })
      .catch((error) => {
        setTopupNotice(error.response?.data?.message || 'PayPal could not confirm this top-up. Contact support before retrying payment.');
      })
      .finally(() => setCaptureLoading(false));
  }, [searchParams]);

  const openTopup = () => { setModal('topup'); setForm({ ...form, amount: '' }); setTopupNotice(''); };
  const openWithdraw = () => { setModal('withdraw'); setForm({ amount: '' }); };
  const openAccount = () => {
    setForm({
      bankName: paymentAccount.bankName || '',
      bankAccountName: paymentAccount.bankAccountName || '',
      bankAccountNumber: paymentAccount.bankAccountNumber || '',
      gcashNumber: paymentAccount.gcashNumber || '',
      paymentPreference: paymentAccount.paymentPreference || '',
      paypalEmail: paymentAccount.paypalEmail || '',
    });
    setModal('account');
  };
  const closeModal = () => setModal(null);

  const handleTopUp = async (e) => {
    if (e) e.preventDefault();
    setCaptureLoading(true);
    try {
      const resp = await api.post('/wallet/topup', { amount: form.amount });
      if (!resp.data.success || !resp.data.approvalUrl) throw new Error(resp.data.message || 'Could not start PayPal checkout.');
      window.location.assign(resp.data.approvalUrl);
    } catch (err) {
      setTopupNotice(err.response?.data?.message || err.message || 'Top-up failed');
    } finally {
      setCaptureLoading(false);
    }
  };

  const handleWithdraw = async (e) => {
    e.preventDefault();
    try {
      await api.post('/wallet/withdraw', { amount: form.amount });
      closeModal();
      loadData();
    } catch (err) {
      alert(err.response?.data?.message || 'Withdrawal failed');
    }
  };

  const handleSaveAccount = async (e) => {
    e.preventDefault();
    try {
      const resp = await api.post('/payments/account', {
        bankName: form.bankName || '',
        bankAccountName: form.bankAccountName || '',
        bankAccountNumber: form.bankAccountNumber || '',
        gcashNumber: form.gcashNumber || '',
        paymentPreference: form.paymentPreference || '',
        paypalEmail: form.paypalEmail || '',
      });
      if (!resp.data.success) throw new Error(resp.data.message);
      setPaymentAccount(resp.data.account);
      closeModal();
      loadData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to save account details');
    }
  };

  // Wallet is only for Vehicle Owners and Admins
  if (user && user.role === 'renter') {
    return (
      <div className="page-shell">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="card bg-amber-50 border border-amber-200 rounded-lg p-8 text-center">
            <h2 className="text-lg font-bold text-amber-900 mb-2">Wallet Access</h2>
            <p className="text-amber-700">The Wallet is available to Vehicle Owners and Admins only.</p>
            <p className="text-amber-600 text-sm mt-2">Renters pay through checkout at the time of booking.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">E-Wallet</h1>
            <p className="text-gray-600">Top up securely via PayPal. Withdrawals are sent to your bank account.</p>
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
              <button className="flex-1 bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg text-sm flex items-center justify-center gap-2 text-white transition" onClick={openAccount}>
                <Banknote className="w-4 h-4" /> Account
              </button>
            </div>
          </div>

          <div className="card">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Payment Account</h3>
            <div className="space-y-2 text-sm">
              <p><strong>Bank:</strong> {paymentAccount.bankName || 'Not set'}</p>
              <p><strong>Account Name:</strong> {paymentAccount.bankAccountName || 'Not set'}</p>
              <p><strong>Account Number:</strong> {paymentAccount.bankAccountNumber || 'Not set'}</p>
              <p><strong>GCash Number:</strong> {paymentAccount.gcashNumber || 'Not set'}</p>
              <p><strong>Preferred Method:</strong> {paymentAccount.paymentPreference || 'Not set'}</p>
              <p><strong>PayPal Email:</strong> {paymentAccount.paypalEmail || 'Not set'}</p>
            </div>
            <p className="mt-3 text-xs text-gray-500">PayPal is the only supported wallet top-up method. Bank details are used for withdrawals.</p>
          </div>

          {topupNotice && (
            <div className={`mb-6 rounded-lg border p-4 text-sm ${topupNotice.includes('completed') || topupNotice.includes('already credited') ? 'border-green-200 bg-green-50 text-green-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
              {topupNotice}
            </div>
          )}

          <div className="card">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Platform Fee Info</h3>
            <p className="text-gray-600">Owners: Php 499/ monthly Subscription or Php 4,999/ yearly subscription.</p>
            <p className="text-gray-600">10% Service charge per booking escrow split payment add-on to the owner's net rental payment during renter's checkout payment.</p>
            <p className="text-gray-600">Renters takes charge for fuel during en-route destination and fuel full tank refund before turning over back to the owner, damages during en-route, and delay charges.</p>
            <p className="text-gray-600">Admin wallet holds the escrow split of 10% service charge only. Admin can only follow up refunds to Owner. Owner processes refunds because Owner holds the payment from Renter.</p>
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
            <button type="button" className="absolute right-4 top-4 text-gray-400 hover:text-gray-600" onClick={closeModal}>
              ×
            </button>

            {modal === 'topup' && (
              <form onSubmit={handleTopUp} className="space-y-4">
                <h2 className="text-lg font-bold text-gray-900 mb-4">Top Up Wallet</h2>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Amount (PHP)</label>
                  <input
                    className="input-field"
                    type="number"
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    required
                    min="1"
                    max="100000"
                    step="0.01"
                  />
                </div>
                <p className="text-sm text-gray-600">Your wallet is credited only after VeloDrive verifies the PayPal capture.</p>
                <div className="flex gap-3">
                  <button type="button" className="btn-secondary flex-1" onClick={closeModal}>Cancel</button>
                  <button type="submit" className="btn-primary flex-1" disabled={captureLoading}>
                    {captureLoading ? 'Creating...' : 'Continue to PayPal'}
                  </button>
                </div>
              </form>
            )}

            {modal === 'withdraw' && (
              <form onSubmit={handleWithdraw} className="space-y-4">
                <h2 className="text-lg font-bold text-gray-900 mb-4">Withdraw to Bank</h2>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Amount (PHP)</label>
                  <input
                    className="input-field"
                    type="number"
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    required
                    min="1"
                  />
                  <p className="text-xs text-gray-500">Withdrawal sent to your linked bank account.</p>
                </div>
                <div className="flex gap-3">
                  <button type="button" className="btn-secondary flex-1" onClick={closeModal}>Cancel</button>
                  <button type="submit" className="btn-primary flex-1">Withdraw</button>
                </div>
              </form>
            )}

            {modal === 'account' && (
              <form onSubmit={handleSaveAccount} className="space-y-4">
                <h2 className="text-lg font-bold text-gray-900 mb-4">Payment Account Details</h2>
                <div className="space-y-3">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Bank Name</label>
                    <input
                      className="input-field"
                      type="text"
                      value={form.bankName || ''}
                      onChange={(e) => setForm({ ...form, bankName: e.target.value })}
                      placeholder="e.g. BPI, BDO, Metrobank"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Account Name</label>
                    <input
                      className="input-field"
                      type="text"
                      value={form.bankAccountName || ''}
                      onChange={(e) => setForm({ ...form, bankAccountName: e.target.value })}
                      placeholder="e.g. Juan Dela Cruz"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Account Number</label>
                    <input
                      className="input-field"
                      type="text"
                      value={form.bankAccountNumber || ''}
                      onChange={(e) => setForm({ ...form, bankAccountNumber: e.target.value })}
                      placeholder="e.g. 1234567890"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">GCash Number</label>
                    <input
                      className="input-field"
                      type="text"
                      value={form.gcashNumber || ''}
                      onChange={(e) => setForm({ ...form, gcashNumber: e.target.value })}
                      placeholder="e.g. 09123456789"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">PayPal Email</label>
                    <input
                      className="input-field"
                      type="email"
                      value={form.paypalEmail || ''}
                      onChange={(e) => setForm({ ...form, paypalEmail: e.target.value })}
                      placeholder="e.g. your-email@example.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Preferred Payment Method</label>
                    <select
                      className="input-field"
                      value={form.paymentPreference || ''}
                      onChange={(e) => setForm({ ...form, paymentPreference: e.target.value })}
                    >
                      <option value="">Select preference</option>
                      <option value="bank">Bank Transfer</option>
                      <option value="gcash">GCash</option>
                      <option value="paypal">PayPal</option>
                    </select>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button type="button" className="btn-secondary flex-1" onClick={closeModal}>Cancel</button>
                  <button type="submit" className="btn-primary flex-1">Save Details</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default WalletPage;
