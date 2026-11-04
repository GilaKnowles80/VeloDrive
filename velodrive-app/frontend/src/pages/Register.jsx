import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { Mail, Lock, User as UserIcon, Phone, MapPin } from 'lucide-react';

const Register = () => {
  const [formData, setFormData] = useState({
    role: 'renter', firstName: '', lastName: '', email: '', password: '',
    phone: '', address: '', gdprConsent: false
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const { data } = await api.post('/auth/register', formData);
      const userWithoutPassword = { ...data.user };
      delete userWithoutPassword.password;
      login(userWithoutPassword, data.tokens.accessToken, data.tokens.refreshToken);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed');
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow-sm border border-gray-200 p-8">
        <div className="text-center mb-8">
          <div className="bg-blue-600 p-3 rounded-lg inline-block mb-4">
            <UserIcon className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Create Account</h2>
          <p className="text-gray-600">Join VeloDrive today</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Register As</label>
            <select className="input-field" value={formData.role} onChange={(e) => setFormData({...formData, role: e.target.value})}>
              <option value="owner">Vehicle Owner</option>
              <option value="renter">Renter</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">First Name</label>
              <input className="input-field" type="text" value={formData.firstName} onChange={(e)=>setFormData({...formData, firstName:e.target.value})} required />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Last Name</label>
              <input className="input-field" type="text" value={formData.lastName} onChange={(e)=>setFormData({...formData, lastName:e.target.value})} required />
            </div>
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Email</label>
            <div className="relative"><Mail className="absolute left-3 top-3 w-4 h-4 text-gray-400"/><input className="input-field pl-10" type="email" value={formData.email} onChange={(e)=>setFormData({...formData, email:e.target.value})} required /></div>
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Phone</label>
            <div className="relative"><Phone className="absolute left-3 top-3 w-4 h-4 text-gray-400"/><input className="input-field pl-10" type="tel" value={formData.phone} onChange={(e)=>setFormData({...formData, phone:e.target.value})} required /></div>
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Address</label>
            <div className="relative"><MapPin className="absolute left-3 top-3 w-4 h-4 text-gray-400"/><input className="input-field pl-10" type="text" value={formData.address} onChange={(e)=>setFormData({...formData, address:e.target.value})} required /></div>
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Password</label>
            <div className="relative"><Lock className="absolute left-3 top-3 w-4 h-4 text-gray-400"/><input className="input-field pl-10" type="password" value={formData.password} onChange={(e)=>setFormData({...formData, password:e.target.value})} placeholder="Min 8 chars" required /></div>
            <p className="text-xs text-gray-500">Owners: Php 1,000/month fee + 10% commission per booking.</p>
          </div>
          <div className="flex items-start gap-2">
            <input type="checkbox" checked={formData.gdprConsent} onChange={(e)=>setFormData({...formData, gdprConsent:e.target.checked})} className="mt-1" required />
            <label className="text-sm text-gray-600 leading-relaxed">I consent to VeloDrive processing my personal data per <a href="/privacy" className="text-blue-600 underline">GDPR Privacy Policy</a>.</label>
          </div>
          <button type="submit" className="btn-primary w-full disabled:opacity-50" disabled={loading}>
            {loading ? 'Creating...' : 'Create Account'}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-gray-600">Already have an account? <Link to="/login" className="text-blue-600 underline font-medium">Sign in</Link></p>
      </div>
    </div>
  );
};

export default Register;