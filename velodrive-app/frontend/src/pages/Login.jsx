import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { Mail, Lock, User as UserIcon, KeyRound } from 'lucide-react';

const Login = () => {
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [otp, setOtp] = useState('');
  const [needsVerify, setNeedsVerify] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const response = await api.post('/auth/login', {
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
      });
      const { user, tokens } = response.data;
      login(user, tokens.accessToken, tokens.refreshToken);
      if (user?.role === 'admin') navigate('/admin/dashboard');
      else if (user?.role === 'owner') navigate('/owner/dashboard');
      else navigate('/renter/dashboard');
    } catch (err) {
      const msg = err.response?.data?.message || 'Login failed';
      setError(msg);
      if (/verify|otp|verification/i.test(msg)) setNeedsVerify(true);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const res = await api.post('/auth/verify-otp', {
        email: formData.email.trim().toLowerCase(),
        otp: otp.trim(),
      });
      const { user, tokens } = res.data;
      if (user && tokens) {
        login(user, tokens.accessToken, tokens.refreshToken);
        if (user?.role === 'admin') navigate('/admin/dashboard');
        else if (user?.role === 'owner') navigate('/owner/dashboard');
        else navigate('/renter/dashboard');
        return;
      }
      setMessage('Email verified. Please sign in.');
      setNeedsVerify(false);
    } catch (err) {
      setError(err.response?.data?.message || 'OTP verification failed');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setResending(true);
    setError('');
    setMessage('');
    try {
      const res = await api.post('/auth/resend-otp', { email: formData.email.trim().toLowerCase() });
      setMessage(res.data?.message || 'A new verification code was sent.');
      setNeedsVerify(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not resend code.');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="w-full max-w-md p-6 bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="text-center mb-8">
          <div className="bg-blue-600 p-3 rounded-lg inline-block mb-4">
            <UserIcon className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Welcome back</h2>
          <p className="text-gray-600">Sign in to your VeloDrive account</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}
          {message && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-lg text-sm">
              {message}
            </div>
          )}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
              <input
                type="email"
                name="email"
                className="input-field pl-10"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="you@example.com"
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
              <input
                type="password"
                name="password"
                className="input-field pl-10"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="••••••••"
                required
              />
            </div>
          </div>
          <button
            type="submit"
            className="btn-primary w-full disabled:opacity-50"
            disabled={loading}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        {needsVerify && (
          <form onSubmit={handleVerifyOtp} className="mt-4 space-y-3 border-t border-gray-200 pt-4">
            <p className="text-sm text-gray-700 font-medium">Verify your email to continue</p>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">6-Digit OTP Code</label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  className="input-field pl-10 tracking-widest"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  placeholder="123456"
                  required
                />
              </div>
            </div>
            <button type="submit" className="btn-primary w-full disabled:opacity-50" disabled={loading || otp.length < 6}>
              {loading ? 'Verifying...' : 'Verify Email'}
            </button>
            <button type="button" onClick={handleResendOtp} disabled={resending} className="w-full text-sm text-blue-600 font-medium hover:underline disabled:opacity-50">
              {resending ? 'Sending...' : 'Resend code'}
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-gray-600">
          Don't have an account?{' '}
          <Link to="/register" className="text-blue-600 hover:text-blue-500 font-medium">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Login;