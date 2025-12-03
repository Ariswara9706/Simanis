// --- TAMBAHKAN BARIS INI DI PALING ATAS ---
import React from 'react'; 
// ------------------------------------------

import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Anjab from './pages/Anjab';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';

// Komponen Proteksi (Harus Login)
const PrivateRoute = ({ children }) => {
  const { token } = useAuth();
  return token ? children : <Navigate to="/login" />;
};

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      
      <Route path="/dashboard" element={
        <PrivateRoute>
          <Dashboard />
        </PrivateRoute>
      } />
      <Route path="/anjab" element={
        <PrivateRoute>
          <Anjab />
        </PrivateRoute>
      } />

      {/* Redirect root ke login */}
      <Route path="*" element={<Navigate to="/login" />} />
    </Routes>
  );
}

export default function App() {
  return (
    // Error terjadi di sini (Fragment <>) karena React tidak didefinisikan
    <>
      <Toaster position="top-right" />
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </>
  );
}