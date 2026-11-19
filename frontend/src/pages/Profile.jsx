import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { User, Mail, Phone, MapPin, Banknote, ShieldAlert } from 'lucide-react';

const Profile = () => {
  const { user, updateUser } = useAuth();
  const [formData, setFormData] = useState({
    firstName: '', lastName: '', email: '', phone: '', address: '',
    bankAccountName: '', bankAccountNumber: '', bankName: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const syncFromUser = (u) => ({
    firstName: u?.firstName || '',
    lastName: u?.lastName || '',
    email: u?.email || '',
    phone: u?.phone || '',
    address: u?.address || '',
    bankAccountName: u?.bankAccountName || '',
    bankAccountNumber: u?.bankAccountNumber || '',
    bankName: u?.bankName || '',
  });

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const resp = await api.get('/auth/me');
        if (!alive) return;
        if (resp.data?.user) {
          updateUser(resp.data.user);
          setFormData(syncFromUser(resp.data.user));
        } else if (user) {
          setFormData(syncFromUser(user));
        }
      } catch {
        if (alive && user) setFormData(syncFromUser(user));
      } finally {
        if (alive) setLoading(false);
      }
    };
    load();
    return () => { alive = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    setError('');
    try {
      const resp = await api.put('/users/profile', {
        firstName: formData.firstName,
        lastName: formData.lastName,
        phone: formData.phone,
        address: formData.address,
        bankAccountName: formData.bankAccountName,
        bankAccountNumber: formData.bankAccountNumber,
        bankName: formData.bankName,
      });
      if (resp.data?.user) updateUser(resp.data.user);
      setMessage('Profile updated successfully.');
    } catch (err) {
      setError(err.response?.data?.message || 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  const inputFields = [
    { label: 'First Name', name: 'firstName', icon: User, autoComplete: 'given-name', required: true },
    { label: 'Last Name', name: 'lastName', icon: User, autoComplete: 'family-name', required: true },
    { label: 'Email (account)', name: 'email', icon: Mail, type: 'email', disabled: true, hint: 'Email changes require support verification.' },
    { label: 'Phone', name: 'phone', icon: Phone, type: 'tel', autoComplete: 'tel', required: true },
    { label: 'Address', name: 'address', icon: MapPin, autoComplete: 'street-address', required: true },
    { label: 'Bank Account Name', name: 'bankAccountName', icon: Banknote },
    { label: 'Bank Account Number', name: 'bankAccountNumber', icon: Banknote },
    { label: 'Bank Name', name: 'bankName', icon: Banknote },
  ];

  return (
    <div className="page-shell">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Profile Settings</h1>
        <p className="text-sm text-gray-600 mb-6">Your registration details are shown below and can be edited.</p>
        {loading && <div className="mb-4 p-3 rounded-lg bg-gray-100 text-gray-700 text-sm">Loading profile…</div>}
        {error && <div className="mb-4 p-3 rounded-lg bg-red-100 text-red-700 text-sm">{error}</div>}
        {message && <div className="mb-4 p-3 rounded-lg bg-green-100 text-green-700 text-sm">{message}</div>}
        <form onSubmit={handleSubmit} className="card space-y-4">
          {inputFields.map((f) => (
            <div key={f.name} className="space-y-1">
              <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <f.icon className="w-4 h-4 text-gray-400" /> {f.label}{f.required ? ' *' : ''}
              </label>
              <input
                className={`input-field ${f.disabled ? 'bg-gray-50 text-gray-600 cursor-not-allowed' : ''}`}
                type={f.type || 'text'}
                value={formData[f.name] || ''}
                onChange={(e) => !f.disabled && setFormData({ ...formData, [f.name]: e.target.value })}
                autoComplete={f.autoComplete}
                disabled={f.disabled || loading}
                required={f.required}
              />
              {f.hint && <p className="text-xs text-gray-500">{f.hint}</p>}
            </div>
          ))}
          <button type="submit" className="btn-primary w-full disabled:opacity-50" disabled={saving || loading}>
            {saving ? 'Saving…' : 'Save Changes'}
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