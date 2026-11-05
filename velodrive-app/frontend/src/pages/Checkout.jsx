import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const Checkout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  
  // Retrieve the vehicle object passed from the grid
  const vehicle = location.state?.vehicle;

  // Fallback if someone navigates directly to /checkout without selecting a vehicle
  if (!vehicle) {
    return (
      <div className="max-w-xl mx-auto py-20 text-center px-4">
        <h2 className="text-xl font-bold text-slate-900 mb-2">No Vehicle Selected</h2>
        <p className="text-slate-600 mb-6 text-sm">Please choose a vehicle from the category grid to proceed with your booking.</p>
        <button 
          onClick={() => navigate('/')} 
          className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm transition"
        >
          Back to Home
        </button>
      </div>
    );
  }

  const handlePayPalCheckout = () => {
    // Route to PayPal payment gateway
    window.location.href = `https://www.paypal.com/paypalme/your-paypal-account/${vehicle.pricePerDay}`;
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <button 
        onClick={() => navigate(-1)} 
        className="text-sm font-semibold text-blue-600 hover:text-blue-800 mb-6 flex items-center gap-1 cursor-pointer"
      >
        ← Back to Listings
      </button>

      <h2 className="text-3xl font-black text-slate-900 mb-8">Complete Your Rental Checkout</h2>

      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row gap-6 mb-8">
        <img 
          src={vehicle.imageUrl || vehicle.adCampaignImage || "/placeholder.jpg"} 
          alt={vehicle.title || vehicle.model} 
          className="w-full md:w-72 h-48 object-cover rounded-xl border border-slate-100"
        />
        <div className="flex flex-col justify-between flex-grow">
          <div>
            <span className="inline-block px-3 py-1 bg-blue-50 text-blue-600 text-xs font-bold rounded-full mb-2">
              {vehicle.vehicleType}
            </span>
            <h3 className="font-bold text-xl text-slate-900">{vehicle.title || vehicle.model}</h3>
            <p className="text-slate-600 text-sm mt-2 leading-relaxed">{vehicle.description}</p>
          </div>
          
          <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
            <span className="text-slate-500 text-sm font-medium">Rental Rate</span>
            <span className="text-2xl font-black text-blue-600">₱{vehicle.pricePerDay} <span className="text-xs text-slate-400 font-normal">/ day</span></span>
          </div>
        </div>
      </div>

      <div className="bg-blue-50/60 border border-blue-100 rounded-2xl p-6 mb-8">
        <h4 className="font-bold text-slate-900 mb-2 text-sm">Escrow & Payment Terms</h4>
        <p className="text-xs text-slate-600 leading-relaxed">
          Your payment will be held securely in escrow. Upon booking confirmation, a flat ₱250 platform service fee is allocated to admin, and the remaining balance is routed to the vehicle owner.
        </p>
      </div>

      <button
        onClick={handlePayPalCheckout}
        className="w-full py-4 bg-[#0070ba] hover:bg-[#005ea6] text-white font-extrabold rounded-2xl transition shadow-lg flex items-center justify-center gap-2 cursor-pointer text-base"
      >
        Pay ₱{vehicle.pricePerDay} securely with PayPal
      </button>
    </div>
  );
};

export default Checkout;