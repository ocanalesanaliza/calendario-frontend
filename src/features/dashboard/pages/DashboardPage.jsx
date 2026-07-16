import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../auth/context/AuthContext'
import { getDashboardOperativo } from '../services/dashboardService'
import { getGerentes } from '../../gerentes/services/gerentesService'
import { getUsuarios } from '../../usuarios/services/usuariosService'
import {
  createTrabajoCampo,
  cancelarTrabajoCampo,
  getTrabajosCampo,
} from '../../trabajosCampo/services/trabajosCampoService'
import './DashboardPage.css'

const ESTADO_CAMPO_BADGE = {
  pendiente: 'badge-yellow',
  aceptado:  'badge-green',
  rechazado: 'badge-red',
  cancelado: 'badge-tipo',
}

const PRESENCIA_BADGE = {
  activo:      { cls: 'badge-green',  label: 'Activo' },
  en_almuerzo: { cls: 'badge-yellow', label: 'En almuerzo' },
}

const LABEL_COLOR = {
  'Jornada manana':      'estado-manana',
  'Jornada mañana':      'estado-manana',
  'Jornada tarde':       'estado-tarde',
  'Cambio de jornada':   'estado-cambio',
  'Cambio jornada':      'estado-cambio',
  'Antes de apertura':   'estado-antes',
  'Antes apertura':      'estado-antes',
  'Cerrado':             'estado-cerrado',
  'Sucursal cerrada hoy':'estado-cerrado',
  'Sucursal cerrada':    'estado-cerrado',
  'Sin sucursal':        'estado-sin',
}

const META_VACIA = { requiere_filtro: false, mensaje: '', resumen_areas: [] }

export default function DashboardPage() {
  const { perfil } = useAuth()
  const esAdmin = perfil?.es_admin_maestro === true

  const [results, setResults]       = useState([])
  const [count, setCount]           = useState(0)
  const [meta, setMeta]             = useState(META_VACIA)
  const [loading, setLoading]       = useState(true)
  const [fecha, setFecha]           = useState('')
  const [buscar, setBuscar]         = useState('')
  const [filtroOp, setFiltroOp]     = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')
  const [idGerenteArea, setIdGerenteArea] = useState('')
  const [verTodos, setVerTodos]     = useState(false)
  const [gerentes, setGerentes]     = useState([])
  const [modalCampo, setModalCampo] = useState(null)
  const [tab, setTab]               = useState('operativo')

  useEffect(() => {
    if (esAdmin) getGerentes().then(setGerentes).catch(() => {})
  }, [esAdmin])

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const params = {}
      if (fecha)        params.fecha            = fecha
      if (buscar)       params.buscar           = buscar
      if (filtroOp)     params.estado_operativo = filtroOp
      if (filtroEstado) params.estado           = filtroEstado
      if (esAdmin) {
        if (verTodos) params.todos = 'true'
        else if (idGerenteArea) params.id_gerente_area = idGerenteArea
      }
      const data = await getDashboardOperativo(params)
      setResults(data.results ?? [])
      setCount(data.count ?? 0)
      setMeta(data.meta ?? META_VACIA)
    } finally {
      setLoading(false)
    }
  }, [fecha, buscar, filtroOp, filtroEstado, esAdmin, idGerenteArea, verTodos])

  useEffect(() => { loadData() }, [loadData])

  async function handleCancelarCampo(idTrabajoCampo) {
    try {
      await cancelarTrabajoCampo(idTrabajoCampo)
      await loadData()
    } catch (err) {
      alert(err.message)
    }
  }

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

      <div className="tab-bar">
        <button
          className={`tab-btn${tab === 'operativo' ? ' active' : ''}`}
          onClick={() => setTab('operativo')}
        >
          Vista operativa
        </button>
        <button
          className={`tab-btn${tab === 'campo' ? ' active' : ''}`}
          onClick={() => setTab('campo')}
        >
          Tareas de campo
        </button>
      </div>

      {tab === 'campo' ? (
        <TareasCampoTab perfil={perfil} />
      ) : (
        <>
      <div className="toolbar">
        <div className="search-wrapper">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="text"
            placeholder="Buscar por nombre, email, sucursal o área..."
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
        {esAdmin && (
          <>
            <select
              className="filtro-select"
              value={idGerenteArea}
              disabled={verTodos}
              onChange={(e) => setIdGerenteArea(e.target.value)}
            >
              <option value="">Selecciona un área...</option>
              {gerentes.map((g) => (
                <option key={g.id_gerente_area} value={g.id_gerente_area}>{g.nombre}</option>
              ))}
            </select>
            <label className="filtro-check">
              <input type="checkbox" checked={verTodos} onChange={(e) => setVerTodos(e.target.checked)} />
              Ver todos
            </label>
          </>
        )}
      </div>

      {meta.resumen_areas.length > 0 && (
        <div className="resumen-areas-row">
          {meta.resumen_areas.map((r) => (
            <div key={r.gerente_area.id_gerente_area} className="resumen-area-card">
              <span className="resumen-area-nombre">{r.gerente_area.nombre}</span>
              <span className="resumen-area-pct">{parseFloat(r.rendimiento_mes).toFixed(0)}%</span>
              <span className="resumen-area-usuarios">{r.usuarios_count} usuario{r.usuarios_count !== 1 ? 's' : ''}</span>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div className="loading-state">
          <div className="loading-bar">
            <div className="loading-bar-fill" />
          </div>
          <span>Cargando dashboard...</span>
        </div>
      ) : meta.requiere_filtro ? (
        <div className="empty-state">{meta.mensaje || 'Selecciona un filtro para ver el dashboard.'}</div>
      ) : results.length === 0 ? (
        <div className="empty-state">Sin resultados para los filtros aplicados.</div>
      ) : (
        <div className="dashboard-grid">
          {results.map((u, i) => (
            <UserCard
              key={i}
              user={u}
              esAdmin={esAdmin}
              fechaDashboard={fecha}
              onCrearCampo={(idUsuario) => setModalCampo({ idUsuario, nombreUsuario: u.nombre_usuario })}
              onCancelarCampo={handleCancelarCampo}
            />
          ))}
        </div>
      )}

      {modalCampo && (
        <TrabajoCampoModal
          idUsuario={modalCampo.idUsuario}
          nombreUsuario={modalCampo.nombreUsuario}
          fechaDashboard={fecha}
          onClose={() => setModalCampo(null)}
          onSuccess={() => { setModalCampo(null); loadData() }}
        />
      )}
        </>
      )}
    </div>
  )
}

function UserCard({ user, esAdmin, fechaDashboard, onCrearCampo, onCancelarCampo }) {
  const presencia    = PRESENCIA_BADGE[user.estado]
  const score        = parseFloat(user.rendimiento_hoy ?? 0)
  const colorClass   = LABEL_COLOR[user.estado_operativo_label] ?? 'estado-sin'
  const campo        = user.trabajo_campo
  const resultadoDia = user.resultado_dia
  const tareasCumplidas   = resultadoDia?.tareas_cumplidas ?? null
  const tareasProgramadas = resultadoDia?.tareas_programadas ?? null

  return (
    <div className={`user-card ${colorClass}`}>
      <div className="user-card-top">
        <div className="user-card-avatar">
          {user.nombre_usuario?.charAt(0).toUpperCase() ?? '?'}
        </div>
        <div className="user-card-info">
          <p className="user-card-nombre">{user.nombre_usuario}</p>
          <p className="user-card-sucursal">
            {user.sucursal ?? '—'}
            {esAdmin && user.gerente_area && ` · ${user.gerente_area.nombre}`}
          </p>
        </div>
        {presencia && (
          <span className={`badge ${presencia.cls}`}>{presencia.label}</span>
        )}
      </div>

      {campo && (
        <div className={`campo-banner${campo.estado === 'aceptado' ? ' campo-banner-aceptado' : ''}`}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
            <polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
          <span>
            Trabajo de campo {campo.estado === 'aceptado' ? '(autorizado)' : '(pendiente)'} — {campo.jornada === 'manana' ? 'Mañana' : 'Tarde'}
            {campo.motivo ? ` · ${campo.motivo}` : ''}
          </span>
          {campo.estado === 'pendiente' && (
            <button
              className="campo-cancel-btn"
              title="Cancelar solicitud"
              onClick={() => onCancelarCampo(campo.id_trabajo_campo)}
            >
              ✕
            </button>
          )}
        </div>
      )}

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
          {tareasProgramadas !== null && tareasProgramadas > 0 && (
            <span className="score-tareas">{tareasCumplidas}/{tareasProgramadas}</span>
          )}
        </div>
        {!campo && user.sucursal && (
          <button
            className="btn-campo"
            onClick={() => onCrearCampo(user.id_usuario ?? user.usuario_id)}
          >
            Trabajo de campo
          </button>
        )}
      </div>
    </div>
  )
}

function TrabajoCampoModal({ idUsuario, nombreUsuario, fechaDashboard, usuarios, onClose, onSuccess }) {
  const hoy = new Date().toISOString().slice(0, 10)
  const [form, setForm] = useState({
    idUsuario: idUsuario || '',
    fecha:     fechaDashboard || hoy,
    jornada:   'manana',
    motivo:    '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await createTrabajoCampo({
        id_usuario: idUsuario || form.idUsuario,
        fecha:      form.fecha,
        jornada:    form.jornada,
        motivo:     form.motivo || undefined,
      })
      onSuccess()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{nombreUsuario ? `Trabajo de campo — ${nombreUsuario}` : 'Nueva solicitud de trabajo de campo'}</h2>
          <button className="modal-close" onClick={onClose}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <form className="modal-form" onSubmit={handleSubmit}>
          {!idUsuario && (
            <div className="form-group">
              <label>Empleado</label>
              <select value={form.idUsuario} onChange={set('idUsuario')} required>
                <option value="">Selecciona un empleado...</option>
                {(usuarios ?? []).map((u) => (
                  <option key={u.id_usuario} value={u.id_usuario}>{u.nombre}</option>
                ))}
              </select>
            </div>
          )}
          <div className="form-group">
            <label>Fecha</label>
            <input type="date" value={form.fecha} onChange={set('fecha')} required />
          </div>
          <div className="form-group">
            <label>Jornada</label>
            <select value={form.jornada} onChange={set('jornada')} required>
              <option value="manana">Mañana</option>
              <option value="tarde">Tarde</option>
            </select>
          </div>
          <div className="form-group">
            <label>Motivo <span className="label-optional">(opc.)</span></label>
            <input type="text" value={form.motivo} onChange={set('motivo')} placeholder="ej. Visita externa aprobada" />
          </div>
          {error && <p className="modal-error">{error}</p>}
          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Enviando...' : 'Solicitar trabajo de campo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function TareasCampoTab({ perfil }) {
  const [enviadas, setEnviadas]   = useState([])
  const [usuarios, setUsuarios]   = useState([])
  const [loading, setLoading]     = useState(true)
  const [modalOpen, setModalOpen] = useState(false)

  useEffect(() => {
    getUsuarios().then(setUsuarios).catch(() => {})
  }, [])

  const loadEnviadas = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getTrabajosCampo({})
      const propias = (data.results ?? []).filter(
        (t) => t.solicitado_por?.id_usuario === perfil?.id
      )
      setEnviadas(propias)
    } finally {
      setLoading(false)
    }
  }, [perfil])

  useEffect(() => { loadEnviadas() }, [loadEnviadas])

  async function handleCancelar(id) {
    try {
      await cancelarTrabajoCampo(id)
      await loadEnviadas()
    } catch (err) {
      alert(err.message)
    }
  }

  return (
    <div className="tareas-campo-tab">
      <div className="tareas-campo-header">
        <p>{enviadas.length} solicitud{enviadas.length !== 1 ? 'es' : ''} enviada{enviadas.length !== 1 ? 's' : ''}</p>
        <button className="btn-primary" onClick={() => setModalOpen(true)}>Nueva solicitud</button>
      </div>

      {loading ? (
        <div className="loading-state">
          <div className="loading-bar">
            <div className="loading-bar-fill" />
          </div>
          <span>Cargando...</span>
        </div>
      ) : enviadas.length === 0 ? (
        <div className="empty-state">No has enviado solicitudes de trabajo de campo.</div>
      ) : (
        <div className="campo-enviadas-list">
          {enviadas.map((t) => (
            <div key={t.id_trabajo_campo} className="campo-enviada-row">
              <div className="campo-enviada-info">
                <p className="campo-enviada-nombre">{t.usuario?.nombre}</p>
                <p className="campo-enviada-meta">
                  {t.fecha} · {t.jornada === 'manana' ? 'Mañana' : 'Tarde'}
                  {t.motivo ? ` · ${t.motivo}` : ''}
                </p>
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

      {modalOpen && (
        <TrabajoCampoModal
          usuarios={usuarios}
          onClose={() => setModalOpen(false)}
          onSuccess={() => { setModalOpen(false); loadEnviadas() }}
        />
      )}
    </div>
  )
}
