import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { User, Mail, Phone, MapPin, Banknote, ShieldAlert } from 'lucide-react';

const Profile = () => {
  const { user, updateUser } = useAuth();
  const [formData, setFormData] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    email: user?.email || '',
    phone: user?.phone || '',
    address: user?.address || '',
    bankAccountName: user?.bankAccountName || '',
    bankAccountNumber: user?.bankAccountNumber || '',
    bankName: user?.bankName || ''
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (user) {
      setFormData({
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        email: user.email || '',
        phone: user.phone || '',
        address: user.address || '',
        bankAccountName: user.bankAccountName || '',
        bankAccountNumber: user.bankAccountNumber || '',
        bankName: user.bankName || ''
      });
    }
  }, [user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    try {
      const resp = await api.put('/users/profile', {
        firstName: formData.firstName,
        lastName: formData.lastName,
        phone: formData.phone,
        address: formData.address,
        bankAccountName: formData.bankAccountName,
        bankAccountNumber: formData.bankAccountNumber,
        bankName: formData.bankName
      });
      updateUser(resp.data.user);
      setMessage('Profile updated successfully');
    } catch (err) {
      setMessage(err.response?.data?.message || 'Update failed');
    } finally {
      setLoading(false);
    }
  };

  const fields = [
    { label: 'First Name', name: 'firstName', icon: User },
    { label: 'Last Name', name: 'lastName', icon: User },
    { label: 'Email', name: 'email', icon: Mail, type: 'email' },
    { label: 'Phone', name: 'phone', icon: Phone, type: 'tel' },
    { label: 'Address', name: 'address', icon: MapPin },
    { label: 'Bank Account Name', name: 'bankAccountName', icon: Banknote },
    { label: 'Bank Account Number', name: 'bankAccountNumber', icon: Banknote },
    { label: 'Bank Name', name: 'bankName', icon: Banknote }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Profile Settings</h1>
        {message && (
          <div className="mb-4 p-3 rounded-lg {message.includes('successfully') ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'} text-sm">
            {message}
          </div>
        )}
        <form onSubmit={handleSubmit} className="card space-y-4">
          {fields.map((f) => (
            <div key={f.name} className="space-y-2">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <f.icon className="w-4 h-4 text-gray-400" /> {f.label}
              </label>
              <input
                className="input-field"
                type={f.type || 'text'}
                value={formData[f.name]}
                onChange={(e) => setFormData({...formData, [f.name]: e.target.value})}
              />
            </div>
          ))}
          <button type="submit" className="btn-primary w-full disabled:opacity-50" disabled={loading}>
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
        </form>

        <div className="mt-8 card p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <ShieldAlert className="w-5 h-5" /> GDPR Data Rights
          </h2>
          <p className="text-sm text-gray-600 mb-4">
            Under GDPR, you have the right to access, export, and erase your personal data.
          </p>
          <div className="space-y-2">
            <button
              onClick={() => {
                if(confirm('Export all your personal data?')) {
                  api.get('/users/gdpr/export').then(r => {
                    const blob = new Blob([JSON.stringify(r.data, null, 2)], {type: 'application/json'});
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url; a.download = 'veodrive-my-data.json'; a.click();
                  });
                }
              }}
              className="w-full btn-secondary text-sm"
            >
              Export My Data (JSON)
            </button>
            <button
              onClick={() => {
                if(confirm('PERMANENTLY erase all your data? This cannot be undone.')) {
                  api.delete('/users/gdpr/erase').then(() => {
                    alert('Your data has been erased.');
                    localStorage.clear();
                    window.location.href = '/login';
                  });
                }
              }}
              className="w-full btn-danger text-sm"
            >
              Erase My Data (Right to be Forgotten)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;