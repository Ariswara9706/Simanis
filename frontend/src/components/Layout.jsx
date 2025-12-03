import React, { useState } from 'react'; 
import { useAuth } from '../context/AuthContext';
// 1. IMPORT HOOK INI AGAR TERSAMBUNG KE ANJAB
import { useNotification } from '../context/NotificationContext'; 
import { Link, useLocation } from 'react-router-dom';
import { Navbar, Nav, Offcanvas, Button, Badge as BsBadge } from 'react-bootstrap';
import { LayoutDashboard, FileText, Users, Activity, Menu, LogOut, UserCircle } from 'lucide-react';

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [show, setShow] = useState(false);
  
  // 2. GANTI STATE LOKAL DENGAN CONTEXT GLOBAL
  // Jangan pakai useState/useEffect fetch sendiri lagi disini!
  // Ambil langsung dari "Pusat Informasi"
  const { notifCounts } = useNotification(); 

  const handleClose = () => setShow(false);
  const handleShow = () => setShow(true);

  // Helper Badge
  const renderBadge = (menuName) => {
    if (menuName === 'Data Anjab') {
        if ((user?.role === 'ADMIN' || user?.role === 'KASUDIN') && notifCounts.pending > 0) {
            return <BsBadge bg="danger" pill className="ms-auto">{notifCounts.pending}</BsBadge>;
        }
        // Logic Guru: Ambil angka dari Context yang bisa di-reset jadi 0
        if (user?.role === 'GURU_TENDIK' && notifCounts.approved > 0) {
            return <BsBadge bg="success" pill className="ms-auto">{notifCounts.approved}</BsBadge>;
        }
    }
    return null;
  };

  const menus = [
    { name: 'Dashboard', path: '/dashboard', icon: <LayoutDashboard size={20} />, roles: ['ADMIN', 'KASUDIN', 'GURU_TENDIK'] },
    { name: 'Data Anjab', path: '/anjab', icon: <FileText size={20} />, roles: ['ADMIN', 'KASUDIN', 'GURU_TENDIK'] },
    { name: 'Manajemen User', path: '/users', icon: <Users size={20} />, roles: ['ADMIN'] },
    { name: 'Log Aktivitas', path: '/logs', icon: <Activity size={20} />, roles: ['ADMIN', 'KASUDIN'] },
  ];

  const filteredMenus = menus.filter(menu => menu.roles.includes(user?.role));

  const SidebarContent = () => (
    <div className="d-flex flex-column h-100 bg-white">
      <div className="p-3 border-bottom text-center">
        <h5 className="mb-0 fw-bold text-primary">SIMANIS APP</h5>
        <small className="text-muted">Sistem Analisis Jabatan JT2</small>
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
            {/* Render Badge dari Context */}
            {renderBadge(menu.name)}
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
      <aside className="d-none d-lg-block bg-white border-end shadow-sm" style={{ width: '260px', minWidth: '260px' }}>
        <SidebarContent />
      </aside>

      <main className="flex-grow-1 d-flex flex-column h-100 overflow-hidden position-relative">
        <Navbar bg="white" className="border-bottom px-4 py-3 shadow-sm" expand={false}>
          <div className="d-flex align-items-center w-100">
            <Button variant="light" className="d-lg-none me-3 border" onClick={handleShow}>
              <Menu size={24} className="text-dark" />
            </Button>

            <h5 className="mb-0 fw-bold text-dark me-auto">
              {menus.find(m => m.path === location.pathname)?.name || 'Dashboard'}
            </h5>

            <div className="d-flex align-items-center gap-3">
               <div className="text-end d-none d-md-block lh-1">
                 <div className="fw-bold text-dark" style={{fontSize: '14px'}}>{user?.nama_lengkap}</div>
                 <div className="text-muted small" style={{fontSize: '11px'}}>{user?.role}</div>
               </div>
               <div className="bg-light rounded-circle p-1 border">
                 <UserCircle size={32} className="text-secondary" />
               </div>
            </div>
          </div>
        </Navbar>

        <div className="flex-grow-1 overflow-auto p-4 bg-light">
          {children}
        </div>
      </main>

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