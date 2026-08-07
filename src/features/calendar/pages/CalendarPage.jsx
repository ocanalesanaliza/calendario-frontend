import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../auth/context/AuthContext'
import { getTrabajosCampo } from '../../trabajosCampo/services/trabajosCampoService'
import { getCoberturas } from '../../coberturas/services/coberturasService'
import { getSolicitudesVacacion } from '../../vacacionesProgramadas/services/vacacionesProgramadasService'
import './CalendarPage.css'

const ICONS = {
  tareas: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  ),
  almuerzo: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8h1a4 4 0 0 1 0 8h-1" />
      <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" />
      <line x1="6" y1="1" x2="6" y2="4" />
      <line x1="10" y1="1" x2="10" y2="4" />
      <line x1="14" y1="1" x2="14" y2="4" />
    </svg>
  ),
  rendimiento: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  ),
  pendientes: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  ),
  sucursales: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  ),
  coberturas: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
  ),
  dashboard: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="9" /><rect x="14" y="3" width="7" height="5" />
      <rect x="14" y="12" width="7" height="9" /><rect x="3" y="16" width="7" height="5" />
    </svg>
  ),
  reportes: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  ),
  usuarios: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  configuracion: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  ),
}

function saludoSegunHora() {
  const hora = new Date().getHours()
  if (hora < 12) return 'Buenos días'
  if (hora < 19) return 'Buenas tardes'
  return 'Buenas noches'
}

function fechaDeHoy() {
  const texto = new Date().toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

function CalendarPage() {
  const { perfil } = useAuth()
  const esGerenteArea = perfil?.type === 'gerente_area'
  const esSucursal = perfil?.type === 'gerente_sucursal'
  const esAdmin = perfil?.es_admin_maestro === true

  const [pendientes, setPendientes] = useState(0)
  const [cargandoPendientes, setCargandoPendientes] = useState(esGerenteArea || esSucursal)

  useEffect(() => {
    if (esGerenteArea) {
      Promise.all([
        getTrabajosCampo({ estado: 'pendiente' }).catch(() => ({ results: [] })),
        getSolicitudesVacacion({ estado: 'pendiente' }).catch(() => ({ results: [] })),
      ])
        .then(([trabajos, vacaciones]) => {
          setPendientes((trabajos.results ?? []).length + (vacaciones.results ?? []).length)
        })
        .finally(() => setCargandoPendientes(false))
    } else if (esSucursal) {
      getCoberturas({ estado: 'pendiente' })
        .then((res) => setPendientes((res.results ?? []).length))
        .catch(() => {})
        .finally(() => setCargandoPendientes(false))
    }
  }, [esGerenteArea, esSucursal])

  const accesos = [
    { to: '/mis-tareas', label: 'Mis tareas', desc: 'Marca tus tareas del día', icon: ICONS.tareas, visible: esSucursal },
    { to: '/almuerzos', label: 'Almuerzo', desc: 'Registra tu horario de almuerzo', icon: ICONS.almuerzo, visible: true },
    { to: '/rendimiento', label: 'Rendimiento', desc: 'Consulta tu desempeño', icon: ICONS.rendimiento, visible: esSucursal },
    { to: '/solicitudes-pendientes', label: 'Solicitudes pendientes', desc: 'Revisa lo que espera tu aprobación', icon: ICONS.pendientes, visible: esSucursal || esGerenteArea, badge: pendientes },
    { to: '/tareas', label: 'Tareas', desc: 'Administra tareas por sucursal', icon: ICONS.tareas, visible: esGerenteArea || esAdmin },
    { to: '/sucursales', label: 'Sucursales', desc: 'Gestiona tus sucursales', icon: ICONS.sucursales, visible: esGerenteArea || esAdmin },
    { to: '/coberturas', label: 'Cambios de sucursal', desc: 'Cambios temporales entre sucursales', icon: ICONS.coberturas, visible: esGerenteArea || esAdmin },
    { to: '/dashboard', label: 'Dashboard', desc: 'Panorama operativo del día', icon: ICONS.dashboard, visible: esGerenteArea || esAdmin },
    { to: '/reportes', label: 'Reportes', desc: 'Exporta información histórica', icon: ICONS.reportes, visible: esGerenteArea || esAdmin },
    { to: '/usuarios', label: 'Usuarios', desc: 'Administra al personal', icon: ICONS.usuarios, visible: esGerenteArea || esAdmin },
    { to: '/configuracion', label: 'Configuración', desc: 'Ajustes generales del sistema', icon: ICONS.configuracion, visible: esAdmin },
  ].filter((item) => item.visible)

  return (
    <div className="home-page">
      <div className="home-header">
        <h1>{saludoSegunHora()}, {perfil?.nombre || 'Usuario'}</h1>
        <p>{fechaDeHoy()}</p>
      </div>

      {(esGerenteArea || esSucursal) && (
        <div className="home-summary">
          <div className="home-summary-icon">{ICONS.pendientes}</div>
          <div>
            <span className="home-summary-value">
              {cargandoPendientes ? '—' : pendientes}
            </span>
            <span className="home-summary-label">
              {pendientes === 1 ? 'solicitud pendiente por revisar' : 'solicitudes pendientes por revisar'}
            </span>
          </div>
          {pendientes > 0 && (
            <Link to="/solicitudes-pendientes" className="home-summary-link">Revisar</Link>
          )}
        </div>
      )}

      <h2 className="home-section-title">Accesos rápidos</h2>
      <div className="home-grid">
        {accesos.map((item) => (
          <Link to={item.to} key={item.to} className="home-card">
            <div className="home-card-icon">{item.icon}</div>
            <div className="home-card-body">
              <span className="home-card-label">{item.label}</span>
              <span className="home-card-desc">{item.desc}</span>
            </div>
            {item.badge > 0 && <span className="home-card-badge">{item.badge}</span>}
          </Link>
        ))}
      </div>
    </div>
  )
}

export default CalendarPage
