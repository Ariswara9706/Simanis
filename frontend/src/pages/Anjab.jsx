import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Table, Card, Button, Form, Row, Col, Badge, Modal, Spinner, Pagination, Alert } from 'react-bootstrap';
import { Search, Plus, Trash2, Edit, Eye, History, Download, ArrowUpDown, CheckSquare, XCircle, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { useNotification } from '../context/NotificationContext';

export default function Anjab() {
  const { user } = useAuth();
  
  // === STATE DATA UTAMA ===
  const [dataAnjab, setDataAnjab] = useState([]);
  const [loading, setLoading] = useState(true);
const { refreshNotifs, clearGuruBadge } = useNotification();
  // === STATE FORM MODAL (Edit/Add/View) ===
  const [showModal, setShowModal] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [isViewMode, setIsViewMode] = useState(false);
  const [formData, setFormData] = useState({});
  const [saving, setSaving] = useState(false);

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
  const [filters, setFilters] = useState({ nama: '', nip: '', unit_kerja: '' });
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
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
            <h2 className="fw-bold text-dark mb-1">Data Anjab</h2>
            <p className="text-muted small">Total Data: {paginationInfo.totalItems} Pegawai</p>
        </div>
        {user?.role === 'ADMIN' && (
             <Button variant="primary" onClick={() => handleOpenModal(null)}>
                <Plus size={18} className="me-2" /> Tambah Data
             </Button>
        )}
      </div>

      {/* FILTER SEARCH */}
      <Card className="border-0 shadow-sm mb-4">
        <Card.Body>
            <Form onSubmit={handleSearch}>
                <Row className="g-3">
                    <Col md={3}><Form.Control placeholder="Cari Nama..." value={filters.nama} onChange={(e) => setFilters({...filters, nama: e.target.value})} /></Col>
                    <Col md={3}><Form.Control placeholder="NIP..." value={filters.nip} onChange={(e) => setFilters({...filters, nip: e.target.value})} /></Col>
                    <Col md={3}><Form.Control placeholder="Unit Kerja..." value={filters.unit_kerja} onChange={(e) => setFilters({...filters, unit_kerja: e.target.value})} /></Col>
                    <Col md={3}><Button type="submit" variant="secondary" className="w-100"><Search size={18} className="me-2" /> Cari</Button></Col>
                </Row>
            </Form>
        </Card.Body>
      </Card>

      {/* TABEL DATA */}
      <Card className="border-0 shadow-sm">
        <Card.Body className="p-0">
            {loading ? (
                <div className="text-center p-5"><Spinner animation="border" /></div>
            ) : (
                <>
                <div className="p-3 border-bottom d-flex justify-content-between align-items-center bg-light">
                    <div className="d-flex align-items-center gap-2">
                        <small className="text-muted">Tampilkan:</small>
                        <Form.Select size="sm" style={{width: '70px'}} value={params.limit} onChange={handleLimitChange}>
                            <option value="10">10</option>
                            <option value="20">20</option>
                        </Form.Select>
                    </div>
                </div>

                <Table responsive hover className="mb-0 align-middle">
                    <thead className="bg-light">
                        <tr>
                            <th className="py-3 ps-4" role="button" onClick={() => handleSort('nama_pegawai')}>Nama <ArrowUpDown size={14} className="text-muted ms-1"/></th>
                            <th role="button" onClick={() => handleSort('nip')}>NIP / NRK</th>
                            <th>Jabatan</th>
                            <th>Unit Kerja</th>
                            <th role="button" onClick={() => handleSort('status_verifikasi')}>Status <ArrowUpDown size={14} className="text-muted ms-1"/></th>
                            <th className="text-end pe-4">Aksi</th>
                        </tr>
                    </thead>
                    <tbody>
                        {dataAnjab.length > 0 ? dataAnjab.map((item) => (
                            <tr key={item.id}>
                                <td className="ps-4 fw-medium">{item.nama_pegawai}</td>
                                <td><div>{item.nip || '-'}</div><small className="text-muted">{item.nrk || '-'}</small></td>
                                <td>{item.jabatan}</td>
                                <td>{item.unit_kerja_nama}</td>
                                <td>
                                    {item.request_status === 'PENDING' ? (
                                        <Badge bg="warning" text="dark">Menunggu Verifikasi</Badge>
                                    ) : (
                                        <Badge bg="success">Terverifikasi</Badge>
                                    )}
                                </td>
                                <td className="text-end pe-4">
                                    <div className="d-flex justify-content-end gap-2">
                                        
                                        {/* === TOMBOL VERIFIKASI (ADMIN ONLY & JIKA PENDING) === */}
                                        {user?.role === 'ADMIN' && item.request_status === 'PENDING' && (
                                            <Button 
                                                variant="success" 
                                                size="sm" 
                                                title="Verifikasi Perubahan"
                                                onClick={() => handleOpenVerify(item.pending_request_id)}
                                                className="animation-pulse" // Bisa tambah CSS blink kalau mau
                                            >
                                                <CheckSquare size={16} />
                                            </Button>
                                        )}
                                        {/* =================================================== */}

                                        <Button variant="outline-secondary" size="sm" onClick={() => handleOpenHistory(item)}><History size={16} /></Button>
                                        <Button variant="outline-info" size="sm" onClick={() => handleViewDetail(item)}><Eye size={16} /></Button>
                                        
                                        {(user?.role === 'ADMIN' || user?.role === 'GURU_TENDIK') && (
                                            <Button variant="outline-primary" size="sm" onClick={() => handleOpenModal(item)} disabled={user?.role === 'GURU_TENDIK' && item.request_status === 'PENDING'}><Edit size={16} /></Button>
                                        )}
                                        {user?.role === 'ADMIN' && (
                                            <Button variant="outline-danger" size="sm" onClick={() => handleDelete(item.id)}><Trash2 size={16} /></Button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        )) : (
                            <tr><td colSpan="6" className="text-center py-5 text-muted">Tidak ada data ditemukan</td></tr>
                        )}
                    </tbody>
                </Table>
                
                {paginationInfo.totalPages > 1 && (
                    <div className="p-3 d-flex justify-content-end">
                        <Pagination className="mb-0">
                            <Pagination.Prev disabled={params.page === 1} onClick={() => setParams({...params, page: params.page - 1})} />
                            {[...Array(paginationInfo.totalPages)].map((_, idx) => (
                                <Pagination.Item key={idx + 1} active={idx + 1 === params.page} onClick={() => setParams({...params, page: idx + 1})}>{idx + 1}</Pagination.Item>
                            ))}
                            <Pagination.Next disabled={params.page === paginationInfo.totalPages} onClick={() => setParams({...params, page: params.page + 1})} />
                        </Pagination>
                    </div>
                )}
                </>
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

      {/* === MODAL FORM EDIT/DETAIL (KODE LAMA TETAP DISINI) === */}
      <Modal show={showModal} onHide={() => setShowModal(false)} size="xl" backdrop="static">
        {/* ... (Isi modal form edit sama seperti sebelumnya, tidak saya ubah) ... */}
        {/* Copy bagian Modal Edit dari kode sebelumnya, atau biarkan jika Anda sudah paham */}
        <Modal.Header closeButton>
            <Modal.Title>{isViewMode ? 'Detail Data' : (isEdit ? 'Edit Data' : 'Tambah Data')}</Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleSave}>
             <Modal.Body style={{maxHeight: '70vh', overflowY: 'auto'}}>
               <fieldset disabled={isViewMode}>
    <h6 className="fw-bold text-primary mb-3">Identitas Pegawai</h6>
    <Row className="mb-3">
        <Col md={6} className="mb-2">
            <Form.Label>Nama Pegawai</Form.Label>
            <Form.Control name="nama_pegawai" defaultValue={formData.nama_pegawai} onChange={handleChange} required />
        </Col>
        <Col md={3} className="mb-2">
            <Form.Label>NIP</Form.Label>
            <Form.Control name="nip" defaultValue={formData.nip} onChange={handleChange} />
        </Col>
        <Col md={3} className="mb-2">
            <Form.Label>NRK</Form.Label>
            <Form.Control name="nrk" defaultValue={formData.nrk} onChange={handleChange} />
        </Col>
        <Col md={3} className="mb-2">
            <Form.Label>NIK</Form.Label>
            <Form.Control name="nik" defaultValue={formData.nik} onChange={handleChange} />
        </Col>
        <Col md={3} className="mb-2">
            <Form.Label>Tanggal Lahir</Form.Label>
            {/* Format tanggal dipotong agar pas dengan input type date */}
            <Form.Control type="date" name="tanggal_lahir" 
                defaultValue={formData.tanggal_lahir ? formData.tanggal_lahir.split('T')[0] : ''} 
                onChange={handleChange} 
            />
        </Col>
        <Col md={3} className="mb-2">
            <Form.Label>Status Pegawai</Form.Label>
            <Form.Select name="status_pegawai" defaultValue={formData.status_pegawai} onChange={handleChange}>
                <option value="">Pilih...</option>
                <option value="PNS">PNS</option>
                <option value="PPPK">PPPK</option>
                <option value="KKI">KKI</option>
                <option value="HONOR">HONOR</option>
            </Form.Select>
        </Col>
        <Col md={3} className="mb-2">
            <Form.Label>Jabatan</Form.Label>
            <Form.Control name="jabatan" defaultValue={formData.jabatan} onChange={handleChange} />
        </Col>
    </Row>

    <h6 className="fw-bold text-primary mb-3 mt-4">Unit Kerja & Alamat</h6>
    <Row className="mb-3">
        <Col md={6} className="mb-2">
            <Form.Label>Unit Kerja</Form.Label>
            <Form.Control name="unit_kerja_nama" defaultValue={formData.unit_kerja_nama} onChange={handleChange} />
        </Col>
        <Col md={6} className="mb-2">
            <Form.Label>Alamat Jalan</Form.Label>
            <Form.Control name="alamat_jalan" defaultValue={formData.alamat_jalan} onChange={handleChange} />
        </Col>
        <Col md={4} className="mb-2">
            <Form.Label>Kecamatan Domisili</Form.Label>
            <Form.Control name="kecamatan_domisili" defaultValue={formData.kecamatan_domisili} onChange={handleChange} />
        </Col>
        <Col md={4} className="mb-2">
            <Form.Label>Kota/Kabupaten</Form.Label>
            <Form.Control name="kota_kabupaten" defaultValue={formData.kota_kabupaten} onChange={handleChange} />
        </Col>
    </Row>

    <h6 className="fw-bold text-primary mb-3 mt-4">Gaji & Pensiun</h6>
    <Row>
        <Col md={4} className="mb-2">
            <Form.Label>Besaran Gaji</Form.Label>
            <Form.Control type="number" name="besaran_gaji" defaultValue={formData.besaran_gaji} onChange={handleChange} />
        </Col>
        <Col md={4} className="mb-2">
            <Form.Label>Estimasi Tahun Pensiun</Form.Label>
            <Form.Control type="number" name="estimasi_pensiun_tahun" defaultValue={formData.estimasi_pensiun_tahun} onChange={handleChange} />
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