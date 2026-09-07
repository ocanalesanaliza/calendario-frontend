import { useState, useEffect } from 'react'
import { getMiAlmuerzo, activarAlmuerzo, cerrarAlmuerzo, getDashboardAlmuerzos } from '../services/almuerzosService'
import { useAuth } from '../../auth/context/AuthContext'
import './AlmuerzosPage.css'

const ESTADO_LABEL = {
  no_iniciado: 'Sin almuerzo',
  en_almuerzo: 'En almuerzo',
  finalizado:  'Finalizado',
}

const ESTADO_COLOR = {
  no_iniciado: 'badge-tipo',
  en_almuerzo: 'badge-yellow',
  finalizado:  'badge-green',
}

const CIERRE_LABEL = {
  usuario:    'Por usuario',
  supervisor: 'Por supervisor',
  automatico: 'Automático',
}

export default function AlmuerzosPage() {
  const { perfil } = useAuth()
  const isAreaManager = perfil?.type === 'gerente_area'
  const [activeTab, setActiveTab] = useState('personal')
  const [dashboardRefreshKey, setDashboardRefreshKey] = useState(0)

  if (!isAreaManager) {
    return (
      <div className="almuerzos-page">
        <MiAlmuerzo />
      </div>
    )
  }

  return (
    <div className="almuerzos-page">
      <div className="tab-bar" role="tablist" aria-label="Almuerzos">
        <button
          className={`tab-btn${activeTab === 'personal' ? ' active' : ''}`}
          role="tab"
          aria-selected={activeTab === 'personal'}
          onClick={() => setActiveTab('personal')}
        >
          Mi almuerzo
        </button>
        <button
          className={`tab-btn${activeTab === 'team' ? ' active' : ''}`}
          role="tab"
          aria-selected={activeTab === 'team'}
          onClick={() => setActiveTab('team')}
        >
          Equipo
        </button>
      </div>

      {activeTab === 'personal' ? (
        <MiAlmuerzo onUpdated={() => setDashboardRefreshKey((current) => current + 1)} />
      ) : (
        <DashboardAlmuerzos refreshKey={dashboardRefreshKey} />
      )}
    </div>
  )
}

function MiAlmuerzo({ onUpdated }) {
  const [almuerzo, setAlmuerzo] = useState(null)
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')

  useEffect(() => { loadAlmuerzo() }, [])

  async function loadAlmuerzo() {
    setLoading(true)
    try {
      const data = await getMiAlmuerzo()
      setAlmuerzo(data)
    } catch (requestError) {
      setAlmuerzo(null)
      setError(requestError.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleActivar() {
    setSaving(true)
    setError('')
    try {
      await activarAlmuerzo()
      await loadAlmuerzo()
      onUpdated?.()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleCerrar() {
    setSaving(true)
    setError('')
    try {
      await cerrarAlmuerzo()
      await loadAlmuerzo()
      onUpdated?.()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="loading-state">Cargando...</div>

  const estado = almuerzo?.estado ?? 'no_iniciado'

  return (
    <section className="almuerzo-personal">
      <div className="page-header">
        <div>
          <h1>Mi almuerzo</h1>
          <p>{almuerzo?.fecha ?? 'Hoy'}</p>
        </div>
      </div>

      <div className="almuerzo-card">
        <div className="almuerzo-estado-row">
          <span className={`badge badge-lg ${ESTADO_COLOR[estado]}`}>
            {ESTADO_LABEL[estado]}
          </span>
          {estado === 'en_almuerzo' && almuerzo?.minutos_transcurridos != null && (
            <span className="almuerzo-tiempo">
              {almuerzo.minutos_transcurridos} min transcurridos
              {almuerzo.minutos_restantes != null && ` · ${almuerzo.minutos_restantes} min restantes`}
            </span>
          )}
        </div>

        {estado !== 'no_iniciado' && (
          <div className="almuerzo-detalle">
            {almuerzo?.hora_inicio && (
              <div className="detalle-row">
                <span className="detalle-label">Inicio</span>
                <span className="detalle-val">{fmtHora(almuerzo.hora_inicio)}</span>
              </div>
            )}
            {almuerzo?.hora_fin && (
              <div className="detalle-row">
                <span className="detalle-label">Fin</span>
                <span className="detalle-val">{fmtHora(almuerzo.hora_fin)}</span>
              </div>
            )}
            {almuerzo?.tipo_cierre && (
              <div className="detalle-row">
                <span className="detalle-label">Tipo de cierre</span>
                <span className="detalle-val">{CIERRE_LABEL[almuerzo.tipo_cierre] ?? almuerzo.tipo_cierre}</span>
              </div>
            )}
            {almuerzo?.duracion_minutos != null && (
              <div className="detalle-row">
                <span className="detalle-label">Duración</span>
                <span className="detalle-val">{almuerzo.duracion_minutos} min</span>
              </div>
            )}
          </div>
        )}

        {error && <p className="almuerzo-error" role="alert">{error}</p>}

        <div className="almuerzo-acciones">
          {almuerzo?.puede_activar && (
            <button className="btn-almuerzo btn-iniciar" onClick={handleActivar} disabled={saving}>
              {saving ? 'Procesando...' : 'Iniciar almuerzo'}
            </button>
          )}
          {almuerzo?.puede_cerrar && (
            <button className="btn-almuerzo btn-cerrar" onClick={handleCerrar} disabled={saving}>
              {saving ? 'Procesando...' : 'Cerrar almuerzo'}
            </button>
          )}
        </div>
      </div>
    </section>
  )
}

function DashboardAlmuerzos({ refreshKey }) {
  const [registros, setRegistros] = useState([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')
  const [fecha, setFecha]         = useState('')

  useEffect(() => { loadDashboard() }, [filtroEstado, fecha, refreshKey])

  async function loadDashboard() {
    setLoading(true)
    setError('')
    try {
      const params = {}
      if (filtroEstado) params.estado = filtroEstado
      if (fecha)        params.fecha  = fecha
      const data = await getDashboardAlmuerzos(params)
      setRegistros(data.results ?? [])
    } catch (requestError) {
      setRegistros([])
      setError(requestError.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="almuerzo-dashboard">
      <div className="page-header">
        <div>
          <p>Estado de almuerzos del equipo</p>
        </div>
      </div>

      <div className="toolbar">
        <input
          type="date"
          className="fecha-picker"
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
        />
        <select className="filtro-select" value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}>
          <option value="">Todos los estados</option>
          <option value="no_iniciado">Sin almuerzo</option>
          <option value="en_almuerzo">En almuerzo</option>
          <option value="finalizado">Finalizado</option>
        </select>
      </div>

      {error ? (
        <p className="almuerzo-error" role="alert">{error}</p>
      ) : loading ? (
        <div className="loading-state">Cargando...</div>
      ) : registros.length === 0 ? (
        <div className="empty-state">Sin registros para los filtros aplicados.</div>
      ) : (
        <div className="table-card">
          <table className="almuerzos-table">
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Sucursal actual</th>
                <th>Fecha</th>
                <th>Estado</th>
                <th>Inicio</th>
                <th>Fin</th>
                <th>Duración</th>
              </tr>
            </thead>
            <tbody>
              {registros.map((r) => (
                <tr key={r.id_almuerzo ?? r.usuario?.id_usuario}>
                  <td className="td-nombre">{r.usuario?.nombre ?? '—'}</td>
                  <td>{r.sucursal_actual?.nombre ?? r.sucursal?.nombre ?? '—'}</td>
                  <td>{r.fecha}</td>
                  <td>
                    <span className={`badge ${ESTADO_COLOR[r.estado] ?? 'badge-tipo'}`}>
                      {ESTADO_LABEL[r.estado] ?? r.estado}
                    </span>
                  </td>
                  <td>{r.hora_inicio ? fmtHora(r.hora_inicio) : '—'}</td>
                  <td>{r.hora_fin    ? fmtHora(r.hora_fin)    : '—'}</td>
                  <td>{r.duracion_minutos != null ? `${r.duracion_minutos} min` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function fmtHora(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleTimeString('es-HN', { hour: '2-digit', minute: '2-digit' })
  } catch { return iso }
}
