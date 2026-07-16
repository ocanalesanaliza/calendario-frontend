import { useState, useEffect, useCallback, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import {
  getTrabajosCampo,
  aceptarTrabajoCampo,
  rechazarTrabajoCampo,
} from '../services/trabajosCampoService'
import './SolicitudesPendientesPage.css'

export default function SolicitudesPendientesPage() {
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
    <div className="solicitudes-pendientes-page">
      <div className="page-header">
        <div>
          <h1>Solicitudes pendientes</h1>
          <p>Trabajo de campo que te han solicitado</p>
        </div>
      </div>

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
                    Solicitud de trabajo de campo
                    <span className="badge badge-yellow">Pendiente</span>
                  </p>
                  <p className="campo-solicitud-meta">
                    {tc.fecha} · {tc.jornada === 'manana' ? 'Mañana' : 'Tarde'}
                    {tc.motivo ? ` · ${tc.motivo}` : ''}
                  </p>
                  {tc.solicitado_por?.nombre && (
                    <p className="campo-solicitud-solicitante">
                      Solicitado por {tc.solicitado_por.nombre}
                    </p>
                  )}
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
    </div>
  )
}
