// routes/anjabRoutes.js
const express = require('express');
const router = express.Router();
const pool = require('../db');
const { verifyToken, authorize } = require('../middleware/authMiddleware');

// === 1. GET DATA (Dengan Filter, Pagination, Sorting) ===
router.get('/', verifyToken, async (req, res) => {
  try {
    const { 
        nama, nip, nrk, kecamatan, unit_kerja, 
        page = 1, limit = 10, 
        sortBy = 'nama_pegawai', sortOrder = 'ASC' 
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Query Dasar
   let baseQuery = `
      SELECT a.*, 
      (SELECT status FROM anjab_change_requests WHERE anjab_data_id = a.id AND status = 'PENDING' LIMIT 1) as request_status,
      (SELECT id FROM anjab_change_requests WHERE anjab_data_id = a.id AND status = 'PENDING' LIMIT 1) as pending_request_id
      FROM anjab_data a 
    `;
    
    let countQuery = `SELECT COUNT(*) FROM anjab_data a`;

    let params = [];
    let conditions = [];

    // Filter Logic
    if (req.userRole === 'GURU_TENDIK') {
      conditions.push(`a.user_id = $${params.length + 1}`);
      params.push(req.userId);
    } else {
      if (nama) { conditions.push(`a.nama_pegawai ILIKE $${params.length + 1}`); params.push(`%${nama}%`); }
      if (nip) { conditions.push(`a.nip ILIKE $${params.length + 1}`); params.push(`%${nip}%`); }
      if (nrk) { conditions.push(`a.nrk ILIKE $${params.length + 1}`); params.push(`%${nrk}%`); }
      if (kecamatan) { conditions.push(`a.kecamatan_domisili ILIKE $${params.length + 1}`); params.push(`%${kecamatan}%`); }
      if (unit_kerja) { conditions.push(`a.unit_kerja_nama ILIKE $${params.length + 1}`); params.push(`%${unit_kerja}%`); }
    }

    if (conditions.length > 0) {
      const whereClause = ' WHERE ' + conditions.join(' AND ');
      baseQuery += whereClause;
      countQuery += whereClause;
    }

    // Sorting Logic
    // Jika sort by status, kita pakai alias 'request_status'
    let orderClause = '';
    if (sortBy === 'status_verifikasi') {
        orderClause = ` ORDER BY request_status ${sortOrder} NULLS LAST`;
    } else {
        // Default sort by column name
        orderClause = ` ORDER BY a.${sortBy} ${sortOrder}`;
    }

    // Pagination
    const limitClause = ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    
    // Eksekusi Query Data
    const finalQuery = baseQuery + orderClause + limitClause;
    const dataResult = await pool.query(finalQuery, [...params, limit, offset]);

    // Eksekusi Query Total (Untuk menghitung halaman)
    const countResult = await pool.query(countQuery, params);
    const totalItems = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(totalItems / limit);

    res.json({
        data: dataResult.rows,
        pagination: {
            totalItems,
            totalPages,
            currentPage: parseInt(page),
            limit: parseInt(limit)
        }
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// === 2. UPDATE DATA (Logic Guru vs Admin) ===
router.put('/:id', verifyToken, async (req, res) => {
  const { id } = req.params; 
  const newData = req.body; 

  try {
    // --- PEMBERSIHAN DATA (PENTING) ---
    // Kita buang field yang tidak boleh di-update langsung atau field virtual
    // agar database tidak error "Column does not exist"
    const { 
      id: _id,            // Buang ID (karena sudah ada di params)
      request_status,     // Buang status virtual
      created_at,         // Jangan update tanggal buat
      updated_at,         // Nanti diupdate otomatis
      user_id,            // Jangan ubah pemilik sembarangan
      ...cleanData        // Sisa data bersih disimpan di 'cleanData'
    } = newData;

    // Fix Data Kosong untuk Angka (agar tidak error invalid syntax integer)
    if (cleanData.estimasi_pensiun_tahun === '') cleanData.estimasi_pensiun_tahun = null;
    if (cleanData.besaran_gaji === '') cleanData.besaran_gaji = 0;
    if (cleanData.jam_mengajar_utama === '') cleanData.jam_mengajar_utama = 0;


    if (req.userRole === 'ADMIN') {
      // --- ADMIN: Direct Update ---
      
      const keys = Object.keys(cleanData);
      const values = Object.values(cleanData);
      
      if (keys.length === 0) {
        return res.status(400).json({ message: "Tidak ada data yang valid untuk diupdate" });
      }

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
      
      const checkOwner = await pool.query('SELECT user_id FROM anjab_data WHERE id = $1', [id]);
      if (checkOwner.rows.length === 0 || checkOwner.rows[0].user_id !== req.userId) {
        return res.status(403).json({ message: 'Anda hanya bisa mengedit data sendiri' });
      }

      const checkPending = await pool.query('SELECT id FROM anjab_change_requests WHERE anjab_data_id = $1 AND status = $2', [id, 'PENDING']);
      if (checkPending.rows.length > 0) {
        return res.status(400).json({ message: 'Masih ada perubahan yang statusnya In Progress' });
      }

      // Simpan data bersih (cleanData) ke JSON request
      await pool.query(
        `INSERT INTO anjab_change_requests (anjab_data_id, requested_by, changes_json, status) VALUES ($1, $2, $3, 'PENDING')`,
        [id, req.userId, JSON.stringify(cleanData)]
      );

      await pool.query(
        `INSERT INTO activity_logs (user_id, action_type, description) VALUES ($1, 'REQUEST_UPDATE', $2)`,
        [req.userId, `Request update for data ID: ${id}`]
      );

      return res.json({ message: 'Perubahan disimpan sebagai Draft, menunggu verifikasi Admin.' });
    } else {
        return res.status(403).json({ message: 'Role ini tidak memiliki akses edit' });
    }
  } catch (err) {
    console.error(err); // Print error di terminal backend agar terlihat
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


// === 4. GET HISTORY PER ITEM (Dipecah: Pengajuan & Keputusan) ===
router.get('/:id/history', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;

        // 1. Ambil SEMUA request (tanpa limit SQL dulu, karena kita mau memecah baris di JS)
        const query = `
            SELECT r.id, r.created_at, r.processed_at, r.status, r.admin_note, u.nama_lengkap as pemohon
            FROM anjab_change_requests r
            LEFT JOIN users u ON r.requested_by = u.id
            WHERE r.anjab_data_id = $1
            ORDER BY r.created_at DESC
        `;
        
        const result = await pool.query(query, [id]);
        
        // 2. LOGIKA SPLIT: 1 Row Database -> Jadi 2 Baris History (Timeline)
        let events = [];
        
        result.rows.forEach(row => {
            // A. Event Keputusan (Hanya jika sudah diproses/tidak pending)
            // Ini ditaruh duluan biar muncul paling atas (terbaru)
            if (row.status !== 'PENDING' && row.processed_at) {
                events.push({
                    id: `dec-${row.id}`, // ID unik buatan
                    created_at: row.processed_at, // Waktu admin klik
                    pemohon: 'Admin Verifikator', // Actornya admin
                    status: row.status, // APPROVED / REJECTED
                    admin_note: row.admin_note,
                    original_status: 'DECISION'
                });
            }
            
            // B. Event Pengajuan (Selalu ada)
            events.push({
                id: `req-${row.id}`,
                created_at: row.created_at, // Waktu user klik simpan
                pemohon: row.pemohon || 'User',
                status: 'MENUNGGU VERIFIKASI', // Label historis
                admin_note: '-', // Saat pengajuan belum ada note
                original_status: 'REQUEST'
            });
        });

        // 3. Sorting Ulang berdasarkan Waktu (Terbaru diatas)
        events.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        // 4. Pagination Manual (Memory Slicing)
        const totalItems = events.length;
        const totalPages = Math.ceil(totalItems / limit);
        const startIndex = (page - 1) * limit;
        const paginatedData = events.slice(startIndex, startIndex + limit);

        res.json({
            data: paginatedData,
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

// === 5. MARK AS READ (Tandai Sudah Dibaca) ===
router.put('/:id/mark-read', verifyToken, async (req, res) => {
    try {
        const { id } = req.params; // ID Data Anjab
        
        // Update request milik user ini yang terkait data ini menjadi is_read = TRUE
        await pool.query(
            `UPDATE anjab_change_requests 
             SET is_read = TRUE 
             WHERE anjab_data_id = $1 AND requested_by = $2 AND status IN ('APPROVED', 'REJECTED')`,
            [id, req.userId]
        );

        res.json({ message: 'Marked as read' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;