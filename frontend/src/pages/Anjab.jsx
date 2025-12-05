import React, { useState, useEffect } from 'react';

import Layout from '../components/Layout';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Table, Card, Button, Form, Row, Col, Badge, Modal, Spinner, Pagination, Alert, Collapse } from 'react-bootstrap';// Tambahkan useRef dan Upload icon
import { useRef } from 'react'; 
import { 
    Search, Plus, Trash2, Edit, Eye, History, Download, 
    ArrowUpDown, CheckSquare, XCircle, CheckCircle, Upload, 
    RefreshCw, FileDown, Filter, FileSpreadsheet // <--- Tambahkan ini
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useNotification } from '../context/NotificationContext';

export default function Anjab() {
  const { user } = useAuth();
  
  // === STATE DATA UTAMA ===
  const [dataAnjab, setDataAnjab] = useState([]);
  const [loading, setLoading] = useState(true);
const { refreshNotifs, clearGuruBadge } = useNotification();
// 1. Tambahkan State Baru di dalam function Anjab()
const [showErrorModal, setShowErrorModal] = useState(false);
const [uploadErrors, setUploadErrors] = useState([]);
  // === STATE FORM MODAL (Edit/Add/View) ===
  const [showModal, setShowModal] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [isViewMode, setIsViewMode] = useState(false);
  const [formData, setFormData] = useState({});
  const [saving, setSaving] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // === STATE HISTORY MODAL (BARU) ===
  const [showHistory, setShowHistory] = useState(false);
  const [historyData, setHistoryData] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [selectedAnjabId, setSelectedAnjabId] = useState(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    totalPages: 0,
    totalItems: 0
  });

  // State Filter & Pagination & Sort
// === STATE BARU: OPTIONS UNTUK AUTOCOMPLETE ===
  const [optionLists, setOptionLists] = useState({ units: [], jabatans: [] });

  // Update Filters State (Tambah jabatan & status_pegawai)
  const [filters, setFilters] = useState({ 
      nama: '', nip: '', unit_kerja: '', 
      jabatan: '', status_pegawai: '', status_verifikasi: '' 
  });
    const [params, setParams] = useState({
      page: 1,
      limit: 10,
      sortBy: 'nama_pegawai', // Default sort
      sortOrder: 'ASC'
  });
  const [paginationInfo, setPaginationInfo] = useState({ totalPages: 0, totalItems: 0 });

   // === STATE BARU: MODAL VERIFIKASI (BEFORE VS AFTER) ===
  const [showVerify, setShowVerify] = useState(false);
  const [verifyData, setVerifyData] = useState(null); // { current_data, new_data, request_info }
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [adminNote, setAdminNote] = useState('');

  // Ref untuk input file tersembunyi
  const fileInputRef = useRef(null); 
  const [isUploading, setIsUploading] = useState(false);

  // === FUNGSI BARU: PANGGIL API MARK READ ===
const markAsRead = async (item) => {
    // Cuma jalankan kalau Guru & Data sudah selesai (bukan pending)
    if (user?.role === 'GURU_TENDIK' && item.request_status !== 'PENDING') {
        try {
            await api.put(`/anjab/${item.id}/mark-read`);
            refreshNotifs(); // Refresh angka badge segera!
        } catch (error) {
            console.error("Gagal mark read", error);
        }
    }
};
  // === FETCH DATA ===
  const fetchData = async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams({
          ...filters,
          page: params.page,
          limit: params.limit,
          sortBy: params.sortBy,
          sortOrder: params.sortOrder
      }).toString();
      const res = await api.get(`/anjab?${queryParams}`);
      setDataAnjab(res.data.data);
      setPaginationInfo(res.data.pagination);
    } catch (error) {
      console.error(error);
      toast.error('Gagal mengambil data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [params]);
  // === HANDLER UPLOAD EXCEL ===
  // 2. Update handleFileUpload
const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.name.match(/\.(xlsx|xls)$/)) {
        return toast.error("Format file harus Excel (.xlsx / .xls)");
    }

    setIsUploading(true);
    const formDataUpload = new FormData();
    formDataUpload.append('file', file);

    try {
        const loadingToast = toast.loading("Sedang memproses data...");
        
        const res = await api.post('/anjab/upload', formDataUpload, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        
        toast.dismiss(loadingToast);

        // CEK APAKAH ADA ERROR DARI BACKEND?
        if (res.data.errorCount > 0) {
            setUploadErrors(res.data.errors); // Simpan list error
            setShowErrorModal(true); // Tampilkan Pop-up
            
            // Tampilkan pesan sukses sebagian jika ada yang berhasil
            if (res.data.message.includes('0 data berhasil')) {
                toast.error("Semua data gagal (NIK Kosong)");
            } else {
                toast.warning("Upload Selesai dengan beberapa catatan (Cek Pop-up)");
            }
        } else {
            toast.success(res.data.message);
        }

        fetchData(); // Refresh tabel
    } catch (error) {
        toast.dismiss();
        console.error(error);
        toast.error(error.response?.data?.error || "Gagal upload file");
    } finally {
        setIsUploading(false);
        if(fileInputRef.current) fileInputRef.current.value = ''; 
    }
};

// === FETCH OPTIONS (AUTOCOMPLETE) ===
  const fetchOptions = async () => {
      try {
          const res = await api.get('/anjab/options');
          setOptionLists(res.data);
      } catch (error) {
          console.error("Gagal load options", error);
      }
  };

  // Panggil fetchOptions saat pertama kali load
  useEffect(() => { 
      fetchData(); 
      fetchOptions(); // <--- Load data autocomplete
  }, [params]);
// Handler Reset (Update juga)
  const handleReset = () => {
    setFilters({ nama: '', nip: '', unit_kerja: '', jabatan: '', status_pegawai: '', status_verifikasi: '' });
    setParams({ ...params, page: 1 });
  };
const handleExport = async () => {
    try {
        const loadingToast = toast.loading("Sedang mengunduh data...");
        // Query params sama dengan filter saat ini
        const queryParams = new URLSearchParams(filters).toString();

        const response = await api.get(`/anjab/export?${queryParams}`, {
            responseType: 'blob', // Penting agar dibaca sebagai file
        });

        // Buat link download invisible
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `Data_Anjab_${new Date().toISOString().slice(0,10)}.xlsx`);
        document.body.appendChild(link);
        link.click();
        link.parentNode.removeChild(link);

        toast.dismiss(loadingToast);
        toast.success("Data berhasil diunduh!");
    } catch (error) {
        toast.dismiss();
        toast.error("Gagal export data");
    }
};
  // === HANDLER VERIFIKASI (BARU) ===
  const handleOpenVerify = async (requestId) => {
      setShowVerify(true);
      setVerifyLoading(true);
      setAdminNote('');
      try {
          const res = await api.get(`/admin/verifications/${requestId}`);
          setVerifyData(res.data);
      } catch (error) {
          toast.error("Gagal mengambil data perbandingan");
          setShowVerify(false);
      } finally {
          setVerifyLoading(false);
      }
  };
  // === HANDLER DOWNLOAD TEMPLATE ===
  const handleDownloadTemplate = async () => {
      try {
          const loadingToast = toast.loading("Mengunduh template...");
          
          // Request ke backend dengan responseType 'blob' (binary)
          const response = await api.get('/anjab/template', { responseType: 'blob' });
          
          // Buat URL sementara untuk file hasil download
          const url = window.URL.createObjectURL(new Blob([response.data]));
          const link = document.createElement('a');
          link.href = url;
          // Nama file saat didownload user
          link.setAttribute('download', 'Template_Upload_Pegawai.xlsx'); 
          
          document.body.appendChild(link);
          link.click();
          
          // Bersihkan memory
          link.parentNode.removeChild(link);
          window.URL.revokeObjectURL(url);
          
          toast.dismiss(loadingToast);
          toast.success("Template berhasil diunduh");
      } catch (error) {
          toast.dismiss();
          console.error("Gagal download template", error);
          toast.error("Gagal mengunduh template");
      }
  };

  const handleDecide = async (decision) => {
      if (!window.confirm(`Yakin ingin ${decision === 'APPROVED' ? 'MENYETUJUI' : 'MENOLAK'} perubahan ini?`)) return;
      
      setVerifyLoading(true);
      try {
          // Kirim keputusan ke backend
          await api.post(`/admin/verifications/${verifyData.request_info.id}/decide`, {
              decision,
              admin_note: adminNote
          });
          toast.success(`Request berhasil di-${decision}`);
          setShowVerify(false);
          fetchData(); // Refresh tabel utama
          refreshNotifs();
      } catch (error) {
          toast.error(error.response?.data?.message || "Gagal memproses");
      } finally {
          setVerifyLoading(false);
      }
  };

  // Helper: Cek apakah field berubah (untuk highlight warna)
  const isChanged = (key) => {
      if (!verifyData) return false;
      const oldVal = verifyData.current_data[key];
      const newVal = verifyData.new_data[key];
      // Bandingkan nilai (konversi ke string biar aman)
      return String(oldVal) !== String(newVal);
  };

  // Handler Cari (Reset ke halaman 1)
  const handleSearch = (e) => {
    e.preventDefault();
    setParams({ ...params, page: 1 }); // Reset page ke 1
  };

  // Handler Sort
  const handleSort = (column) => {
      const newOrder = params.sortBy === column && params.sortOrder === 'ASC' ? 'DESC' : 'ASC';
      setParams({ ...params, sortBy: column, sortOrder: newOrder });
  };

  // Handler Change Limit (10/20/50)
  const handleLimitChange = (e) => {
      setParams({ ...params, limit: parseInt(e.target.value), page: 1 });
  };

  // === 2. FETCH HISTORY (Logika Baru) ===
  const fetchHistory = async (anjabId, page = 1, limit = 10) => {
    setHistoryLoading(true);
    try {
        const res = await api.get(`/anjab/${anjabId}/history?page=${page}&limit=${limit}`);
        setHistoryData(res.data.data);
        setPagination({
            page: res.data.pagination.currentPage,
            limit: res.data.pagination.limit,
            totalPages: res.data.pagination.totalPages,
            totalItems: res.data.pagination.totalItems
        });
    } catch (error) {
        toast.error("Gagal mengambil riwayat");
    } finally {
        setHistoryLoading(false);
    }
  };

 // 2. UPDATE HISTORY
const handleOpenHistory = (item) => {
    setSelectedAnjabId(item.id);
    setPagination({ ...pagination, page: 1 });
    setShowHistory(true);
    fetchHistory(item.id, 1, pagination.limit);
    markAsRead(item); // <--- TAMBAHKAN INI
};

  // === 3. DOWNLOAD CSV LOGIC ===
  const handleDownloadHistory = () => {
    if (historyData.length === 0) return toast.error("Tidak ada data untuk diunduh");

    // Header CSV
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Tanggal,Pemohon,Status,Catatan Admin\n";

    // Isi Data
    historyData.forEach(row => {
        const tanggal = new Date(row.created_at).toLocaleString('id-ID');
        const pemohon = row.pemohon || 'System';
        const status = row.status;
        const note = row.admin_note ? row.admin_note.replace(/,/g, " ") : "-"; // Hapus koma biar gak rusak CSV
        csvContent += `${tanggal},${pemohon},${status},${note}\n`;
    });

    // Buat Link Download Palsu
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `riwayat_perubahan_${selectedAnjabId}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // === 4. HANDLER LAINNYA ===
  const handleDelete = async (id) => {
    if (!window.confirm('Yakin ingin menghapus data ini?')) return;
    try {
      await api.delete(`/anjab/${id}`);
      toast.success('Data berhasil dihapus');
      fetchData();
    } catch (error) {
      toast.error('Gagal menghapus data');
    }
  };

 // 1. UPDATE DETAIL
const handleViewDetail = (data) => {
    setFormData(data);
    setIsEdit(false);
    setIsViewMode(true);
    setShowModal(true);
    markAsRead(data); // <--- TAMBAHKAN INI
};
 // 3. UPDATE EDIT
const handleOpenModal = (data = null) => {
    setIsViewMode(false);
    if (data) {
        setIsEdit(true);
        setFormData(data);
        markAsRead(data); // <--- TAMBAHKAN INI (Jika klik edit pada data yg sudah approved)
    } else {
        setIsEdit(false);
        setFormData({});
    }
    setShowModal(true);
};
  const handleSave = async (e) => {
    e.preventDefault();
    if (isViewMode) return; 

    setSaving(true);
    try {
      if (isEdit) {
        const res = await api.put(`/anjab/${formData.id}`, formData);
        toast.success(res.data.message || 'Perubahan disimpan');
      } else {
        toast.error("Fitur Tambah Data Baru belum diaktifkan.");
      }
      setShowModal(false);
      fetchData();
      refreshNotifs();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Gagal menyimpan data');
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

return (
    <Layout>
      {/* === HEADER & ACTIONS === */}
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-4">
        <div>
            <h2 className="fw-bold text-dark mb-1">Data Anjab</h2>
            <p className="text-muted small mb-0">Total Data: {paginationInfo.totalItems} Pegawai</p>
        </div>
        
      {/* Action Buttons */}
        {user?.role === 'ADMIN' && (
             <div className="d-flex flex-wrap gap-2">
                 <input 
                    type="file" 
                    ref={fileInputRef} 
                    style={{display: 'none'}} 
                    onChange={handleFileUpload} 
                    accept=".xlsx, .xls"
                 />
                 
                 {/* === TOMBOL TEMPLATE (BARU) === */}
                 <Button 
                    variant="outline-secondary" 
                    size="sm"
                    onClick={handleDownloadTemplate}
                    title="Download Template Excel Format Baru"
                    className="d-flex align-items-center bg-white"
                 >
                    <FileSpreadsheet size={16} className="me-2 text-success" /> Template
                 </Button>

                 {/* Tombol Upload */}
                 <Button 
                    variant="success" 
                    size="sm"
                    onClick={() => fileInputRef.current.click()} 
                    disabled={isUploading}
                    className="d-flex align-items-center"
                 >
                     {isUploading ? <Spinner size="sm" animation="border" /> : <><Upload size={16} className="me-2" /> Upload</>}
                 </Button>

                 {/* Tombol Export */}
                 <Button variant="outline-success" size="sm" onClick={handleExport} className="d-flex align-items-center">
                    <FileDown size={16} className="me-2" /> Export
                 </Button>

                 {/* Tombol Tambah Manual */}
                 <Button variant="primary" size="sm" onClick={() => handleOpenModal(null)} className="d-flex align-items-center">
                    <Plus size={16} className="me-2" /> Baru
                 </Button>
             </div>
        )}
      </div>

      {/* === FILTER PINTAR (RESPONSIF) === */}
      <Card className="border-0 shadow-sm mb-4">
        <Card.Body className="p-3">
            <Form onSubmit={handleSearch}>
                {/* BARIS UTAMA: Cari Nama & Toggle Filter */}
                <div className="d-flex gap-2">
                    <div className="flex-grow-1 position-relative">
                        <Search className="position-absolute text-muted" style={{top: '10px', left: '12px'}} size={18}/>
                        <Form.Control 
                            placeholder="Cari nama pegawai..." 
                            value={filters.nama} 
                            onChange={(e) => setFilters({...filters, nama: e.target.value})} 
                            className="ps-5 bg-light border-0"
                            style={{height: '40px'}}
                        />
                    </div>
                    <Button 
                        variant={showFilters ? "primary" : "outline-secondary"} 
                        onClick={() => setShowFilters(!showFilters)}
                        title="Filter Lanjutan"
                        style={{width: '45px', flexShrink: 0}}
                    >
                        <Filter size={20} />
                    </Button>
                    <Button type="submit" variant="primary" style={{width: '45px', flexShrink: 0}}>
                        <Search size={20} />
                    </Button>
                </div>

                {/* FILTER LANJUTAN (COLLAPSIBLE) */}
                <Collapse in={showFilters}>
                    <div className="mt-3 pt-3 border-top">
                        <Row className="g-3">
                            <Col xs={12} md={4}>
                                <Form.Label className="small text-muted mb-1">NIP / NRK</Form.Label>
                                <Form.Control size="sm" placeholder="Cari NIP..." value={filters.nip} onChange={(e) => setFilters({...filters, nip: e.target.value})} />
                            </Col>
                            <Col xs={12} md={4}>
                                <Form.Label className="small text-muted mb-1">Unit Kerja</Form.Label>
                                <Form.Control size="sm" placeholder="Ketik Unit..." value={filters.unit_kerja} onChange={(e) => setFilters({...filters, unit_kerja: e.target.value})} list="unit-options" />
                            </Col>
                            <Col xs={12} md={4}>
                                <Form.Label className="small text-muted mb-1">Jabatan</Form.Label>
                                <Form.Control size="sm" placeholder="Ketik Jabatan..." value={filters.jabatan} onChange={(e) => setFilters({...filters, jabatan: e.target.value})} list="jabatan-options" />
                            </Col>
                            
                            <Col xs={6} md={3}>
                                <Form.Label className="small text-muted mb-1">Status Pegawai</Form.Label>
                                <Form.Select size="sm" value={filters.status_pegawai} onChange={(e) => setFilters({...filters, status_pegawai: e.target.value})}>
                                    <option value="">Semua</option>
                                    <option value="PNS">PNS</option>
                                    <option value="PPPK">PPPK</option>
                                    <option value="KKI">KKI</option>
                                    <option value="HONOR">HONOR</option>
                                </Form.Select>
                            </Col>
                            <Col xs={6} md={3}>
                                <Form.Label className="small text-muted mb-1">Status Verifikasi</Form.Label>
                                <Form.Select size="sm" value={filters.status_verifikasi} onChange={(e) => setFilters({...filters, status_verifikasi: e.target.value})}>
                                    <option value="">Semua</option>
                                    <option value="PENDING">Menunggu</option>
                                    <option value="VERIFIED">Selesai</option>
                                </Form.Select>
                            </Col>
                            <Col xs={12} md={6} className="d-flex align-items-end justify-content-end">
                                <Button variant="link" size="sm" className="text-decoration-none text-muted" onClick={handleReset}>
                                    <RefreshCw size={14} className="me-1"/> Reset Filter
                                </Button>
                            </Col>
                        </Row>
                        
                        {/* Datalist untuk Autocomplete */}
                        <datalist id="unit-options">
                            {optionLists.units.map((unit, idx) => <option key={idx} value={unit} />)}
                        </datalist>
                        <datalist id="jabatan-options">
                            {optionLists.jabatans.map((jab, idx) => <option key={idx} value={jab} />)}
                        </datalist>
                    </div>
                </Collapse>
            </Form>
        </Card.Body>
      </Card>

      {/* === TABEL DATA (SCROLLABLE CARD DI MOBILE) === */}
      <Card className="border-0 shadow-sm">
        <Card.Body className="p-0">
            {loading ? (
                <div className="text-center p-5"><Spinner animation="border" variant="primary" /></div>
            ) : (
                <>
                {/* Mobile View: Tampilan Card List (Hanya muncul di XS/SM) */}
                <div className="d-block d-md-none">
                    {dataAnjab.length > 0 ? dataAnjab.map((item) => (
                        <div key={item.id} className="p-3 border-bottom position-relative">
                             <div className="d-flex justify-content-between align-items-start mb-2">
                                <div>
                                    <div className="fw-bold text-dark">{item.nama_pegawai}</div>
                                                                   </div>
                                {item.request_status === 'PENDING' ? <Badge bg="warning" text="dark">Pending</Badge> : <Badge bg="success">Verified</Badge>}
                             </div>
                             
                             <div className="small text-secondary mb-2">
                                <div className="text-truncate" style={{maxWidth: '250px'}}>{item.jabatan}</div>
                                <div className="text-truncate" style={{maxWidth: '250px'}}>{item.unit_kerja_nama}</div>
                             </div>

                             <div className="d-flex gap-2 mt-3">
                                <Button variant="outline-info" size="sm" className="flex-fill" onClick={() => handleViewDetail(item)}>Detail</Button>
                                {user?.role === 'ADMIN' && (
                                     <Button variant="outline-primary" size="sm" className="flex-fill" onClick={() => handleOpenModal(item)}>Edit</Button>
                                )}
                             </div>
                        </div>
                    )) : (
                        <div className="text-center p-4 text-muted">Data tidak ditemukan</div>
                    )}
                </div>

                {/* Desktop View: Tabel Biasa (Hanya muncul di MD ke atas) */}
                <div className="d-none d-md-block">
                    <Table responsive hover className="mb-0 align-middle text-nowrap">
                        <thead className="bg-light">
                            <tr>
                                <th className="py-3 ps-4">Nama Pegawai</th>
                                <th>NIP / NRK</th>
                                <th>Jabatan</th>
                                <th>Unit Kerja</th>
                                <th>Status</th>
                                <th className="text-end pe-4">Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {dataAnjab.length > 0 ? dataAnjab.map((item) => (
                                <tr key={item.id}>
                                    <td className="ps-4">
                                        <div className="fw-bold text-dark">{item.nama_pegawai}</div>
                                        {item.status_pegawai && <Badge bg="light" text="dark" className="border mt-1">{item.status_pegawai}</Badge>}
                                    </td>
                                    <td>
                                                                          </td>
                                    <td className="text-wrap" style={{maxWidth: '200px'}}>{item.jabatan}</td>
                                    <td className="text-wrap" style={{maxWidth: '200px'}}>{item.unit_kerja_nama}</td>
                                    <td>
                                        {item.request_status === 'PENDING' ? (
                                            <Badge bg="warning" text="dark">Menunggu Verifikasi</Badge>
                                        ) : (
                                            <Badge bg="success">Terverifikasi</Badge>
                                        )}
                                    </td>
                                    <td className="text-end pe-4">
                                        <div className="d-flex justify-content-end gap-1">
                                            {/* Action buttons sama seperti sebelumnya... */}
                                            {user?.role === 'ADMIN' && item.request_status === 'PENDING' && (
                                                <Button variant="success" size="sm" onClick={() => handleOpenVerify(item.pending_request_id)} title="Verifikasi">
                                                    <CheckSquare size={14} />
                                                </Button>
                                            )}
                                            <Button variant="light" size="sm" onClick={() => handleViewDetail(item)} title="Detail"><Eye size={14} /></Button>
                                            <Button variant="light" size="sm" onClick={() => handleOpenHistory(item)} title="History"><History size={14} /></Button>
                                            <Button variant="light" size="sm" onClick={() => handleOpenModal(item)} title="Edit"><Edit size={14} /></Button>
                                            {user?.role === 'ADMIN' && (
                                                <Button variant="light" size="sm" className="text-danger" onClick={() => handleDelete(item.id)} title="Hapus"><Trash2 size={14} /></Button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            )) : (
                                <tr><td colSpan="6" className="text-center py-5 text-muted">Tidak ada data ditemukan</td></tr>
                            )}
                        </tbody>
                    </Table>
                </div>
                </>
            )}

            {/* Pagination Controls (Tetap sama, taruh di bawah sini) */}
            {paginationInfo.totalPages > 1 && (
               <div className="p-3 border-top d-flex flex-column flex-md-row justify-content-between align-items-center gap-3">
                
                {/* Bagian Kiri: Info Data & Selector Limit */}
                <div className="d-flex align-items-center gap-2">
                    <small className="text-muted text-nowrap">Tampilkan:</small>
                    <Form.Select 
                        size="sm" 
                        style={{width: 'auto'}} 
                        value={params.limit} 
                        onChange={(e) => setParams({...params, limit: parseInt(e.target.value), page: 1})}
                    >
                        <option value="10">10</option>
                        <option value="20">20</option>
                        <option value="50">50</option>
                        <option value="100">100</option>
                        <option value="200">200</option>
                        <option value="500">500</option>
                        <option value="1000">1000</option>
                        {/* Value besar untuk "Semua", pastikan backend kuat handle query besar */}
                        <option value="10000">Semua</option> 
                    </Form.Select>
                    <small className="text-muted text-nowrap">
                        dari <strong>{paginationInfo.totalItems}</strong> data
                    </small>
                </div>

                {/* Bagian Kanan: Pagination Controls */}
                {paginationInfo.totalPages > 1 && (
                    <Pagination className="mb-0 justify-content-center">
                        <Pagination.First 
                            disabled={params.page === 1} 
                            onClick={() => setParams({...params, page: 1})} 
                        />
                        <Pagination.Prev 
                            disabled={params.page === 1} 
                            onClick={() => setParams({...params, page: params.page - 1})} 
                        />
                        
                        {/* Logic Simple Pagination: Tampilkan halaman saat ini */}
                        <Pagination.Item active>{params.page}</Pagination.Item>
                        
                        <Pagination.Next 
                            disabled={params.page === paginationInfo.totalPages} 
                            onClick={() => setParams({...params, page: params.page + 1})} 
                        />
                        <Pagination.Last 
                            disabled={params.page === paginationInfo.totalPages} 
                            onClick={() => setParams({...params, page: paginationInfo.totalPages})} 
                        />
                    </Pagination>
                )}
            </div>
            )}
        </Card.Body>
      </Card>
      {/* === MODAL VERIFIKASI (COMPARE BEFORE AFTER) === */}
      <Modal show={showVerify} onHide={() => setShowVerify(false)} size="xl" backdrop="static">
        <Modal.Header closeButton>
            <Modal.Title className="fw-bold">Verifikasi Perubahan Data</Modal.Title>
        </Modal.Header>
        <Modal.Body className="bg-light">
            {verifyLoading || !verifyData ? (
                <div className="text-center p-5"><Spinner animation="border" /></div>
            ) : (
                <>
                    <Alert variant="info" className="mb-3">
                        Periksa perubahan data di bawah ini. Kolom yang <strong>berwarna hijau</strong> menandakan adanya perubahan.
                    </Alert>

                    <Row>
                        {/* KOLOM KIRI: DATA LAMA */}
                        <Col md={6}>
                            <Card className="border-0 shadow-sm mb-3">
                                <Card.Header className="bg-secondary text-white fw-bold">Data Saat Ini (Before)</Card.Header>
                                <Card.Body style={{maxHeight: '50vh', overflowY: 'auto'}}>
                                    <Table borderless size="sm">
                                        <tbody>
                                            {Object.keys(verifyData.new_data).map((key) => (
                                                <tr key={key}>
                                                    <td className="text-muted small w-50">{key.replace(/_/g, ' ').toUpperCase()}</td>
                                                    <td className="fw-bold text-dark">{verifyData.current_data[key] || '-'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </Table>
                                </Card.Body>
                            </Card>
                        </Col>

                        {/* KOLOM KANAN: DATA BARU */}
                        <Col md={6}>
                            <Card className="border-0 shadow-sm mb-3">
                                <Card.Header className="bg-primary text-white fw-bold">Permintaan Perubahan (After)</Card.Header>
                                <Card.Body style={{maxHeight: '50vh', overflowY: 'auto'}}>
                                    <Table borderless size="sm">
                                        <tbody>
                                            {Object.keys(verifyData.new_data).map((key) => (
                                                <tr key={key} className={isChanged(key) ? 'bg-success bg-opacity-25' : ''}>
                                                    <td className="text-muted small w-50">{key.replace(/_/g, ' ').toUpperCase()}</td>
                                                    <td className={`fw-bold ${isChanged(key) ? 'text-success' : 'text-dark'}`}>
                                                        {verifyData.new_data[key] || '-'}
                                                        {isChanged(key) && <Badge bg="success" className="ms-2">Updated</Badge>}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </Table>
                                </Card.Body>
                            </Card>
                        </Col>
                    </Row>

                    {/* KOLOM CATATAN ADMIN */}
                    <div className="bg-white p-3 rounded shadow-sm">
                        <Form.Label className="fw-bold">Catatan Admin (Alasan Terima/Tolak):</Form.Label>
                        <Form.Control 
                            as="textarea" 
                            rows={2} 
                            placeholder="Contoh: Data valid, disetujui."
                            value={adminNote}
                            onChange={(e) => setAdminNote(e.target.value)}
                        />
                    </div>
                </>
            )}
        </Modal.Body>
        <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowVerify(false)}>Batal</Button>
            <Button variant="danger" onClick={() => handleDecide('REJECTED')} disabled={verifyLoading}>
                <XCircle size={18} className="me-2"/> Tolak Perubahan
            </Button>
            <Button variant="success" onClick={() => handleDecide('APPROVED')} disabled={verifyLoading}>
                <CheckCircle size={18} className="me-2"/> Setujui Perubahan
            </Button>
        </Modal.Footer>
      </Modal>
      {/* === MODAL HISTORY (BARU) === */}
      <Modal show={showHistory} onHide={() => setShowHistory(false)} size="lg">
        <Modal.Header closeButton>
            <Modal.Title className="d-flex align-items-center gap-2">
                <History size={20} /> Riwayat Perubahan
            </Modal.Title>
        </Modal.Header>
        <Modal.Body>
            <div className="d-flex justify-content-between align-items-center mb-3">
                {/* Selector Limit Paging */}
                <div className="d-flex align-items-center gap-2">
                    <small>Tampilkan:</small>
                    <Form.Select 
                        size="sm" 
                        style={{width: '70px'}} 
                        value={pagination.limit}
                        onChange={(e) => fetchHistory(selectedAnjabId, 1, e.target.value)}
                    >
                        <option value="10">10</option>
                        <option value="20">20</option>
                        <option value="50">50</option>
                    </Form.Select>
                    <small>data</small>
                </div>

                {/* Tombol Download */}
                <Button variant="success" size="sm" onClick={handleDownloadHistory}>
                    <Download size={16} className="me-2" /> Download CSV
                </Button>
            </div>

            {/* Tabel History */}
            {historyLoading ? (
                <div className="text-center p-4"><Spinner animation="border" size="sm" /></div>
            ) : (
                <>
                    <Table striped bordered hover size="sm" className="small">
                        <thead className="table-light">
                            <tr>
                                <th>Tanggal</th>
                                <th>Pemohon</th>
                                <th>Status</th>
                                <th>Catatan Admin</th>
                            </tr>
                        </thead>
                        <tbody>
                            {historyData.length > 0 ? historyData.map((log) => (
                                <tr key={log.id}>
                                    <td>{new Date(log.created_at).toLocaleString('id-ID')}</td>
                                    <td>{log.pemohon}</td>
                                    <td>
                                        <Badge bg={
                                            log.status === 'APPROVED' ? 'success' : 
                                            (log.status === 'REJECTED' ? 'danger' : 'warning')
                                        }>
                                            {log.status}
                                        </Badge>
                                    </td>
                                    <td className="text-muted fst-italic">{log.admin_note || '-'}</td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan="4" className="text-center py-3">Belum ada riwayat perubahan.</td>
                                </tr>
                            )}
                        </tbody>
                    </Table>

                    {/* Pagination Controls */}
                    {pagination.totalPages > 1 && (
                        <div className="d-flex justify-content-center mt-3">
                            <Pagination size="sm">
                                <Pagination.Prev 
                                    disabled={pagination.page === 1}
                                    onClick={() => fetchHistory(selectedAnjabId, pagination.page - 1, pagination.limit)}
                                />
                                {[...Array(pagination.totalPages)].map((_, idx) => (
                                    <Pagination.Item 
                                        key={idx + 1} 
                                        active={idx + 1 === pagination.page}
                                        onClick={() => fetchHistory(selectedAnjabId, idx + 1, pagination.limit)}
                                    >
                                        {idx + 1}
                                    </Pagination.Item>
                                ))}
                                <Pagination.Next 
                                    disabled={pagination.page === pagination.totalPages}
                                    onClick={() => fetchHistory(selectedAnjabId, pagination.page + 1, pagination.limit)}
                                />
                            </Pagination>
                        </div>
                    )}
                </>
            )}
        </Modal.Body>
        <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowHistory(false)}>Tutup</Button>
        </Modal.Footer>
      </Modal>
      {/* === MODAL ERROR UPLOAD (POP UP NIK KOSONG) === */}
      <Modal show={showErrorModal} onHide={() => setShowErrorModal(false)} backdrop="static">
        <Modal.Header closeButton className="bg-danger text-white">
            <Modal.Title><XCircle size={20} className="me-2"/> Gagal Upload Sebagian</Modal.Title>
        </Modal.Header>
        <Modal.Body>
            <Alert variant="warning">
                Data berikut <strong>TIDAK DISIMPAN</strong> karena kolom <strong>NIK Kosong</strong>. 
                Sistem wajib menggunakan NIK sebagai acuan update.
            </Alert>
            <div className="border rounded p-2 bg-light" style={{maxHeight: '300px', overflowY: 'auto'}}>
                <ul className="mb-0 ps-3 text-danger small">
                    {uploadErrors.map((err, idx) => (
                        <li key={idx}>{err}</li>
                    ))}
                </ul>
            </div>
        </Modal.Body>
        <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowErrorModal(false)}>Tutup</Button>
        </Modal.Footer>
      </Modal>

      {/* === MODAL FORM EDIT/DETAIL (KODE LAMA TETAP DISINI) === */}
      <Modal show={showModal} onHide={() => setShowModal(false)} size="xl" backdrop="static">
        {/* ... (Isi modal form edit sama seperti sebelumnya, tidak saya ubah) ... */}
        {/* Copy bagian Modal Edit dari kode sebelumnya, atau biarkan jika Anda sudah paham */}
        <Modal.Header closeButton>
            <Modal.Title>{isViewMode ? 'Detail Data' : (isEdit ? 'Edit Data' : 'Tambah Data')}</Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleSave}>
           <Modal.Body style={{ maxHeight: '75vh', overflowY: 'auto' }}>
                <fieldset disabled={isViewMode}>
                    
                    {/* === BAGIAN 1: IDENTITAS PRIBADI === */}
                    <h6 className="fw-bold text-primary mb-3"><i className="bi bi-person-lines-fill me-2"></i>Identitas Pribadi</h6>
                    <Row className="g-3 mb-4">
                        <Col md={12}>
                            <Form.Label className="fw-medium small text-muted">Nama Lengkap</Form.Label>
                            <Form.Control name="nama_pegawai" defaultValue={formData.nama_pegawai} onChange={handleChange} required className="fw-bold" />
                        </Col>
                        <Col md={3}>
                            <Form.Label className="fw-medium small text-muted">NIK</Form.Label>
                            <Form.Control name="nik" defaultValue={formData.nik} onChange={handleChange} />
                        </Col>
                        <Col md={3}>
                            <Form.Label className="fw-medium small text-muted">Jenis Kelamin</Form.Label>
                            <Form.Select name="jenis_kelamin" defaultValue={formData.jenis_kelamin} onChange={handleChange}>
                                <option value="">Pilih...</option>
                                <option value="L">Laki-laki</option>
                                <option value="P">Perempuan</option>
                            </Form.Select>
                        </Col>
                        <Col md={3}>
                            <Form.Label className="fw-medium small text-muted">Tempat Lahir</Form.Label>
                            <Form.Control name="tempat_lahir" defaultValue={formData.tempat_lahir} onChange={handleChange} />
                        </Col>
                        <Col md={3}>
                            <Form.Label className="fw-medium small text-muted">Tanggal Lahir</Form.Label>
                            <Form.Control type="date" name="tanggal_lahir" 
                                defaultValue={formData.tanggal_lahir ? formData.tanggal_lahir.split('T')[0] : ''} 
                                onChange={handleChange} 
                            />
                        </Col>
                        <Col md={3}>
                            <Form.Label className="fw-medium small text-muted">Agama</Form.Label>
                            <Form.Control name="agama" defaultValue={formData.agama} onChange={handleChange} />
                        </Col>
                        <Col md={3}>
                            <Form.Label className="fw-medium small text-muted">Status Pegawai</Form.Label>
                            <Form.Select name="status_pegawai" defaultValue={formData.status_pegawai} onChange={handleChange}>
                                <option value="">Pilih...</option>
                                <option value="PNS">PNS</option>
                                <option value="PPPK">PPPK</option>
                                <option value="KKI">KKI</option>
                                <option value="HONOR">HONOR</option>
                            </Form.Select>
                        </Col>
                    </Row>

                    {/* === BAGIAN 2: DATA KEPEGAWAIAN === */}
                    <h6 className="fw-bold text-primary mb-3 border-top pt-3"><i className="bi bi-briefcase me-2"></i>Data Kepegawaian</h6>
                    <Row className="g-3 mb-4">
                        <Col md={4}>
                            <Form.Label className="fw-medium small text-muted">NIP</Form.Label>
                            <Form.Control name="nip" defaultValue={formData.nip} onChange={handleChange} />
                        </Col>
                        <Col md={4}>
                            <Form.Label className="fw-medium small text-muted">NRK</Form.Label>
                            <Form.Control name="nrk" defaultValue={formData.nrk} onChange={handleChange} />
                        </Col>
                        <Col md={4}>
                            <Form.Label className="fw-medium small text-muted">NUPTK</Form.Label>
                            <Form.Control name="nuptk" defaultValue={formData.nuptk} onChange={handleChange} />
                        </Col>

                        <Col md={6}>
                            <Form.Label className="fw-medium small text-muted">Jabatan</Form.Label>
                            <Form.Control name="jabatan" defaultValue={formData.jabatan} onChange={handleChange} />
                        </Col>
                        <Col md={3}>
                            <Form.Label className="fw-medium small text-muted">Golongan</Form.Label>
                            <Form.Control name="golongan" defaultValue={formData.golongan} onChange={handleChange} />
                        </Col>
                        <Col md={3}>
                            <Form.Label className="fw-medium small text-muted">Masa Kerja</Form.Label>
                            <Form.Control name="masa_kerja" defaultValue={formData.masa_kerja} onChange={handleChange} placeholder="Contoh: 10 Tahun" />
                        </Col>

                        <Col md={4}>
                            <Form.Label className="fw-medium small text-muted">TMT CPNS</Form.Label>
                            <Form.Control type="date" name="tmt_cpns" 
                                defaultValue={formData.tmt_cpns ? formData.tmt_cpns.split('T')[0] : ''} 
                                onChange={handleChange} 
                            />
                        </Col>
                        <Col md={4}>
                            <Form.Label className="fw-medium small text-muted">TMT Eselon</Form.Label>
                            <Form.Control type="date" name="tmt_eselon" 
                                defaultValue={formData.tmt_eselon ? formData.tmt_eselon.split('T')[0] : ''} 
                                onChange={handleChange} 
                            />
                        </Col>
                        <Col md={4}>
                            <Form.Label className="fw-medium small text-muted">TMT Unit Kerja (Pangkat)</Form.Label>
                            <Form.Control type="date" name="tmt_unit_kerja" 
                                defaultValue={formData.tmt_unit_kerja ? formData.tmt_unit_kerja.split('T')[0] : ''} 
                                onChange={handleChange} 
                            />
                        </Col>
                    </Row>

                    {/* === BAGIAN 3: PENDIDIKAN & TUGAS === */}
                    <h6 className="fw-bold text-primary mb-3 border-top pt-3"><i className="bi bi-book me-2"></i>Pendidikan & Tugas</h6>
                    <Row className="g-3 mb-4">
                        <Col md={3}>
                            <Form.Label className="fw-medium small text-muted">Jenjang Pendidikan</Form.Label>
                            <Form.Control name="jenjang" defaultValue={formData.jenjang} onChange={handleChange} />
                        </Col>
                        <Col md={5}>
                            <Form.Label className="fw-medium small text-muted">Ijazah / Jurusan</Form.Label>
                            <Form.Control name="ijazah" defaultValue={formData.ijazah} onChange={handleChange} />
                        </Col>
                        <Col md={4}>
                            <Form.Label className="fw-medium small text-muted">Bidang Studi Sertifikasi</Form.Label>
                            <Form.Control name="bidang_studi_sertifikasi" defaultValue={formData.bidang_studi_sertifikasi} onChange={handleChange} />
                        </Col>
                        <Col md={6}>
                            <Form.Label className="fw-medium small text-muted">Mata Pelajaran Diajarkan</Form.Label>
                            <Form.Control name="mata_pelajaran_diajarkan" defaultValue={formData.mata_pelajaran_diajarkan} onChange={handleChange} />
                        </Col>
                        <Col md={6}>
                            <Form.Label className="fw-medium small text-muted">Tugas Tambahan</Form.Label>
                            <Form.Control name="tugas_tambahan" defaultValue={formData.tugas_tambahan} onChange={handleChange} />
                        </Col>
                         <Col md={4}>
                            <Form.Label className="fw-medium small text-muted">Jam Mengajar Utama</Form.Label>
                            <Form.Control type="number" name="jam_mengajar_utama" defaultValue={formData.jam_mengajar_utama} onChange={handleChange} />
                        </Col>
                    </Row>

                    {/* === BAGIAN 4: LOKASI & SKPD === */}
                    <h6 className="fw-bold text-primary mb-3 border-top pt-3"><i className="bi bi-geo-alt me-2"></i>Lokasi & SKPD</h6>
                    <Row className="g-3 mb-2">
                        <Col md={6}>
                            <Form.Label className="fw-medium small text-muted">Nama Unit Kerja</Form.Label>
                            <Form.Control name="unit_kerja_nama" defaultValue={formData.unit_kerja_nama} onChange={handleChange} />
                        </Col>
                        <Col md={6}>
                            <Form.Label className="fw-medium small text-muted">SKPD</Form.Label>
                            <Form.Control name="skpd" defaultValue={formData.skpd} onChange={handleChange} />
                        </Col>
                        <Col md={12}>
                            <Form.Label className="fw-medium small text-muted">Alamat Jalan</Form.Label>
                            <Form.Control name="alamat_jalan" defaultValue={formData.alamat_jalan} onChange={handleChange} />
                        </Col>
                        <Col md={4}>
                            <Form.Label className="fw-medium small text-muted">Kelurahan</Form.Label>
                            <Form.Control name="kelurahan" defaultValue={formData.kelurahan} onChange={handleChange} />
                        </Col>
                        <Col md={4}>
                            <Form.Label className="fw-medium small text-muted">Kecamatan Domisili</Form.Label>
                            <Form.Control name="kecamatan_domisili" defaultValue={formData.kecamatan_domisili} onChange={handleChange} />
                        </Col>
                        <Col md={4}>
                            <Form.Label className="fw-medium small text-muted">Kota/Kabupaten</Form.Label>
                            <Form.Control name="kota_kabupaten" defaultValue={formData.kota_kabupaten} onChange={handleChange} />
                        </Col>
                    </Row>
                </fieldset>
            </Modal.Body>
            <Modal.Footer>
                <Button variant="secondary" onClick={() => setShowModal(false)}>
                    {isViewMode ? 'Tutup' : 'Batal'}
                </Button>
                {!isViewMode && (
                    <Button variant="primary" type="submit" disabled={saving}>
                        {saving ? 'Menyimpan...' : (isEdit ? 'Simpan Perubahan' : 'Tambah Data')}
                    </Button>
                )}
            </Modal.Footer>
        </Form>
      </Modal>
    </Layout>
  );
}