// --- TAMBAHKAN BARIS INI DI PALING ATAS ---
import React from 'react'; 
// ------------------------------------------

import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Anjab from './pages/Anjab';
import Users from './pages/Users'; // Tambahkan iniimport { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import Logs from './pages/Logs'; // <--- Import ini
// --- TAMBAHKAN IMPORT INI ---
import { NotificationProvider } from './context/NotificationContext';
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
      {/* --- Route Baru: Users --- */}
      <Route path="/users" element={
        <PrivateRoute>
          <Users />
        </PrivateRoute>
      } />
{/* --- Route Baru --- */}
      <Route path="/logs" element={<PrivateRoute><Logs /></PrivateRoute>} />
      {/* ------------------ */}
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
        {/* --- PASANG NotificationProvider DISINI (Didalam AuthProvider) --- */}
        <NotificationProvider>
            <AppRoutes />
        </NotificationProvider>
        {/* ---------------------------------------------------------------- */}
      </AuthProvider>
    </>
  );
}