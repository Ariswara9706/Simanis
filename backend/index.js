// index.js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

const app = express();

// Middleware Global
app.use(helmet());
app.use(cors()); // Sesuaikan origin untuk keamanan produksi
app.use(express.json());
app.use(morgan('dev'));

// Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/dashboard', require('./routes/dashboardRoutes'));
app.use('/api/anjab', require('./routes/anjabRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));

// Health Check (Penting untuk Fly.io)
app.get('/', (req, res) => {
  res.send('API Anjab is Running...');
});

const PORT = process.env.PORT || 10000; // Render defaultnya sering pakai 10000
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});