// routes/anjabRoutes.js
const express = require('express');
const router = express.Router();
const pool = require('../db');
const { verifyToken, authorize } = require('../middleware/authMiddleware');

// === 1. GET DATA (Dengan Filter & Role Logic) ===
router.get('/', verifyToken, async (req, res) => {
  try {
    const { nama, nip, nrk, kecamatan, unit_kerja } = req.query;
    let query = `
      SELECT a.*, 
      (SELECT status FROM anjab_change_requests WHERE anjab_data_id = a.id AND status = 'PENDING' LIMIT 1) as request_status
      FROM anjab_data a 
    `;
    let params = [];
    let conditions = [];

    // Logic Role: Guru hanya lihat data sendiri
    if (req.userRole === 'GURU_TENDIK') {
      conditions.push(`a.user_id = $${params.length + 1}`);
      params.push(req.userId);
    } 
    // Admin & Kasudin lihat semua (bisa tambah filter query string)
    else {
      if (nama) { conditions.push(`a.nama_pegawai ILIKE $${params.length + 1}`); params.push(`%${nama}%`); }
      if (nip) { conditions.push(`a.nip ILIKE $${params.length + 1}`); params.push(`%${nip}%`); }
      if (nrk) { conditions.push(`a.nrk ILIKE $${params.length + 1}`); params.push(`%${nrk}%`); }
      if (kecamatan) { conditions.push(`a.kecamatan_domisili ILIKE $${params.length + 1}`); params.push(`%${kecamatan}%`); }
      if (unit_kerja) { conditions.push(`a.unit_kerja_nama ILIKE $${params.length + 1}`); params.push(`%${unit_kerja}%`); }
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY a.nama_pegawai ASC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// === 2. UPDATE DATA (Logic Guru vs Admin) ===
router.put('/:id', verifyToken, async (req, res) => {
  const { id } = req.params; // ID anjab_data
  const newData = req.body; // Data form lengkap

  try {
    if (req.userRole === 'ADMIN') {
      // --- ADMIN: Direct Update ---
      // (Disini kamu harus menulis query UPDATE SET ... yang panjang sesuai kolom)
      // Untuk mempersingkat contoh, saya pakai dynamic query builder sederhana:
      
      const keys = Object.keys(newData);
      const values = Object.values(newData);
      const setString = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
      
      await pool.query(
        `UPDATE anjab_data SET ${setString}, updated_at = NOW() WHERE id = $${keys.length + 1}`,
        [...values, id]
      );

      // Log activity
      await pool.query(
        `INSERT INTO activity_logs (user_id, action_type, description) VALUES ($1, 'UPDATE_ANJAB', $2)`,
        [req.userId, `Admin updated data ID: ${id}`]
      );

      return res.json({ message: 'Data updated successfully by Admin' });

    } else if (req.userRole === 'GURU_TENDIK') {
      // --- GURU: Request Change (In Progress) ---
      
      // Cek apakah data milik user ini?
      const checkOwner = await pool.query('SELECT user_id FROM anjab_data WHERE id = $1', [id]);
      if (checkOwner.rows.length === 0 || checkOwner.rows[0].user_id !== req.userId) {
        return res.status(403).json({ message: 'Anda hanya bisa mengedit data sendiri' });
      }

      // Cek apakah sudah ada request pending?
      const checkPending = await pool.query('SELECT id FROM anjab_change_requests WHERE anjab_data_id = $1 AND status = $2', [id, 'PENDING']);
      if (checkPending.rows.length > 0) {
        // Update request yang ada atau tolak
        return res.status(400).json({ message: 'Masih ada perubahan yang statusnya In Progress (Pending Verification)' });
      }

      // Insert ke tabel request
      await pool.query(
        `INSERT INTO anjab_change_requests (anjab_data_id, requested_by, changes_json, status) VALUES ($1, $2, $3, 'PENDING')`,
        [id, req.userId, JSON.stringify(newData)]
      );

      // Log
      await pool.query(
        `INSERT INTO activity_logs (user_id, action_type, description) VALUES ($1, 'REQUEST_UPDATE', $2)`,
        [req.userId, `Request update for data ID: ${id}`]
      );

      return res.json({ message: 'Perubahan disimpan sebagai Draft (In Progress), menunggu verifikasi Admin.' });
    } else {
        return res.status(403).json({ message: 'Kasudin cannot edit' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// === 3. DELETE (Admin Only) ===
router.delete('/:id', verifyToken, authorize(['ADMIN']), async (req, res) => {
    try {
        await pool.query('DELETE FROM anjab_data WHERE id = $1', [req.params.id]);
        res.json({ message: 'Data deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;