import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Wallet, Users, Mail, Lock, KeyRound, Clock } from 'lucide-react';
import logo from '../assets/logo.jpg';
import VehicleTypesFilter from '../components/VehicleTypesFilter';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

const OTP_EXPIRES_SEC = 10 * 60;
const formatCountdown = (s) => `${Math.floor(Math.max(0, s) / 60)}:${String(Math.max(0, s) % 60).padStart(2, '0')}`;

const Home = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [otp, setOtp] = useState('');
  const [needsVerify, setNeedsVerify] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [otpExpiresIn, setOtpExpiresIn] = useState(0);
  const [retryAfter, setRetryAfter] = useState(0);

  useEffect(() => { if (otpExpiresIn > 0) { const t = setInterval(() => setOtpExpiresIn((s) => (s <= 1 ? 0 : s - 1)), 1000); return () => clearInterval(t); } }, [otpExpiresIn]);
  useEffect(() => { if (retryAfter > 0) { const t = setInterval(() => setRetryAfter((s) => (s <= 1 ? 0 : s - 1)), 1000); return () => clearInterval(t); } }, [retryAfter]);

  const goDashboard = (user) => {
    if (user?.role === 'admin') navigate('/admin/dashboard');
    else if (user?.role === 'owner') navigate('/owner/dashboard');
    else navigate('/renter/dashboard');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError(''); setMessage('');
    try {
      const response = await api.post('/auth/login', { email: formData.email.trim().toLowerCase(), password: formData.password });
      const { user, tokens } = response.data;
      login(user, tokens.accessToken, tokens.refreshToken);
      goDashboard(user);
    } catch (err) {
      const msg = err.response?.data?.message || 'Login failed';
      setError(msg);
      if (/verify|otp|verification/i.test(msg)) { setNeedsVerify(true); if (otpExpiresIn <= 0) setOtpExpiresIn(OTP_EXPIRES_SEC); }
    } finally { setLoading(false); }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setLoading(true); setError(''); setMessage('');
    try {
      const res = await api.post('/auth/verify-otp', { email: formData.email.trim().toLowerCase(), otp: otp.trim() });
      const { user, tokens } = res.data;
      if (user && tokens) { login(user, tokens.accessToken, tokens.refreshToken); goDashboard(user); return; }
      setMessage('Email verified. Please sign in.'); setNeedsVerify(false);
    } catch (err) { setError(err.response?.data?.message || 'OTP verification failed'); }
    finally { setLoading(false); }
  };

  const handleResendOtp = async () => {
    if (retryAfter > 0) return;
    setResending(true); setError(''); setMessage('');
    try {
      const res = await api.post('/auth/resend-otp', { email: formData.email.trim().toLowerCase() });
      setMessage(res.data?.message || 'A new verification code was sent. Code expires in 10 minutes.');
      setNeedsVerify(true); setOtpExpiresIn(OTP_EXPIRES_SEC); setRetryAfter(0);
    } catch (err) {
      const data = err.response?.data || {};
      setError(data.message || 'Could not resend code.');
      if (err.response?.status === 429 && data.retryAfterSec) setRetryAfter(Number(data.retryAfterSec) || 0);
    } finally { setResending(false); }
  };

  return (
  <div className="page-shell">
    <section className="relative overflow-hidden text-white py-20 px-4">
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-blue-900 to-sky-700" />
      <div className="absolute inset-0 opacity-30" style={{ backgroundImage: 'radial-gradient(circle at 20% 20%, rgba(255,255,255,.25), transparent 35%), radial-gradient(circle at 80% 0%, rgba(56,189,248,.35), transparent 30%)' }} />
      <div className="relative max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          <div className="text-center lg:text-left pt-4">
            <img src={logo} alt="VeloDrive Logo" className="w-20 h-20 mx-auto lg:mx-0 mb-6 object-contain rounded-xl bg-white/10 p-1" />
            <h1 className="text-4xl md:text-6xl font-bold mb-6">Velo<span className="text-sky-300">Drive</span></h1>
            <p className="text-lg md:text-xl text-blue-100 mb-8 max-w-2xl mx-auto lg:mx-0 leading-relaxed">
              VeloDrive: A peer-to-peer (P2P) vehicle rental and ride-hailing hybrid marketplace. Self-drive and hire-a-driver services.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start flex-wrap">
              <Link to="/register?role=owner" className="bg-sky-500 hover:bg-sky-400 text-white px-6 py-3 rounded-lg font-semibold transition text-center">Vehicles Owner</Link>
              <Link to="/register?role=renter" className="bg-white/10 hover:bg-white/20 text-white px-6 py-3 rounded-lg border border-white/30 transition text-center">Renter Sign Up</Link>
            </div>
          </div>

          <div id="signin" className="w-full max-w-md mx-auto lg:ml-auto bg-white/95 backdrop-blur rounded-2xl shadow-xl border border-white/20 p-6 text-gray-900">
            <h2 className="text-xl font-bold mb-1">Sign in</h2>
            <p className="text-sm text-gray-600 mb-4">Admin, Vehicle Owner, or Renter — use your account credentials.</p>
            {error && <div className="mb-3 bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">{error}</div>}
            {message && <div className="mb-3 bg-emerald-50 border border-emerald-200 text-emerald-700 px-3 py-2 rounded-lg text-sm">{message}</div>}
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                <div className="relative"><Mail className="absolute left-3 top-3 w-4 h-4 text-gray-400" /><input type="email" autoComplete="username email" className="input-field pl-10" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder="you@example.com" required /></div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <div className="relative"><Lock className="absolute left-3 top-3 w-4 h-4 text-gray-400" /><input type="password" autoComplete="current-password" className="input-field pl-10" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} placeholder="••••••••" required /></div>
              </div>
              <button type="submit" className="btn-primary w-full disabled:opacity-50" disabled={loading}>{loading ? 'Signing in...' : 'Sign In'}</button>
            </form>
            {needsVerify && (
              <form onSubmit={handleVerifyOtp} className="mt-4 space-y-3 border-t border-gray-200 pt-4">
                <p className="text-sm font-semibold text-gray-800">Verify your email</p>
                <div className="rounded-lg bg-sky-50 border border-sky-100 px-3 py-2 text-xs text-sky-800 space-y-1">
                  <div className="flex items-center gap-2"><Clock className="w-4 h-4" /><span>Expires in <strong>{otpExpiresIn > 0 ? formatCountdown(otpExpiresIn) : '0:00'}</strong> (10 min).</span></div>
                  <div>Max <strong>3 codes / 10 minutes</strong>.{retryAfter > 0 ? ` Try again in ${formatCountdown(retryAfter)}.` : ''}</div>
                </div>
                <div className="relative"><KeyRound className="absolute left-3 top-3 w-4 h-4 text-gray-400" /><input type="text" name="otp" autoComplete="one-time-code" inputMode="numeric" maxLength={6} className="input-field pl-10 tracking-widest" value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))} placeholder="123456" required /></div>
                <button type="submit" className="btn-primary w-full disabled:opacity-50" disabled={loading || otp.length < 6}>{loading ? 'Verifying...' : 'Verify Email'}</button>
                <button type="button" onClick={handleResendOtp} disabled={resending || retryAfter > 0} className="w-full text-sm text-blue-600 font-medium hover:underline disabled:opacity-50">{resending ? 'Sending...' : retryAfter > 0 ? `Resend in ${formatCountdown(retryAfter)}` : 'Resend code'}</button>
              </form>
            )}
            <p className="mt-4 text-center text-sm text-gray-600">No account? <Link to="/register" className="text-blue-600 font-medium">Create one</Link></p>
          </div>
        </div>
      </div>
    </section>

    {/* Interactive Supported Vehicle Types Filter & Showcase */}
    <section className="py-16 px-4 bg-white/70 backdrop-blur-sm">
      <VehicleTypesFilter />
    </section>

    <section className="py-16 px-4">
      <div className="max-w-7xl mx-auto">
        <h2 className="text-3xl font-bold text-gray-900 text-center mb-12">How It Works</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { icon: Users, title: 'Register & Verify', desc: 'Owners and renters register with ID, license, and documents. GDPR consent required.' },
            { icon: Wallet, title: 'List or Browse Vehicles', desc: 'Owners list vehicles with certificates, specs, price/day, and marketing ads.' },
            { icon: Wallet, title: 'Book & Pay via Escrow', desc: 'Renters book; payment held in escrow. Split: 90% owner, 10% admin commission.' }
          ].map((item, i) => (
            <div key={i} className="card text-center p-8 bg-white/90 backdrop-blur rounded-xl shadow-sm border border-gray-200">
              <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4 text-blue-600">
                <item.icon className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">{item.title}</h3>
              <p className="text-gray-600 text-sm">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>

    <section className="py-16 px-4 bg-white/40">
      <div className="max-w-7xl mx-auto">
        <h2 className="text-3xl font-bold text-gray-900 text-center mb-12">Platform Fees</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-center">
          <div className="card p-8 bg-white/90 backdrop-blur rounded-xl shadow-sm border border-gray-200">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Vehicle Owner Membership</h3>
            <p className="text-gray-600 mb-4">Php 2,500/year one-time subscription fee. Charged once per year when you register as a vehicle owner, regardless of how many vehicles you own.</p>
            <div className="bg-blue-50 p-4 rounded-lg">
              <p className="text-sm text-blue-800">Paid via PayPal QR Code, PayPal Payment Link, or PayPal Subscription.</p>
            </div>
          </div>
          <div className="card p-8 bg-white/90 backdrop-blur rounded-xl shadow-sm border border-gray-200">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Service Charge per Booking</h3>
            <p className="text-gray-600 mb-4">Php 250 flat service charge deducted from each rental payment. Paid via PayPal wallet, QR code, or payment link.</p>
            <div className="bg-green-50 p-4 rounded-lg">
              <p className="text-sm text-green-800">Owner receives: Rental amount − Php 250 service charge. Admin receives: Php 250 service charge.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
  );
};

export default Home;
