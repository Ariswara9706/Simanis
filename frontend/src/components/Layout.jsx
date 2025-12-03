import React, { useState } from 'react'; // Jangan lupa import React
import { useAuth } from '../context/AuthContext';
import { Link, useLocation } from 'react-router-dom';
import { Navbar, Container, Nav, Offcanvas, Button, Dropdown } from 'react-bootstrap';
import { LayoutDashboard, FileText, Users, Activity, Menu, LogOut, UserCircle } from 'lucide-react';

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [show, setShow] = useState(false);

  const handleClose = () => setShow(false);
  const handleShow = () => setShow(true);

  // Daftar Menu
  const menus = [
    { name: 'Dashboard', path: '/dashboard', icon: <LayoutDashboard size={20} />, roles: ['ADMIN', 'KASUDIN', 'GURU_TENDIK'] },
    { name: 'Data Anjab', path: '/anjab', icon: <FileText size={20} />, roles: ['ADMIN', 'KASUDIN', 'GURU_TENDIK'] },
    { name: 'Manajemen User', path: '/users', icon: <Users size={20} />, roles: ['ADMIN'] },
    { name: 'Log Aktivitas', path: '/logs', icon: <Activity size={20} />, roles: ['ADMIN', 'KASUDIN'] },
  ];

  const filteredMenus = menus.filter(menu => menu.roles.includes(user?.role));

  // Komponen Sidebar (Dipakai ulang di Desktop & Mobile)
  const SidebarContent = () => (
    <div className="d-flex flex-column h-100 bg-white">
      <div className="p-3 border-bottom text-center">
        <h5 className="mb-0 fw-bold text-primary">SIMANIS APP</h5>
        <small className="text-muted">SDN Cawang 01</small>
      </div>
      <Nav className="flex-column p-2 flex-grow-1 mt-2">
        {filteredMenus.map((menu) => (
          <Nav.Link 
            as={Link} 
            to={menu.path} 
            key={menu.path}
            onClick={handleClose} 
            className={`d-flex align-items-center gap-2 mb-2 rounded px-3 py-2 ${
              location.pathname === menu.path 
                ? 'bg-primary text-white shadow-sm' 
                : 'text-secondary hover-bg-light'
            }`}
          >
            {menu.icon} 
            <span className="fw-medium">{menu.name}</span>
          </Nav.Link>
        ))}
      </Nav>
      <div className="p-3 border-top mt-auto">
        <Button 
          variant="outline-danger" 
          className="w-100 d-flex align-items-center justify-content-center gap-2" 
          onClick={logout}
        >
          <LogOut size={18} /> Logout
        </Button>
      </div>
    </div>
  );

  return (
    <div className="d-flex vh-100 overflow-hidden bg-light">
      {/* === 1. SIDEBAR DESKTOP (Kiri) === */}
      {/* Hanya muncul di layar besar (lg ke atas) */}
      <aside className="d-none d-lg-block bg-white border-end shadow-sm" style={{ width: '260px', minWidth: '260px' }}>
        <SidebarContent />
      </aside>

      {/* === 2. KONTEN UTAMA (Kanan) === */}
      <main className="flex-grow-1 d-flex flex-column h-100 overflow-hidden position-relative">
        
        {/* Header / Navbar */}
        <Navbar bg="white" className="border-bottom px-4 py-3 shadow-sm" expand={false}>
          <div className="d-flex align-items-center w-100">
            {/* Tombol Menu Mobile */}
            <Button variant="light" className="d-lg-none me-3 border" onClick={handleShow}>
              <Menu size={24} className="text-dark" />
            </Button>

            {/* Judul Halaman */}
            <h5 className="mb-0 fw-bold text-dark me-auto">
              {menus.find(m => m.path === location.pathname)?.name || 'Dashboard'}
            </h5>

            {/* Profil User */}
            <div className="d-flex align-items-center gap-3">
               <div className="text-end d-none d-md-block lh-1">
                 <div className="fw-bold text-dark" style={{fontSize: '14px'}}>{user?.nama_lengkap}</div>
                 <BadgeRole role={user?.role} />
               </div>
               <div className="bg-light rounded-circle p-1 border">
                 <UserCircle size={32} className="text-secondary" />
               </div>
            </div>
          </div>
        </Navbar>

        {/* Area Konten Scrollable */}
        <div className="flex-grow-1 overflow-auto p-4 bg-light">
          {children}
        </div>
      </main>

      {/* === 3. SIDEBAR MOBILE (Offcanvas) === */}
      {/* Hapus prop 'responsive="lg"' agar tidak bentrok dengan sidebar desktop */}
      <Offcanvas show={show} onHide={handleClose} placement="start">
        <Offcanvas.Header closeButton>
          <Offcanvas.Title className="fw-bold text-primary">Menu</Offcanvas.Title>
        </Offcanvas.Header>
        <Offcanvas.Body className="p-0">
          <SidebarContent />
        </Offcanvas.Body>
      </Offcanvas>
    </div>
  );
}

// Komponen kecil untuk mempercantik Role
function BadgeRole({ role }) {
  let color = 'text-muted';
  if (role === 'ADMIN') color = 'text-primary';
  if (role === 'KASUDIN') color = 'text-success';
  return <div className={`small fw-bold ${color}`} style={{fontSize: '11px'}}>{role}</div>;
}