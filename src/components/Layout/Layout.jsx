import { useState, useRef, useEffect } from 'react'
import { Outlet, Link, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../features/auth/context/AuthContext'
import { getTrabajosCampo } from '../../features/trabajosCampo/services/trabajosCampoService'
import { getCoberturas } from '../../features/coberturas/services/coberturasService'
import { getSolicitudesVacacion } from '../../features/vacacionesProgramadas/services/vacacionesProgramadasService'
import './Layout.css'

const NAV_CATEGORY_KEYS = ['dia-a-dia', 'gestion', 'personas', 'analitica', 'administracion']

function Layout() {
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef(null)
  const navigate = useNavigate()
  const location = useLocation()
  const { perfil, logout } = useAuth()

  const esGerenteArea  = perfil?.type === 'gerente_area'
  const esSucursal     = perfil?.type === 'gerente_sucursal'
  const esAdmin        = perfil?.es_admin_maestro === true

  const [notifOpen, setNotifOpen]     = useState(false)
  const [notificaciones, setNotificaciones] = useState([])
  const puedeVerNotificaciones = esGerenteArea || esSucursal
  const notificacionesVisibles = puedeVerNotificaciones ? notificaciones : []
  const notifRef = useRef(null)

  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const stored = localStorage.getItem('sidebarCollapsed')
    return stored === null ? true : stored === '1'
  })
  const [openCategories, setOpenCategories] = useState(
    () => new Set(NAV_CATEGORY_KEYS)
  )

  function toggleSidebar() {
    setSidebarCollapsed((prev) => {
      const next = !prev
      localStorage.setItem('sidebarCollapsed', next ? '1' : '0')
      return next
    })
  }

  function toggleCategory(key) {
    setOpenCategories((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false)
      }
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotifOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (esGerenteArea) {
      Promise.all([
        getTrabajosCampo({ estado: 'pendiente' }).catch(() => ({ results: [] })),
        getSolicitudesVacacion({ estado: 'pendiente' }).catch(() => ({ results: [] })),
      ]).then(([trabajos, vacaciones]) => {
        const deCampo = (trabajos.results ?? []).map((tc) => ({
          id: tc.id_trabajo_campo,
          tipo: 'campo',
          titulo: `Trabajo de campo — ${tc.usuario?.nombre ?? ''}`,
          fecha: tc.fecha,
          meta: `${tc.jornada === 'manana' ? 'Mañana' : 'Tarde'}${tc.motivo ? ` · ${tc.motivo}` : ''}`,
        }))
        const deVacaciones = (vacaciones.results ?? []).map((v) => ({
          id: v.id_solicitud_vacacion,
          tipo: 'vacacion',
          titulo: `Vacaciones programadas — ${v.usuario?.nombre ?? ''}`,
          fecha: v.fecha_inicio,
          meta: `${v.fecha_inicio} al ${v.fecha_fin}${v.motivo ? ` · ${v.motivo}` : ''}`,
        }))
        setNotificaciones([...deCampo, ...deVacaciones])
      })
    } else if (esSucursal) {
      getCoberturas({ estado: 'pendiente' })
        .then((res) => setNotificaciones(
          (res.results ?? []).map((c) => ({
            id: c.id_cobertura,
            tipo: 'cobertura',
            titulo: `Cobertura en ${c.sucursal_destino?.nombre ?? ''}`,
            fecha: c.fecha,
            meta: `${c.jornada_label ?? ''}${c.motivo ? ` · ${c.motivo}` : ''}`,
          }))
        ))
        .catch(() => {})
    }
  }, [esGerenteArea, esSucursal, location.pathname])

  function handleNotifClick(item) {
    setNotifOpen(false)
    navigate('/solicitudes-pendientes', { state: { highlightId: item.tipo === 'campo' ? item.id : null } })
  }

  function handleLogout() {
    logout()
    navigate('/Login')
  }

  const categorias = [
    {
      key: 'dia-a-dia',
      label: 'Mi día a día',
      items: [
        {
          to: '/mis-tareas',
          label: 'Mis tareas',
          visible: esSucursal,
          icon: (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 11l3 3L22 4" />
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
            </svg>
          ),
        },
        {
          to: '/almuerzos',
          label: 'Almuerzo',
          visible: true,
          icon: (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8h1a4 4 0 0 1 0 8h-1" />
              <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" />
              <line x1="6" y1="1" x2="6" y2="4" />
              <line x1="10" y1="1" x2="10" y2="4" />
              <line x1="14" y1="1" x2="14" y2="4" />
            </svg>
          ),
        },
        {
          to: '/rendimiento',
          label: 'Rendimiento',
          visible: esSucursal,
          icon: (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="20" x2="18" y2="10" />
              <line x1="12" y1="20" x2="12" y2="4" />
              <line x1="6" y1="20" x2="6" y2="14" />
            </svg>
          ),
        },
        {
          to: '/solicitudes-pendientes',
          label: 'Solicitudes pendientes',
          visible: esSucursal || esGerenteArea,
          badge: notificacionesVisibles.length,
          icon: (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
          ),
        },
      ],
    },
    {
      key: 'gestion',
      label: 'Gestión',
      items: [
        {
          to: '/tareas',
          label: 'Tareas',
          visible: esGerenteArea || esAdmin,
          icon: (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 11l3 3L22 4" />
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
            </svg>
          ),
        },
        {
          to: '/sucursales',
          label: 'Sucursales',
          visible: esGerenteArea || esAdmin,
          icon: (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
          ),
        },
        {
          to: '/plantillas',
          label: 'Plantillas',
          visible: esGerenteArea || esAdmin,
          icon: (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
            </svg>
          ),
        },
        {
          to: '/situaciones',
          label: 'Situaciones especiales',
          visible: esGerenteArea || esAdmin,
          icon: (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          ),
        },
        {
          to: '/coberturas',
          label: 'Cambio sucursal temporales',
          visible: esGerenteArea || esAdmin,
          icon: (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="16 18 22 12 16 6" />
              <polyline points="8 6 2 12 8 18" />
            </svg>
          ),
        },
      ],
    },
    {
      key: 'personas',
      label: 'Personas',
      items: [
        {
          to: '/usuarios',
          label: 'Usuarios',
          visible: esGerenteArea || esAdmin,
          icon: (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          ),
        },
        {
          to: '/gerentes',
          label: 'Gerentes de área',
          visible: esAdmin,
          icon: (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          ),
        },
      ],
    },
    {
      key: 'analitica',
      label: 'Analítica',
      items: [
        {
          to: '/dashboard',
          label: 'Dashboard',
          visible: esGerenteArea || esAdmin,
          icon: (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="9" /><rect x="14" y="3" width="7" height="5" />
              <rect x="14" y="12" width="7" height="9" /><rect x="3" y="16" width="7" height="5" />
            </svg>
          ),
        },
        {
          to: '/reportes',
          label: 'Reportes',
          visible: esGerenteArea || esAdmin,
          icon: (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
          ),
        },
      ],
    },
    {
      key: 'administracion',
      label: 'Administración',
      items: [
        {
          to: '/configuracion',
          label: 'Configuración',
          visible: esAdmin,
          icon: (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          ),
        },
      ],
    },
  ]

  return (
    <div className="layout">
      {/* Topbar */}
      <header className="topbar">
        <Link to="/" className="topbar-brand">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8"  y1="2" x2="8"  y2="6" />
            <line x1="3"  y1="10" x2="21" y2="10" />
            <circle cx="8"  cy="15" r="1" fill="currentColor" stroke="none" />
            <circle cx="12" cy="15" r="1" fill="currentColor" stroke="none" />
            <circle cx="16" cy="15" r="1" fill="currentColor" stroke="none" />
          </svg>
          <span>Taskly</span>
        </Link>

        <div className="topbar-actions">
          {/* Notificaciones */}
          <div className="notif-menu" ref={notifRef}>
            <button
              className="icon-btn"
              aria-label="Notificaciones"
              onClick={() => setNotifOpen(!notifOpen)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              {notificacionesVisibles.length > 0 && (
                <span className="notif-badge">{notificaciones.length}</span>
              )}
            </button>

            {notifOpen && (
              <div className="dropdown-menu notif-dropdown">
                {notificacionesVisibles.length === 0 ? (
                  <p className="notif-empty">No tienes notificaciones.</p>
                ) : (
                  notificacionesVisibles.map((item) => (
                    <button
                      key={`${item.tipo}-${item.id}`}
                      className="notif-item"
                      onClick={() => handleNotifClick(item)}
                    >
                      <p className="notif-item-titulo">{item.titulo}</p>
                      <p className="notif-item-meta">{item.fecha} · {item.meta}</p>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Usuario dropdown */}
          <div className="user-menu" ref={dropdownRef}>
            <button
              className="user-btn"
              onClick={() => setDropdownOpen(!dropdownOpen)}
              aria-expanded={dropdownOpen}
            >
              <div className="user-avatar">
                {perfil?.nombre ? perfil.nombre.charAt(0).toUpperCase() : 'U'}
              </div>
              <span className="user-name">{perfil?.nombre || 'Usuario'}</span>
              <svg
                className={`chevron ${dropdownOpen ? 'open' : ''}`}
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            {dropdownOpen && (
              <div className="dropdown-menu">
                <button className="dropdown-item" onClick={() => setDropdownOpen(false)}>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                  Perfil
                </button>
                <button className="dropdown-item danger" onClick={handleLogout}>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                  Cerrar sesión
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="layout-body">
        {/* Sidebar */}
        <aside className={`sidebar ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
          <button
            type="button"
            className="sidebar-toggle"
            onClick={toggleSidebar}
            aria-label={sidebarCollapsed ? 'Expandir menú' : 'Contraer menú'}
            title={sidebarCollapsed ? 'Expandir menú' : 'Contraer menú'}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="11 17 6 12 11 7" />
              <polyline points="18 17 13 12 18 7" />
            </svg>
          </button>

          <nav className="sidebar-nav">
            {categorias.map((categoria, index) => {
              const items = categoria.items.filter((item) => item.visible)
              if (items.length === 0) return null

              const isOpen = openCategories.has(categoria.key)

              return (
                <div className="nav-group" key={categoria.key}>
                  {sidebarCollapsed ? (
                    index > 0 && <div className="nav-group-divider" />
                  ) : (
                    <button
                      type="button"
                      className="nav-group-header"
                      onClick={() => toggleCategory(categoria.key)}
                      aria-expanded={isOpen}
                    >
                      <span>{categoria.label}</span>
                      <svg
                        className={`nav-group-chevron ${isOpen ? 'open' : ''}`}
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </button>
                  )}

                  {(sidebarCollapsed || isOpen) && (
                    <div className="nav-group-items">
                      {items.map((item) => (
                        <NavLink
                          key={item.to}
                          to={item.to}
                          title={sidebarCollapsed ? item.label : undefined}
                          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                        >
                          {item.icon}
                          {!sidebarCollapsed && <span className="nav-item-label">{item.label}</span>}
                          {item.badge > 0 && (
                            sidebarCollapsed
                              ? <span className="nav-item-dot" />
                              : <span className="tab-count">{item.badge}</span>
                          )}
                        </NavLink>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </nav>

          <div className="sidebar-footer">
            <div className="sidebar-user-avatar">
              {perfil?.nombre ? perfil.nombre.charAt(0).toUpperCase() : 'U'}
            </div>
            {!sidebarCollapsed && (
              <div className="sidebar-user-info">
                <span className="sidebar-user-name">{perfil?.nombre || 'Usuario'}</span>
                <span className="sidebar-user-role">
                  {esAdmin ? 'Admin maestro' : esGerenteArea ? 'Gerente de área' : 'Gerente de sucursal'}
                </span>
              </div>
            )}
          </div>
        </aside>

        {/* Contenido principal */}
        <main className="main-content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default Layout
