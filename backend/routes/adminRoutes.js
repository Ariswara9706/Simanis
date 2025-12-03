const express = require('express');
const router = express.Router();
const pool = require('../db');
const bcrypt = require('bcryptjs');
const { verifyToken, authorize } = require('../middleware/authMiddleware');

// Middleware: Hanya Admin
router.use(verifyToken, authorize(['ADMIN']));

// === DAFTAR KOLOM VALID (WHITELIST) ===
// Copy dari anjabRoutes agar konsisten
const VALID_COLUMNS = [
  'nama_pegawai', 'tanggal_lahir', 'status_pegawai', 'jabatan',
  'nip', 'nrk', 'nikki', 'nuptk', 'nik',
  'alamat_jalan', 'rt', 'rw', 'kelurahan', 'kecamatan_domisili', 'kota_kabupaten',
  'unit_kerja_nama', 'unit_kerja_kecamatan', 'npsn', 'tmt_unit_kerja',
  'ijazah', 'bidang_studi_pendidikan', 'bidang_studi_sertifikasi', 
  'mata_pelajaran_diajarkan', 'tugas_tambahan', 'jam_mengajar_utama',
  'penyandang_difabel', 'keterangan', 'besaran_gaji', 'sumber_gaji', 
  'estimasi_pensiun_tahun'
];

// === 1. LIST USERS ===
router.get('/users', async (req, res) => {
    try {
        const result = await pool.query('SELECT id, username, role, nama_lengkap, created_at FROM users ORDER BY id ASC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// === 2. ADD USER ===
router.post('/users', async (req, res) => {
    const { username, password, role, nama_lengkap, anjab_id } = req.body;
    
    if (!username || !password || !role || !nama_lengkap) {
        return res.status(400).json({ message: 'Semua field wajib diisi' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const checkUser = await client.query('SELECT id FROM users WHERE username = $1', [username]);
        if (checkUser.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: 'Username sudah digunakan' });
        }

        const hash = bcrypt.hashSync(password, 8);
        const newUser = await client.query(
            'INSERT INTO users (username, password_hash, role, nama_lengkap) VALUES ($1, $2, $3, $4) RETURNING id',
            [username, hash, role, nama_lengkap]
        );
        const newUserId = newUser.rows[0].id;

        if (anjab_id && role === 'GURU_TENDIK') {
            await client.query('UPDATE anjab_data SET user_id = $1 WHERE id = $2', [newUserId, anjab_id]);
        }

        await client.query(
            `INSERT INTO activity_logs (user_id, action_type, description) VALUES ($1, 'ADD_USER', $2)`,
            [req.userId, `Menambah user baru: ${username}`]
        );

        await client.query('COMMIT');
        res.json({ message: 'User berhasil dibuat' });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

// === 3. UPDATE USER ===
router.put('/users/:id', async (req, res) => {
    const { id } = req.params;
    const { username, password, role, nama_lengkap, anjab_id } = req.body;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const oldUser = await client.query('SELECT * FROM users WHERE id = $1', [id]);
        if (oldUser.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'User tidak ditemukan' });
        }

        if (username !== oldUser.rows[0].username) {
            const checkUser = await client.query('SELECT id FROM users WHERE username = $1', [username]);
            if (checkUser.rows.length > 0) {
                await client.query('ROLLBACK');
                return res.status(400).json({ message: 'Username sudah digunakan' });
            }
        }

        let newPasswordHash = oldUser.rows[0].password_hash;
        if (password && password.trim() !== "") {
            newPasswordHash = bcrypt.hashSync(password, 8);
        }

        await client.query(
            'UPDATE users SET username=$1, password_hash=$2, role=$3, nama_lengkap=$4 WHERE id=$5',
            [username, newPasswordHash, role, nama_lengkap, id]
        );

        if (anjab_id && role === 'GURU_TENDIK') {
            await client.query('UPDATE anjab_data SET user_id = $1 WHERE id = $2', [id, anjab_id]);
        }

        await client.query(
            `INSERT INTO activity_logs (user_id, action_type, description) VALUES ($1, 'EDIT_USER', $2)`,
            [req.userId, `Edit user ID: ${id}`]
        );

        await client.query('COMMIT');
        res.json({ message: 'User updated' });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

// === 4. DELETE USER ===
router.delete('/users/:id', async (req, res) => {
    const targetId = req.params.id;
    if (parseInt(targetId) === req.userId) return res.status(400).json({ message: 'Cannot delete self' });

    try {
        await pool.query('DELETE FROM users WHERE id = $1', [targetId]);
        res.json({ message: 'User deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// === 5. VERIFICATIONS (List & Detail) ===
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

router.get('/verifications/:requestId', async (req, res) => {
    try {
      const requestData = await pool.query('SELECT * FROM anjab_change_requests WHERE id = $1', [req.params.requestId]);
      if (requestData.rows.length === 0) return res.status(404).json({ message: 'Request not found' });
  
      const newData = requestData.rows[0].changes_json;
      const anjabId = requestData.rows[0].anjab_data_id;
      const currentData = await pool.query('SELECT * FROM anjab_data WHERE id = $1', [anjabId]);
      
      res.json({
        request_info: requestData.rows[0],
        current_data: currentData.rows[0],
        new_data: newData
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
});

// === 6. APPROVE / REJECT (DENGAN FILTER PENGAMAN) ===
router.post('/verifications/:requestId/decide', async (req, res) => {
    const { decision, admin_note } = req.body; 
    const { requestId } = req.params;
  
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
  
      const reqRes = await client.query('SELECT * FROM anjab_change_requests WHERE id = $1', [requestId]);
      if(reqRes.rows.length === 0) throw new Error("Request not found");
      const request = reqRes.rows[0];
  
      if (decision === 'APPROVED') {
          const rawData = request.changes_json;
          const anjabId = request.anjab_data_id;

          // --- FILTER PENGAMAN (CLEANING DATA) ---
          const cleanData = {};
          Object.keys(rawData).forEach(key => {
              if (VALID_COLUMNS.includes(key)) {
                  let value = rawData[key];
                  // Fix Data Kosong agar tidak error di Database
                  if (value === '') {
                      if (['besaran_gaji', 'jam_mengajar_utama', 'estimasi_pensiun_tahun'].includes(key)) {
                          value = 0; 
                      } else {
                          value = null;
                      }
                  }
                  cleanData[key] = value;
              }
          });

          const keys = Object.keys(cleanData);
          const values = Object.values(cleanData);
          
          if (keys.length > 0) {
              const setString = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
              await client.query(
                  `UPDATE anjab_data SET ${setString}, updated_at = NOW() WHERE id = $${keys.length + 1}`,
                  [...values, anjabId]
              );
          }
      }
  
      await client.query(
          `UPDATE anjab_change_requests SET status = $1, admin_note = $2, processed_at = NOW() WHERE id = $3`,
          [decision, admin_note, requestId]
      );
  
      await client.query(
          `INSERT INTO activity_logs (user_id, action_type, description) VALUES ($1, $2, $3)`,
          [req.userId, `VERIFY_${decision}`, `Request ID ${requestId} was ${decision}`]
      );
  
      await client.query('COMMIT');
      res.json({ message: `Request successfully ${decision}` });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error("VERIFY ERROR:", err); // Log error di terminal backend
      res.status(500).json({ error: err.message });
    } finally {
      client.release();
    }
});

// === 4. GET LOGS (Dengan Pagination) ===
router.get('/logs', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20; // Default 20 data per halaman
        const offset = (page - 1) * limit;

        // Query Data
        const query = `
            SELECT l.*, u.username, u.role, u.nama_lengkap
            FROM activity_logs l 
            LEFT JOIN users u ON l.user_id = u.id 
            ORDER BY l.created_at DESC 
            LIMIT $1 OFFSET $2
        `;
        
        // Query Total Data (untuk hitung jumlah halaman)
        const countQuery = `SELECT COUNT(*) FROM activity_logs`;

        const result = await pool.query(query, [limit, offset]);
        const countResult = await pool.query(countQuery);
        
        const totalItems = parseInt(countResult.rows[0].count);
        const totalPages = Math.ceil(totalItems / limit);

        res.json({
            data: result.rows,
            pagination: {
                totalItems,
                totalPages,
                currentPage: page,
                limit
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
module.exports = router;