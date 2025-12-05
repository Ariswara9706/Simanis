import React, { useState, useEffect } from 'react';
import api from '../services/api'; // Pastikan path ini sesuai dengan struktur projectmu
import Layout from '../components/Layout'; // Layout utama aplikasimu
import { Row, Col, Card, Table, Spinner, Badge, Modal, Button } from 'react-bootstrap';
import { Users, BookOpen, TrendingUp, MapPin, ChevronRight } from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend 
} from 'recharts';

export default function Dashboard() {
  // === STATE MANAGEMENT ===
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  // State untuk Modal Detail Pensiun
  const [showModal, setShowModal] = useState(false);
  const [selectedYear, setSelectedYear] = useState(null);
  const [detailData, setDetailData] = useState([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // === FETCH DATA UTAMA ===
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await api.get('/dashboard/stats');
        setStats(res.data);
      } catch (error) {
        console.error("Error fetching stats", error);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  // === HANDLER: KLIK TAHUN PENSIUN ===
  const handleYearClick = async (year) => {
    setSelectedYear(year);
    setShowModal(true);
    setLoadingDetail(true);
    try {
      // Panggil API detail yang sudah kita buat sebelumnya
      const res = await api.get(`/dashboard/pension-detail/${year}`);
      setDetailData(res.data);
    } catch (error) {
      console.error("Gagal ambil detail", error);
    } finally {
      setLoadingDetail(false);
    }
  };

  // === PREPARE DATA FOR CHARTS ===
  
  // 1. Data Pie Chart (Guru vs Tendik)
  const pieData = stats ? [
    { name: 'Guru & Kepsek', value: parseInt(stats.total_guru) },
    { name: 'Tendik / Staf', value: parseInt(stats.total_tendik) },
  ] : [];
  const PIE_COLORS = ['#0d6efd', '#198754']; // Biru & Hijau

  // 2. Hitung Total Pensiun 5 Tahun
  const totalPension5Years = stats?.pension_projection?.reduce((acc, curr) => acc + parseInt(curr.count), 0) || 0;

  // === RENDER LOADING ===
  if (loading) return (
    <Layout>
      <div className="d-flex justify-content-center align-items-center" style={{ height: '80vh' }}>
        <Spinner animation="border" variant="primary" />
      </div>
    </Layout>
  );

  // === RENDER DASHBOARD ===
  return (
    <Layout>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h4 className="fw-bold mb-0">Dashboard Eksekutif</h4>
          <small className="text-muted">Analisis Data Kepegawaian & Proyeksi Pensiun</small>
        </div>
        <div className="text-end">
            <Badge bg="light" text="dark" className="border">
                Tahun Data: {new Date().getFullYear()}
            </Badge>
        </div>
      </div>

      {/* === BAGIAN 1: KARTU STATISTIK (KPI) === */}
      <Row className="g-3 mb-4">
        {/* Card Guru */}
        <Col md={4}>
          <Card className="border-0 shadow-sm h-100 border-start border-4 border-primary">
            <Card.Body className="d-flex align-items-center">
              <div className="bg-primary bg-opacity-10 p-3 rounded-circle me-3 text-primary">
                <Users size={24} />
              </div>
              <div>
                <div className="text-muted small fw-bold text-uppercase">Total Guru & Kepsek</div>
                <h2 className="mb-0 fw-bold">{stats?.total_guru?.toLocaleString('id-ID')}</h2>
              </div>
            </Card.Body>
          </Card>
        </Col>

        {/* Card Tendik */}
        <Col md={4}>
          <Card className="border-0 shadow-sm h-100 border-start border-4 border-success">
            <Card.Body className="d-flex align-items-center">
              <div className="bg-success bg-opacity-10 p-3 rounded-circle me-3 text-success">
                <BookOpen size={24} />
              </div>
              <div>
                <div className="text-muted small fw-bold text-uppercase">Total Tendik</div>
                <h2 className="mb-0 fw-bold">{stats?.total_tendik?.toLocaleString('id-ID')}</h2>
              </div>
            </Card.Body>
          </Card>
        </Col>

        {/* Card Pensiun */}
        <Col md={4}>
          <Card className="border-0 shadow-sm h-100 border-start border-4 border-danger">
            <Card.Body className="d-flex align-items-center">
              <div className="bg-danger bg-opacity-10 p-3 rounded-circle me-3 text-danger">
                <TrendingUp size={24} />
              </div>
              <div>
                <div className="text-muted small fw-bold text-uppercase">Proyeksi Pensiun (5 Thn)</div>
                <h2 className="mb-0 fw-bold">{totalPension5Years} <span className="fs-6 text-muted fw-normal">Pegawai</span></h2>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* === BAGIAN 2: CHART DEMOGRAFI (PIE & KECAMATAN) === */}
      <Row className="g-3 mb-4">
        {/* Pie Chart: Komposisi Pegawai */}
        <Col lg={4} md={12}>
          <Card className="border-0 shadow-sm h-100">
            <Card.Header className="bg-white py-3 border-bottom-0">
              <h6 className="mb-0 fw-bold">Komposisi Pegawai</h6>
            </Card.Header>
            <Card.Body style={{ height: 320 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    fill="#8884d8"
                    paddingAngle={5}
                    dataKey="value"
                    label
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => `${value} Orang`} />
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer>
            </Card.Body>
          </Card>
        </Col>

        {/* Bar Chart Horizontal: Sebaran Kecamatan */}
        <Col lg={8} md={12}>
          <Card className="border-0 shadow-sm h-100">
            <Card.Header className="bg-white py-3 border-bottom-0">
              <h6 className="mb-0 fw-bold">Sebaran Pegawai per Kecamatan</h6>
            </Card.Header>
            <Card.Body style={{ height: 320 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  layout="vertical"
                  data={stats?.kecamatan_stats}
                  margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                  <XAxis type="number" />
                  <YAxis 
                    dataKey="unit_kerja_kecamatan" 
                    type="category" 
                    width={130} 
                    tick={{fontSize: 12}} 
                  />
                  <Tooltip 
                    cursor={{fill: '#f8f9fa'}} 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}
                  />
                  <Bar dataKey="count" name="Jumlah Pegawai" fill="#6610f2" radius={[0, 4, 4, 0]} barSize={25} />
                </BarChart>
              </ResponsiveContainer>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* === BAGIAN 3: ANALISIS PENSIUN (CHART & TABEL) === */}
      <h5 className="fw-bold mb-3 mt-4">Analisis Proyeksi Pensiun (2025 - 2030)</h5>
      <Row className="g-3">
        {/* Chart Tren Pensiun */}
        <Col lg={7} md={12}>
          <Card className="border-0 shadow-sm h-100">
            <Card.Header className="bg-white py-3">
              <h6 className="mb-0 fw-bold">Grafik Tren Tahunan</h6>
            </Card.Header>
            <Card.Body style={{ height: 350 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats?.pension_projection}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="tahun_pensiun" />
                  <YAxis />
                  <Tooltip 
                     contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}
                  />
                  <Bar dataKey="count" name="Yang Akan Pensiun" fill="#dc3545" radius={[4, 4, 0, 0]} barSize={50} />
                </BarChart>
              </ResponsiveContainer>
            </Card.Body>
          </Card>
        </Col>

        {/* Tabel Detail Pensiun */}
        <Col lg={5} md={12}>
          <Card className="border-0 shadow-sm h-100">
            <Card.Header className="bg-white py-3">
              <h6 className="mb-0 fw-bold">Rincian Data (Klik untuk Detail)</h6>
            </Card.Header>
            <Card.Body className="p-0 table-responsive">
              <Table hover striped className="mb-0 align-middle">
                <thead className="table-light">
                  <tr>
                    <th className="ps-4">Tahun</th>
                    <th>Jumlah</th>
                    <th className="text-end pe-4">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {stats?.pension_projection?.length > 0 ? (
                    stats.pension_projection.map((item, index) => (
                      <tr 
                        key={index} 
                        style={{ cursor: 'pointer', transition: '0.2s' }} 
                        onClick={() => handleYearClick(item.tahun_pensiun)}
                      >
                        <td className="ps-4 fw-bold">{item.tahun_pensiun}</td>
                        <td>
                            <Badge bg="secondary" className="rounded-pill px-3">
                                {item.count} Pegawai
                            </Badge>
                        </td>
                        <td className="text-end pe-4">
                            <Button variant="outline-primary" size="sm" className="rounded-pill">
                                Detail <ChevronRight size={14} />
                            </Button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="3" className="text-center text-muted py-4">
                        Tidak ada data pensiun dalam 5 tahun ke depan.
                      </td>
                    </tr>
                  )}
                </tbody>
              </Table>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* === MODAL POPUP: DETAIL PEGAWAI === */}
      <Modal show={showModal} onHide={() => setShowModal(false)} size="xl" centered scrollable>
        <Modal.Header closeButton className="border-0 pb-0">
          <div>
            <Modal.Title className="fw-bold">Daftar Pegawai Pensiun</Modal.Title>
            <p className="text-muted mb-0">Tahun: <span className="text-primary fw-bold">{selectedYear}</span></p>
          </div>
        </Modal.Header>
        <Modal.Body className="pt-2">
          {loadingDetail ? (
            <div className="d-flex justify-content-center align-items-center py-5">
              <Spinner animation="border" variant="primary" />
              <span className="ms-2">Memuat data pegawai...</span>
            </div>
          ) : (
            <>
                <div className="alert alert-info d-flex align-items-center py-2 mb-3">
                    <Users size={18} className="me-2"/>
                    <small>Total: <strong>{detailData.length}</strong> pegawai akan pensiun pada tahun ini.</small>
                </div>
                <Table responsive hover size="sm" className="align-middle">
                <thead className="table-light sticky-top">
                    <tr>
                    <th>No</th>
                    <th>Nama Pegawai</th>
                    <th>NIP</th>
                    <th>Jabatan</th>
                    <th>Unit Kerja</th>
                    </tr>
                </thead>
                <tbody>
                    {detailData.length > 0 ? (
                    detailData.map((pegawai, idx) => (
                        <tr key={idx}>
                        <td>{idx + 1}</td>
                        <td className="fw-bold text-dark">{pegawai.nama_pegawai}</td>
                        <td className="font-monospace text-muted">{pegawai.nip}</td>
                        <td>
                            <Badge bg={pegawai.jabatan?.toLowerCase().includes('guru') ? 'primary' : 'success'} className="fw-normal">
                                {pegawai.jabatan}
                            </Badge>
                        </td>
                        <td className="small text-secondary">{pegawai.unit_kerja_nama}</td>
                        </tr>
                    ))
                    ) : (
                    <tr>
                        <td colSpan="5" className="text-center py-4 text-muted">Data pegawai tidak ditemukan.</td>
                    </tr>
                    )}
                </tbody>
                </Table>
            </>
          )}
        </Modal.Body>
        <Modal.Footer className="border-0 pt-0">
          <Button variant="secondary" onClick={() => setShowModal(false)}>Tutup</Button>
        </Modal.Footer>
      </Modal>

    </Layout>
  );
}