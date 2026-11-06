import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

const Register = () => {
  const [step, setStep] = useState('register'); // 'register' or 'verify'
  const [formData, setFormData] = useState({
    firstName: '', lastName: '', email: '', phone: '', address: '', password: '', role: 'renter', gdprConsent: false,
  });
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const { loginWithCredentials } = useAuth();
  const navigate = useNavigate();

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    if (!formData.gdprConsent) {
      setError('GDPR consent is required to register.');
      return;
    }
    try {
      await api.post('/auth/register', {
        role: formData.role,
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        email: formData.email.trim(),
        password: formData.password,
        phone: formData.phone.trim(),
        address: formData.address.trim(),
        gdprConsent: true,
      });

      setMessage('Verification code sent to your email!');
      setStep('verify'); // Switch to OTP verification input view
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed');
    }
  };

  const handleVerifySubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    try {
      const res = await api.post('/auth/verify-otp', {
        email: formData.email,
        otp
      });
      const data = res.data;

      if (data.tokens) {
        await loginWithCredentials(data.user, data.tokens.accessToken, data.tokens.refreshToken);
      }

      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'OTP verification failed');
    }
  };

  return (
    <div className="max-w-md mx-auto mt-20 p-8 bg-white border border-slate-200 rounded-2xl shadow-sm">
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
              <input type="text" value={formData.firstName} onChange={(e) => setFormData({ ...formData, firstName: e.target.value })} required className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-sky-500" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Last Name</label>
              <input type="text" value={formData.lastName} onChange={(e) => setFormData({ ...formData, lastName: e.target.value })} required className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-sky-500" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Email Address</label>
            <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} required className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-sky-500" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Phone</label>
            <input type="tel" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} required className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-sky-500" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Address</label>
            <input type="text" value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} required className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-sky-500" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Password</label>
            <input type="password" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} required className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-sky-500" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Account Role</label>
            <select value={formData.role} onChange={(e) => setFormData({ ...formData, role: e.target.value })} className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:border-sky-500">
              <option value="renter">Renter</option>
              <option value="owner">Vehicle Owner</option>
            </select>
            <p className="text-[11px] text-slate-500 mt-1">Admin accounts are created by the system administrator.</p>
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
          <p className="text-xs text-slate-500 text-center mb-4">
            We've sent a 6-digit verification code to <span className="font-bold text-slate-800">{formData.email}</span>.
          </p>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">6-Digit OTP Code</label>
            <input 
              type="text" 
              maxLength="6"
              value={otp} 
              onChange={(e) => setOtp(e.target.value)} 
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
        </form>
      )}

      <p className="text-xs text-slate-500 text-center mt-6">
        Already have an account? <Link to="/login" className="text-sky-600 font-bold hover:underline">Login here</Link>
      </p>
    </div>
  );
};

export default Register;