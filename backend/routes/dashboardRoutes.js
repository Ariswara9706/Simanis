// routes/dashboardRoutes.js
const express = require('express');
const router = express.Router();
const pool = require('../db');
const { verifyToken } = require('../middleware/authMiddleware');

router.get('/stats', verifyToken, async (req, res) => {
  try {
    // 1. Total Guru (Asumsi jabatan mengandung kata 'Guru')
    const guruCount = await pool.query("SELECT COUNT(*) FROM anjab_data WHERE jabatan ILIKE '%Guru%'");
    
    // 2. Total Tendik (Asumsi jabatan TIDAK mengandung kata 'Guru')
    const tendikCount = await pool.query("SELECT COUNT(*) FROM anjab_data WHERE jabatan NOT ILIKE '%Guru%'");

    // 3. Estimasi Pensiun 5 Tahun Kedepan (2025 - 2030)
    const currentYear = new Date().getFullYear();
    const pensionStats = await pool.query(`
      SELECT estimasi_pensiun_tahun, COUNT(*) as count 
      FROM anjab_data 
      WHERE estimasi_pensiun_tahun BETWEEN $1 AND $2 
      GROUP BY estimasi_pensiun_tahun 
      ORDER BY estimasi_pensiun_tahun ASC
    `, [currentYear, currentYear + 5]);

    res.json({
      total_guru: parseInt(guruCount.rows[0].count),
      total_tendik: parseInt(tendikCount.rows[0].count),
      pension_projection: pensionStats.rows
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;