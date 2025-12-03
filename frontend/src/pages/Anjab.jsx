import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Table, Card, Button, Form, Row, Col, Badge, Modal, Spinner } from 'react-bootstrap';
import { Search, Plus, Trash2, Edit, Eye, Save, X } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Anjab() {
  const { user } = useAuth();
  
  // State Data
  const [dataAnjab, setDataAnjab] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ nama: '', nip: '', unit_kerja: '' });

  // State Modal (Form)
  const [showModal, setShowModal] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [formData, setFormData] = useState({});
  const [saving, setSaving] = useState(false);

  // === 1. FETCH DATA ===
  const fetchData = async () => {
    setLoading(true);
    try {
      // Mengirim parameter filter ke backend
      const params = new URLSearchParams(filters).toString();
      const res = await api.get(`/anjab?${params}`);
      setDataAnjab(res.data);
    } catch (error) {
      console.error(error);
      toast.error('Gagal mengambil data anjab');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []); // Load pertama kali

  // === 2. HANDLER FILTER ===
  const handleSearch = (e) => {
    e.preventDefault();
    fetchData();
  };

  // === 3. HANDLER HAPUS (ADMIN ONLY) ===
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

  // === 4. HANDLER FORM (MODAL) ===
  const handleOpenModal = (data = null) => {
    if (data) {
      setIsEdit(true);
      setFormData(data); // Isi form dengan data yang dipilih
    } else {
      setIsEdit(false);
      setFormData({}); // Kosongkan form untuk data baru
    }
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (isEdit) {
        // Edit Mode
        const res = await api.put(`/anjab/${formData.id}`, formData);
        toast.success(res.data.message || 'Perubahan disimpan');
      } else {
        // Create Mode (Khusus Admin, kalau mau fitur Add)
        // Note: Di backend route create belum ada di contoh sebelumnya, 
        // tapi logic edit sudah ada. Kita fokus Edit dulu.
        toast.error("Fitur Tambah Data Baru belum diaktifkan di backend, gunakan Edit dulu.");
      }
      setShowModal(false);
      fetchData();
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
            <p className="text-muted small">Analisis Jabatan Guru & Tenaga Kependidikan</p>
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
                    <Col md={3}>
                        <Form.Control 
                            placeholder="Cari Nama Pegawai..." 
                            value={filters.nama}
                            onChange={(e) => setFilters({...filters, nama: e.target.value})}
                        />
                    </Col>
                    <Col md={3}>
                        <Form.Control 
                            placeholder="Cari NIP..." 
                            value={filters.nip}
                            onChange={(e) => setFilters({...filters, nip: e.target.value})}
                        />
                    </Col>
                    <Col md={3}>
                        <Form.Control 
                            placeholder="Unit Kerja..." 
                            value={filters.unit_kerja}
                            onChange={(e) => setFilters({...filters, unit_kerja: e.target.value})}
                        />
                    </Col>
                    <Col md={3}>
                        <Button type="submit" variant="secondary" className="w-100">
                            <Search size={18} className="me-2" /> Cari Data
                        </Button>
                    </Col>
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
                <Table responsive hover className="mb-0 align-middle">
                    <thead className="bg-light">
                        <tr>
                            <th className="py-3 ps-4">Nama Pegawai</th>
                            <th>NIP / NRK</th>
                            <th>Jabatan</th>
                            <th>Unit Kerja</th>
                            <th>Status Data</th>
                            <th className="text-end pe-4">Aksi</th>
                        </tr>
                    </thead>
                    <tbody>
                        {dataAnjab.length > 0 ? dataAnjab.map((item) => (
                            <tr key={item.id}>
                                <td className="ps-4 fw-medium">
                                    {item.nama_pegawai}
                                    <div className="text-muted small" style={{fontSize: '11px'}}>{item.status_pegawai}</div>
                                </td>
                                <td>
                                    <div>{item.nip || '-'}</div>
                                    <small className="text-muted">{item.nrk || '-'}</small>
                                </td>
                                <td>{item.jabatan}</td>
                                <td>{item.unit_kerja_nama}</td>
                                <td>
                                    {/* Logic Status: Jika ada request pending, tampilkan badge */}
                                    {item.request_status === 'PENDING' ? (
                                        <Badge bg="warning" text="dark">Menunggu Verifikasi</Badge>
                                    ) : (
                                        <Badge bg="success">Terverifikasi</Badge>
                                    )}
                                </td>
                                <td className="text-end pe-4">
                                    <div className="d-flex justify-content-end gap-2">
                                        {/* Tombol Edit: Muncul untuk Admin & Pemilik Data */}
                                        {(user?.role === 'ADMIN' || user?.role === 'GURU_TENDIK') && (
                                            <Button variant="outline-primary" size="sm" onClick={() => handleOpenModal(item)}>
                                                <Edit size={16} />
                                            </Button>
                                        )}
                                        
                                        {/* Tombol Delete: HANYA ADMIN */}
                                        {user?.role === 'ADMIN' && (
                                            <Button variant="outline-danger" size="sm" onClick={() => handleDelete(item.id)}>
                                                <Trash2 size={16} />
                                            </Button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        )) : (
                            <tr>
                                <td colSpan="6" className="text-center py-5 text-muted">Tidak ada data ditemukan</td>
                            </tr>
                        )}
                    </tbody>
                </Table>
            )}
        </Card.Body>
      </Card>

      {/* === MODAL FORM EDIT/TAMBAH === */}
      <Modal show={showModal} onHide={() => setShowModal(false)} size="xl" backdrop="static">
        <Modal.Header closeButton>
            <Modal.Title>{isEdit ? 'Edit Data Anjab' : 'Tambah Data Baru'}</Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleSave}>
            <Modal.Body style={{maxHeight: '70vh', overflowY: 'auto'}}>
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
                        {/* Format Date YYYY-MM-DD agar masuk ke input date */}
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
            </Modal.Body>
            <Modal.Footer>
                <Button variant="secondary" onClick={() => setShowModal(false)}>Batal</Button>
                <Button variant="primary" type="submit" disabled={saving}>
                    {saving ? 'Menyimpan...' : (isEdit ? 'Simpan Perubahan' : 'Tambah Data')}
                </Button>
            </Modal.Footer>
        </Form>
      </Modal>
    </Layout>
  );
}