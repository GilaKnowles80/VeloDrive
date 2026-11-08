import React, { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Car, Truck, Motorcycle, MapPinRight } from 'lucide-react';
import logo from '../assets/logo.jpg';
import paypalLogo from '../assets/paypal-logo.png';

const VEHICLE_TYPES = [
  'Motorcycle','Car','Van','SUV','Sedan','Coupe','Hatchback','Pickup',
  'Off-Road','Sport','Micro','Convertible','Wagon','Crossover','Muscle',
  'Roadster','Cabriolet','Limousine','Formula 1','Mini Van','Liftback',
  '10-Wheeler Truck','Trailer Truck','Dump Truck','Wheel Loader','Payloaders',
  'Boom Truck','Crane'
];

const ICON_MAP = {
  'Motorcycle': Motorcycle,
  'Car': Car,
  'Van': Truck,
  'SUV': Truck,
  'Sedan': Car,
  'Coupe': Car,
  'Hatchback': Car,
  'Pickup': Truck,
  'Off-Road': Truck,
  'Sport': Car,
  'Micro': Car,
  'Convertible': Car,
  'Wagon': Car,
  'Crossover': Car,
  'Muscle': Car,
  'Roadster': Car,
  'Cabriolet': Car,
  'Limousine': Car,
  'Formula 1': Car,
  'Mini Van': Truck,
  'Liftback': Car,
  '10-Wheeler Truck': Truck,
  'Trailer Truck': Truck,
  'Dump Truck': Truck,
  'Wheel Loader': Truck,
  'Payloaders': Truck,
  'Boom Truck': Truck,
  'Crane': Truck
};

const VehicleTypePage = () => {
  const { type } = useParams();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedDates, setSelectedDates] = useState({ pickup: '', return: '' });
  const [pickupLocation, setPickupLocation] = useState('');
  const [returnLocation, setReturnLocation] = useState('');

  const typeIndex = VEHICLE_TYPES.indexOf(type);
  const Icon = ICON_MAP[type] || Car;
  const prevType = VEHICLE_TYPES[currentIndex > 0 ? currentIndex - 1 : VEHICLE_TYPES.length - 1];
  const nextType = VEHICLE_TYPES[currentIndex < VEHICLE_TYPES.length - 1 ? currentIndex + 1 : 0];

  useEffect(() => {
    if (type && typeIndex !== -1) {
      setCurrentIndex(typeIndex);
    }
  }, [type, typeIndex]);

  const handleBooking = (e) => {
    e.preventDefault();
    if (!pickupLocation || !returnLocation || !selectedDates.pickup || !selectedDates.return) {
      alert('Please fill in all pickup/return locations and dates');
      return;
    }
    const params = new URLSearchParams({
      type,
      pickupLocation,
      returnLocation,
      pickupDate: selectedDates.pickup,
      returnDate: selectedDates.return
    });
    window.location.href = `/checkout?${params.toString()}`;
  };

  return (
    <div className="page-shell">
      <header className="bg-white shadow-sm border-b border-gray-200 sticky z-50 top-0">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <Link to="/" className="text-xl font-bold text-gray-900 tracking-tight">
                Ve<span className="text-blue-600">lo</span>Drive
              </Link>
            </div>
            <div className="flex items-center gap-4 hidden md:flex">
              <Link to="/" className="text-sm font-medium text-gray-600 hover:text-blue-600">Home</Link>
              <Link to="/vehicles" className="text-sm font-medium text-gray-600 hover:text-blue-600">Vehicles</Link>
              <Link to="/login" className="text-sm font-medium text-gray-600 hover:text-blue-600">Login</Link>
              <Link to="/register" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium">Sign Up</Link>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{type} Rentals</h1>
            <p className="text-gray-600">Browse and book {type.toLowerCase()} vehicles for your trip</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setCurrentIndex((i) => i > 0 ? i - 1 : VEHICLE_TYPES.length - 1);
                window.location.href = `/vehicle-type/${prevType}`;
              }}
              className="p-2 bg-white rounded-lg border border-gray-300 hover:bg-gray-50 text-gray-600"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <span className="px-2 py-1 bg-gray-100 rounded text-sm text-gray-500">
              {currentIndex + 1} of {VEHICLE_TYPES.length}
            </span>
            <button
              onClick={() => {
                setCurrentIndex((i) => i < VEHICLE_TYPES.length - 1 ? i + 1 : 0);
                window.location.href = `/vehicle-type/${nextType}`;
              }}
              className="p-2 bg-white rounded-lg border border-gray-300 hover:bg-gray-50 text-gray-600"
            >
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6 mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Book {type}</h2>
          <form onSubmit={handleBooking} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="col-span-full lg:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Pickup Destination</label>
              <input
                type="text"
                placeholder="Enter pickup location"
                value={pickupLocation}
                onChange={(e) => setPickupLocation(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
            <div className="col-span-full lg:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Return Destination</label>
              <input
                type="text"
                placeholder="Enter return location"
                value={returnLocation}
                onChange={(e) => setReturnLocation(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Pickup Date</label>
              <input
                type="date"
                value={selectedDates.pickup}
                onChange={(e) => setSelectedDates({...selectedDates, pickup: e.target.value})}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Return Date</label>
              <input
                type="date"
                value={selectedDates.return}
                onChange={(e) => setSelectedDates({...selectedDates, return: e.target.value})}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
            <button
              type="submit"
              className="col-span-full bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 text-lg font-bold rounded-lg transition flex items-center justify-center gap-2"
            >
              <MapPinRight className="w-5 h-5" /> Check Availability & Book
            </button>
          </form>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Icon className="w-8 h-8 text-blue-600" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 text-center mb-2">{type}</h3>
            <p className="text-sm text-gray-600 text-center">Available for daily rental</p>
          </div>
          <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Vehicle Specifications</h3>
            <ul className="space-y-2 text-sm text-gray-600">
              <li><span className="font-medium text-gray-900">Type:</span> {type}</li>
              <li><span className="font-medium text-gray-900">Transmission:</span> Manual or Automatic</li>
              <li><span className="font-medium text-gray-900">Drive:</span> 2WD or 4WD</li>
              <li><span className="font-medium text-gray-900">Engine:</span> Diesel or Gasoline</li>
            </ul>
          </div>
          <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Payment Options</h3>
            <ul className="space-y-2 text-sm text-gray-600">
              <li><span className="font-medium text-gray-900">PayPal:</span> QR Code, Payment Link, Subscription</li>
              <li><span className="font-medium text-gray-900">Service Charge:</span> Php 250 per booking</li>
              <li><span className="font-medium text-gray-900">Owner Payout:</span> Rental − Php 250</li>
            </ul>
          </div>
        </div>
      </div>

      <footer className="bg-gray-900 text-white pt-12 pb-8 mt-12">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6 mb-8">
            <div className="flex items-center gap-2">
              <img src={logo} alt="VeloDrive Logo" className="w-10 h-10" />
              <span className="text-2xl font-bold tracking-tight">
                Ve<span className="text-blue-400">lo</span>Drive
              </span>
            </div>
            <div className="text-sm text-gray-400">
              &copy; 2026 VeloDrive. All rights reserved.
            </div>
          </div>
          <div className="border-t border-gray-800 pt-6">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <span>Powered by</span>
                <img src={paypalLogo} alt="PayPal" className="h-8 w-auto object-contain bg-white rounded px-1" />
              </div>
              <div className="flex gap-4 text-sm text-gray-400">
                <a href="/privacy" className="hover:text-blue-400 transition">Privacy Policy</a>
                <a href="/terms" className="hover:text-blue-400 transition">Terms of Service</a>
                <a href="https://www.paypal.com" target="_blank" rel="noopener noreferrer" className="hover:text-blue-400 transition">PayPal</a>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-4 text-center">
              VeloDrive is a peer-to-peer vehicle rental marketplace. All transactions processed securely via PayPal.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default VehicleTypePage;

