import React, { createContext, useState, useEffect, useContext } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { Container, Card, Form, Button } from 'react-bootstrap';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await api.post('/auth/login', { username, password });
      const { accessToken, user } = response.data;
      toast.success(`Login Berhasil! Halo ${user.nama_lengkap}`);
      login(accessToken, user);
    } catch (error) {
      toast.error('Username atau Password salah!');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="d-flex justify-content-center align-items-center vh-100 bg-light">
      <Container style={{ maxWidth: '400px' }}>
        <Card className="shadow border-0">
          <Card.Body className="p-4">
            <div className="text-center mb-4">
              <h3 className="fw-bold text-primary">SIMANIS</h3>
              <p className="text-muted">Sistem Analisis Jabatan</p>
            </div>
            <Form onSubmit={handleSubmit}>
              <Form.Group className="mb-3">
                <Form.Label>Username</Form.Label>
                <Form.Control 
                  type="text" 
                  placeholder="Masukkan username" 
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required 
                />
              </Form.Group>

              <Form.Group className="mb-4">
                <Form.Label>Password</Form.Label>
                <Form.Control 
                  type="password" 
                  placeholder="Masukkan password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required 
                />
              </Form.Group>

              <Button variant="primary" type="submit" className="w-100" disabled={loading}>
                {loading ? 'Memproses...' : 'Masuk Aplikasi'}
              </Button>
            </Form>
          </Card.Body>
        </Card>
      </Container>
    </div>
  );
}