// routes/adminRoutes.js
const express = require('express');
const router = express.Router();
const pool = require('../db');
const bcrypt = require('bcryptjs');
const { verifyToken, authorize } = require('../middleware/authMiddleware');

// Middleware: Hanya Admins
router.use(verifyToken, authorize(['ADMIN']));

// === 1. LIST PENDING REQUESTS ===
router.get('/verifications', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT r.id, r.anjab_data_id, r.created_at, u.nama_lengkap as requester_name, a.nama_pegawai
      FROM anjab_change_requests r
      JOIN users u ON r.requested_by = u.id
      JOIN anjab_data a ON r.anjab_data_id = a.id
      WHERE r.status = 'PENDING'
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// === 2. DETAIL COMPARE (Before vs After) ===
router.get('/verifications/:requestId', async (req, res) => {
  try {
    // Ambil data request (JSON baru)
    const requestData = await pool.query('SELECT * FROM anjab_change_requests WHERE id = $1', [req.params.requestId]);
    if (requestData.rows.length === 0) return res.status(404).json({ message: 'Request not found' });

    const newData = requestData.rows[0].changes_json;
    const anjabId = requestData.rows[0].anjab_data_id;

    // Ambil data sekarang (Database)
    const currentData = await pool.query('SELECT * FROM anjab_data WHERE id = $1', [anjabId]);
    
    res.json({
      request_info: requestData.rows[0],
      current_data: currentData.rows[0], // Data Lama
      new_data: newData // Data Baru dari user
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// === 3. APPROVE / REJECT REQUEST ===
router.post('/verifications/:requestId/decide', async (req, res) => {
  const { decision, admin_note } = req.body; // decision: 'APPROVED' or 'REJECTED'
  const { requestId } = req.params;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Ambil detail request
    const reqRes = await client.query('SELECT * FROM anjab_change_requests WHERE id = $1', [requestId]);
    const request = reqRes.rows[0];

    if (decision === 'APPROVED') {
        const newData = request.changes_json;
        const anjabId = request.anjab_data_id;
        
        // Update Table Utama
        const keys = Object.keys(newData);
        const values = Object.values(newData);
        // Hapus field yang tidak ada di kolom tabel jika ada (misal id)
        
        const setString = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
        await client.query(
            `UPDATE anjab_data SET ${setString}, updated_at = NOW() WHERE id = $${keys.length + 1}`,
            [...values, anjabId]
        );
    }

    // Update Status Request
    await client.query(
        `UPDATE anjab_change_requests SET status = $1, admin_note = $2, processed_at = NOW() WHERE id = $3`,
        [decision, admin_note, requestId]
    );

    // Log Activity
    await client.query(
        `INSERT INTO activity_logs (user_id, action_type, description) VALUES ($1, $2, $3)`,
        [req.userId, `VERIFY_${decision}`, `Request ID ${requestId} was ${decision}`]
    );

    await client.query('COMMIT');
    res.json({ message: `Request successfully ${decision}` });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// === 4. USER MANAGEMENT (Add User) ===
router.post('/users', async (req, res) => {
    const { username, password, role, nama_lengkap } = req.body;
    const hash = bcrypt.hashSync(password, 8);
    try {
        await pool.query(
            'INSERT INTO users (username, password_hash, role, nama_lengkap) VALUES ($1, $2, $3, $4)',
            [username, hash, role, nama_lengkap]
        );
        res.json({ message: 'User created' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// === 5. ACTIVITY LOGS ===
router.get('/logs', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT l.*, u.username, u.role 
            FROM activity_logs l 
            LEFT JOIN users u ON l.user_id = u.id 
            ORDER BY l.created_at DESC LIMIT 100
        `);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;