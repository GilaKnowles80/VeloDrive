import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import ProtectedRoute from './components/ProtectedRoute';

import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Privacy from './pages/Privacy';
import Terms from './pages/Terms';
import AdminDashboard from './pages/AdminDashboard';
import OwnerDashboard from './pages/OwnerDashboard';
import OwnerMembership from './pages/OwnerMembership';
import RenterDashboard from './pages/RenterDashboard';
import BookingSuccess from './pages/BookingSuccess';
import BookingCancel from './pages/BookingCancel';
import Vehicles from './pages/Vehicles';
import Wallet from './pages/Wallet';
import Profile from './pages/Profile';

const AdminOnly = ({ children }) => {
  const { isAdmin } = useAuth();
  return isAdmin ? <>{children}</> : <Navigate to="/" replace />;
};

const OwnerOnly = ({ children }) => {
  const { isOwner } = useAuth();
  return isOwner ? <>{children}</> : <Navigate to="/" replace />;
};

const RenterOnly = ({ children }) => {
  const { isRenter } = useAuth();
  return isRenter ? <>{children}</> : <Navigate to="/" replace />;
};

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Navbar />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/vehicles" element={<Vehicles />} />
          <Route path="/wallet" element={<ProtectedRoute><Wallet /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />

          {/* Admin Routes */}
          <Route
            path="/admin/dashboard"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminOnly><AdminDashboard /></AdminOnly>
              </ProtectedRoute>
            }
          />

          {/* Owner Routes */}
          <Route
            path="/owner/dashboard"
            element={
              <ProtectedRoute allowedRoles={['owner', 'admin']}>
                <OwnerOnly><OwnerDashboard /></OwnerOnly>
              </ProtectedRoute>
            }
          />
          <Route
            path="/owner/membership"
            element={
              <ProtectedRoute allowedRoles={['owner', 'admin']}>
                <OwnerOnly><OwnerMembership /></OwnerOnly>
              </ProtectedRoute>
            }
          />

          {/* Renter Routes */}
          <Route
            path="/renter/dashboard"
            element={
              <ProtectedRoute allowedRoles={['renter', 'admin']}>
                <RenterOnly><RenterDashboard /></RenterOnly>
              </ProtectedRoute>
            }
          />

          {/* Booking Success/Cancel */}
          <Route path="/booking-success/:id" element={<BookingSuccess />} />
          <Route path="/booking-cancel/:id" element={<BookingCancel />} />
        </Routes>
        <Footer />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;