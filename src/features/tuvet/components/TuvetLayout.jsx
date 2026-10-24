import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/context/AuthContext'
import { getTuvetCapabilities, tuvetRoleLabel } from '../tuvetPolicies'
import { useApariencia } from '../../apariencia/AparienciaContext'
import '../../../components/Layout/Layout.css'
import '../tuvet.css'

const ICONOS = {
  seguimiento: <><rect x="3" y="3" width="7" height="9" rx="1" /><rect x="14" y="3" width="7" height="5" rx="1" /><rect x="14" y="12" width="7" height="9" rx="1" /><rect x="3" y="16" width="7" height="5" rx="1" /></>,
  tareas: <><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></>,
  revisiones: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="M9 12l2 2 4-4" /></>,
  catalogo: <><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 8h8M8 12h8M8 16h5" /></>,
  plantillas: <><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></>,
  equipo: <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>,
  rendimiento: <><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></>,
  apariencia: <><path d="M12 22a10 10 0 1 1 10-10c0 2.8-2.2 4-4 4h-1.8a1.7 1.7 0 0 0-1.3 2.8c.6.7.4 3.2-2.9 3.2z" /><circle cx="7.5" cy="11.5" r="1.2" /><circle cx="10.5" cy="7.5" r="1.2" /><circle cx="15.5" cy="7.5" r="1.2" /></>,
  cambiar: <><polyline points="17 1 21 5 17 9" /><path d="M3 11V9a4 4 0 0 1 4-4h14" /><polyline points="7 23 3 19 7 15" /><path d="M21 13v2a4 4 0 0 1-4 4H3" /></>,
}

function Icono({ nombre }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {ICONOS[nombre]}
    </svg>
  )
}

export default function TuvetLayout() {
  const { perfil, logout } = useAuth()
  const { logo, empresa } = useApariencia('tuvet')
  const navigate = useNavigate()
  const [menuAbierto, setMenuAbierto] = useState(false)
  const menuRef = useRef(null)
  const capacidades = getTuvetCapabilities(perfil)

  useEffect(() => {
    function onMouseDown(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) setMenuAbierto(false)
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [])

  const items = [
    { to: '/tuvet/seguimiento', label: 'Seguimiento', icono: 'seguimiento', visible: capacidades.canManageTasks },
    { to: '/tuvet/mis-tareas', label: 'Mis tareas', icono: 'tareas', visible: capacidades.canAccessMyTasks },
    { to: '/tuvet/revisiones', label: 'Revisiones', icono: 'revisiones', visible: capacidades.canReview },
    { to: '/tuvet/tareas', label: 'Tareas', icono: 'catalogo', visible: capacidades.canManageTasks },
    { to: '/tuvet/plantillas', label: 'Plantillas', icono: 'plantillas', visible: capacidades.canManageTasks },
    { to: '/tuvet/equipo', label: capacidades.canManageStructure ? 'Estructura' : 'Equipo', icono: 'equipo', visible: capacidades.canAccessTeam },
    { to: '/tuvet/rendimiento', label: 'Rendimiento', icono: 'rendimiento', visible: capacidades.canAccessPerformance },
    { to: '/tuvet/apariencia', label: 'Apariencia', icono: 'apariencia', visible: capacidades.canManageStructure },
  ].filter((item) => item.visible)

  function cerrarSesion() {
    logout()
    navigate('/Login')
  }

  const inicial = perfil?.nombre ? perfil.nombre.charAt(0).toUpperCase() : 'U'

  return (
    <div className="layout tuvet-app">
      <a className="tuvet-skip-link" href="#tuvet-contenido">Saltar al contenido</a>
      <header className="topbar">
        <Link to="/tuvet" className="topbar-brand">
          {logo ? (
            <img className="topbar-logo" src={logo} alt={empresa?.nombre ? `Logo de ${empresa.nombre}` : 'Logo de la empresa'} />
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
          )}
          {/* Con logo propio el nombre sobra: el logo ya identifica a la empresa. */}
          {!logo && <span>Taskly · Tuvet</span>}
        </Link>

        <div className="topbar-actions">
          <div className="user-menu" ref={menuRef}>
            <button type="button" className="user-btn" onClick={() => setMenuAbierto((valor) => !valor)} aria-expanded={menuAbierto}>
              <div className="user-avatar">{inicial}</div>
              <span className="user-name">{perfil?.nombre || 'Usuario'}</span>
            </button>
            {menuAbierto && (
              <div className="dropdown-menu" role="menu">
                {capacidades.isSystemsAccount && (
                  <button type="button" role="menuitem" className="dropdown-item" onClick={() => { setMenuAbierto(false); navigate('/empresas') }}>
                    <Icono nombre="cambiar" />
                    Cambiar de empresa
                  </button>
                )}
                <button type="button" role="menuitem" className="dropdown-item danger" onClick={cerrarSesion}>Cerrar sesión</button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="layout-body">
        <aside className="sidebar">
          <nav className="sidebar-nav" aria-label="Calendario Tuvet">
            <div className="nav-group">
              <div className="nav-group-items">
                {items.map((item) => (
                  <NavLink key={item.to} to={item.to} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                    <Icono nombre={item.icono} />
                    <span className="nav-item-label">{item.label}</span>
                  </NavLink>
                ))}
              </div>
            </div>
            {capacidades.isSystemsAccount && (
              <div className="nav-group">
                <div className="nav-group-divider" />
                <div className="nav-group-items">
                  <NavLink to="/empresas" className="nav-item">
                    <Icono nombre="cambiar" />
                    <span className="nav-item-label">Cambiar de empresa</span>
                  </NavLink>
                </div>
              </div>
            )}
          </nav>

          <div className="sidebar-footer">
            <div className="sidebar-user-avatar">{inicial}</div>
            <div className="sidebar-user-info">
              <span className="sidebar-user-name">{perfil?.nombre || 'Usuario'}</span>
              <span className="sidebar-user-role">{tuvetRoleLabel(perfil)}</span>
            </div>
          </div>
        </aside>

        <main id="tuvet-contenido" className="main-content" tabIndex={-1}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
