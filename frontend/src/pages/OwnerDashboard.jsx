import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import api from '../utils/api';
import { Car, Wallet, Calendar, Truck, MapPin, Upload, Image as ImageIcon, Trash2, Edit2, Save, Building2, ChevronLeft, ChevronRight, FileText } from 'lucide-react';
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
const getImageDimensions = (file) => new Promise((resolve, reject) => {
  const image = new Image();
  const objectUrl = URL.createObjectURL(file);
  image.onload = () => {
    URL.revokeObjectURL(objectUrl);
    resolve({ width: image.naturalWidth, height: image.naturalHeight });
  };
  image.onerror = () => {
    URL.revokeObjectURL(objectUrl);
    reject(new Error('The selected image could not be read.'));
  };
  image.src = objectUrl;
});

const OwnerDashboard = () => {
  const { user, updateUser } = useAuth();
  const [stats, setStats] = useState({ totalVehicles: 0, totalBookings: 0, totalEarnings: 0, pendingBookings: 0 });
  const [vehicles, setVehicles] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [ads, setAds] = useState([emptyAd()]);
  const [activeAdIndex, setActiveAdIndex] = useState(0);
  const [vehicleSlides, setVehicleSlides] = useState({});
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
      setBookings(b);
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

  const startRental = async (booking) => {
    try {
      const resp = await api.put(`/bookings/${booking.id}/start`);
      if (resp.data?.success) {
        const vehicleName = `${booking.vehicle?.make || 'Vehicle'} ${booking.vehicle?.model || ''}`.trim();
        setMsg(`${vehicleName} is now En Route / Pulled Out for booking ${booking.bookingReference}.`);
        await loadData();
      }
    } catch (e2) {
      setErr(e2.response?.data?.message || 'Failed to start rental.');
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

  const onImagePick = async (idx, file) => {
    setErr('');
    if (!file) return;
    if (!/^image\/(png|jpeg)$/.test(file.type)) {
      setErr('Only PNG or JPEG images are allowed.');
      return;
    }
    let dimensions;
    try {
      dimensions = await getImageDimensions(file);
    } catch (e) {
      setErr(e.message);
      return;
    }
    if (dimensions.width !== dimensions.height || ![1080, 1200].includes(dimensions.width)) {
      setErr('Vehicle images must be square and sized 1080 × 1080 or 1200 × 1200 pixels.');
      return;
    }
    const next = [...ads];
    if (next[idx]?.preview) URL.revokeObjectURL(next[idx].preview);
    next[idx] = { ...next[idx], file, preview: URL.createObjectURL(file) };
    setAds(next);
    setActiveAdIndex(idx);
  };

  const onDocumentPick = (key, file) => {
    setErr('');
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.pdf') || file.type !== 'application/pdf') {
      setDocs((current) => ({ ...current, [key]: null }));
      setErr('Vehicle documents must be PDF files.');
      return;
    }
    setDocs((current) => ({ ...current, [key]: file }));
  };

  const addSlot = () => {
    if (ads.length >= MAX_IMAGES) return;
    setActiveAdIndex(ads.length);
    setAds([...ads, emptyAd()]);
  };
  const removeSlot = (idx) => {
    const next = ads.filter((_, i) => i !== idx);
    if (ads[idx]?.preview) URL.revokeObjectURL(ads[idx].preview);
    setAds(next.length ? next : [emptyAd()]);
    setActiveAdIndex((current) => Math.min(current > idx ? current - 1 : current, Math.max(next.length - 1, 0)));
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
      setActiveAdIndex(0);
      setDocs({ or: null, proofOfOwnership: null, cr: null });
      loadData();
    } catch (e2) {
      setErr(e2.response?.data?.message || 'Failed to submit vehicle ad.');
    } finally { setSaving(false); }
  };

  const saveCompanyDetails = async () => {
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

  const cancelCompanyEdit = () => {
    setCompanyForm({
      companyName: user?.companyName || '',
      companyAddress: user?.companyAddress || '',
      contactNumber: user?.contactNumber || '',
      contactPerson: user?.contactPerson || '',
      email: user?.email || '',
      position: user?.position || '',
    });
    setCompanyEdit(false);
  };

  const renderVehicleImages = (v) => {
    let imgs = [];
    try { imgs = typeof v.adImages === 'string' ? JSON.parse(v.adImages) : (v.adImages || []); } catch { /* keep empty */ }
    if (!imgs.length && v.adCampaignImage) imgs = [v.adCampaignImage];
    return imgs;
  };
  const activeAd = ads[activeAdIndex] || ads[0];

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

        <div className="card mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900">Vehicle Ad Uploader</h2>
            <p className="text-sm text-gray-500 ml-2">Upload 1–10 vehicle ad images (PNG/JPEG only). Beside each image, add the vehicle description/details for that ad.</p>
          </div>
          {err && <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm">{err}</div>}
          {msg && <div className="mb-4 p-3 rounded-lg bg-green-50 text-green-700 text-sm">{msg}</div>}
          <form onSubmit={submitVehicleAd} noValidate className="space-y-5">
            <p className="mb-1 text-sm text-gray-500">Each submission creates a separate vehicle ad, so you can list all 10 cars individually. Add up to 10 square JPEG or PNG photos (1080 × 1080 or 1200 × 1200 pixels) to each vehicle's carousel.</p>
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
            </div>

            <div className="space-y-4">
              {ads.map((ad, idx) => (
                <div key={idx} className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border border-gray-200 rounded-xl bg-white">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <p className="text-xs font-semibold text-gray-800">Ad Image {idx + 1}</p>
                      <span className="text-xs text-gray-500">Square PNG/JPEG · 1080 or 1200 px</span>
                    </div>
                    <label className="flex flex-col items-center justify-center h-48 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-400 bg-gray-50 overflow-hidden">
                      {ad.preview ? <img src={ad.preview} alt={`Ad ${idx + 1}`} className="h-full w-full object-cover" /> : (
                        <div className="text-center text-gray-500 p-4"><ImageIcon className="w-8 h-8 mx-auto mb-2" /><span className="text-xs">Choose PNG or JPEG</span></div>
                      )}
                      <input type="file" accept="image/png,image/jpeg,.png,.jpg,.jpeg" className="hidden" onChange={(e)=>onImagePick(idx, e.target.files[0])} />
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
            <section className="rounded-xl border border-gray-200 bg-gray-50 p-4">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900">Feed Preview</h3>
                  <p className="text-xs text-gray-500">Preview this vehicle’s photo carousel.</p>
                </div>
                <div className="flex items-center gap-2">
                  <button type="button" aria-label="Previous preview image" onClick={() => setActiveAdIndex((activeAdIndex + ads.length - 1) % ads.length)} className="rounded-full border border-gray-300 bg-white p-2 disabled:opacity-40" disabled={ads.length < 2}><ChevronLeft className="h-4 w-4" /></button>
                  <span className="text-xs text-gray-600">{activeAdIndex + 1} / {ads.length}</span>
                  <button type="button" aria-label="Next preview image" onClick={() => setActiveAdIndex((activeAdIndex + 1) % ads.length)} className="rounded-full border border-gray-300 bg-white p-2 disabled:opacity-40" disabled={ads.length < 2}><ChevronRight className="h-4 w-4" /></button>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="aspect-square overflow-hidden rounded-lg bg-white">
                  {activeAd?.preview ? <img src={activeAd.preview} alt={`Feed preview ${activeAdIndex + 1}`} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-sm text-gray-400"><ImageIcon className="mr-2 h-5 w-5" />Select a vehicle image</div>}
                </div>
                <div className="rounded-lg bg-white p-4">
                  <p className="font-semibold text-gray-900">{form.adCampaignTitle || `${form.make || 'Vehicle'} ${form.model}`}</p>
                  <div className="mt-2 text-sm text-gray-700">{activeAd?.description?.replace(/<[^>]*>/g, '') || 'Your image description will appear here.'}</div>
                </div>
              </div>
            </section>
            <button type="button" onClick={addSlot} disabled={ads.length >= MAX_IMAGES} className="px-4 py-2 rounded-lg border border-gray-300 text-sm disabled:opacity-50"><Upload className="w-4 h-4 inline mr-1" />Add Image Slot ({ads.length}/{MAX_IMAGES})</button>
            <section className="rounded-xl border border-gray-200 p-4">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <h3 className="flex items-center gap-2 font-semibold text-gray-900"><Building2 className="h-5 w-5" /> Company Details</h3>
                  <p className="text-sm text-gray-500">Shown to renters with your vehicle listings.</p>
                </div>
                {!companyEdit && <button type="button" onClick={() => setCompanyEdit(true)} className="inline-flex items-center gap-1 text-sm font-medium text-blue-700"><Edit2 className="h-4 w-4" />Edit</button>}
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div className="space-y-2">
                  <input className="input-field" placeholder="Company Name" value={companyForm.companyName} disabled={!companyEdit} onChange={(e) => setCompanyForm({ ...companyForm, companyName: e.target.value })} />
                  <input className="input-field" placeholder="Company Address" value={companyForm.companyAddress} disabled={!companyEdit} onChange={(e) => setCompanyForm({ ...companyForm, companyAddress: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <input className="input-field" placeholder="Contact Person" value={companyForm.contactPerson} disabled={!companyEdit} onChange={(e) => setCompanyForm({ ...companyForm, contactPerson: e.target.value })} />
                  <input className="input-field" placeholder="Contact Number" value={companyForm.contactNumber} disabled={!companyEdit} onChange={(e) => setCompanyForm({ ...companyForm, contactNumber: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <input className="input-field" placeholder="Position" value={companyForm.position} disabled={!companyEdit} onChange={(e) => setCompanyForm({ ...companyForm, position: e.target.value })} />
                  <input className="input-field" type="email" placeholder="Email Address" value={companyForm.email} readOnly />
                </div>
              </div>
              {companyEdit && <div className="mt-3 flex gap-3">
                <button type="button" onClick={saveCompanyDetails} disabled={companySaving} className="btn-primary inline-flex items-center gap-1 px-4 py-2">{companySaving ? <Save className="h-4 w-4" /> : null}{companySaving ? 'Saving…' : 'Save Company Details'}</button>
                <button type="button" onClick={cancelCompanyEdit} className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600">Cancel</button>
              </div>}
            </section>
            <section className="space-y-3">
              <div>
                <h3 className="font-semibold text-gray-900">Vehicle Documents (PDF)</h3>
                <p className="text-xs text-gray-500">Required for verification. Documents are stored under the existing OR, CR, and proof-of-ownership fields.</p>
              </div>
              <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-3">
                {[
                  { key: 'cr', title: 'Certificate (CR)', ref: docCrRef },
                  { key: 'or', title: 'Receipt (OR)', ref: docOrRef },
                  { key: 'proofOfOwnership', title: 'Proof of Ownership', ref: docProofRef },
                ].map(({ key, title, ref }) => (
                  <label key={key} onClick={() => ref.current?.click()} className={`block cursor-pointer rounded-lg border p-3 transition-colors hover:border-blue-400 hover:bg-blue-50 ${docs[key] ? 'border-green-500 bg-green-50' : 'border-gray-300'}`}>
                    <div className="mb-2 flex items-center gap-2"><FileText className="h-4 w-4 text-gray-500" /><p className="text-xs font-semibold text-gray-800">{title}</p></div>
                    <span className="text-xs text-gray-600">Upload PDF</span>
                    <input ref={ref} type="file" className="hidden" accept="application/pdf,.pdf" onChange={(e) => onDocumentPick(key, e.target.files[0])} />
                    {docs[key] && <div className="mt-1 truncate text-xs text-green-700">{docs[key].name}</div>}
                  </label>
                ))}
              </div>
            </section>
            <div className="flex justify-end pt-2">
              <button type="submit" disabled={saving} className="btn-primary px-6 py-2">{saving ? 'Submitting...' : 'Submit Vehicle Ad'}</button>
            </div>
          </form>
        </div>

        <div className="card mb-8">
          <h2 className="mb-4 text-lg font-bold text-gray-900">Bookings & Vehicle Dispatch</h2>
          {bookings.length === 0 ? <p className="text-sm text-gray-500">No bookings yet.</p> : (
            <div className="space-y-3">
              {bookings.map((booking) => (
                <div key={booking.id} className="flex flex-col gap-3 rounded-xl border border-gray-200 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-semibold text-gray-900">{booking.vehicle?.make} {booking.vehicle?.model} {booking.vehicle?.year}</p>
                    <p className="text-sm text-gray-600">Booking {booking.bookingReference} · {booking.rentalStartDate} to {booking.rentalEndDate}</p>
                    <p className="mt-1 text-xs text-gray-500">Booking status: {booking.status} · Vehicle: {booking.vehicle?.status || 'active'}</p>
                  </div>
                  {booking.status === 'confirmed' && (
                    <button type="button" onClick={() => startRental(booking)} className="btn-primary px-4 py-2 text-sm">Start Rental / Mark En Route</button>
                  )}
                  {booking.status === 'active' && booking.vehicle?.status === 'en-route' && (
                    <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700">Vehicle En Route / Pulled Out</span>
                  )}
                </div>
              ))}
            </div>
          )}
          <p className="mt-3 text-xs text-gray-500">Starting a confirmed rental marks only its booked vehicle En Route and unavailable. Set a returned damaged vehicle to In Repair / Under Maintenance in its vehicle status control.</p>
        </div>

        <div className="card mb-8">
          <h2 className="text-lg font-bold text-gray-900 mb-4">My Vehicle Ads</h2>
          {loading ? <div className="h-40 flex items-center justify-center text-gray-500">Loading...</div> : vehicles.length === 0 ? (
            <div className="h-40 flex items-center justify-center text-gray-500">No vehicle ads yet</div>
          ) : (
            <div className="space-y-4">
              {vehicles.map((v) => {
                const imgs = renderVehicleImages(v);
                const slideIndex = imgs.length ? (vehicleSlides[v.id] || 0) % imgs.length : 0;
                const slide = imgs[slideIndex];
                const imageSrc = typeof slide === 'string' ? slide : slide?.path || slide?.url;
                return (
                  <div key={v.id} className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border border-gray-200 rounded-xl bg-white">
                    <div className="relative aspect-square overflow-hidden rounded-lg bg-gray-100">
                      {imageSrc ? <img src={assetUrl(imageSrc)} alt={`${v.make} ${v.model} ${slideIndex + 1}`} className="h-full w-full object-cover" onError={(e)=>{e.currentTarget.style.display='none';}} /> : <div className="flex h-full items-center justify-center text-gray-400"><Car className="h-10 w-10" /></div>}
                      {imgs.length > 1 && <>
                        <button type="button" aria-label={`Previous ${v.make} ${v.model} image`} onClick={() => setVehicleSlides((current) => ({ ...current, [v.id]: (slideIndex + imgs.length - 1) % imgs.length }))} className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2 shadow"><ChevronLeft className="h-4 w-4" /></button>
                        <button type="button" aria-label={`Next ${v.make} ${v.model} image`} onClick={() => setVehicleSlides((current) => ({ ...current, [v.id]: (slideIndex + 1) % imgs.length }))} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2 shadow"><ChevronRight className="h-4 w-4" /></button>
                        <span className="absolute bottom-2 right-2 rounded-full bg-black/60 px-2 py-1 text-xs text-white">{slideIndex + 1}/{imgs.length}</span>
                      </>}
                    </div>
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="font-bold text-gray-900">{v.adCampaignTitle || `${v.make} ${v.model} ${v.year}`}</h3>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${v.isVerified ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{v.isVerified ? 'Verified' : 'Pending'}</span>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${v.status === 'en-route' ? 'bg-blue-100 text-blue-700' : v.status === 'maintenance' ? 'bg-red-100 text-red-700' : v.status === 'inactive' ? 'bg-gray-100 text-gray-700' : v.status === 'suspended' ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700'}`}>{v.status === 'en-route' ? 'En Route / Pulled Out' : v.status === 'maintenance' ? 'In Repair / Under Maintenance' : v.status === 'inactive' ? 'Inactive' : v.status === 'suspended' ? 'Suspended' : 'Active'}</span>
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
                        {v.status === 'en-route' && <p className="mb-2 text-xs text-blue-700">This vehicle is on an active rental and cannot be booked.</p>}
                        {v.status === 'maintenance' && <p className="mb-2 text-xs text-red-700">This vehicle is in repair / under maintenance and unavailable to renters.</p>}
                        <select
                          value={v.status || 'active'}
                          onChange={(e) => updateVehicleStatus(v.id, e.target.value)}
                          className="w-full px-2 py-1 text-xs border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 outline-none"
                        >
                          <option value="active">Active</option>
                          <option value="en-route">En Route / Pulled Out</option>
                          <option value="maintenance">In Repair / Under Maintenance</option>
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
