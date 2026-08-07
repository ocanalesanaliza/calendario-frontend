import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/context/AuthContext'
import { getTrabajosCampo } from '../../trabajosCampo/services/trabajosCampoService'
import { getCoberturas } from '../../coberturas/services/coberturasService'
import { getSolicitudesVacacion } from '../../vacacionesProgramadas/services/vacacionesProgramadasService'
import './CalendarPage.css'

const AGENDA_ICONS = {
  campo: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  ),
  cobertura: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
  ),
  vacacion: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  ),
}

const JORNADA_ORDEN = { manana: 0, tarde: 1 }

function saludoSegunHora() {
  const hora = new Date().getHours()
  if (hora < 12) return 'Buenos días'
  if (hora < 19) return 'Buenas tardes'
  return 'Buenas noches'
}

function hoyISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
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
  const navigate = useNavigate()
  const { perfil } = useAuth()
  const esGerenteArea = perfil?.type === 'gerente_area'
  const tieneAgenda = esGerenteArea

  const [agenda, setAgenda] = useState([])
  const [cargando, setCargando] = useState(tieneAgenda)

  useEffect(() => {
    if (!tieneAgenda) return

    const hoy = hoyISO()
    setCargando(true)

    Promise.all([
      getTrabajosCampo({ fecha: hoy }).catch(() => ({ results: [] })),
      getCoberturas({ fecha: hoy }).catch(() => ({ results: [] })),
      getSolicitudesVacacion({}).catch(() => ({ results: [] })),
    ]).then(([trabajos, coberturas, vacaciones]) => {
      const deCampo = (trabajos.results ?? [])
        .filter((tc) => tc.estado === 'pendiente')
        .map((tc) => ({
          id: `campo-${tc.id_trabajo_campo}`,
          tipo: 'campo',
          idOriginal: tc.id_trabajo_campo,
          jornada: tc.jornada,
          titulo: `Trabajo de campo — ${tc.usuario?.nombre ?? ''}`,
          meta: [tc.jornada_label, tc.sucursal?.nombre, tc.motivo].filter(Boolean).join(' · '),
          pendiente: tc.estado === 'pendiente',
        }))

      const deCoberturas = (coberturas.results ?? [])
        .filter((c) => c.estado !== 'rechazado' && c.estado !== 'cancelado')
        .map((c) => ({
          id: `cobertura-${c.id_cobertura}`,
          tipo: 'cobertura',
          jornada: c.jornada,
          titulo: `Cobertura en ${c.sucursal_destino?.nombre ?? ''}`,
          meta: [c.jornada_label, c.usuario_reemplazo?.nombre, c.motivo].filter(Boolean).join(' · '),
          pendiente: c.estado === 'pendiente',
        }))

      const deVacaciones = (vacaciones.results ?? [])
        .filter((v) => v.estado === 'aceptado' && v.fecha_inicio <= hoy && hoy <= v.fecha_fin)
        .map((v) => ({
          id: `vacacion-${v.id_solicitud_vacacion}`,
          tipo: 'vacacion',
          jornada: 'manana',
          titulo: `Vacaciones — ${v.usuario?.nombre ?? ''}`,
          meta: `Hasta el ${v.fecha_fin}${v.motivo ? ` · ${v.motivo}` : ''}`,
          pendiente: false,
        }))

      setAgenda(
        [...deCampo, ...deCoberturas, ...deVacaciones].sort(
          (a, b) => (JORNADA_ORDEN[a.jornada] ?? 0) - (JORNADA_ORDEN[b.jornada] ?? 0)
        )
      )
    }).finally(() => setCargando(false))
  }, [tieneAgenda])

  function handleAgendaClick(item) {
    navigate('/solicitudes-pendientes', {
      state: { highlightId: item.tipo === 'campo' ? item.idOriginal : null },
    })
  }

  return (
    <div className="home-page">
      <div className="home-header">
        <h1>{saludoSegunHora()}, {perfil?.nombre || 'Usuario'}</h1>
        <p>{fechaDeHoy()}</p>
      </div>

      {tieneAgenda && (
        <div className="agenda">
          <h2 className="home-section-title">Agenda de hoy</h2>

          {cargando ? (
            <p className="agenda-empty">Cargando agenda...</p>
          ) : agenda.length === 0 ? (
            <p className="agenda-empty">No hay nada agendado para hoy.</p>
          ) : (
            <div className="agenda-list">
              {agenda.map((item) => (
                <button
                  type="button"
                  className="agenda-item"
                  key={item.id}
                  onClick={() => handleAgendaClick(item)}
                >
                  <div className={`agenda-item-icon agenda-item-icon-${item.tipo}`}>
                    {AGENDA_ICONS[item.tipo]}
                  </div>
                  <div className="agenda-item-body">
                    <span className="agenda-item-titulo">{item.titulo}</span>
                    {item.meta && <span className="agenda-item-meta">{item.meta}</span>}
                  </div>
                  {item.pendiente && <span className="agenda-item-badge">Pendiente</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default CalendarPage
