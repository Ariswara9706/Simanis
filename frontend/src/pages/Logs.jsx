import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import api from '../services/api';
import { Table, Card, Badge, Spinner, Pagination, Form, Button } from 'react-bootstrap';
import { Activity, RefreshCcw, User, Clock, ShieldAlert } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Logs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // State Pagination
  const [params, setParams] = useState({
      page: 1,
      limit: 20
  });
  const [paginationInfo, setPaginationInfo] = useState({ totalPages: 0, totalItems: 0 });

  // === FETCH LOGS ===
  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/admin/logs?page=${params.page}&limit=${params.limit}`);
      setLogs(res.data.data);
      setPaginationInfo(res.data.pagination);
    } catch (error) {
      console.error(error);
      toast.error('Gagal memuat log aktivitas');
    } finally {
      setLoading(false);
    }
  };

  // Fetch saat params berubah
  useEffect(() => {
    fetchLogs();
  }, [params]);

  // Helper Warna Badge Action
  const getActionColor = (action) => {
      if (action.includes('LOGIN')) return 'info';
      if (action.includes('ADD')) return 'success';
      if (action.includes('UPDATE') || action.includes('EDIT')) return 'primary';
      if (action.includes('DELETE')) return 'danger';
      if (action.includes('VERIFY')) return 'warning';
      return 'secondary';
  };

  return (
    <Layout>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
            <h2 className="fw-bold text-dark mb-1">Log Aktivitas</h2>
            <p className="text-muted small">Rekam jejak aktivitas sistem secara real-time</p>
        </div>
        <Button variant="outline-primary" onClick={fetchLogs}>
            <RefreshCcw size={18} className="me-2" /> Refresh
        </Button>
      </div>

      <Card className="border-0 shadow-sm">
        <Card.Body className="p-0">
            {/* Toolbar Limit */}
            <div className="p-3 border-bottom d-flex justify-content-between align-items-center bg-light">
                <div className="d-flex align-items-center gap-2">
                    <small className="text-muted">Tampilkan:</small>
                    <Form.Select 
                        size="sm" 
                        style={{width: '80px'}} 
                        value={params.limit} 
                        onChange={(e) => setParams({...params, limit: parseInt(e.target.value), page: 1})}
                    >
                        <option value="20">20</option>
                        <option value="50">50</option>
                        <option value="100">100</option>
                    </Form.Select>
                    <small className="text-muted">baris per halaman</small>
                </div>
                <div className="text-muted small">
                    Total: <strong>{paginationInfo.totalItems}</strong> Aktivitas
                </div>
            </div>

            {loading ? (
                <div className="text-center p-5"><Spinner animation="border" variant="primary" /></div>
            ) : (
                <div className="table-responsive">
                    <Table hover className="mb-0 align-middle small">
                        <thead className="bg-light">
                            <tr>
                                <th className="py-3 ps-4" style={{width: '200px'}}>Waktu</th>
                                <th style={{width: '250px'}}>User</th>
                                <th style={{width: '150px'}}>Tipe Aksi</th>
                                <th>Deskripsi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {logs.length > 0 ? logs.map((log) => (
                                <tr key={log.id}>
                                    <td className="ps-4 text-muted">
                                        <div className="d-flex align-items-center gap-2">
                                            <Clock size={14} />
                                            {new Date(log.created_at).toLocaleString('id-ID')}
                                        </div>
                                    </td>
                                    <td>
                                        <div className="fw-bold text-dark">{log.nama_lengkap || log.username || 'System'}</div>
                                        <div className="text-muted smaller" style={{fontSize: '10px'}}>
                                            {log.role ? log.role : 'Unknown'}
                                        </div>
                                    </td>
                                    <td>
                                        <Badge bg={getActionColor(log.action_type)} className="fw-normal">
                                            {log.action_type}
                                        </Badge>
                                    </td>
                                    <td className="text-secondary">
                                        {log.description}
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan="4" className="text-center py-5 text-muted">
                                        <ShieldAlert size={48} className="mb-3 opacity-25" />
                                        <p>Belum ada aktivitas tercatat</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </Table>
                </div>
            )}

            {/* Pagination Controls */}
            {paginationInfo.totalPages > 1 && (
                <div className="p-3 d-flex justify-content-end border-top">
                    <Pagination className="mb-0" size="sm">
                        <Pagination.Prev 
                            disabled={params.page === 1}
                            onClick={() => setParams({...params, page: params.page - 1})}
                        />
                        {/* Logic Pagination Sederhana (First, Last, Current) */}
                        <Pagination.Item active>{params.page}</Pagination.Item>
                        
                        <Pagination.Next 
                            disabled={params.page === paginationInfo.totalPages}
                            onClick={() => setParams({...params, page: params.page + 1})}
                        />
                    </Pagination>
                </div>
            )}
        </Card.Body>
      </Card>
    </Layout>
  );
}