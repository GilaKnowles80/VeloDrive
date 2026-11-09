import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { Wallet, Send, ArrowDown, Banknote, Smartphone } from 'lucide-react';

const PAYMENT_METHODS = [
  { id: 'paypal', label: 'PayPal', color: 'bg-blue-500' },
  { id: 'gcash', label: 'GCash', color: 'bg-green-500' },
  { id: 'bank_transfer', label: 'Bank Transfer', color: 'bg-indigo-500' },
];

const WalletPage = () => {
  const { user } = useAuth();
  const [wallet, setWallet] = useState({ balance: 0, bankAccountName: '', bankAccountNumber: '', bankName: '' });
  const [paymentAccount, setPaymentAccount] = useState({
    bankAccountName: '', bankAccountNumber: '', bankName: '', gcashNumber: '', paymentPreference: '', paypalEmail: '', paypalVerified: false,
  });  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [topupMethod, setTopupMethod] = useState('paypal');
  const [form, setForm] = useState({ amount: '', method: 'paypal', bankName: '', bankAccountName: '', bankAccountNumber: '', gcashNumber: '', paymentPreference: '', paypalEmail: '' });
  const [captureLoading, setCaptureLoading] = useState(false);
  const [instructions, setInstructions] = useState(null);

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

  const openTopup = () => { setModal('topup'); setForm({ amount: '', method: 'paypal', bankName: '', bankAccountName: '', bankAccountNumber: '', gcashNumber: '', paymentPreference: '', paypalEmail: '' }); setInstructions(null); };
  const openWithdraw = () => { setModal('withdraw'); setForm({ amount: '' }); };
  const openAccount = () => { setModal('account'); };
  const closeModal = () => setModal(null);

  const handleTopUp = async (e) => {
    if (e) e.preventDefault();
    setCaptureLoading(true);
    try {
      const resp = await api.post('/payments/create', {
        amount: form.amount,
        paymentMethod: form.method,
      });

      if (!resp.data.success) {
        if (resp.data.requiresSetup) {
          setInstructions({ error: resp.data.message, requiresSetup: true });
          return;
        }
        throw new Error(resp.data.message || 'Top-up failed');
      }

      const data = resp.data;

      if (data.paymentMethod === 'paypal' && data.redirectUrl) {
        window.location.href = data.redirectUrl;
      } else if (data.paymentMethod === 'gcash' || data.paymentMethod === 'bank_transfer') {
        setInstructions({
          paymentMethod: data.paymentMethod,
          reference: data.referenceId,
          amount: data.amount,
          instructions: data.instructions,
          gcashNumber: data.gcashNumber,
          bankName: data.bankName,
          bankAccountName: data.bankAccountName,
          bankAccountNumber: data.bankAccountNumber,
        });
        closeModal();
        loadData();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Top-up failed');
    } finally {
      setCaptureLoading(false);
    }
  };

  const handleCapture = async (e) => {
    e.preventDefault();
    setCaptureLoading(true);
    try {
      const resp = await api.post('/payments/capture', {
        paymentMethod: form.method,
        referenceId: instructions?.reference,
        confirmCode: e.target.elements.confirmCode?.value || '',
      });

      if (!resp.data.success) {
        throw new Error(resp.data.message || 'Verification failed');
      }

      setInstructions(null);
      closeModal();
      loadData();
    } catch (err) {
      alert(err.response?.data?.message || 'Verification failed');
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

  return (
    <div className="page-shell">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">E-Wallet</h1>
            <p className="text-gray-600">Top up via PayPal, GCash, or bank transfer. Withdrawable to your bank account.</p>
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
            <p className="mt-3 text-xs text-gray-500">Set your preferred payment method to enable GCash and bank transfer top-ups.</p>
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
            <button type="button" className="absolute right-4 top-4 text-gray-400 hover:text-gray-600" onClick={closeModal}>
              ×
            </button>

            {modal === 'topup' && (
              <div className="space-y-4">
                <h2 className="text-lg font-bold text-gray-900 mb-4">Top Up Wallet</h2>
                {!instructions && (
                  <div>
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
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">Payment Method</label>
                      <div className="grid grid-cols-3 gap-2">
                        {PAYMENT_METHODS.map((m) => (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => setTopupMethod(m.id)}
                            className={`px-3 py-2 rounded-lg text-sm font-medium border transition ${topupMethod === m.id ? `${m.color} text-white border-${m.color.replace('bg-', '')}` : 'bg-gray-50 text-gray-700 border-gray-200'}`}
                          >
                            {m.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    {instructions && instructions.requiresSetup && (
                      <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                        {instructions.error}
                      </div>
                    )}
                    <div className="flex gap-3">
                      <button type="button" className="btn-secondary flex-1" onClick={closeModal}>Cancel</button>
                      <button type="button" className="btn-primary flex-1" onClick={handleTopUp} disabled={captureLoading}>
                        {captureLoading ? 'Creating...' : 'Continue to Payment'}
                      </button>
                    </div>
                  </div>
                )}
                {instructions && !instructions.requiresSetup && (
                  <div className="space-y-4">
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-sm text-blue-800"><strong>Reference:</strong> {instructions.reference}</p>
                      <p className="text-sm text-blue-800"><strong>Amount:</strong> Php {instructions.amount.toFixed(2)}</p>
                      <p className="text-sm text-blue-800">{instructions.instructions}</p>
                    </div>
                    {instructions.paymentMethod === 'gcash' && (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(instructions.gcashNumber || '');
                            alert('GCash number copied to clipboard');
                          }}
                          className="flex-1 bg-green-100 text-green-700 text-sm px-4 py-2 rounded-lg font-medium"
                        >
                          <Smartphone className="w-4 h-4 mr-2" /> Copy GCash Number
                        </button>
                      </div>
                    )}
                    {instructions.paymentMethod === 'bank_transfer' && (
                      <div className="space-y-2">
                        <p className="text-sm text-gray-700"><strong>Bank:</strong> {instructions.bankName}</p>
                        <p className="text-sm text-gray-700"><strong>Account Name:</strong> {instructions.bankAccountName}</p>
                        <p className="text-sm text-gray-700"><strong>Account Number:</strong> {instructions.bankAccountNumber}</p>
                      </div>
                    )}
                    <form onSubmit={handleCapture} className="space-y-4">
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">Confirmation Code (optional)</label>
                        <input
                          name="confirmCode"
                          type="text"
                          className="input-field"
                          placeholder="Enter reference or confirmation code"
                        />
                      </div>
                      <button type="submit" className="w-full btn-primary" disabled={captureLoading}>
                        {captureLoading ? 'Verifying...' : 'I Have Completed the Payment'}
                      </button>
                    </form>
                    <div className="flex gap-3">
                      <button type="button" className="btn-secondary flex-1" onClick={() => setInstructions(null)}>Back</button>
                    </div>
                  </div>
                )}
              </div>
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
