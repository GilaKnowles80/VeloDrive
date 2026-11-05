import React from 'react';
import { Link } from 'react-router-dom';
import { Car, Wallet, Users } from 'lucide-react';
import logo from '../assets/logo.svg';

const Home = () => (
  <div className="min-h-screen bg-gray-50">
    <section className="bg-blue-900 text-white py-20 px-4">
      <div className="max-w-7xl mx-auto text-center">
        <img src={logo} alt="VeloDrive Logo" className="w-20 h-20 mx-auto mb-6" />
        <h1 className="text-4xl md:text-6xl font-bold mb-6">Velo<span className="text-blue-600">Drive</span></h1>
        <p className="text-xl md:text-2xl text-blue-100 mb-8 max-w-2xl mx-auto leading-relaxed">
          VeloDrive: A peer-to-peer (P2P) vehicle rental and ride-hailing hybrid marketplace. It supports both self-drive arrangements and hire-a-driver services, operating on transactional commission or subscription-based monetization logic.
        </p>
        <div className="flex flex-col md:flex-row gap-4 justify-center">
          <Link to="/register?role=owner" className="btn-primary px-8 py-3 text-lg">Vehicles Owner</Link>
          <Link to="/register?role=renter" className="bg-blue-800 hover:bg-blue-700 text-white px-8 py-3 text-lg rounded-lg border border-blue-500 transition">Renter Sign Up</Link>
        </div>
      </div>
    </section>

    <section className="py-16 px-4">
      <div className="max-w-7xl mx-auto">
        <h2 className="text-3xl font-bold text-gray-900 text-center mb-12">Supported Vehicle Types</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {[
            'Motorcycle','Car','Van','SUV','Sedan','Coupe','Hatchback','Pickup',
            'Off-Road','Sport','Micro','Convertible','Wagon','Crossover','Muscle',
            'Roadster','Cabriolet','Limousine','Formula 1','Mini Van','Liftback',
            '10-Wheeler Truck','Trailer Truck','Dump Truck','Wheel Loader','Payloaders',
            'Boom Truck','Crane'
          ].map((v, i) => (
            <div key={i} className="p-4 bg-white rounded-lg border border-gray-200 text-center">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-2">
                <Car className="w-5 h-5 text-blue-600" />
              </div>
              <p className="text-sm font-medium text-gray-900">{v}</p>
            </div>
          ))}
        </div>
      </div>
    </section>

    <section className="py-16 px-4 bg-gray-100">
      <div className="max-w-7xl mx-auto">
        <h2 className="text-3xl font-bold text-gray-900 text-center mb-12">How It Works</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { icon: Users, title: 'Register & Verify', desc: 'Owners and renters register with ID, license, and documents. GDPR consent required.' },
            { icon: Car, title: 'List or Browse Vehicles', desc: 'Owners list vehicles with certificates, specs, price/day, and marketing ads.' },
            { icon: Wallet, title: 'Book & Pay via Escrow', desc: 'Renters book; payment held in escrow. Split: 90% owner, 10% admin commission.' }
          ].map((item, i) => (
            <div key={i} className="card text-center p-8">
              <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4 text-blue-600">
                <item.icon className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">{item.title}</h3>
              <p className="text-gray-600 text-sm">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>

    <section className="py-16 px-4">
      <div className="max-w-7xl mx-auto">
        <h2 className="text-3xl font-bold text-gray-900 text-center mb-12">Platform Fees</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-center">
          <div className="card p-8">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Vehicle Owner Membership</h3>
            <p className="text-gray-600 mb-4">Php 2,500/year one-time subscription fee. Charged once per year when you register as a vehicle owner, regardless of how many vehicles you own.</p>
            <div className="bg-blue-50 p-4 rounded-lg">
              <p className="text-sm text-blue-800">Paid via PayPal QR Code, PayPal Payment Link, or PayPal Subscription.</p>
            </div>
          </div>
          <div className="card p-8">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Service Charge per Booking</h3>
            <p className="text-gray-600 mb-4">Php 250 flat service charge deducted from each rental payment. Paid via PayPal wallet, QR code, or payment link.</p>
            <div className="bg-green-50 p-4 rounded-lg">
              <p className="text-sm text-green-800">Owner receives: Rental amount − Php 250 service charge. Admin receives: Php 250 service charge.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
);

export default Home;

