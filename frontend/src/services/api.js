import axios from 'axios';

// LOGIKA OTOMATIS:
// Jika sedang di Laptop (Development) -> Pakai Localhost:8080
// Jika sedang di Render (Production) -> Pakai URL Render
const API_URL = import.meta.env.DEV 
  ? 'http://localhost:8080/api' 
  : 'https://simanis-mmqi.onrender.com/api';

console.log('Saat ini terhubung ke:', API_URL); // Cek Console browser untuk memastikan

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor Token (Biarkan seperti semula)
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export default api;