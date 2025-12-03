import axios from 'axios';

// === LOGIKA FINAL (OTOMATIS) ===
// 1. Cek apakah ada 'VITE_API_URL' (Ini yang kita setting di Dashboard Vercel tadi).
// 2. Jika TIDAK ADA (artinya sedang di laptop/local), otomatis pakai 'http://localhost:8080'.
// ----------------------------------------------------------------------------------------
const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

console.log('🔗 Terhubung ke API:', `${BASE_URL}/api`); // Cek console browser untuk memastikan

const api = axios.create({
  baseURL: `${BASE_URL}/api`, // Kita tambahkan /api di sini agar rapi
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor Token (Tetap sama)
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