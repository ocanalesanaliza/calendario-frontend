import { useState, useRef, useEffect } from 'react'
import { Outlet, Link, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../features/auth/context/AuthContext'
import { getTrabajosCampo } from '../../features/trabajosCampo/services/trabajosCampoService'
import { getCoberturas } from '../../features/coberturas/services/coberturasService'
import { getSolicitudesVacacion } from '../../features/vacacionesProgramadas/services/vacacionesProgramadasService'
import { getProfileCapabilities } from '../../features/auth/profilePolicies'
import { useApariencia } from '../../features/apariencia/AparienciaContext'
import './Layout.css'

const NAV_CATEGORY_KEYS = ['dia-a-dia', 'gestion', 'personas', 'analitica', 'administracion']
const MOBILE_QUERY = '(max-width: 900px)'

function Layout() {
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef(null)
  const navigate = useNavigate()
  const location = useLocation()
  const { perfil, logout } = useAuth()
  const { logo, empresa } = useApariencia('tareas')

  const {
    isAreaManager: esGerenteArea,
    isBranchManager: esSucursal,
    isAdminMaster,
    isMasterAdmin: esAdmin,
    isOperationsManager: esGerenteOperaciones,
    canAccessLunch,
    canAccessMyTasks: puedeAccederMisTareas,
    canManageAreaManagers,
    canManageOperationsManagers,
    canManageOrganization,
    canManageBranches,
    canManageTemplates,
    canManageUsers,
    canManageSpecialSituations,
    canAccessOperationalDashboard,
    canAccessPerformanceReports,
    canAccessAreaAbsences,
    isSystemsAccount,
    canAccessPendingRequests,
  } = getProfileCapabilities(perfil)
  const hideRestrictedNavigation = esGerenteArea

  const [notifOpen, setNotifOpen]     = useState(false)
  const [notificaciones, setNotificaciones] = useState([])
  const puedeVerNotificaciones = esGerenteArea || esSucursal
  const notificacionesVisibles = puedeVerNotificaciones ? notificaciones : []
  const notifRef = useRef(null)

  // Siempre inicia contraído (solo iconos); el botón de menú lo expande durante la sesión.
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true)
  // En pantallas pequeñas el menú lateral es un panel que se abre desde la barra superior.
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  // El botón de menú contrae el lateral en escritorio y abre el panel en móvil (mismo punto de corte que Layout.css).
  const [esMovil, setEsMovil] = useState(() => window.matchMedia?.(MOBILE_QUERY).matches ?? false)
  useEffect(() => {
    const media = window.matchMedia?.(MOBILE_QUERY)
    if (!media) return undefined
    const actualizar = (evento) => {
      setEsMovil(evento.matches)
      if (!evento.matches) setMobileNavOpen(false)
    }
    media.addEventListener('change', actualizar)
    return () => media.removeEventListener('change', actualizar)
  }, [])
  const [navLocation, setNavLocation] = useState(location.pathname)
  if (navLocation !== location.pathname) {
    setNavLocation(location.pathname)
    setMobileNavOpen(false)
  }
  const [openCategories, setOpenCategories] = useState(
    () => new Set(NAV_CATEGORY_KEYS)
  )

  function toggleSidebar() {
    setSidebarCollapsed((prev) => !prev)
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
    // Escape cierra menús desplegables y el panel móvil.
    function handleEscape(e) {
      if (e.key !== 'Escape') return
      setDropdownOpen(false)
      setNotifOpen(false)
      setMobileNavOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
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
          visible: !hideRestrictedNavigation && !esGerenteOperaciones && puedeAccederMisTareas,
          // Portapapeles con check: las tareas propias del día.
          icon: (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="8" y="2" width="8" height="4" rx="1" />
              <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
              <path d="M9 14l2 2 4-4" />
            </svg>
          ),
        },
        {
          to: '/depositospendientes',
          label: 'Depósitos pendientes',
          visible: !hideRestrictedNavigation && esGerenteArea,
          icon: (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {/* Billete: depósitos de dinero. */}
              <rect x="2" y="6" width="20" height="12" rx="2" />
              <circle cx="12" cy="12" r="2" />
              <path d="M6 12h.01M18 12h.01" />
            </svg>
          ),
        },
        {
          to: '/calendario-area',
          label: 'Calendario del área',
          visible: esGerenteArea,
          icon: (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {/* Calendario con días marcados. */}
              <rect x="3" y="4" width="18" height="17" rx="2" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
              <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01" />
            </svg>
          ),
        },
        {
          to: '/almuerzos',
          label: 'Mi almuerzo',
          visible: canAccessLunch && !isAdminMaster,
          icon: (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {/* Tenedor y cuchillo: almuerzo. */}
              <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" />
              <path d="M7 2v20" />
              <path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7" />
            </svg>
          ),
        },
        {
          to: '/rendimiento',
          label: 'Rendimiento',
          visible: esSucursal,
          // Tendencia al alza: rendimiento.
          icon: (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
              <polyline points="16 7 22 7 22 13" />
            </svg>
          ),
        },
        {
          to: '/solicitudes-pendientes',
          label: 'Solicitudes pendientes',
          visible: canAccessPendingRequests,
          badge: notificacionesVisibles.length,
          // Bandeja de entrada: solicitudes que esperan respuesta.
          icon: (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
              <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
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
          visible: !hideRestrictedNavigation && canManageBranches,
          // Lista con checks: catálogo de tareas.
          icon: (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6l1.5 1.5L7 5" />
              <path d="M3 12l1.5 1.5L7 11" />
              <path d="M3 18l1.5 1.5L7 17" />
              <path d="M11 6h10M11 12h10M11 18h10" />
            </svg>
          ),
        },
        {
          to: '/inventario-demo',
          label: 'Conteo de inventario',
          visible: !hideRestrictedNavigation && canManageBranches,
          icon: (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {/* Caja con lista: inventario que se cuenta. */}
              <path d="M21 8V6a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 6v10a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 1 .27" />
              <path d="M3.3 6.5L12 11.5l8.7-5" />
              <path d="M12 22V11.5" />
              <path d="M16 15h6M16 18.5h6M16 22h4" />
            </svg>
          ),
        },
        {
          to: '/sucursales',
          label: 'Sucursales',
          visible: canManageBranches,
          // Fachada de tienda con toldo: sucursal.
          icon: (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l1.5-5h15L21 9" />
              <path d="M3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0" />
              <path d="M5 11.5V21h14v-9.5" />
              <path d="M10 21v-5h4v5" />
            </svg>
          ),
        },
        {
          to: '/areas',
          label: 'Áreas',
          visible: canManageAreaManagers,
          icon: (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {/* Mapa plegado: zonas o áreas geográficas. */}
              <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" />
              <line x1="9" y1="3" x2="9" y2="18" />
              <line x1="15" y1="6" x2="15" y2="21" />
            </svg>
          ),
        },
        {
          to: '/organizacion',
          label: 'Organización',
          visible: canManageOrganization,
          icon: (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {/* Organigrama: un nodo superior con dos dependientes. */}
              <rect x="9" y="2" width="6" height="6" rx="1" />
              <rect x="2" y="16" width="6" height="6" rx="1" />
              <rect x="16" y="16" width="6" height="6" rx="1" />
              <path d="M5 16v-3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3M12 12V8" />
            </svg>
          ),
        },
        {
          to: '/plantillas',
          label: 'Plantillas',
          visible: canManageTemplates,
          icon: (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {/* Hojas apiladas: plantillas reutilizables. */}
              <path d="M15 2H8a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7z" />
              <path d="M15 2v5h5" />
              <path d="M4 7v13a2 2 0 0 0 2 2h10" />
              <path d="M10 11h6M10 14h4" />
            </svg>
          ),
        },
        {
          to: '/ausencias-area',
          label: 'Vacaciones y situaciones del área',
          visible: canAccessAreaAbsences,
          icon: (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {/* Avión: vacaciones y ausencias. */}
              <path d="M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" />
            </svg>
          ),
        },
        {
          to: '/plantillas-area',
          label: 'Plantillas de área',
          visible: isSystemsAccount || esAdmin,
          icon: (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {/* Plantilla con bloques (encabezado y columnas): plantillas de área. */}
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <rect x="7" y="7" width="10" height="3" rx=".5" />
              <rect x="7" y="13" width="4" height="4" rx=".5" />
              <path d="M14 13h3M14 17h3" />
            </svg>
          ),
        },
        {
          to: '/situaciones',
          label: 'Situaciones especiales',
          visible: canManageSpecialSituations,
          icon: (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {/* Triángulo de advertencia: permisos, incapacidades e imprevistos. */}
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          ),
        },
        {
          to: '/coberturas',
          label: 'Cambio sucursal temporales',
          visible: canManageUsers,
          icon: (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {/* Flechas de ida y vuelta: traslado temporal entre sucursales. */}
              <path d="M8 3L4 7l4 4" />
              <path d="M4 7h16" />
              <path d="M16 21l4-4-4-4" />
              <path d="M20 17H4" />
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
          visible: canManageUsers,
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
          visible: canManageAreaManagers || esAdmin,
          icon: (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {/* Persona con marcador de ubicación: gerente a cargo de un área. */}
              <path d="M15 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="8.5" cy="7" r="4" />
              <path d="M19 15.5s3-2.6 3-5a3 3 0 0 0-6 0c0 2.4 3 5 3 5z" />
              <circle cx="19" cy="10.5" r=".8" />
            </svg>
          ),
        },
        {
          to: '/gerentes-operaciones',
          label: 'Gerentes de operaciones',
          visible: canManageOperationsManagers,
          icon: (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {/* Maletín: gerencia de operaciones. */}
              <rect x="2" y="7" width="20" height="14" rx="2" />
              <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
              <path d="M2 13h20M12 12v2" />
            </svg>
          ),
        },
        {
          to: '/admin-master-asignaciones',
          label: 'Admin Masters',
          visible: isSystemsAccount,
          icon: (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {/* Escudo con llave: administradores con acceso total. */}
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <circle cx="12" cy="10" r="2" />
              <path d="M12 12v4M12 14.5h1.5" />
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
          label: 'Status',
          visible: canAccessOperationalDashboard,
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
          visible: canAccessPerformanceReports,
          icon: (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {/* Documento con gráfico de barras: reporte. */}
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <path d="M8 18v-2M12 18v-5M16 18v-3" />
            </svg>
          ),
        },
        {
          to: '/analitica/revisiones-guardia',
          label: 'Revisiones de guardia',
          visible: esAdmin,
          icon: (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <path d="M9 12l2 2 4-4" />
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
          to: '/apariencia',
          label: 'Apariencia',
          visible: esAdmin || isAdminMaster || isSystemsAccount,
          // Paleta de pintor: colores, fuente y logo de la empresa.
          icon: (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22a10 10 0 1 1 10-10c0 2.8-2.2 4-4 4h-1.8a1.7 1.7 0 0 0-1.3 2.8c.6.7.4 3.2-2.9 3.2z" />
              <circle cx="7.5" cy="11.5" r="1.2" fill="currentColor" stroke="none" />
              <circle cx="10.5" cy="7.5" r="1.2" fill="currentColor" stroke="none" />
              <circle cx="15.5" cy="7.5" r="1.2" fill="currentColor" stroke="none" />
            </svg>
          ),
        },
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

  // En móvil el panel abierto siempre muestra etiquetas, aunque en escritorio esté contraído.
  const compacto = sidebarCollapsed && !mobileNavOpen
  const totalNotificaciones = notificacionesVisibles.length
  // Sin los casos de sistemas y admin maestro de país, ambos caían en "Gerente de sucursal".
  const rolUsuario = isSystemsAccount ? 'Sistemas'
    : esAdmin ? 'Admin maestro'
      : isAdminMaster ? 'Admin Master'
        : esGerenteOperaciones ? 'Gerente de operaciones'
          : esGerenteArea ? 'Gerente de área'
            : 'Gerente de sucursal'

  return (
    <div className={`layout layout-responsive ${mobileNavOpen ? 'layout-nav-open' : ''}`}>
      <a className="skip-link" href="#contenido-principal">Saltar al contenido</a>

      {/* Topbar */}
      <header className="topbar">
        <button
          type="button"
          className="icon-btn topbar-menu-btn"
          onClick={() => (esMovil ? setMobileNavOpen((abierto) => !abierto) : toggleSidebar())}
          aria-label={esMovil ? (mobileNavOpen ? 'Cerrar menú' : 'Abrir menú') : (sidebarCollapsed ? 'Expandir menú' : 'Contraer menú')}
          title={esMovil ? undefined : (sidebarCollapsed ? 'Expandir menú' : 'Contraer menú')}
          aria-expanded={esMovil ? mobileNavOpen : !sidebarCollapsed}
          aria-controls="menu-lateral"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {esMovil && mobileNavOpen
              ? <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>
              : <><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></>}
          </svg>
        </button>
        <Link to={isSystemsAccount ? '/calendario' : '/'} className="topbar-brand">
          {/* Logo de la empresa y país (Apariencia); sin logo se mantiene el icono del calendario. */}
          {logo ? (
            <img className="topbar-logo" src={logo} alt={empresa?.nombre ? `Logo de ${empresa.nombre}` : 'Logo de la empresa'} />
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8"  y1="2" x2="8"  y2="6" />
              <line x1="3"  y1="10" x2="21" y2="10" />
              <circle cx="8"  cy="15" r="1" fill="currentColor" stroke="none" />
              <circle cx="12" cy="15" r="1" fill="currentColor" stroke="none" />
              <circle cx="16" cy="15" r="1" fill="currentColor" stroke="none" />
            </svg>
          )}
          {/* Con logo propio el nombre sobra: el logo ya identifica a la empresa. */}
          {!logo && <span>CRONOS</span>}
        </Link>

        <div className="topbar-actions">
          {/* Notificaciones */}
          <div className="notif-menu" ref={notifRef}>
            <button
              type="button"
              className="icon-btn"
              aria-label={totalNotificaciones > 0 ? `Notificaciones: ${totalNotificaciones} pendientes` : 'Notificaciones'}
              aria-expanded={notifOpen}
              aria-haspopup="true"
              onClick={() => setNotifOpen(!notifOpen)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              {totalNotificaciones > 0 && (
                <span className="notif-badge" aria-hidden="true">{totalNotificaciones > 99 ? '99+' : totalNotificaciones}</span>
              )}
            </button>

            {notifOpen && (
              <div className="dropdown-menu notif-dropdown">
                <p className="dropdown-title">Notificaciones</p>
                {notificacionesVisibles.length === 0 ? (
                  <p className="notif-empty">No tienes notificaciones.</p>
                ) : (
                  notificacionesVisibles.map((item) => (
                    <button
                      type="button"
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
              type="button"
              className="user-btn"
              onClick={() => setDropdownOpen(!dropdownOpen)}
              aria-expanded={dropdownOpen}
              aria-haspopup="menu"
              aria-label={`Menú de ${perfil?.nombre || 'usuario'}`}
            >
              <span className="user-avatar" aria-hidden="true">
                {perfil?.nombre ? perfil.nombre.charAt(0).toUpperCase() : 'U'}
              </span>
              <span className="user-name">{perfil?.nombre || 'Usuario'}</span>
              <svg
                aria-hidden="true"
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
              <div className="dropdown-menu" role="menu">
                <div className="dropdown-header" aria-hidden="true">
                  <span className="dropdown-header-name">{perfil?.nombre || 'Usuario'}</span>
                  <span className="dropdown-header-role">{rolUsuario}</span>
                </div>
                <button type="button" role="menuitem" className="dropdown-item" onClick={() => setDropdownOpen(false)}>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                  Perfil
                </button>
                {isSystemsAccount && (
                  <button type="button" role="menuitem" className="dropdown-item" onClick={() => { setDropdownOpen(false); navigate('/empresas') }}>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <polyline points="17 1 21 5 17 9" />
                      <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                      <polyline points="7 23 3 19 7 15" />
                      <path d="M21 13v2a4 4 0 0 1-4 4H3" />
                    </svg>
                    Cambiar de empresa
                  </button>
                )}
                <div className="dropdown-separator" role="separator" />
                <button type="button" role="menuitem" className="dropdown-item danger" onClick={handleLogout}>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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
        {/* Fondo del panel móvil: un clic fuera lo cierra */}
        <div className="sidebar-backdrop" onClick={() => setMobileNavOpen(false)} aria-hidden="true" />

        {/* Sidebar */}
        <aside
          id="menu-lateral"
          className={`sidebar ${compacto ? 'sidebar-collapsed' : ''} ${mobileNavOpen ? 'sidebar-mobile-open' : ''}`}
          aria-label="Menú principal"
        >
          <nav className="sidebar-nav" aria-label="Secciones">
            {categorias.map((categoria, index) => {
              const items = categoria.items.filter((item) => item.visible)
              if (items.length === 0) return null

              const isOpen = openCategories.has(categoria.key)
              const groupId = `nav-grupo-${categoria.key}`

              return (
                <div className="nav-group" key={categoria.key}>
                  {compacto ? (
                    index > 0 && <div className="nav-group-divider" role="separator" />
                  ) : (
                    <button
                      type="button"
                      className="nav-group-header"
                      onClick={() => toggleCategory(categoria.key)}
                      aria-expanded={isOpen}
                      aria-controls={groupId}
                    >
                      <span>{categoria.label}</span>
                      <svg
                        aria-hidden="true"
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

                  {(compacto || isOpen) && (
                    <div className="nav-group-items" id={groupId}>
                      {items.map((item) => (
                        <NavLink
                          key={item.to}
                          to={item.to}
                          title={compacto ? item.label : undefined}
                          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                        >
                          <span className="nav-item-icon" aria-hidden="true">{item.icon}</span>
                          {!compacto && <span className="nav-item-label">{item.label}</span>}
                          {/* En modo compacto el nombre también aparece al enfocar con teclado, no solo con el ratón. */}
                          {compacto && <span className="nav-tooltip" aria-hidden="true">{item.label}</span>}
                          {item.badge > 0 && (
                            compacto
                              ? <span className="nav-item-dot"><span className="visually-hidden">{item.badge} pendientes</span></span>
                              : <span className="tab-count">{item.badge}<span className="visually-hidden"> pendientes</span></span>
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
            <div className="sidebar-user-avatar" aria-hidden="true">
              {perfil?.nombre ? perfil.nombre.charAt(0).toUpperCase() : 'U'}
            </div>
            {!compacto && (
              <div className="sidebar-user-info">
                <span className="sidebar-user-name">{perfil?.nombre || 'Usuario'}</span>
                <span className="sidebar-user-role">{rolUsuario}</span>
              </div>
            )}
          </div>
        </aside>

        {/* Contenido principal */}
        <main id="contenido-principal" className="main-content" tabIndex={-1}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default Layout
