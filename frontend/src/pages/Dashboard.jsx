import React, { createContext, useState, useEffect, useContext } from 'react';
import api from '../services/api';
import Layout from '../components/Layout';
import { Row, Col, Card, Table, Spinner, Badge } from 'react-bootstrap';
import { Users, BookOpen, TrendingUp } from 'lucide-react';

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

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

  if (loading) return (
    <Layout>
      <div className="d-flex justify-content-center align-items-center" style={{height: '50vh'}}>
        <Spinner animation="border" variant="primary" />
      </div>
    </Layout>
  );

  return (
    <Layout>
      {/* Kartu Statistik */}
      <Row className="g-3 mb-4">
        <Col md={4}>
          <Card className="border-0 shadow-sm h-100 border-start border-4 border-primary">
            <Card.Body className="d-flex align-items-center">
              <div className="bg-primary bg-opacity-10 p-3 rounded-circle me-3 text-primary">
                <Users size={24} />
              </div>
              <div>
                <div className="text-muted small fw-bold">TOTAL GURU</div>
                <h2 className="mb-0 fw-bold">{stats?.total_guru || 0}</h2>
              </div>
            </Card.Body>
          </Card>
        </Col>

        <Col md={4}>
          <Card className="border-0 shadow-sm h-100 border-start border-4 border-success">
            <Card.Body className="d-flex align-items-center">
              <div className="bg-success bg-opacity-10 p-3 rounded-circle me-3 text-success">
                <BookOpen size={24} />
              </div>
              <div>
                <div className="text-muted small fw-bold">TOTAL TENDIK</div>
                <h2 className="mb-0 fw-bold">{stats?.total_tendik || 0}</h2>
              </div>
            </Card.Body>
          </Card>
        </Col>

        <Col md={4}>
          <Card className="border-0 shadow-sm h-100 border-start border-4 border-danger">
            <Card.Body className="d-flex align-items-center">
              <div className="bg-danger bg-opacity-10 p-3 rounded-circle me-3 text-danger">
                <TrendingUp size={24} />
              </div>
              <div>
                <div className="text-muted small fw-bold">PENSIUN (5 THN)</div>
                <h2 className="mb-0 fw-bold">
                  {stats?.pension_projection?.reduce((acc, curr) => acc + parseInt(curr.count), 0) || 0}
                </h2>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Tabel Statistik */}
      <Card className="border-0 shadow-sm">
        <Card.Header className="bg-white py-3">
          <h6 className="mb-0 fw-bold">Proyeksi Pensiun 2025 - 2030</h6>
        </Card.Header>
        <Card.Body>
          <Table hover responsive striped className="mb-0">
            <thead className="table-light">
              <tr>
                <th>Tahun Pensiun</th>
                <th>Jumlah Pegawai</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {stats?.pension_projection?.length > 0 ? (
                stats.pension_projection.map((item, index) => (
                  <tr key={index}>
                    <td className="fw-bold">{item.estimasi_pensiun_tahun}</td>
                    <td>{item.count} Orang</td>
                    <td><Badge bg="warning" text="dark">Perlu Peremajaan</Badge></td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="3" className="text-center text-muted">Data aman, tidak ada pensiun dekat ini.</td>
                </tr>
              )}
            </tbody>
          </Table>
        </Card.Body>
      </Card>
    </Layout>
  );
}