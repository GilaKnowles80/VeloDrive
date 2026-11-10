import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import api from '../utils/api';
import { Car, Wallet, Calendar, Truck, MapPin, Upload, Image as ImageIcon, Trash2, Edit2, Save, Building2 } from 'lucide-react';
import RichTextEditor from '../components/RichTextEditor';
import GPSMap from '../components/GPSMap';

const API_ORIGIN = import.meta.env.VITE_API_ORIGIN || '';
const assetUrl = (p) => {
  if (!p) return '';
  if (/^https?:\/\//i.test(p)) return p;
  const path = String(p).replace(/^src[\\/]/, '').replace(/\\/g, '/');
  return API_ORIGIN ? `${API_ORIGIN}/${path.replace(/^\//, '')}` : `/${path.replace(/^\//, '')}`;
};

const MAX_IMAGES = 10;
const emptyAd = () => ({ file: null, preview: '', description: '' });

const OwnerDashboard = () => {
  const { user, updateUser } = useAuth();
  const [stats, setStats] = useState({ totalVehicles: 0, totalBookings: 0, totalEarnings: 0, pendingBookings: 0 });
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [ads, setAds] = useState([emptyAd()]);
  const [form, setForm] = useState({
    type: 'car', make: '', model: '', year: new Date().getFullYear(), color: '',
    licensePlate: '', vin: '', description: '', pricePerDay: '', adCampaignTitle: '',
  });
  const [docs, setDocs] = useState({ or: null, proofOfOwnership: null, cr: null });
  const docOrRef = useRef(null);
  const docProofRef = useRef(null);
  const docCrRef = useRef(null);

  // Company details state
  const [companyEdit, setCompanyEdit] = useState(false);
  const [companyForm, setCompanyForm] = useState({
    companyName: '', companyAddress: '', contactNumber: '', contactPerson: '', email: '', position: '',
  });
  const [companySaving, setCompanySaving] = useState(false);

  const loadData = async () => {
    try {
      const [vResp, bResp] = await Promise.all([
        api.get('/vehicles/my-vehicles'),
        api.get('/bookings/my-bookings').catch(() => ({ data: { bookings: [] } })),
      ]);
      const v = vResp.data?.vehicles || [];
      const b = bResp.data?.bookings || [];
      setVehicles(v);
      setStats({
        totalVehicles: v.length,
        totalBookings: b.length,
        totalEarnings: b.reduce((sum, x) => sum + parseFloat(x.ownerPayout || 0), 0),
        pendingBookings: b.filter((x) => x.status === 'pending').length,
      });
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const updateVehicleStatus = async (vehicleId, newStatus) => {
    try {
      const resp = await api.put(`/vehicles/${vehicleId}/status`, { status: newStatus });
      if (resp.data?.success) {
        setMsg(`Vehicle status updated to ${newStatus}`);
        loadData();
      }
    } catch (e2) {
      setErr(e2.response?.data?.message || 'Failed to update vehicle status');
    }
  };

  useEffect(() => { loadData(); }, []);

  // Sync company details from user
  useEffect(() => {
    if (user) {
      setCompanyForm({
        companyName: user.companyName || '',
        companyAddress: user.companyAddress || '',
        contactNumber: user.contactNumber || '',
        contactPerson: user.contactPerson || '',
        email: user.email || '',
        position: user.position || '',
      });
    }
  }, [user]);

  const onImagePick = (idx, file) => {
    setErr('');
    if (!file) return;
    if (!/^image\/(png|jpeg)$/.test(file.type)) {
      setErr('Only PNG or JPEG images are allowed.');
      return;
    }
    const next = [...ads];
    if (next[idx]?.preview) URL.revokeObjectURL(next[idx].preview);
    next[idx] = { ...next[idx], file, preview: URL.createObjectURL(file) };
    setAds(next);
  };

  const addSlot = () => { if (ads.length < MAX_IMAGES) setAds([...ads, emptyAd()]); };
  const removeSlot = (idx) => {
    const next = ads.filter((_, i) => i !== idx);
    if (ads[idx]?.preview) URL.revokeObjectURL(ads[idx].preview);
    setAds(next.length ? next : [emptyAd()]);
  };

  const submitVehicleAd = async (e) => {
    e.preventDefault();
    setErr(''); setMsg('');
    const imageCount = ads.filter((a) => a.file).length;
    if (imageCount < 1) { setErr('Upload at least 1 vehicle ad image (PNG/JPEG).'); return; }
    if (!docs.or || !docs.proofOfOwnership || !docs.cr) {
      setErr('OR, Proof of Ownership, and CR are required.');
      return;
    }
    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => fd.append(k, v ?? ''));
    fd.append('folder', 'ads');
    fd.append('adImageDescriptions', JSON.stringify(ads.map((a) => a.description || '')));
    ads.forEach((a) => { if (a.file) fd.append('adImages', a.file); });
    Object.entries(docs).forEach(([k, f]) => { if (f) fd.append(k, f); });
    setSaving(true);
    try {
      await api.post('/vehicles/', fd);
      setMsg('Vehicle ad submitted. It will appear after verification.');
      setForm({ type: 'car', make: '', model: '', year: new Date().getFullYear(), color: '', licensePlate: '', vin: '', description: '', pricePerDay: '', adCampaignTitle: '' });
      setAds([emptyAd()]);
      setDocs({ or: null, proofOfOwnership: null, cr: null });
      loadData();
    } catch (e2) {
      setErr(e2.response?.data?.message || 'Failed to submit vehicle ad.');
    } finally { setSaving(false); }
  };

  const saveCompanyDetails = async (e) => {
    e.preventDefault();
    setCompanySaving(true);
    try {
      const resp = await api.put('/users/profile', {
        companyName: companyForm.companyName,
        companyAddress: companyForm.companyAddress,
        contactNumber: companyForm.contactNumber,
        contactPerson: companyForm.contactPerson,
        position: companyForm.position,
      });
      if (resp.data?.user) {
        updateUser(resp.data.user);
        setCompanyEdit(false);
        setMsg('Company details updated.');
      }
    } catch (e2) {
      setErr(e2.response?.data?.message || 'Failed to update company details.');
    } finally { setCompanySaving(false); }
  };

  const renderVehicleImages = (v) => {
    let imgs = [];
    try { imgs = typeof v.adImages === 'string' ? JSON.parse(v.adImages) : (v.adImages || []); } catch { /* keep empty */ }
    if (!imgs.length && v.adCampaignImage) imgs = [v.adCampaignImage];
    return imgs;
  };

  return (
    <div className="page-shell">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Owner Dashboard</h1>
            <p className="text-gray-600">Manage your vehicles, ads, and rentals</p>
          </div>
          <Link to="/profile" className="mt-4 md:mt-0 px-3 py-1 bg-blue-100 text-blue-700 text-xs rounded-full font-medium hover:bg-blue-200 inline-block" title="Edit your profile">
            {user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email : 'Guest'}
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {[
            { label: 'Vehicles', icon: Car, value: stats.totalVehicles },
            { label: 'Bookings', icon: Calendar, value: stats.totalBookings },
            { label: 'Earnings (PHP)', icon: Wallet, value: stats.totalEarnings },
            { label: 'Pending', icon: Truck, value: stats.pendingBookings },
          ].map((stat, i) => (
            <div key={i} className="card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 uppercase tracking-wider">{stat.label}</p>
                  <p className="text-3xl font-bold text-gray-900">{stat.value}</p>
                </div>
                <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center text-gray-500">
                  <stat.icon className="w-5 h-5" />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Company Details Section */}
        <div className="card mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Building2 className="w-5 h-5" /> Company Details
              </h2>
              <p className="text-sm text-gray-500">Your business information shown to renters alongside your vehicle listings.</p>
            </div>
            {!companyEdit && (
              <button
                onClick={() => setCompanyEdit(true)}
                className="px-3 py-1.5 text-xs bg-blue-100 text-blue-700 rounded-lg font-medium hover:bg-blue-200 flex items-center gap-1"
              >
                <Edit2 className="w-3 h-3" /> Edit
              </button>
            )}
          </div>

          {companyEdit ? (
            <form onSubmit={saveCompanyDetails} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="md:col-span-2 space-y-2">
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-700">Company Name</label>
                    <input
                      className="input-field"
                      value={companyForm.companyName}
                      onChange={(e) => setCompanyForm({ ...companyForm, companyName: e.target.value })}
                      placeholder="e.g., Sample Vehicle Rentals"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-700">Company Address</label>
                    <input
                      className="input-field"
                      value={companyForm.companyAddress}
                      onChange={(e) => setCompanyForm({ ...companyForm, companyAddress: e.target.value })}
                      placeholder="e.g., 123 Main Street, Metro Manila, Philippines"
                    />
                  </div>
                </div>
                <div className="md:col-span-1 space-y-2">
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-700">Contact Person</label>
                    <input
                      className="input-field"
                      value={companyForm.contactPerson}
                      onChange={(e) => setCompanyForm({ ...companyForm, contactPerson: e.target.value })}
                      placeholder="e.g., Virgilio Cain"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-700">Contact Number</label>
                    <input
                      className="input-field"
                      type="tel"
                      value={companyForm.contactNumber}
                      onChange={(e) => setCompanyForm({ ...companyForm, contactNumber: e.target.value })}
                      placeholder="+63 9xx xxx xxxx"
                    />
                  </div>
                </div>
                <div className="md:col-span-1 space-y-2">
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-700">Position</label>
                    <input
                      className="input-field"
                      value={companyForm.position}
                      onChange={(e) => setCompanyForm({ ...companyForm, position: e.target.value })}
                      placeholder="e.g., Owner / Manager"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-700">Email Address</label>
                    <input
                      className="input-field"
                      type="email"
                      value={companyForm.email}
                      readOnly
                    />
                  </div>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={companySaving}
                  className="btn-primary px-6 py-2 flex items-center gap-1"
                >
                  {companySaving ? <Save className="w-4 h-4" /> : null} {companySaving ? 'Saving…' : 'Save Changes'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (user) {
                      setCompanyForm({
                        companyName: user.companyName || '',
                        companyAddress: user.companyAddress || '',
                        contactNumber: user.contactNumber || '',
                        contactPerson: user.contactPerson || '',
                        email: user.email || '',
                        position: user.position || '',
                      });
                    }
                    setCompanyEdit(false);
                  }}
                  className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
                <div className="md:col-span-2 space-y-2">
                  <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Company Name</p>
                    <p className="text-gray-900 font-medium">{companyForm.companyName || '— Not set —'}</p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Company Address</p>
                    <p className="text-gray-900 font-medium">{companyForm.companyAddress || '— Not set —'}</p>
                  </div>
                </div>
                <div className="md:col-span-1 space-y-2">
                  <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Contact Person</p>
                    <p className="text-gray-900 font-medium">{companyForm.contactPerson || '— Not set —'}</p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Contact Number</p>
                    <p className="text-gray-900 font-medium">{companyForm.contactNumber || '— Not set —'}</p>
                  </div>
                </div>
                <div className="md:col-span-1 space-y-2">
                  <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Position</p>
                    <p className="text-gray-900 font-medium">{companyForm.position || '— Not set —'}</p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Email Address</p>
                    <p className="text-gray-900 font-medium">{companyForm.email || '— Not set —'}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="card mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900">Vehicle Ad Uploader</h2>
            <p className="text-sm text-gray-500 ml-2">Upload 1–10 vehicle ad images (PNG/JPEG only). Beside each image, add the vehicle description/details for that ad.</p>
          </div>
          {err && <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm">{err}</div>}
          {msg && <div className="mb-4 p-3 rounded-lg bg-green-50 text-green-700 text-sm">{msg}</div>}
          <form onSubmit={submitVehicleAd} noValidate className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-700">Ad Title</label>
                <input className="input-field" placeholder="e.g., Toyota Vios 2023 - Self Drive" value={form.adCampaignTitle} onChange={(e)=>setForm({...form, adCampaignTitle:e.target.value})} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-700">Make</label>
                <input className="input-field" placeholder="Toyota" value={form.make} onChange={(e)=>setForm({...form, make:e.target.value})} required />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-700">Model</label>
                <input className="input-field" placeholder="Vios" value={form.model} onChange={(e)=>setForm({...form, model:e.target.value})} required />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-700">Type</label>
                <select className="input-field" value={form.type} onChange={(e)=>setForm({...form, type:e.target.value})}>{['motorcycle','car','van','suv','sedan','pickup','other'].map(t=><option key={t} value={t}>{t}</option>)}</select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-700">Year</label>
                <input className="input-field" type="number" placeholder="2023" value={form.year} onChange={(e)=>setForm({...form, year:e.target.value})} required />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-700">Color</label>
                <input className="input-field" placeholder="White" value={form.color} onChange={(e)=>setForm({...form, color:e.target.value})} required />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-700">License Plate</label>
                <input className="input-field" placeholder="ABC-1234" value={form.licensePlate} onChange={(e)=>setForm({...form, licensePlate:e.target.value})} required />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-700">Price per Day (PHP)</label>
                <input className="input-field" type="number" min="0" step="0.01" placeholder="1500" value={form.pricePerDay} onChange={(e)=>setForm({...form, pricePerDay:e.target.value})} required />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-700">VIN (optional)</label>
                <input className="input-field" placeholder="VIN" value={form.vin} onChange={(e)=>setForm({...form, vin:e.target.value})} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-700 block">Company Details</label>
                <div className="space-y-2">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                    <div className="md:col-span-2 space-y-1">
                      <input className="input-field" placeholder="Company Name" value={companyForm.companyName} onChange={(e)=>setCompanyForm({...companyForm, companyName:e.target.value})} />
                      <input className="input-field" placeholder="Company Address" value={companyForm.companyAddress} onChange={(e)=>setCompanyForm({...companyForm, companyAddress:e.target.value})} />
                    </div>
                    <div className="md:col-span-1 space-y-1">
                      <input className="input-field" placeholder="Contact Person" value={companyForm.contactPerson} onChange={(e)=>setCompanyForm({...companyForm, contactPerson:e.target.value})} />
                      <input className="input-field" placeholder="Contact Phone Number" value={companyForm.contactNumber} onChange={(e)=>setCompanyForm({...companyForm, contactNumber:e.target.value})} />
                    </div>
                    <div className="md:col-span-1 space-y-1">
                      <input className="input-field" placeholder="Position" value={companyForm.position} onChange={(e)=>setCompanyForm({...companyForm, position:e.target.value})} />
                      <input className="input-field" type="email" placeholder="Email Address" value={companyForm.email} readOnly />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
              <div className="space-y-1">
                <label
                  onClick={() => docOrRef.current?.click()}
                  className={`block border rounded-lg p-3 hover:border-blue-400 hover:bg-blue-50 cursor-pointer transition-colors ${docs.or ? 'border-green-500 bg-green-50' : 'border-gray-300'}`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <p className="text-xs font-semibold text-gray-800">OR</p>
                    <span className="text-xs text-gray-500">Certificate of Registration</span>
                  </div>
                  <svg className="w-5 h-5 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                  <span className="text-xs text-gray-600">Upload PNG/JPEG/PDF</span>
                  <input ref={docOrRef} type="file" className="hidden" accept="image/png,image/jpeg,.pdf" onChange={(e)=>setDocs({...docs, or:e.target.files[0]})} />
                  {docs.or && <div className="mt-1 text-xs text-green-700 flex items-center gap-1"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg> {docs.or.name}</div>}
                </label>
              </div>
              <div className="space-y-1">
                <label
                  onClick={() => docProofRef.current?.click()}
                  className={`block border rounded-lg p-3 hover:border-blue-400 hover:bg-blue-50 cursor-pointer transition-colors ${docs.proofOfOwnership ? 'border-green-500 bg-green-50' : 'border-gray-300'}`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <p className="text-xs font-semibold text-gray-800">Proof of Ownership</p>
                  </div>
                  <svg className="w-5 h-5 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                  <span className="text-xs text-gray-600">Upload document</span>
                  <input ref={docProofRef} type="file" className="hidden" accept="image/png,image/jpeg,.pdf" onChange={(e)=>setDocs({...docs, proofOfOwnership:e.target.files[0]})} />
                  {docs.proofOfOwnership && <div className="mt-1 text-xs text-green-700 flex items-center gap-1"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg> {docs.proofOfOwnership.name}</div>}
                </label>
              </div>
              <div className="space-y-1">
                <label
                  onClick={() => docCrRef.current?.click()}
                  className={`block border rounded-lg p-3 hover:border-blue-400 hover:bg-blue-50 cursor-pointer transition-colors ${docs.cr ? 'border-green-500 bg-green-50' : 'border-gray-300'}`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <p className="text-xs font-semibold text-gray-800">CR</p>
                    <span className="text-xs text-gray-500">Original Certificate</span>
                  </div>
                  <svg className="w-5 h-5 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                  <span className="text-xs text-gray-600">Upload document</span>
                  <input ref={docCrRef} type="file" className="hidden" accept="image/png,image/jpeg,.pdf" onChange={(e)=>setDocs({...docs, cr:e.target.files[0]})} />
                  {docs.cr && <div className="mt-1 text-xs text-green-700 flex items-center gap-1"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg> {docs.cr.name}</div>}
                </label>
              </div>
            </div>

            <div className="space-y-4">
              {ads.map((ad, idx) => (
                <div key={idx} className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border border-gray-200 rounded-xl bg-white">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <p className="text-xs font-semibold text-gray-800">Ad Image {idx + 1}</p>
                      <span className="text-xs text-gray-500">PNG/JPEG</span>
                    </div>
                    <label className="flex flex-col items-center justify-center h-48 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-400 bg-gray-50 overflow-hidden">
                      {ad.preview ? <img src={ad.preview} alt={`Ad ${idx + 1}`} className="h-full w-full object-cover" /> : (
                        <div className="text-center text-gray-500 p-4"><ImageIcon className="w-8 h-8 mx-auto mb-2" /><span className="text-xs">Choose PNG or JPEG</span></div>
                      )}
                      <input type="file" accept="image/png,image/jpeg" className="hidden" onChange={(e)=>onImagePick(idx, e.target.files[0])} />
                    </label>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <p className="text-xs font-semibold text-gray-800">Description</p>
                      <span className="text-xs text-gray-500">Beside image</span>
                    </div>
                    <RichTextEditor
                      value={ad.description}
                      onChange={(v) => { const n=[...ads]; n[idx]={...n[idx], description:v}; setAds(n); }}
                      minHeight="120px"
                      className="w-full"
                    />
                    {ads.length > 1 && <button type="button" onClick={()=>removeSlot(idx)} className="mt-2 inline-flex items-center gap-1 text-xs text-red-600"><Trash2 className="w-3 h-3" /> Remove</button>}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 pt-2">
              <button type="button" onClick={addSlot} disabled={ads.length >= MAX_IMAGES} className="px-4 py-2 rounded-lg border border-gray-300 text-sm disabled:opacity-50"><Upload className="w-4 h-4 inline mr-1" />Add Image Slot ({ads.length}/{MAX_IMAGES})</button>
              <button type="submit" disabled={saving} className="btn-primary px-6 py-2">{saving ? 'Submitting...' : 'Submit Vehicle Ad'}</button>
            </div>
          </form>
        </div>

        <div className="card mb-8">
          <h2 className="text-lg font-bold text-gray-900 mb-4">My Vehicle Ads</h2>
          {loading ? <div className="h-40 flex items-center justify-center text-gray-500">Loading...</div> : vehicles.length === 0 ? (
            <div className="h-40 flex items-center justify-center text-gray-500">No vehicle ads yet</div>
          ) : (
            <div className="space-y-4">
              {vehicles.map((v) => {
                const imgs = renderVehicleImages(v);
                return (
                  <div key={v.id} className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border border-gray-200 rounded-xl bg-white">
                    <div className="grid grid-cols-2 gap-2">
                      {imgs.length ? imgs.slice(0, 10).map((img, i) => (
                        <img key={i} src={assetUrl(typeof img === 'string' ? img : img.path || img.url)} alt={`${v.make} ${v.model} ${i + 1}`} className="w-full h-28 object-cover rounded-lg bg-gray-100" onError={(e)=>{e.currentTarget.style.display='none';}} />
                      )) : <div className="col-span-2 h-28 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400"><Car className="w-8 h-8" /></div>}
                    </div>
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="font-bold text-gray-900">{v.adCampaignTitle || `${v.make} ${v.model} ${v.year}`}</h3>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${v.isVerified ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{v.isVerified ? 'Verified' : 'Pending'}</span>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${v.status === 'en-route' ? 'bg-blue-100 text-blue-700' : v.status === 'maintenance' ? 'bg-red-100 text-red-700' : v.status === 'inactive' ? 'bg-gray-100 text-gray-700' : v.status === 'suspended' ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700'}`}>{v.status === 'en-route' ? 'En Route' : v.status === 'maintenance' ? 'Maintenance' : v.status === 'inactive' ? 'Inactive' : v.status === 'suspended' ? 'Suspended' : 'Active'}</span>
                        </div>
                      </div>
                      <p className="text-sm text-blue-700 font-semibold mt-1">Php {v.pricePerDay}/day</p>
                      <p className="text-xs text-gray-500">{v.type} • {v.color} • {v.licensePlate}</p>
                      <div className="mt-2">
                        <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Description</p>
                        <div
                          className="text-sm text-gray-700 leading-relaxed"
                          dangerouslySetInnerHTML={{ __html: (v.adCampaignDescription || v.description || '') }}
                        />
                        {!v.adCampaignDescription && !v.description && <p className="text-xs text-gray-400 mt-1">No description provided.</p>}
                      </div>
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Vehicle Status</p>
                        <select
                          value={v.status || 'active'}
                          onChange={(e) => updateVehicleStatus(v.id, e.target.value)}
                          className="w-full px-2 py-1 text-xs border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 outline-none"
                        >
                          <option value="active">Active</option>
                          <option value="en-route">En Route</option>
                          <option value="maintenance">Maintenance (Damage/Broken)</option>
                          <option value="inactive">Inactive</option>
                          <option value="suspended">Suspended</option>
                        </select>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="card">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Vehicle Location Tracking</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {vehicles.map((v) => (
              <div key={v.id} className="h-80"><GPSMap vehicleId={v.id} title={`${v.make} ${v.model} (${v.licensePlate})`} /></div>
            ))}
            {!vehicles.length && <div className="h-40 flex flex-col items-center justify-center text-gray-500"><MapPin className="w-10 h-10 mb-2 opacity-50" /><p>No vehicles to track</p></div>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OwnerDashboard;
