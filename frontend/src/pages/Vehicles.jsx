import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { MapPin, Car } from 'lucide-react';

const Vehicles = () => {
  const navigate = useNavigate();
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const loadVehicles = async () => {
      try {
        const resp = await api.get('/vehicles/');
        setVehicles(resp.data.vehicles || []);
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    };
    loadVehicles();
  }, []);

  const filtered = vehicles.filter(v =>
    `${v.make} ${v.model} ${v.type}`.toLowerCase().includes(search.toLowerCase())
  );

  const handleBook = (vehicleId) => {
    const token = localStorage.getItem('accessToken') || localStorage.getItem('token');
    if (!token) {
      navigate(`/login?next=/renter/dashboard&vehicleId=${encodeURIComponent(vehicleId)}`);
      return;
    }
    navigate(`/renter/dashboard?vehicleId=${encodeURIComponent(vehicleId)}`);
  };

  return (
    <div className="page-shell">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Browse Vehicles</h1>
            <p className="text-gray-600">All vehicle types from motorcycle to crane</p>
          </div>
          <div className="mt-4 md:mt-0 flex w-full md:w-auto">
            <input
              className="input-field w-full md:w-80"
              placeholder="Search vehicle type, make, model..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-4">
          {loading ? (
            <div className="w-full h-64 flex items-center justify-center">Loading vehicles...</div>
          ) : filtered.length > 0 ? (
            filtered.map((v) => (
              <div key={v.id} className="w-full md:w-1/2 lg:w-1/3 xl:w-1/4 card">
                <div className="h-48 bg-gray-200 rounded-t-lg flex items-center justify-center mb-4">
                  <Car className="w-12 h-12 text-gray-400" />
                </div>
                <div className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold text-gray-900">{v.make} {v.model}</h3>
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">{v.type}</span>
                  </div>
                  <p className="text-sm text-gray-600 mb-3">{v.description || 'No description'}</p>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xl font-bold text-gray-900">Php {v.pricePerDay}</span>
                    <span className="text-xs text-gray-500">/day</span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-gray-500 mb-3">
                    <MapPin className="w-3 h-3" /> {v.owner?.firstName} {v.owner?.lastName}
                  </div>
                  <button className="btn-primary w-full text-sm" onClick={() => handleBook(v.id)}>Book Now</button>
                </div>
              </div>
            ))
          ) : (
            <div className="w-full h-96 flex flex-col items-center justify-center text-gray-500">
              <Car className="w-12 h-12 mb-3 opacity-50" />
              <p>No vehicles found</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Vehicles;