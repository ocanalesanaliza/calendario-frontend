import { useState, useEffect, useCallback } from 'react'
import { getDashboardOperativo } from '../services/dashboardService'
import './DashboardPage.css'

const PRESENCIA_BADGE = {
  activo:      { cls: 'badge-green',  label: 'Activo' },
  en_almuerzo: { cls: 'badge-yellow', label: 'En almuerzo' },
}

const LABEL_COLOR = {
  'Jornada mañana':   'estado-manana',
  'Jornada tarde':    'estado-tarde',
  'Cambio jornada':   'estado-cambio',
  'Antes apertura':   'estado-antes',
  'Cerrado':          'estado-cerrado',
  'Sucursal cerrada': 'estado-cerrado',
  'Sin sucursal':     'estado-sin',
}

export default function DashboardPage() {
  const [results, setResults]       = useState([])
  const [count, setCount]           = useState(0)
  const [loading, setLoading]       = useState(true)
  const [fecha, setFecha]           = useState('')
  const [buscar, setBuscar]         = useState('')
  const [filtroOp, setFiltroOp]     = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const params = {}
      if (fecha)       params.fecha             = fecha
      if (buscar)      params.buscar            = buscar
      if (filtroOp)    params.estado_operativo  = filtroOp
      if (filtroEstado) params.estado           = filtroEstado
      const data = await getDashboardOperativo(params)
      setResults(data.results ?? [])
      setCount(data.count ?? 0)
    } finally {
      setLoading(false)
    }
  }, [fecha, buscar, filtroOp, filtroEstado])

  useEffect(() => { loadData() }, [loadData])

  return (
    <div className="dashboard-page">
      <div className="page-header">
        <div>
          <h1>Dashboard operativo</h1>
          <p>{count} gerente{count !== 1 ? 's' : ''} en el sistema</p>
        </div>
        <button className="btn-refresh" onClick={loadData} title="Actualizar">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10"/>
            <polyline points="1 20 1 14 7 14"/>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
          </svg>
          Actualizar
        </button>
      </div>

      <div className="toolbar">
        <div className="search-wrapper">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="text"
            placeholder="Buscar por nombre o sucursal..."
            value={buscar}
            onChange={(e) => setBuscar(e.target.value)}
          />
        </div>
        <input
          type="date"
          className="fecha-picker"
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
        />
        <select className="filtro-select" value={filtroOp} onChange={(e) => setFiltroOp(e.target.value)}>
          <option value="">Todos los estados</option>
          <option value="manana">Jornada mañana</option>
          <option value="tarde">Jornada tarde</option>
          <option value="cambio_jornada">Cambio jornada</option>
          <option value="antes_apertura">Antes apertura</option>
          <option value="cerrado">Cerrado</option>
          <option value="sucursal_cerrada">Sucursal cerrada</option>
          <option value="sin_sucursal">Sin sucursal</option>
        </select>
        <select className="filtro-select" value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}>
          <option value="">Toda presencia</option>
          <option value="activo">Activo</option>
          <option value="en_almuerzo">En almuerzo</option>
        </select>
      </div>

      {loading ? (
        <div className="loading-state">Cargando dashboard...</div>
      ) : results.length === 0 ? (
        <div className="empty-state">Sin resultados para los filtros aplicados.</div>
      ) : (
        <div className="dashboard-grid">
          {results.map((u, i) => (
            <UserCard key={i} user={u} />
          ))}
        </div>
      )}
    </div>
  )
}

function UserCard({ user }) {
  const presencia  = PRESENCIA_BADGE[user.estado]
  const score      = parseFloat(user.rendimiento_hoy ?? 0)
  const colorClass = LABEL_COLOR[user.estado_operativo_label] ?? 'estado-sin'

  return (
    <div className={`user-card ${colorClass}`}>
      <div className="user-card-top">
        <div className="user-card-avatar">
          {user.nombre_usuario?.charAt(0).toUpperCase() ?? '?'}
        </div>
        <div className="user-card-info">
          <p className="user-card-nombre">{user.nombre_usuario}</p>
          <p className="user-card-sucursal">{user.sucursal ?? '—'}</p>
        </div>
        {presencia && (
          <span className={`badge ${presencia.cls}`}>{presencia.label}</span>
        )}
      </div>

      <div className="user-card-bottom">
        <div className="estado-op-label">
          <span className={`dot dot-${colorClass}`} />
          {user.estado_operativo_label ?? '—'}
        </div>
        <div className="score-wrap">
          <div className="score-bar-bg">
            <div
              className={`score-bar-fill ${score >= 80 ? 'score-high' : score >= 50 ? 'score-mid' : 'score-low'}`}
              style={{ width: `${Math.min(score, 100)}%` }}
            />
          </div>
          <span className="score-pct">{score.toFixed(0)}%</span>
        </div>
      </div>
    </div>
  )
}
