import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { Eye, EyeOff } from 'lucide-react';

const OTP_EXPIRES_SEC = 10 * 60;

const formatCountdown = (s) => {
  const m = Math.floor(Math.max(0, s) / 60);
  const sec = Math.max(0, s) % 60;
  return `${m}:${String(sec).padStart(2, '0')}`;
};

const Register = () => {
  const [step, setStep] = useState('register'); // 'register' or 'verify'
  const [formData, setFormData] = useState({
    firstName: '', lastName: '', email: '', phone: '', address: '', password: '', confirmPassword: '', role: 'renter', gdprConsent: false,
  });
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [otpExpiresIn, setOtpExpiresIn] = useState(0);
  const [retryAfter, setRetryAfter] = useState(0);
  const [resending, setResending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (step !== 'verify' || otpExpiresIn <= 0) return;
    const t = setInterval(() => setOtpExpiresIn((s) => (s <= 1 ? 0 : s - 1)), 1000);
    return () => clearInterval(t);
  }, [step, otpExpiresIn]);

  useEffect(() => {
    if (retryAfter <= 0) return;
    const t = setInterval(() => setRetryAfter((s) => (s <= 1 ? 0 : s - 1)), 1000);
    return () => clearInterval(t);
  }, [retryAfter]);

  const dashboardFor = (role) => (role === 'admin' ? '/admin/dashboard' : role === 'owner' ? '/owner/dashboard' : '/renter/dashboard');

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    if (!formData.gdprConsent) {
      setError('GDPR consent is required to register.');
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      setError('Password and Confirm Password do not match.');
      return;
    }
    try {
      const res = await api.post('/auth/register', {
        role: formData.role,
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
        phone: formData.phone.trim(),
        address: formData.address.trim(),
        gdprConsent: true,
      });
      const data = res.data || {};
      if (data.emailSent === false) {
        setError(data.message || 'Account created, but the verification email could not be sent. Use "Resend code".');
      } else {
        setMessage((data.message || 'Verification code sent to your email!') + ' Expires in 10 minutes. Max 3 codes per 10 minutes.');
      }
      if (data.devOtp) setOtp(String(data.devOtp));
      setOtpExpiresIn(OTP_EXPIRES_SEC);
      setRetryAfter(0);
      setStep('verify');
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed');
    }
  };

  const handleResendOTP = async () => {
    if (retryAfter > 0) return;
    setError('');
    setMessage('');
    setResending(true);
    try {
      const res = await api.post('/auth/resend-otp', { email: formData.email.trim().toLowerCase() });
      const data = res.data || {};
      setMessage(data.message || 'A new verification code was sent. Expires in 10 minutes.');
      if (data.devOtp) setOtp(String(data.devOtp));
      setOtpExpiresIn(OTP_EXPIRES_SEC);
      setRetryAfter(0);
    } catch (err) {
      const data = err.response?.data || {};
      setError(data.message || 'Could not resend code. Please try again.');
      if (err.response?.status === 429 && data.retryAfterSec) setRetryAfter(Number(data.retryAfterSec) || 0);
    } finally {
      setResending(false);
    }
  };

  const handleVerifySubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    try {
      const res = await api.post('/auth/verify-otp', {
        email: formData.email.trim().toLowerCase(),
        otp: String(otp || '').trim(),
      });
      const data = res.data || {};
      if (data.user && data.tokens) {
        login(data.user, data.tokens.accessToken, data.tokens.refreshToken);
        navigate(dashboardFor(data.user.role));
        return;
      }
      setMessage('Email verified. Please sign in.');
    } catch (err) {
      setError(err.response?.data?.message || 'OTP verification failed');
    }
  };

  return (
    <div className="page-shell py-10 px-4"><div className="max-w-md mx-auto p-8 bg-white/95 backdrop-blur border border-slate-200 rounded-2xl shadow-sm">
      <h2 className="text-2xl font-black text-slate-900 mb-6 text-center">
        {step === 'register' ? 'Create an Account' : 'Enter Verification Code'}
      </h2>

      {error && <div className="mb-4 p-3 bg-red-50 text-red-600 text-xs rounded-xl font-medium">{error}</div>}
      {message && <div className="mb-4 p-3 bg-emerald-50 text-emerald-600 text-xs rounded-xl font-medium">{message}</div>}

      {step === 'register' ? (
        <form onSubmit={handleRegisterSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">First Name</label>
              <input type="text" autoComplete="given-name" value={formData.firstName} onChange={(e) => setFormData({ ...formData, firstName: e.target.value })} required className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-sky-500" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Last Name</label>
              <input type="text" autoComplete="family-name" value={formData.lastName} onChange={(e) => setFormData({ ...formData, lastName: e.target.value })} required className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-sky-500" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Email Address</label>
            <input type="email" autoComplete="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} required className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-sky-500" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Phone</label>
            <input type="tel" autoComplete="tel" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} required className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-sky-500" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Address</label>
            <input type="text" autoComplete="street-address" value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} required className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-sky-500" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
                className="w-full px-4 py-2 pl-10 pr-10 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-sky-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Confirm Password</label>
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                required
                className="w-full px-4 py-2 pl-10 pr-10 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-sky-500"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((prev) => !prev)}
                className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Account Role</label>
            <select value={formData.role} onChange={(e) => setFormData({ ...formData, role: e.target.value })} className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:border-sky-500">
              <option value="renter">Renter</option>
              <option value="owner">Vehicle Owner</option>
            </select>
            <p className="text-[11px] text-slate-500 mt-1">
              Admin accounts are provisioned separately. Existing admins should{' '}
              <Link to="/login" className="text-sky-600 font-semibold hover:underline">sign in here</Link>.
            </p>
          </div>
          <label className="flex items-start gap-2 text-xs text-slate-600">
            <input type="checkbox" checked={formData.gdprConsent} onChange={(e) => setFormData({ ...formData, gdprConsent: e.target.checked })} required />
            <span>I consent to data processing as required for account creation (GDPR).</span>
          </label>
          <button type="submit" className="w-full py-3 bg-sky-600 hover:bg-sky-700 text-white font-extrabold rounded-xl transition cursor-pointer text-sm">
            Register & Send OTP
          </button>
        </form>
      ) : (
        <form onSubmit={handleVerifySubmit} className="space-y-4">
          <p className="text-xs text-slate-500 text-center mb-2">
            We've sent a 6-digit verification code to <span className="font-bold text-slate-800">{formData.email}</span>.
          </p>
          <div className="rounded-xl bg-sky-50 border border-sky-100 px-3 py-2 text-xs text-sky-800 space-y-1">
            <div>Code expires in <strong>{otpExpiresIn > 0 ? formatCountdown(otpExpiresIn) : '0:00'}</strong> (10 minutes). Use the latest code.</div>
            <div>Resend limit: <strong>max 3 codes per 10 minutes</strong>.{retryAfter > 0 ? ` Try again in ${formatCountdown(retryAfter)}.` : ''}</div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">6-Digit OTP Code</label>
            <input 
              type="text" 
              name="otp"
              autoComplete="one-time-code"
              inputMode="numeric"
              maxLength="6"
              value={otp} 
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))} 
              required 
              placeholder="123456"
              className="w-full px-4 py-3 text-center tracking-widest text-lg border border-slate-200 rounded-xl focus:outline-none focus:border-sky-500"
            />
          </div>
          <button 
            type="submit" 
            className="w-full py-3 bg-sky-600 hover:bg-sky-700 text-white font-extrabold rounded-xl transition cursor-pointer text-sm"
          >
            Verify Email
          </button>
          <button type="button" onClick={handleResendOTP} disabled={resending || retryAfter > 0} className="w-full py-2 text-sky-700 font-bold text-sm hover:underline disabled:opacity-50 disabled:cursor-not-allowed">
            {resending ? 'Sending...' : retryAfter > 0 ? `Send available in ${formatCountdown(retryAfter)}` : 'Send code'}
          </button>
        </form>
      )}
      <p className="text-xs text-slate-500 text-center mt-6">
        Already have an account?{' '}
        <Link to="/login" className="text-sky-600 font-bold hover:underline">Login here</Link>{' '}
        | <Link to="/forgot-password" className="text-sky-600 font-bold hover:underline">Forgot Password?</Link>
      </p>
    </div>
  </div>
  );
};

export default Register;
