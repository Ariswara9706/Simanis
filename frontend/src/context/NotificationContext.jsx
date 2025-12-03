import React, { createContext, useState, useEffect, useContext } from 'react';
import api from '../services/api';
import { useAuth } from './AuthContext';

const NotificationContext = createContext();

export const NotificationProvider = ({ children }) => {
  const { user } = useAuth();
  const [notifCounts, setNotifCounts] = useState({ pending: 0, approved: 0 });

  const refreshNotifs = async () => {
    if (!user) return;
    try {
      const res = await api.get('/dashboard/notifications');
      setNotifCounts(res.data);
    } catch (error) {
      console.error("Gagal update notifikasi", error);
    }
  };

  useEffect(() => {
    refreshNotifs();
    const interval = setInterval(refreshNotifs, 30000); // Cek tiap 30 detik
    return () => clearInterval(interval);
  }, [user]);

  return (
    <NotificationContext.Provider value={{ notifCounts, refreshNotifs }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotification = () => useContext(NotificationContext);