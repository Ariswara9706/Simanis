// routes/anjabRoutes.js
const express = require('express');
const router = express.Router();
const pool = require('../db');
const multer = require('multer');
const xlsx = require('xlsx');
const upload = multer({ storage: multer.memoryStorage() }); // Simpan di RAM sementara
const { verifyToken, authorize } = require('../middleware/authMiddleware');

// === 1. GET DATA (Update: Tambah Filter Jabatan & Status Pegawai) ===
router.get('/', verifyToken, async (req, res) => {
  try {
    const { 
        nama, nip, nrk, 
        unit_kerja, jabatan, status_pegawai, // <--- Tambah param baru
        status_verifikasi,
        page = 1, limit = 10, 
        sortBy = 'nama_pegawai', sortOrder = 'ASC' 
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const statusSubquery = `(SELECT status FROM anjab_change_requests WHERE anjab_data_id = a.id AND status = 'PENDING' LIMIT 1)`;

    let baseQuery = `
       SELECT a.*, 
       ${statusSubquery} as request_status,
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
      if (nip) { conditions.push(`(a.nip ILIKE $${params.length + 1} OR a.nrk ILIKE $${params.length + 1})`); params.push(`%${nip}%`); } // Gabung NIP/NRK
      
      // --- FILTER BARU ---
      if (unit_kerja) { conditions.push(`a.unit_kerja_nama ILIKE $${params.length + 1}`); params.push(`%${unit_kerja}%`); }
      if (jabatan) { conditions.push(`a.jabatan ILIKE $${params.length + 1}`); params.push(`%${jabatan}%`); }
      if (status_pegawai) { conditions.push(`a.status_pegawai = $${params.length + 1}`); params.push(status_pegawai); }
      // -------------------

      if (status_verifikasi === 'PENDING') {
          conditions.push(`${statusSubquery} = 'PENDING'`);
      } else if (status_verifikasi === 'VERIFIED') {
          conditions.push(`${statusSubquery} IS NULL`);
      }
    }

    if (conditions.length > 0) {
      const whereClause = ' WHERE ' + conditions.join(' AND ');
      baseQuery += whereClause;
      countQuery += whereClause;
    }

    // Sorting & Pagination (Tetap sama)
    let orderClause = '';
    if (sortBy === 'status_verifikasi') {
        orderClause = ` ORDER BY request_status ${sortOrder} NULLS LAST`;
    } else {
        orderClause = ` ORDER BY a.${sortBy} ${sortOrder}`;
    }

    const limitClause = ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    
    const dataResult = await pool.query(baseQuery + orderClause + limitClause, [...params, limit, offset]);
    const countResult = await pool.query(countQuery, params);
    
    const totalItems = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(totalItems / limit);

    res.json({
        data: dataResult.rows,
        pagination: { totalItems, totalPages, currentPage: parseInt(page), limit: parseInt(limit) }
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// === BARU: GET DISTINCT OPTIONS (Untuk Autocomplete Frontend) ===
router.get('/options', verifyToken, async (req, res) => {
    try {
        // Ambil list unik untuk Unit Kerja dan Jabatan
        // Kita pakai DISTINCT agar datanya tidak duplikat
        const unitQuery = await pool.query(`SELECT DISTINCT unit_kerja_nama FROM anjab_data WHERE unit_kerja_nama IS NOT NULL ORDER BY unit_kerja_nama ASC`);
        const jabatanQuery = await pool.query(`SELECT DISTINCT jabatan FROM anjab_data WHERE jabatan IS NOT NULL ORDER BY jabatan ASC`);
        
        // Kirim ke frontend
        res.json({
            units: unitQuery.rows.map(r => r.unit_kerja_nama),
            jabatans: jabatanQuery.rows.map(r => r.jabatan)
        });
    } catch (err) {
        res.status(500).json({ error: "Gagal mengambil data options" });
    }
});
// === BARU: EXPORT EXCEL DATA (Sesuai Filter) ===
router.get('/export', verifyToken, async (req, res) => {
    try {
        const { nama, nip, unit_kerja, status_verifikasi } = req.query;
        
        // Logic Query SAMA dengan GET, tapi TANPA PAGINATION
        const statusSubquery = `(SELECT status FROM anjab_change_requests WHERE anjab_data_id = a.id AND status = 'PENDING' LIMIT 1)`;
        let query = `SELECT a.nama_pegawai, a.nip, a.nrk, a.jabatan, a.unit_kerja_nama, a.status_pegawai, a.golongan, ${statusSubquery} as status_perubahan FROM anjab_data a`;
        
        let params = [];
        let conditions = [];

        if (nama) { conditions.push(`a.nama_pegawai ILIKE $${params.length + 1}`); params.push(`%${nama}%`); }
        if (nip) { conditions.push(`a.nip ILIKE $${params.length + 1}`); params.push(`%${nip}%`); }
        if (unit_kerja) { conditions.push(`a.unit_kerja_nama ILIKE $${params.length + 1}`); params.push(`%${unit_kerja}%`); }
        
        if (status_verifikasi === 'PENDING') conditions.push(`${statusSubquery} = 'PENDING'`);
        else if (status_verifikasi === 'VERIFIED') conditions.push(`${statusSubquery} IS NULL`);

        if (conditions.length > 0) query += ' WHERE ' + conditions.join(' AND ');
        
        query += ` ORDER BY a.nama_pegawai ASC`; // Default sort nama

        const result = await pool.query(query, params);

        // Buat Excel dengan SheetJS
        const worksheet = xlsx.utils.json_to_sheet(result.rows);
        const workbook = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(workbook, worksheet, "Data Pegawai");

        const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });

        res.setHeader('Content-Disposition', 'attachment; filename="Data_Anjab_Export.xlsx"');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(buffer);

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Gagal export data" });
    }
});

// === 2. UPDATE DATA (Logic Guru vs Admin) - FIX ERROR 500 ===
router.put('/:id', verifyToken, async (req, res) => {
  const { id } = req.params; 
  const newData = req.body; 

  try {
    // --- 1. PEMBERSIHAN DATA (CLEANING) ---
    // Buang semua field yang bukan kolom asli tabel 'anjab_data'
    // agar query SQL tidak error "Column does not exist"
    const { 
      id: _id,            // Buang ID (karena sudah ada di params)
      request_status,     // Virtual column
      pending_request_id, // Virtual column (PENYEBAB UTAMA ERROR)
      status_perubahan,   // Virtual column (dari export)
      created_at,         // Jangan update tanggal buat
      updated_at,         // Nanti diupdate otomatis
      user_id,            // Jangan ubah pemilik
      ...cleanData        // Sisa data bersih disimpan di sini
    } = newData;

    // --- 2. SANITASI DATA KOSONG ---
    // Ubah string kosong "" menjadi NULL.
    // PostgreSQL akan error jika kolom DATE diisi "" (string kosong).
    Object.keys(cleanData).forEach(key => {
        if (typeof cleanData[key] === 'string' && cleanData[key].trim() === '') {
            cleanData[key] = null;
        }
    });

    // Default Value untuk Angka (agar tidak error math operation nantinya)
    if (cleanData.besaran_gaji === null) cleanData.besaran_gaji = 0;
    if (cleanData.jam_mengajar_utama === null) cleanData.jam_mengajar_utama = 0;
    if (cleanData.estimasi_pensiun_tahun === null) cleanData.estimasi_pensiun_tahun = 0;


    if (req.userRole === 'ADMIN') {
      // --- ADMIN: Direct Update ---
      
      const keys = Object.keys(cleanData);
      const values = Object.values(cleanData);
      
      if (keys.length === 0) {
        return res.status(400).json({ message: "Tidak ada data yang valid untuk diupdate" });
      }

      // Buat query dinamis: "nama_pegawai = $1, nip = $2, ..."
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

      return res.json({ message: 'Data berhasil diperbarui' });

    } else if (req.userRole === 'GURU_TENDIK') {
      // --- GURU: Request Change (Draft) ---
      
      const checkOwner = await pool.query('SELECT user_id FROM anjab_data WHERE id = $1', [id]);
      if (checkOwner.rows.length === 0 || checkOwner.rows[0].user_id !== req.userId) {
        return res.status(403).json({ message: 'Anda hanya bisa mengedit data sendiri' });
      }

      const checkPending = await pool.query('SELECT id FROM anjab_change_requests WHERE anjab_data_id = $1 AND status = $2', [id, 'PENDING']);
      if (checkPending.rows.length > 0) {
        return res.status(400).json({ message: 'Masih ada perubahan yang statusnya Menunggu Verifikasi' });
      }

      // Simpan request
      await pool.query(
        `INSERT INTO anjab_change_requests (anjab_data_id, requested_by, changes_json, status) VALUES ($1, $2, $3, 'PENDING')`,
        [id, req.userId, JSON.stringify(cleanData)]
      );

      await pool.query(
        `INSERT INTO activity_logs (user_id, action_type, description) VALUES ($1, 'REQUEST_UPDATE', $2)`,
        [req.userId, `Request update for data ID: ${id}`]
      );

      return res.json({ message: 'Perubahan disimpan, menunggu verifikasi Admin.' });
    } else {
        return res.status(403).json({ message: 'Role ini tidak memiliki akses edit' });
    }
  } catch (err) {
    console.error("UPDATE ERROR:", err); // Log error di terminal biar ketahuan
    res.status(500).json({ error: 'Gagal update data: ' + err.message });
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

// === 4. GET HISTORY PER ITEM ===
router.get('/:id/history', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;

        const query = `
            SELECT r.id, r.created_at, r.processed_at, r.status, r.admin_note, u.nama_lengkap as pemohon
            FROM anjab_change_requests r
            LEFT JOIN users u ON r.requested_by = u.id
            WHERE r.anjab_data_id = $1
            ORDER BY r.created_at DESC
        `;
        
        const result = await pool.query(query, [id]);
        
        let events = [];
        
        result.rows.forEach(row => {
            // A. Event Keputusan
            if (row.status !== 'PENDING' && row.processed_at) {
                events.push({
                    id: `dec-${row.id}`,
                    created_at: row.processed_at,
                    pemohon: 'Admin Verifikator',
                    status: row.status,
                    admin_note: row.admin_note,
                    original_status: 'DECISION'
                });
            }
            // B. Event Pengajuan
            events.push({
                id: `req-${row.id}`,
                created_at: row.created_at,
                pemohon: row.pemohon || 'User',
                status: 'MENUNGGU VERIFIKASI',
                admin_note: '-',
                original_status: 'REQUEST'
            });
        });

        // Sort Descending by Time
        events.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        // Pagination Manual
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

// === 5. MARK AS READ ===
router.put('/:id/mark-read', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
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

// === 6. UPLOAD EXCEL (STRICT NIK + PARTIAL UPDATE) ===
router.post('/upload', verifyToken, authorize(['ADMIN']), upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

    const client = await pool.connect();

    try {
        console.time("UploadTimer");
        
        // Baca Excel
        const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        
        // PENTING: raw: false memaksakan baca sesuai tampilan text (mencoba menghindari scientific notation)
        // Tapi User TETAP DISARANKAN format cell NIK jadi 'Text' di Excel.
        const rawData = xlsx.utils.sheet_to_json(sheet, { header: 1, raw: false });

        if (rawData.length < 2) return res.status(400).json({ message: 'File Excel kosong' });

        // Helper Parsing
        const parseDate = (excelDate) => {
            if (!excelDate) return null;
            const date = new Date(excelDate);
            return (date instanceof Date && !isNaN(date)) ? date : null;
        };

        // Helper Bersihkan String (Return NULL jika kosong, biar Logic COALESCE jalan)
        const cleanStr = (val) => {
            if (!val) return null;
            const str = String(val).trim();
            return str === '' || str === '-' ? null : str;
        };

        // Helper Bersihkan NIK (Hapus spasi, petik, titik)
        const cleanNIK = (val) => {
            if (!val) return null;
            // Hapus tanda petik, backtick, spasi, dan karakter aneh
            let str = String(val).replace(/['`\s]/g, '').trim();
            // Validasi format scientific kasar (jika masih lolos)
            if (str.includes('E+')) return null; // Anggap invalid kalau masih scientific
            return str === '' ? null : str;
        };

        await client.query('BEGIN');

        // 1. Temp Table
        await client.query(`
            CREATE TEMP TABLE temp_upload_anjab (
                nrk TEXT, nama_pegawai TEXT, nip TEXT, golongan TEXT, 
                tmt_unit_kerja DATE, jabatan TEXT, tmt_eselon DATE, tmt_cpns DATE,
                tanggal_lahir DATE, tempat_lahir TEXT, masa_kerja TEXT,
                status_pegawai TEXT, jenis_kelamin TEXT, agama TEXT, jenjang TEXT,
                unit_kerja_nama TEXT, skpd TEXT, nik TEXT,
                jam_mengajar_utama INT DEFAULT 0, besaran_gaji BIGINT DEFAULT 0
            ) ON COMMIT DROP; 
        `);

        let batchData = [];
        let errorRows = [];
        const BATCH_SIZE = 500;
        let processedCount = 0;

        // Loop Data (Mulai Baris 2)
        for (let i = 1; i < rawData.length; i++) {
            const row = rawData[i];
            
            // Cek apakah baris ini kosong total (biasanya ada sisa format di excel bawah)
            if (!row[2] && !row[19]) continue;

            // === VALIDASI WAJIB NIK ===
            const nikRaw = cleanNIK(row[19]); // Kolom T (Index 19)

            if (!nikRaw) {
                // Jika NIK Kosong/Rusak -> Catat Error & SKIP
                // Gunakan row[2] (Nama) untuk identifikasi di pesan error
                const namaError = row[2] || "Tanpa Nama";
                errorRows.push(`Baris ${i + 1}: ${namaError} (NIK Kosong/Format Salah)`);
                continue; 
            }

            const rowValues = [
                cleanStr(row[1]),                      // NRK
                cleanStr(row[2]),                      // Nama
                cleanStr(row[3])?.replace(/['`]/g, ''),// NIP (Bersihkan petik)
                cleanStr(row[4]),                      // Golongan
                parseDate(row[5]),                     // TMT Unit
                cleanStr(row[7]),                      // Jabatan
                parseDate(row[8]),                     // TMT Eselon
                parseDate(row[9]),                     // TMT CPNS
                parseDate(row[10]),                    // Tgl Lahir
                cleanStr(row[11]),                     // Tempat Lahir
                cleanStr(row[12]),                     // Masa Kerja
                cleanStr(row[13]),                     // Status Pegawai
                cleanStr(row[14]),                     // JK
                cleanStr(row[15]),                     // Agama
                cleanStr(row[16]),                     // Jenjang
                cleanStr(row[17]),                     // Unit Kerja
                cleanStr(row[18]),                     // SKPD
                nikRaw                                 // NIK (Sudah Clean)
            ];
            
            batchData.push(rowValues);
            processedCount++;

            if (batchData.length >= BATCH_SIZE) {
                await insertToTempTable(client, batchData);
                batchData = [];
            }
        }
        if (batchData.length > 0) await insertToTempTable(client, batchData);

        if (processedCount > 0) {
            // 2. LOGIC UPDATE (PARTIAL UPDATE BASED ON NIK)
            // Kunci: WHERE main.nik = t.nik
            // COALESCE(t.col, main.col) -> Jika Excel NULL, Pakai Data Lama.
            const updateQuery = `
                UPDATE anjab_data main
                SET 
                    nama_pegawai = COALESCE(t.nama_pegawai, main.nama_pegawai),
                    nrk = COALESCE(t.nrk, main.nrk),
                    nip = COALESCE(t.nip, main.nip), -- NIP lama aman meski Excel kosong
                    golongan = COALESCE(t.golongan, main.golongan),
                    tmt_unit_kerja = COALESCE(t.tmt_unit_kerja, main.tmt_unit_kerja),
                    jabatan = COALESCE(t.jabatan, main.jabatan),
                    unit_kerja_nama = COALESCE(t.unit_kerja_nama, main.unit_kerja_nama),
                    status_pegawai = COALESCE(t.status_pegawai, main.status_pegawai),
                    updated_at = NOW()
                FROM temp_upload_anjab t
                WHERE main.nik = t.nik; -- STRICT NIK
            `;
            await client.query(updateQuery);

            // 3. LOGIC INSERT (Hanya jika NIK belum ada sama sekali)
            const insertQuery = `
                INSERT INTO anjab_data (
                    nrk, nama_pegawai, nip, nik, golongan, 
                    tmt_unit_kerja, jabatan, tmt_eselon, tmt_cpns,
                    tanggal_lahir, tempat_lahir, masa_kerja,
                    status_pegawai, jenis_kelamin, agama, jenjang,
                    unit_kerja_nama, skpd, created_at
                )
                SELECT 
                    nrk, nama_pegawai, nip, nik, golongan, 
                    tmt_unit_kerja, jabatan, tmt_eselon, tmt_cpns,
                    tanggal_lahir, tempat_lahir, masa_kerja,
                    status_pegawai, jenis_kelamin, agama, jenjang,
                    unit_kerja_nama, skpd, NOW()
                FROM temp_upload_anjab t
                WHERE NOT EXISTS (
                    SELECT 1 FROM anjab_data main 
                    WHERE main.nik = t.nik
                );
            `;
            await client.query(insertQuery);

            await client.query(
                `INSERT INTO activity_logs (user_id, action_type, description) VALUES ($1, 'UPLOAD_EXCEL', $2)`,
                [req.userId, `Upload NIK Based (${processedCount} processed, ${errorRows.length} errors)`]
            );

            await client.query('COMMIT');
        } else {
            await client.query('ROLLBACK');
        }
        
        console.timeEnd("UploadTimer");
        
        res.json({ 
            message: `Proses Selesai. ${processedCount} data diproses.`,
            errorCount: errorRows.length,
            errors: errorRows
        });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error("UPLOAD ERROR:", err);
        res.status(500).json({ error: 'Gagal proses Excel: ' + err.message });
    } finally {
        client.release();
    }
});

// Helper Insert Temp (SAMA)
async function insertToTempTable(client, rows) {
    if (rows.length === 0) return;
    const columns = 18; 
    let params = [];
    let chunks = [];
    rows.forEach((row, rowIndex) => {
        let valueClause = [];
        row.forEach((val, colIndex) => {
            params.push(val);
            valueClause.push(`$${(rowIndex * columns) + colIndex + 1}`);
        });
        chunks.push(`(${valueClause.join(', ')}, 0, 0)`);
    });
    const queryText = `
        INSERT INTO temp_upload_anjab (
            nrk, nama_pegawai, nip, golongan, 
            tmt_unit_kerja, jabatan, tmt_eselon, tmt_cpns,
            tanggal_lahir, tempat_lahir, masa_kerja,
            status_pegawai, jenis_kelamin, agama, jenjang,
            unit_kerja_nama, skpd, nik,
            jam_mengajar_utama, besaran_gaji
        ) VALUES ${chunks.join(', ')}
    `;
    await client.query(queryText, params);
}
// === 7. DOWNLOAD TEMPLATE EXCEL ===
router.get('/template', verifyToken, (req, res) => {
    try {
        const headers = [
            "No", "NRK", "NAMA PEGAWAI", "NIP", "GOLONGAN", 
            "TMT UNIT KERJA", "ESELON", "JABATAN", "TMT ESELON", 
            "TMT CPNS", "TANGGAL LAHIR", "TEMPAT LAHIR", "MASA KERJA", 
            "STATUS PEGAWAI", "JENIS KELAMIN", "AGAMA", "JENJANG", 
            "UNIT KERJA", "SKPD", "NIK (WAJIB DIISI)" // <--- Updated Label
        ];

        const wb = xlsx.utils.book_new();
        const ws = xlsx.utils.aoa_to_sheet([headers]);

        // Contoh Data Dummy
        xlsx.utils.sheet_add_aoa(ws, [[
            1, "123456", "CONTOH NAMA", "1990xxxx", "III/a",
            "2022-01-01", "-", "GURU", "-",
            "2020-01-01", "1990-01-01", "JAKARTA", "2 Thn",
            "PNS", "L", "ISLAM", "S1", 
            "SDN 01", "DINAS", "3175000000000001" // <--- Contoh NIK
        ]], {origin: "A2"});

        ws['!cols'] = headers.map(() => ({ wch: 20 }));
        xlsx.utils.book_append_sheet(wb, ws, "Template Anjab");
        const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

        res.setHeader('Content-Disposition', 'attachment; filename="Template_Upload_Anjab.xlsx"');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(buffer);
    } catch (err) {
        res.status(500).json({ error: "Gagal generate template" });
    }
});

// === FUNGSI HELPER UNTUK MEMBUAT QUERY BATCH ===
async function insertBatch(client, rows) {
    if (rows.length === 0) return;

    const columns = 17; // Jumlah kolom mapping di atas
    let params = [];
    let chunks = [];

    rows.forEach((row, rowIndex) => {
        let valueClause = [];
        row.forEach((val, colIndex) => {
            params.push(val);
            valueClause.push(`$${(rowIndex * columns) + colIndex + 1}`);
        });
        // Tambahkan default value untuk kolom yg tidak ada di excel (jam_mengajar, gaji, dll)
        chunks.push(`(${valueClause.join(', ')}, 0, 0, false, NOW())`);
    });

    const queryText = `
        INSERT INTO anjab_data (
            nrk, nama_pegawai, nip, golongan, 
            tmt_unit_kerja, jabatan, tmt_eselon, tmt_cpns,
            tanggal_lahir, tempat_lahir, masa_kerja,
            status_pegawai, jenis_kelamin, agama, jenjang,
            unit_kerja_nama, skpd,
            jam_mengajar_utama, besaran_gaji, penyandang_difabel, 
            created_at
        ) VALUES ${chunks.join(', ')}
    `;

    await client.query(queryText, params);
}

module.exports = router;