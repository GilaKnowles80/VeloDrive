import React from 'react';
import logo from '../assets/logo.svg';

const Footer = () => {
  return (
    <footer className="bg-gray-900 text-white pt-12 pb-8">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6 mb-8">
          <div className="flex items-center gap-2">
            <img src={logo} alt="VeloDrive Logo" className="w-10 h-10 object-contain" />
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
              <img src="https://www.paypalobjects.com/webstatic/mktg/logo/pp_cc_mark_114x33.jpg" alt="PayPal" className="w-24 h-8 object-contain" />
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
  );
};

export default Footer;