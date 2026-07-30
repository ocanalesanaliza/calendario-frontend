import { useState, useEffect, useCallback, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../../auth/context/AuthContext'
import {
  getTrabajosCampo,
  aceptarTrabajoCampo,
  rechazarTrabajoCampo,
  cancelarTrabajoCampo,
} from '../services/trabajosCampoService'
import { getCoberturas, aceptarCobertura, rechazarCobertura } from '../../coberturas/services/coberturasService'
import {
  getSolicitudesVacacion,
  aceptarSolicitudVacacion,
  rechazarSolicitudVacacion,
  cancelarSolicitudVacacion,
} from '../../vacacionesProgramadas/services/vacacionesProgramadasService'
import TrabajoCampoModal from '../components/TrabajoCampoModal'
import VacacionModal from '../../vacacionesProgramadas/components/VacacionModal'
import './SolicitudesPendientesPage.css'

const ESTADO_CAMPO_BADGE = {
  pendiente: 'badge-yellow',
  aceptado:  'badge-green',
  rechazado: 'badge-red',
  cancelado: 'badge-tipo',
}

export default function SolicitudesPendientesPage() {
  const { perfil } = useAuth()
  const esGerenteArea = perfil?.type === 'gerente_area'

  return esGerenteArea ? <VistaGerenteArea /> : <VistaGerenteSucursal />
}

/* ── Vista gerente de área: acepta/rechaza trabajo de campo ── */
function VistaGerenteArea() {
  const [tab, setTab] = useState('pendientes')

  return (
    <div className="solicitudes-pendientes-page">
      <div className="page-header">
        <div>
          <h1>Solicitudes pendientes</h1>
          <p>Trabajo de campo y vacaciones programadas que te han solicitado</p>
        </div>
      </div>

      <div className="tab-bar">
        <button
          className={`tab-btn${tab === 'pendientes' ? ' active' : ''}`}
          onClick={() => setTab('pendientes')}
        >
          Pendientes
        </button>
        <button
          className={`tab-btn${tab === 'historial' ? ' active' : ''}`}
          onClick={() => setTab('historial')}
        >
          Historial de solicitudes
        </button>
      </div>

      {tab === 'pendientes' ? (
        <>
          <div className="solicitudes-section">
            <div className="solicitudes-section-header">
              <h2>Trabajo de campo pendiente</h2>
            </div>
            <PendientesTrabajoCampo />
          </div>
          <div className="solicitudes-section">
            <div className="solicitudes-section-header">
              <h2>Vacaciones programadas pendientes</h2>
            </div>
            <PendientesVacaciones />
          </div>
        </>
      ) : (
        <HistorialSolicitudes />
      )}
    </div>
  )
}

function PendientesTrabajoCampo() {
  const location = useLocation()
  const highlightId = location.state?.highlightId ?? null

  const [solicitudes, setSolicitudes] = useState([])
  const [loading, setLoading]         = useState(true)
  const [action, setAction]           = useState(null)
  const highlightRef = useRef(null)

  const loadSolicitudes = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getTrabajosCampo({ estado: 'pendiente' })
      setSolicitudes(res.results ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadSolicitudes() }, [loadSolicitudes])

  useEffect(() => {
    if (highlightId && highlightRef.current) {
      highlightRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [highlightId, solicitudes])

  async function handleAceptar(id) {
    setAction(id)
    try {
      await aceptarTrabajoCampo(id)
      await loadSolicitudes()
    } catch (err) {
      alert(err.message)
    } finally {
      setAction(null)
    }
  }

  async function handleRechazar(id) {
    setAction(id)
    try {
      await rechazarTrabajoCampo(id)
      await loadSolicitudes()
    } catch (err) {
      alert(err.message)
    } finally {
      setAction(null)
    }
  }

  return (
    <>
      {loading ? (
        <div className="loading-state">
          <div className="loading-bar">
            <div className="loading-bar-fill" />
          </div>
          <span>Cargando...</span>
        </div>
      ) : solicitudes.length === 0 ? (
        <div className="empty-state">No tienes solicitudes pendientes.</div>
      ) : (
        <div className="campo-solicitudes">
          {solicitudes.map((tc) => (
            <div
              key={tc.id_trabajo_campo}
              ref={tc.id_trabajo_campo === highlightId ? highlightRef : null}
              className={`campo-solicitud-card${tc.id_trabajo_campo === highlightId ? ' campo-solicitud-highlight' : ''}`}
            >
              <div className="campo-solicitud-info">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                  <polyline points="9 22 9 12 15 12 15 22"/>
                </svg>
                <div>
                  <p className="campo-solicitud-titulo">
                    Solicitud de trabajo de campo — {tc.usuario?.nombre}
                    <span className="badge badge-yellow">Pendiente</span>
                  </p>
                  <p className="campo-solicitud-meta">
                    {tc.fecha} · {tc.jornada === 'manana' ? 'Mañana' : 'Tarde'}
                    {tc.motivo ? ` · ${tc.motivo}` : ''}
                  </p>
                </div>
              </div>
              <div className="campo-solicitud-actions">
                <button
                  className="btn-rechazar"
                  disabled={action === tc.id_trabajo_campo}
                  onClick={() => handleRechazar(tc.id_trabajo_campo)}
                >
                  Rechazar
                </button>
                <button
                  className="btn-aceptar"
                  disabled={action === tc.id_trabajo_campo}
                  onClick={() => handleAceptar(tc.id_trabajo_campo)}
                >
                  Aceptar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}

function PendientesVacaciones() {
  const [solicitudes, setSolicitudes] = useState([])
  const [loading, setLoading]         = useState(true)
  const [action, setAction]           = useState(null)

  const loadSolicitudes = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getSolicitudesVacacion({ estado: 'pendiente' })
      setSolicitudes(res.results ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadSolicitudes() }, [loadSolicitudes])

  async function handleAceptar(id) {
    setAction(id)
    try {
      await aceptarSolicitudVacacion(id)
      await loadSolicitudes()
    } catch (err) {
      alert(err.message)
    } finally {
      setAction(null)
    }
  }

  async function handleRechazar(id) {
    setAction(id)
    try {
      await rechazarSolicitudVacacion(id)
      await loadSolicitudes()
    } catch (err) {
      alert(err.message)
    } finally {
      setAction(null)
    }
  }

  return (
    <>
      {loading ? (
        <div className="loading-state">
          <div className="loading-bar">
            <div className="loading-bar-fill" />
          </div>
          <span>Cargando...</span>
        </div>
      ) : solicitudes.length === 0 ? (
        <div className="empty-state">No tienes solicitudes de vacaciones pendientes.</div>
      ) : (
        <div className="campo-solicitudes">
          {solicitudes.map((sv) => (
            <div key={sv.id_solicitud_vacacion} className="campo-solicitud-card">
              <div className="campo-solicitud-info">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                  <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
                <div>
                  <p className="campo-solicitud-titulo">
                    Vacaciones programadas — {sv.usuario?.nombre}
                    <span className="badge badge-yellow">Pendiente</span>
                  </p>
                  <p className="campo-solicitud-meta">
                    {sv.fecha_inicio}{sv.fecha_fin !== sv.fecha_inicio ? ` al ${sv.fecha_fin}` : ''}
                    {sv.motivo ? ` · ${sv.motivo}` : ''}
                  </p>
                </div>
              </div>
              <div className="campo-solicitud-actions">
                <button
                  className="btn-rechazar"
                  disabled={action === sv.id_solicitud_vacacion}
                  onClick={() => handleRechazar(sv.id_solicitud_vacacion)}
                >
                  Rechazar
                </button>
                <button
                  className="btn-aceptar"
                  disabled={action === sv.id_solicitud_vacacion}
                  onClick={() => handleAceptar(sv.id_solicitud_vacacion)}
                >
                  Aceptar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}

const PAGE_SIZE_HISTORIAL = 10

function HistorialSolicitudes() {
  const [busqueda, setBusqueda] = useState('')
  const [page, setPage]         = useState(1)
  const [data, setData]         = useState({ results: [], count: 0, total_pages: 0 })
  const [loading, setLoading]   = useState(true)

  useEffect(() => { setPage(1) }, [busqueda])

  const loadHistorial = useCallback(async () => {
    setLoading(true)
    try {
      const params = { page, page_size: PAGE_SIZE_HISTORIAL }
      if (busqueda.trim()) params.buscar = busqueda.trim()
      const res = await getTrabajosCampo(params)
      setData({
        results: res.results ?? [],
        count: res.count ?? 0,
        total_pages: res.total_pages ?? 0,
      })
    } finally {
      setLoading(false)
    }
  }, [busqueda, page])

  useEffect(() => { loadHistorial() }, [loadHistorial])

  return (
    <>
      <div className="toolbar">
        <div className="search-wrapper">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="text"
            placeholder="Buscar por nombre, email o motivo..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="loading-state">
          <div className="loading-bar">
            <div className="loading-bar-fill" />
          </div>
          <span>Cargando...</span>
        </div>
      ) : data.results.length === 0 ? (
        <div className="empty-state">No hay solicitudes en el historial.</div>
      ) : (
        <div className="campo-enviadas-list">
          {data.results.map((tc) => (
            <div key={tc.id_trabajo_campo} className="campo-enviada-row">
              <div className="campo-enviada-info">
                <p className="campo-enviada-nombre">{tc.usuario?.nombre}</p>
                <p className="campo-enviada-meta">
                  {tc.fecha} · {tc.jornada === 'manana' ? 'Mañana' : 'Tarde'}
                  {tc.motivo ? ` · ${tc.motivo}` : ''}
                </p>
              </div>
              <span className={`badge ${ESTADO_CAMPO_BADGE[tc.estado] ?? 'badge-tipo'}`}>
                {tc.estado_label}
              </span>
            </div>
          ))}
        </div>
      )}

      {data.total_pages > 1 && (
        <div className="paginacion">
          <button
            className="btn-secondary"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Anterior
          </button>
          <span className="paginacion-info">Página {page} de {data.total_pages}</span>
          <button
            className="btn-secondary"
            disabled={page >= data.total_pages}
            onClick={() => setPage((p) => p + 1)}
          >
            Siguiente
          </button>
        </div>
      )}
    </>
  )
}

/* ── Vista gerente de sucursal: solicita trabajo de campo + acepta/rechaza coberturas ── */
function VistaGerenteSucursal() {
  const { perfil } = useAuth()
  const [enviadas, setEnviadas]       = useState([])
  const [vacacionesEnviadas, setVacacionesEnviadas] = useState([])
  const [coberturas, setCoberturas]   = useState([])
  const [loading, setLoading]         = useState(true)
  const [action, setAction]           = useState(null)
  const [modalOpen, setModalOpen]     = useState(false)
  const [vacacionModalOpen, setVacacionModalOpen] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [trabajos, coberturasRes, vacaciones] = await Promise.all([
        getTrabajosCampo({}),
        getCoberturas({ estado: 'pendiente' }),
        getSolicitudesVacacion({}),
      ])
      const propias = (trabajos.results ?? []).filter(
        (t) => t.solicitado_por?.id_usuario === perfil?.id
      )
      const vacacionesPropias = (vacaciones.results ?? []).filter(
        (v) => v.solicitado_por?.id_usuario === perfil?.id
      )
      setEnviadas(propias)
      setVacacionesEnviadas(vacacionesPropias)
      setCoberturas(coberturasRes.results ?? [])
    } finally {
      setLoading(false)
    }
  }, [perfil])

  useEffect(() => { loadData() }, [loadData])

  async function handleCancelar(id) {
    try {
      await cancelarTrabajoCampo(id)
      await loadData()
    } catch (err) {
      alert(err.message)
    }
  }

  async function handleCancelarVacacion(id) {
    try {
      await cancelarSolicitudVacacion(id)
      await loadData()
    } catch (err) {
      alert(err.message)
    }
  }

  async function handleAceptarCobertura(id) {
    setAction(id)
    try {
      await aceptarCobertura(id)
      await loadData()
    } catch (err) {
      alert(err.message)
    } finally {
      setAction(null)
    }
  }

  async function handleRechazarCobertura(id) {
    setAction(id)
    try {
      await rechazarCobertura(id)
      await loadData()
    } catch (err) {
      alert(err.message)
    } finally {
      setAction(null)
    }
  }

  return (
    <div className="solicitudes-pendientes-page">
      <div className="page-header">
        <div>
          <h1>Solicitudes pendientes</h1>
          <p>Tu trabajo de campo y coberturas temporales</p>
        </div>
      </div>

      {loading ? (
        <div className="loading-state">
          <div className="loading-bar">
            <div className="loading-bar-fill" />
          </div>
          <span>Cargando...</span>
        </div>
      ) : (
        <>
          <div className="solicitudes-section">
            <div className="solicitudes-section-header">
              <h2>Coberturas pendientes de aceptar</h2>
            </div>
            {coberturas.length === 0 ? (
              <div className="empty-state">No tienes coberturas pendientes.</div>
            ) : (
              <div className="campo-solicitudes">
                {coberturas.map((c) => (
                  <div key={c.id_cobertura} className="campo-solicitud-card">
                    <div className="campo-solicitud-info">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
                        <polyline points="16 18 22 12 16 6"/>
                        <polyline points="8 6 2 12 8 18"/>
                      </svg>
                      <div>
                        <p className="campo-solicitud-titulo">
                          Cobertura en {c.sucursal_destino?.nombre}
                          <span className="badge badge-yellow">Pendiente</span>
                        </p>
                        <p className="campo-solicitud-meta">
                          {c.fecha} · {c.jornada_label}
                          {c.motivo ? ` · ${c.motivo}` : ''}
                        </p>
                      </div>
                    </div>
                    <div className="campo-solicitud-actions">
                      <button
                        className="btn-rechazar"
                        disabled={action === c.id_cobertura}
                        onClick={() => handleRechazarCobertura(c.id_cobertura)}
                      >
                        Rechazar
                      </button>
                      <button
                        className="btn-aceptar"
                        disabled={action === c.id_cobertura}
                        onClick={() => handleAceptarCobertura(c.id_cobertura)}
                      >
                        Aceptar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="solicitudes-section">
            <div className="solicitudes-section-header">
              <h2>Mis solicitudes de trabajo de campo</h2>
              <button className="btn-primary" onClick={() => setModalOpen(true)}>Nueva solicitud</button>
            </div>
            {enviadas.length === 0 ? (
              <div className="empty-state">No has enviado solicitudes de trabajo de campo.</div>
            ) : (
              <div className="campo-enviadas-list">
                {enviadas.map((t) => (
                  <div key={t.id_trabajo_campo} className="campo-enviada-row">
                    <div className="campo-enviada-info">
                      <p className="campo-enviada-nombre">{t.fecha} · {t.jornada === 'manana' ? 'Mañana' : 'Tarde'}</p>
                      <p className="campo-enviada-meta">{t.motivo || 'Sin motivo indicado'}</p>
                    </div>
                    <span className={`badge ${ESTADO_CAMPO_BADGE[t.estado] ?? 'badge-tipo'}`}>
                      {t.estado_label}
                    </span>
                    {t.estado === 'pendiente' && (
                      <button
                        className="campo-cancel-btn"
                        title="Cancelar solicitud"
                        onClick={() => handleCancelar(t.id_trabajo_campo)}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="solicitudes-section">
            <div className="solicitudes-section-header">
              <h2>Vacaciones programadas</h2>
              <button className="btn-primary" onClick={() => setVacacionModalOpen(true)}>Nueva solicitud</button>
            </div>
            {vacacionesEnviadas.length === 0 ? (
              <div className="empty-state">No has enviado solicitudes de vacaciones programadas.</div>
            ) : (
              <div className="campo-enviadas-list">
                {vacacionesEnviadas.map((v) => (
                  <div key={v.id_solicitud_vacacion} className="campo-enviada-row">
                    <div className="campo-enviada-info">
                      <p className="campo-enviada-nombre">
                        {v.fecha_inicio}{v.fecha_fin !== v.fecha_inicio ? ` al ${v.fecha_fin}` : ''}
                      </p>
                      <p className="campo-enviada-meta">{v.motivo || 'Sin motivo indicado'}</p>
                    </div>
                    <span className={`badge ${ESTADO_CAMPO_BADGE[v.estado] ?? 'badge-tipo'}`}>
                      {v.estado_label}
                    </span>
                    {v.estado === 'pendiente' && (
                      <button
                        className="campo-cancel-btn"
                        title="Cancelar solicitud"
                        onClick={() => handleCancelarVacacion(v.id_solicitud_vacacion)}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {vacacionModalOpen && (
        <VacacionModal
          onClose={() => setVacacionModalOpen(false)}
          onSuccess={() => { setVacacionModalOpen(false); loadData() }}
        />
      )}

      {modalOpen && (
        <TrabajoCampoModal
          onClose={() => setModalOpen(false)}
          onSuccess={() => { setModalOpen(false); loadData() }}
        />
      )}
    </div>
  )
}
