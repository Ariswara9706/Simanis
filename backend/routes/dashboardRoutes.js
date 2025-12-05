// routes/dashboardRoutes.js
const express = require('express');
const router = express.Router();
const pool = require('../db');
const { verifyToken } = require('../middleware/authMiddleware');

// routes/dashboardRoutes.js

router.get('/stats', verifyToken, async (req, res) => {
  try {
    const currentYear = new Date().getFullYear();

    // 1. Total Guru (Termasuk Kepsek & Wakasek biasanya mengandung kata Guru atau Kepala Sekolah)
    const guruCount = await pool.query("SELECT COUNT(*) FROM anjab_data WHERE jabatan ILIKE '%Guru%' OR jabatan ILIKE '%Kepala Sekolah%'");
    
    // 2. Total Tendik
    const tendikCount = await pool.query("SELECT COUNT(*) FROM anjab_data WHERE jabatan NOT ILIKE '%Guru%' AND jabatan NOT ILIKE '%Kepala Sekolah%'");

    // 3. Estimasi Pensiun 5 Tahun Kedepan (LOGIKA BARU: Guru/Kepsek = 60, Lainnya = 58)
    const pensionStats = await pool.query(`
      SELECT 
        (EXTRACT(YEAR FROM tanggal_lahir) + 
         CASE 
            WHEN jabatan ILIKE '%Guru%' OR jabatan ILIKE '%Kepala Sekolah%' THEN 60 
            ELSE 58 
         END
        ) as tahun_pensiun, 
        COUNT(*) as count 
      FROM anjab_data 
      WHERE tanggal_lahir IS NOT NULL
      AND (
        EXTRACT(YEAR FROM tanggal_lahir) + 
        CASE 
            WHEN jabatan ILIKE '%Guru%' OR jabatan ILIKE '%Kepala Sekolah%' THEN 60 
            ELSE 58 
        END
      ) BETWEEN $1 AND $2 
      GROUP BY tahun_pensiun 
      ORDER BY tahun_pensiun ASC
    `, [currentYear, currentYear + 5]);

    // 4. Statistik Per Kecamatan (BARU: Untuk Chart)
    const kecamatanStats = await pool.query(`
        SELECT unit_kerja_kecamatan, COUNT(*) as count
        FROM anjab_data
        WHERE unit_kerja_kecamatan IS NOT NULL
        GROUP BY unit_kerja_kecamatan
        ORDER BY count DESC
    `);

    res.json({
      total_guru: parseInt(guruCount.rows[0].count),
      total_tendik: parseInt(tendikCount.rows[0].count),
      pension_projection: pensionStats.rows,
      kecamatan_stats: kecamatanStats.rows // Kirim data kecamatan ke frontend
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// === GET NOTIFICATION COUNTS ===
router.get('/notifications', verifyToken, async (req, res) => {
    try {
        let pendingCount = 0;
        let approvedCount = 0;

        // Admin/Kasudin: Hitung yang PENDING
        if (req.userRole === 'ADMIN' || req.userRole === 'KASUDIN') {
            const resCount = await pool.query(
                "SELECT COUNT(*) FROM anjab_change_requests WHERE status = 'PENDING'"
            );
            pendingCount = parseInt(resCount.rows[0].count);
        }

        // Guru: Hitung yang SELESAI tapi BELUM DIBACA
        if (req.userRole === 'GURU_TENDIK') {
            const resCount = await pool.query(
                "SELECT COUNT(*) FROM anjab_change_requests WHERE requested_by = $1 AND status IN ('APPROVED', 'REJECTED') AND is_read = FALSE",
                [req.userId]
            );
            approvedCount = parseInt(resCount.rows[0].count);
        }

        res.json({ pending: pendingCount, approved: approvedCount });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// === BARU: API untuk melihat detail pegawai pensiun per tahun ===
router.get('/pension-detail/:year', verifyToken, async (req, res) => {
  try {
    const { year } = req.params;
    
    const query = `
      SELECT 
        nama_pegawai, 
        nip, 
        jabatan, 
        unit_kerja_nama 
      FROM anjab_data 
      WHERE tanggal_lahir IS NOT NULL
      AND (
        EXTRACT(YEAR FROM tanggal_lahir) + 
        CASE 
            WHEN jabatan ILIKE '%Guru%' THEN 60 
            ELSE 58 
        END
      ) = $1
      ORDER BY nama_pegawai ASC
    `;

    const result = await pool.query(query, [year]);
    res.json(result.rows);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;