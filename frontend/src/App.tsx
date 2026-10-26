import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Toaster } from 'react-hot-toast';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Vehicles from './pages/Vehicles';
import Drivers from './pages/Drivers';
import Trips from './pages/Trips';
import Maintenance from './pages/Maintenance';
import Analytics from './pages/Analytics';
import Settings from './pages/Settings';
import Login from './pages/Login';
import Register from './pages/Register';
import Landing from './pages/Landing';
import Profile from './pages/Profile';
import TripTracking from './pages/TripTracking';
import FuelExpenses from './pages/FuelExpenses';
import SSOCallback from './pages/SSOCallback';
import ClerkTokenBridge from './components/ClerkTokenBridge';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

function AppRoutes() {
  const { isAuthenticated } = useAuth();

  return (
    <Routes>
      <Route path="/" element={isAuthenticated ? <Navigate to="/app" replace /> : <Landing />} />
      <Route path="/login" element={isAuthenticated ? <Navigate to="/app" replace /> : <Login />} />
      <Route path="/register" element={isAuthenticated ? <Navigate to="/app" replace /> : <Register />} />
      
      <Route path="/app" element={
        <ProtectedRoute>
          <Layout />
        </ProtectedRoute>
      }>
        <Route index element={<Dashboard />} />
        <Route path="vehicles" element={<Vehicles />} />
        <Route path="drivers" element={<Drivers />} />
        <Route path="trips" element={<Trips />} />
        <Route path="trips/:id/track" element={<TripTracking />} />
        <Route path="maintenance" element={<Maintenance />} />
        <Route path="expenses" element={<FuelExpenses />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="settings" element={<Settings />} />
        <Route path="profile" element={<Profile />} />
      </Route>

      <Route path="/sso-callback" element={<SSOCallback />} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ClerkTokenBridge />
      <Toaster 
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: 'rgba(255, 255, 255, 0.85)',
            backdropFilter: 'blur(12px) saturate(180%)',
            WebkitBackdropFilter: 'blur(12px) saturate(180%)',
            color: '#1e293b',
            padding: '16px 24px',
            borderRadius: '20px',
            fontSize: '14px',
            fontWeight: '600',
            letterSpacing: '-0.01em',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.05), 0 10px 10px -5px rgba(0, 0, 0, 0.02)',
            maxWidth: '420px',
          },
          success: {
            iconTheme: {
              primary: '#059669',
              secondary: '#ffffff',
            },
            style: {
              borderLeft: '5px solid #059669',
            },
          },
          error: {
            iconTheme: {
              primary: '#e11d48',
              secondary: '#ffffff',
            },
            style: {
              borderLeft: '5px solid #e11d48',
            },
          },
        }}
      />
      <AppRoutes />
    </AuthProvider>
  );
}
