import React, { useCallback, useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, RefreshCw, Loader2 } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/images/marker-icon.png';
import 'leaflet/dist/images/marker-shadow.png';
import api from '../utils/api';

// Safely configure Leaflet default icon (guard against undefined icon.Default)
try {
  if (L.Icon.Default && typeof L.Icon.Default.merge === 'function') {
    L.Icon.Default.merge({
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png'
    });
  }
} catch (e) {
  console.warn('Leaflet icon configuration failed:', e.message);
}

const FitBounds = ({ markers }) => {
  const map = useMap();
  useEffect(() => {
    if (markers && markers.length > 0) {
      const group = new (L.featureGroup)(markers.map(m => L.marker([m.lat, m.lng])));
      map.fitBounds(group.getBounds().pad(0.3));
    }
  }, [map, markers]);
  return null;
};

const GPSMap = ({ vehicleId, bookingId, title = 'Vehicle Location', height = '400px' }) => {
  const [location, setLocation] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchLocation = useCallback(async () => {
    try {
      const url = bookingId ? `/api/bookings/${bookingId}/gps` : `/api/vehicles/${vehicleId}/gps`;
      const resp = await api.get(url);
      const gps = resp.data.gps;
      if (gps) {
        setLocation({
          lat: parseFloat(gps.latitude),
          lng: parseFloat(gps.longitude),
          address: gps.address,
          speed: gps.speed,
          recordedAt: gps.recordedAt
        });
        const histResp = await api.get(`/api/gps/history?vehicleId=${vehicleId}`);
        setHistory(histResp.data.history || []);
      }
    } catch {
      setError('Unable to load GPS location');
    } finally { setLoading(false); }
  }, [vehicleId, bookingId]);

  useEffect(() => {
    fetchLocation();
    const interval = setInterval(fetchLocation, 15000);
    return () => clearInterval(interval);
  }, [fetchLocation]);

  if (loading) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-gray-100 rounded-lg border border-gray-200">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-2" />
        <p className="text-sm text-gray-500">Loading GPS location...</p>
      </div>
    );
  }
  if (error || !location) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-gray-100 rounded-lg border border-gray-200">
        <MapPin className="w-10 h-10 text-gray-400 mb-2" />
        <p className="text-sm text-gray-500">{error || 'No GPS location available'}</p>
      </div>
    );
  }

  const markers = [
    { lat: location.lat, lng: location.lng },
    ...history.slice(0, 20).map(p => ({ lat: parseFloat(p.latitude), lng: parseFloat(p.longitude) }))
  ];

  return (
    <div className="bg-gray-100 rounded-lg border border-gray-200 overflow-hidden flex flex-col h-full">
      <div className="bg-white px-4 py-3 border-b border-gray-200 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <MapPin className="w-5 h-5 text-blue-600" />
          <h3 className="font-semibold text-gray-900">{title}</h3>
        </div>
        <button onClick={fetchLocation} className="p-2 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg text-sm">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>
      <div className="relative flex-1">
        <MapContainer center={[location.lat, location.lng]} zoom={14} style={{ height, width: '100%' }} zoomControl={false}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <Marker position={[location.lat, location.lng]}>
            <Popup>
              <div className="p-2">
                <p className="font-medium text-gray-900">{title}</p>
                <p className="text-sm text-gray-600">{location.address || 'Vehicle location'}</p>
                <p className="text-xs text-gray-500 mt-1">{new Date(location.recordedAt).toLocaleString()}</p>
              </div>
            </Popup>
          </Marker>
          {history.length > 1 && (
            <Polyline positions={history.map(p => [parseFloat(p.latitude), parseFloat(p.longitude)])} color="#0ea5e9" weight={3} opacity={0.7} />
          )}
          <FitBounds markers={markers} />
        </MapContainer>
      </div>
      <div className="bg-white px-4 py-3 border-t border-gray-200 grid grid-cols-4 gap-4 text-sm">
        <div>
          <p className="text-xs text-gray-500 uppercase">Lat</p>
          <p className="text-gray-900 font-mono">{location.lat.toFixed(6)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 uppercase">Lng</p>
          <p className="text-gray-900 font-mono">{location.lng.toFixed(6)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 uppercase">Speed</p>
          <p className="text-gray-900">{location.speed != null ? location.speed + ' km/h' : 'N/A'}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 uppercase">Updated</p>
          <p className="text-gray-900 text-xs">{new Date(location.recordedAt).toLocaleTimeString()}</p>
        </div>
      </div>
    </div>
  );
};

export default GPSMap;