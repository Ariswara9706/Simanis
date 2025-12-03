import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import api from '../services/api';
import { Table, Card, Button, Badge, Modal, Form, Spinner, ListGroup } from 'react-bootstrap';
import { Trash2, UserPlus, Edit, Search } from 'lucide-react'; 
import toast from 'react-hot-toast';

export default function Users() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // State Modal
  const [showModal, setShowModal] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    nama_lengkap: '',
    role: 'GURU_TENDIK'
  });
  const [saving, setSaving] = useState(false);

  // === STATE BARU UNTUK PENCARIAN GURU ===
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  // === FETCH USERS ===
  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/users');
      setUsers(res.data);
    } catch (error) {
      console.error(error);
      toast.error("Gagal mengambil data user");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // === LOGIC PENCARIAN GURU (AUTOCOMPLETE) ===
  // Efek ini jalan setiap kali 'searchTerm' berubah
  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      // Hanya cari jika role Guru, input > 2 huruf, dan dropdown sedang aktif
      if (formData.role === 'GURU_TENDIK' && searchTerm.length >= 2 && showDropdown) {
        setIsSearching(true);
        try {
          // Panggil API Anjab yang sudah ada filternya
          const res = await api.get(`/anjab?nama=${searchTerm}`);
          setSearchResults(res.data);
        } catch (error) {
          console.error("Gagal cari guru", error);
        } finally {
          setIsSearching(false);
        }
      } else if (searchTerm.length < 2) {
        setSearchResults([]);
      }
    }, 500); // Tunggu 500ms setelah user berhenti mengetik (biar gak berat)

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm, formData.role, showDropdown]);

  // Saat Guru dipilih dari dropdown
 const handleSelectGuru = (guru) => {
    setFormData({
      ...formData,
      nama_lengkap: guru.nama_pegawai,
      username: guru.nip || guru.nama_pegawai.split(' ')[0].toLowerCase() + '123',
      
      // PENTING: Simpan ID data Anjab supaya bisa dilink nanti
      anjab_id: guru.id 
    });
    setSearchTerm(guru.nama_pegawai); 
    setShowDropdown(false); 
  };

  // === HANDLER OPEN MODAL (RESET) ===
  const handleOpenModal = (user = null) => {
    setSearchResults([]); 
    setShowDropdown(false);
    
    if (user) {
        setIsEdit(true);
        setSelectedId(user.id);
        setFormData({
            username: user.username,
            password: '', 
            nama_lengkap: user.nama_lengkap,
            role: user.role,
            anjab_id: null // Reset saat edit (kecuali mau fitur relink, tp skip dulu biar simple)
        });
        setSearchTerm(user.nama_lengkap); 
    } else {
        setIsEdit(false);
        setSelectedId(null);
        // Reset anjab_id jadi null
        setFormData({ username: '', password: '', nama_lengkap: '', role: 'GURU_TENDIK', anjab_id: null });
        setSearchTerm('');
    }
    setShowModal(true);
  };

  // === HANDLER DELETE ===
  const handleDelete = async (id) => {
    if(!window.confirm("Yakin ingin menghapus user ini? Akses mereka akan hilang.")) return;
    try {
        await api.delete(`/admin/users/${id}`);
        toast.success("User berhasil dihapus");
        fetchUsers();
    } catch (error) {
        toast.error(error.response?.data?.message || "Gagal hapus user");
    }
  };

 

  // === HANDLER SIMPAN ===
  const handleSave = async (e) => {
      e.preventDefault();
      if (!isEdit && !formData.password) return toast.error("Password wajib diisi untuk user baru!");

      setSaving(true);
      try {
          if (isEdit) {
            await api.put(`/admin/users/${selectedId}`, formData);
            toast.success("Data user diperbarui!");
          } else {
            await api.post('/admin/users', formData);
            toast.success("User baru berhasil ditambahkan!");
          }
          setShowModal(false);
          fetchUsers();
      } catch (error) {
          toast.error(error.response?.data?.message || "Gagal menyimpan user");
      } finally {
          setSaving(false);
      }
  };

  const handleChange = (e) => {
      setFormData({...formData, [e.target.name]: e.target.value});
  };

  return (
    <Layout>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
            <h2 className="fw-bold text-dark mb-1">Manajemen User</h2>
            <p className="text-muted small">Kelola akun akses aplikasi (Admin, Kasudin, Guru)</p>
        </div>
        <Button variant="primary" onClick={() => handleOpenModal(null)}>
            <UserPlus size={18} className="me-2" /> Tambah User
        </Button>
      </div>

      <Card className="border-0 shadow-sm">
        <Card.Body className="p-0">
            {loading ? (
                 <div className="text-center p-5"><Spinner animation="border" /></div>
            ) : (
                <Table responsive hover className="mb-0 align-middle">
                    <thead className="bg-light">
                        <tr>
                            <th className="py-3 ps-4">No</th>
                            <th>Username</th>
                            <th>Nama Lengkap</th>
                            <th>Role</th>
                            <th className="text-end pe-4">Aksi</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.map((u, index) => (
                            <tr key={u.id}>
                                <td className="ps-4">{index + 1}</td>
                                <td className="fw-bold text-primary">{u.username}</td>
                                <td>{u.nama_lengkap}</td>
                                <td>
                                    <Badge bg={u.role === 'ADMIN' ? 'primary' : (u.role === 'KASUDIN' ? 'success' : 'secondary')}>
                                        {u.role}
                                    </Badge>
                                </td>
                                <td className="text-end pe-4">
                                    <div className="d-flex justify-content-end gap-2">
                                        <Button variant="light" size="sm" className="text-primary border-0" onClick={() => handleOpenModal(u)}>
                                            <Edit size={16} />
                                        </Button>
                                        <Button variant="light" size="sm" className="text-danger border-0" onClick={() => handleDelete(u.id)}>
                                            <Trash2 size={16} />
                                        </Button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </Table>
            )}
        </Card.Body>
      </Card>

      {/* MODAL FORM */}
      <Modal show={showModal} onHide={() => setShowModal(false)} backdrop="static">
        <Modal.Header closeButton>
            <Modal.Title>{isEdit ? 'Edit Data User' : 'Tambah User Baru'}</Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleSave}>
            <Modal.Body>
                
                {/* ROLE SELECTOR */}
                <Form.Group className="mb-3">
                    <Form.Label>Role (Hak Akses)</Form.Label>
                    <Form.Select name="role" value={formData.role} onChange={handleChange}>
                        <option value="GURU_TENDIK">GURU / TENDIK</option>
                        <option value="KASUDIN">KASUDIN</option>
                        <option value="ADMIN">ADMIN</option>
                    </Form.Select>
                </Form.Group>

                {/* LOGIKA INPUT NAMA: JIKA GURU -> SEARCHABLE, JIKA ADMIN -> TEXT BIASA */}
                <Form.Group className="mb-3 position-relative">
                    <Form.Label>Nama Lengkap</Form.Label>
                    
                    {formData.role === 'GURU_TENDIK' ? (
                        <>
                            <div className="input-group">
                                <span className="input-group-text bg-white"><Search size={16}/></span>
                                <Form.Control 
                                    type="text"
                                    placeholder="Ketik nama guru untuk mencari..."
                                    value={searchTerm}
                                    onChange={(e) => {
                                        setSearchTerm(e.target.value);
                                        setFormData({...formData, nama_lengkap: e.target.value}); // Tetap simpan manual jaga2
                                        setShowDropdown(true);
                                    }}
                                    onFocus={() => setShowDropdown(true)}
                                    autoComplete="off"
                                />
                                {/* LOADING SPINNER DI KANAN */}
                                {isSearching && (
                                    <span className="input-group-text bg-white border-start-0">
                                        <Spinner animation="border" size="sm" variant="primary" />
                                    </span>
                                )}
                            </div>

                            {/* DROPDOWN HASIL PENCARIAN */}
                            {showDropdown && searchResults.length > 0 && (
                                <ListGroup className="position-absolute w-100 shadow mt-1" style={{zIndex: 1050, maxHeight: '200px', overflowY: 'auto'}}>
                                    {searchResults.map((guru) => (
                                        <ListGroup.Item 
                                            key={guru.id} 
                                            action 
                                            onClick={() => handleSelectGuru(guru)}
                                            className="d-flex justify-content-between align-items-center"
                                        >
                                            <div>
                                                <strong>{guru.nama_pegawai}</strong>
                                                <div className="small text-muted">{guru.nip || 'Non-PNS'} - {guru.jabatan}</div>
                                            </div>
                                        </ListGroup.Item>
                                    ))}
                                </ListGroup>
                            )}
                             {showDropdown && searchTerm.length > 2 && !isSearching && searchResults.length === 0 && (
                                <div className="text-muted small mt-1 fst-italic">Data guru tidak ditemukan di database Anjab.</div>
                            )}
                        </>
                    ) : (
                        // INPUT BIASA UNTUK ADMIN / KASUDIN
                        <Form.Control 
                            type="text" 
                            name="nama_lengkap"
                            value={formData.nama_lengkap} 
                            onChange={handleChange} 
                            required 
                        />
                    )}
                </Form.Group>

                <div className="row">
                    <div className="col-md-6">
                        <Form.Group className="mb-3">
                            <Form.Label>Username</Form.Label>
                            <Form.Control 
                                type="text" 
                                name="username"
                                value={formData.username} 
                                onChange={handleChange} 
                                required 
                                placeholder="Tanpa spasi"
                            />
                        </Form.Group>
                    </div>
                    <div className="col-md-6">
                        <Form.Group className="mb-3">
                            <Form.Label className="d-flex justify-content-between">
                                Password 
                                {isEdit && <small className="text-muted fw-normal">(Opsional)</small>}
                            </Form.Label>
                            <Form.Control 
                                type="password" 
                                name="password"
                                value={formData.password} 
                                onChange={handleChange} 
                                placeholder={isEdit ? "Isi jika ingin ubah" : "Wajib diisi"}
                                required={!isEdit} 
                            />
                        </Form.Group>
                    </div>
                </div>
            </Modal.Body>
            <Modal.Footer>
                <Button variant="secondary" onClick={() => setShowModal(false)}>Batal</Button>
                <Button variant="primary" type="submit" disabled={saving}>
                    {saving ? 'Menyimpan...' : 'Simpan User'}
                </Button>
            </Modal.Footer>
        </Form>
      </Modal>
    </Layout>
  );
}