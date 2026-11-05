import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const vehicleCategories = [
  "Motorcycle", "Car", "Van", "SUV", "Sedan", "Coupe",
  "Hatchback", "Pickup", "Off-Road", "Sport", "Micro", "Convertible",
  "Wagon", "Crossover", "Muscle", "Roadster", "Cabriolet", "Limousine",
  "Formula 1", "Mini Van", "Liftback", "10-Wheeler Truck", "Trailer Truck", "Dump Truck",
  "Wheel Loader", "Payloaders", "Boom Truck", "Crane"
];

const VehicleTypesFilter = () => {
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Fetch owner-uploaded vehicles filtered by the selected category from your backend
  useEffect(() => {
    if (selectedCategory) {
      setLoading(true);
      fetch(`/api/vehicles?type=${encodeURIComponent(selectedCategory)}`)
        .then(res => res.json())
        .then(data => {
          setVehicles(data);
          setLoading(false);
        })
        .catch(err => {
          console.error("Error fetching vehicles:", err);
          setLoading(false);
        });
    }
  }, [selectedCategory]);

  const handleCheckout = (vehicle) => {
    // Route to checkout page, passing the selected vehicle details via state
    navigate('/checkout', { state: { vehicle } });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h2 className="text-2xl font-black text-slate-900 text-center mb-8 uppercase tracking-wider">
        Supported Vehicle Types
      </h2>

      {/* Grid of Clickable Category Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {vehicleCategories.map((category) => (
          <button
            key={category}
            onClick={() => setSelectedCategory(category)}
            className={`flex flex-col items-center justify-center p-4 bg-white border rounded-xl shadow-sm transition hover:shadow-md hover:border-sky-500 cursor-pointer ${
              selectedCategory === category ? 'border-sky-600 ring-2 ring-sky-500 bg-sky-50/50' : 'border-slate-200'
            }`}
          >
            <div className="w-10 h-10 bg-sky-50 rounded-full flex items-center justify-center mb-2 text-sky-600 font-bold">
              🚗
            </div>
            <span className="text-xs font-semibold text-slate-800 text-center">{category}</span>
          </button>
        ))}
      </div>

      {/* Selected Category Vehicle Listings Section */}
      {selectedCategory && (
        <div className="mt-12 bg-slate-50 p-6 rounded-2xl border border-slate-200">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold text-slate-900">
              Available Listings for: <span className="text-sky-600">{selectedCategory}</span>
            </h3>
            <button 
              onClick={() => setSelectedCategory(null)}
              className="text-sm text-slate-500 hover:text-slate-800 font-semibold cursor-pointer"
            >
              ✕ Close
            </button>
          </div>

          {loading ? (
            <p className="text-center text-slate-500 py-8">Loading owner listings...</p>
          ) : vehicles.length === 0 ? (
            <div className="text-center py-8 bg-white rounded-xl border border-dashed border-slate-300">
              <p className="text-slate-600 font-medium">No sample ads uploaded for {selectedCategory} yet.</p>
              <p className="text-xs text-slate-400 mt-1">Vehicle owners can upload listings from their dashboard.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {vehicles.map((vehicle) => (
                <div key={vehicle._id || vehicle.id} className="bg-white rounded-xl overflow-hidden border border-slate-200 shadow-sm flex flex-col">
                  <img 
                    src={vehicle.imageUrl || vehicle.adCampaignImage || "/placeholder.jpg"} 
                    alt={vehicle.title || vehicle.model} 
                    className="w-full h-48 object-cover"
                  />
                  <div className="p-4 flex flex-col flex-grow">
                    <h4 className="font-bold text-slate-900 text-lg">{vehicle.title || vehicle.model}</h4>
                    <p className="text-xs text-slate-500 mt-1 flex-grow">{vehicle.description}</p>
                    <div className="mt-4 flex items-center justify-between">
                      <span className="text-sky-600 font-extrabold">₱{vehicle.pricePerDay} / day</span>
                      <button 
                        onClick={() => handleCheckout(vehicle)}
                        className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold rounded-lg transition shadow cursor-pointer"
                      >
                        Rent via PayPal
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default VehicleTypesFilter;