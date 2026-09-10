import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  getRendimientoDiario,
  getRendimientoMensual,
  reabrirRendimientoDiario,
  cerrarRendimientoDiario,
} from '../services/rendimientoService'
import { getUsuarios } from '../../usuarios/services/usuariosService'
import { useAuth } from '../../auth/context/AuthContext'
import './RendimientoPage.css'

const hoy = () => new Date().toISOString().slice(0, 10)
const mesActual = () => {
  const d = new Date()
  return { anio: d.getFullYear(), mes: d.getMonth() + 1 }
}

const ESTADO_TAREA = {
  cumplida:     { clase: 'badge-green', label: 'Realizada' },
  realizada:    { clase: 'badge-green', label: 'Realizada' },
  incumplida:   { clase: 'badge-red', label: 'Incumplida' },
  pendiente:    { clase: 'badge-yellow', label: 'Pendiente' },
  no_puntua:    { clase: 'badge-tipo', label: 'No puntuable' },
  no_puntuable: { clase: 'badge-tipo', label: 'No puntuable' },
  no_puntuada:  { clase: 'badge-tipo', label: 'No puntuable' },
}

function pesoObtenido(detalle) {
  const realizada = detalle.estado_final === 'cumplida' || detalle.estado_final === 'realizada'
  if (!realizada || detalle.cuenta_en_rendimiento === false) return '0.00'
  const peso = Number(detalle.peso_obtenido ?? detalle.peso_programado ?? detalle.peso ?? detalle.peso_base ?? 0)
  return Number.isFinite(peso) ? peso.toFixed(2) : '0.00'
}

export default function RendimientoPage() {
  const { perfil } = useAuth()
  const esGerente = perfil?.type === 'gerente_area'
  const [searchParams, setSearchParams] = useSearchParams()

  const [tab, setTab]           = useState('diario')
  const [usuarios, setUsuarios] = useState([])
  const idUsuario = searchParams.get('id_usuario') ?? ''

  useEffect(() => {
    if (esGerente) getUsuarios().then(setUsuarios).catch(() => {})
  }, [esGerente])

  return (
    <div className="rendimiento-page">
      <div className="page-header">
        <div>
          <h1>Rendimiento</h1>
          <p>Score de tareas cumplidas</p>
        </div>
        {esGerente && usuarios.length > 0 && (
          <select
            className="filtro-select"
            value={idUsuario}
            aria-label="Usuario"
            onChange={(e) => {
              const nextParams = new URLSearchParams(searchParams)
              if (e.target.value) nextParams.set('id_usuario', e.target.value)
              else nextParams.delete('id_usuario')
              setSearchParams(nextParams)
            }}
          >
            <option value="">Mi rendimiento</option>
            {usuarios.map((u) => (
              <option key={u.id_usuario} value={u.id_usuario}>{u.nombre}</option>
            ))}
          </select>
        )}
      </div>

      <div className="tab-bar">
        <button
          className={`tab-btn${tab === 'diario' ? ' active' : ''}`}
          onClick={() => setTab('diario')}
        >
          Diario
        </button>
        <button
          className={`tab-btn${tab === 'mensual' ? ' active' : ''}`}
          onClick={() => setTab('mensual')}
        >
          Mensual
        </button>
      </div>

      {tab === 'diario'
        ? <VistaDiaria  esGerente={esGerente} idUsuario={idUsuario || undefined} />
        : <VistaMensual esGerente={esGerente} idUsuario={idUsuario || undefined} />
      }
    </div>
  )
}

/* ── Diario ── */
function VistaDiaria({ esGerente, idUsuario }) {
  const [fecha, setFecha]       = useState(hoy())
  const [carga, setCarga]       = useState({ clave: null, data: null, error: '' })
  const [revision, setRevision] = useState(0)
  const [modal, setModal]       = useState(null)
  const claveCarga = `${idUsuario ?? ''}:${fecha}:${revision}`
  const loading = carga.clave !== claveCarga
  const data = loading ? null : carga.data
  const error = loading ? '' : carga.error

  useEffect(() => {
    let vigente = true
    const params = {}
    if (idUsuario) params.id_usuario = idUsuario
    params.fecha = fecha
    getRendimientoDiario(params)
      .then((resultado) => {
        if (vigente) setCarga({ clave: claveCarga, data: resultado, error: '' })
      })
      .catch((err) => {
        if (vigente) setCarga({ clave: claveCarga, data: null, error: err.message })
      })
    return () => { vigente = false }
  }, [fecha, idUsuario, claveCarga])

  function loadDiario() {
    setRevision((value) => value + 1)
  }

  const acceso = data?.acceso
  const soloLectura = acceso?.solo_lectura === true
  const puedeGestionar = !soloLectura && acceso?.puede_registrar_tareas !== false

  async function handleReabrir(body) {
    await reabrirRendimientoDiario(body)
    loadDiario()
    setModal(null)
  }

  async function handleCerrar(body) {
    await cerrarRendimientoDiario(body)
    loadDiario()
    setModal(null)
  }

  return (
    <div className="vista-diaria">
      <div className="vista-toolbar">
        <input
          type="date"
          className="fecha-picker"
          value={fecha}
          max={hoy()}
          aria-label="Fecha"
          onChange={(e) => setFecha(e.target.value)}
        />
        {esGerente && data && puedeGestionar && (
          <div className="acciones-dia">
            {data.cerrado_en ? (
              <button
                className="btn-accion btn-reabrir"
                onClick={() => setModal({ type: 'reabrir' })}
              >
                Reabrir día
              </button>
            ) : (
              <button
                className="btn-accion btn-cerrar"
                onClick={() => setModal({ type: 'cerrar' })}
              >
                Cerrar día
              </button>
            )}
          </div>
        )}
      </div>

      {loading ? (
        <div className="loading-state">Cargando rendimiento...</div>
      ) : error ? (
        <div role="alert" className="modal-error">{error}</div>
      ) : !data ? (
        <div className="empty-state">Sin datos para esta fecha.</div>
      ) : (
        <>
          <div className="score-header">
            <ScoreCircle pct={parseFloat(data.porcentaje_dia ?? 0)} />
            <div className="score-stats">
              <StatItem label="Programadas" value={data.tareas_programadas} />
              <StatItem label="Cumplidas"   value={data.tareas_cumplidas}   color="green" />
              <StatItem label="No puntúan"  value={data.tareas_no_puntuan}  color="gray" />
              <StatItem label="Peso logrado" value={`${data.peso_total_cumplido} / ${data.peso_total_programado}`} />
              {data.cerrado_en && (
                <span className="badge badge-red cerrado-badge">Cerrado</span>
              )}
              {data.abierto_manual && (
                <span className="badge badge-yellow cerrado-badge">Reabierto</span>
              )}
              {soloLectura && (
                <span className="badge badge-tipo cerrado-badge">Solo lectura</span>
              )}
            </div>
          </div>

          {data.detalles?.length > 0 && (
            <div className="detalles-section">
              <h3 className="section-title">Detalle por tarea</h3>
              <div className="table-card">
                <table className="detalles-table">
                  <thead>
                    <tr>
                      <th>Tarea</th>
                      <th>Jornada</th>
                      <th>Hora</th>
                      <th>Estado</th>
                      <th>Peso obtenido</th>
                      <th>Nota</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.detalles.map((d) => (
                      <tr key={d.id_rendimiento_detalle}>
                        <td className="td-nombre">{d.nombre_tarea_snapshot}</td>
                        <td>{d.jornada === 'manana' ? 'Mañana' : 'Tarde'}</td>
                        <td>{d.hora_programada}</td>
                        <td>
                          <span className={`badge ${ESTADO_TAREA[d.estado_final]?.clase ?? 'badge-tipo'}`}>
                            {ESTADO_TAREA[d.estado_final]?.label ?? d.estado_final}
                          </span>
                        </td>
                        <td className="td-mono td-peso-rendimiento">{pesoObtenido(d)}</td>
                        <td className="td-nota-rendimiento">{d.revision_guardia?.notas || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {modal?.type === 'reabrir' && data && puedeGestionar && (
        <AjusteModal
          titulo="Reabrir día"
          descripcion={`Reabrir el día ${fecha} para ${data.usuario?.nombre ?? 'este usuario'}.`}
          accion="Reabrir"
          onConfirm={(motivo) => handleReabrir({ id_usuario: data.usuario?.id_usuario, fecha, motivo })}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === 'cerrar' && data && puedeGestionar && (
        <AjusteModal
          titulo="Cerrar día"
          descripcion={`Cerrar el día ${fecha} para ${data.usuario?.nombre ?? 'este usuario'}. Las tareas pendientes quedarán como incumplidas.`}
          accion="Cerrar"
          onConfirm={(motivo) => handleCerrar({ id_usuario: data.usuario?.id_usuario, fecha, motivo })}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}

/* ── Mensual ── */
function VistaMensual({ idUsuario }) {
  const init = mesActual()
  const [anio, setAnio] = useState(init.anio)
  const [mes, setMes]   = useState(init.mes)
  const [carga, setCarga] = useState({ clave: null, data: null, error: '' })
  const claveCarga = `${idUsuario ?? ''}:${anio}:${mes}`
  const loading = carga.clave !== claveCarga
  const data = loading ? null : carga.data
  const error = loading ? '' : carga.error

  useEffect(() => {
    let vigente = true
    const params = {}
    if (idUsuario) params.id_usuario = idUsuario
    params.anio = anio
    params.mes = mes
    getRendimientoMensual(params)
      .then((resultado) => {
        if (vigente) setCarga({ clave: claveCarga, data: resultado, error: '' })
      })
      .catch((err) => {
        if (vigente) setCarga({ clave: claveCarga, data: null, error: err.message })
      })
    return () => { vigente = false }
  }, [anio, mes, idUsuario, claveCarga])

  const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

  return (
    <div className="vista-mensual">
      <div className="vista-toolbar">
        <select className="filtro-select" aria-label="Mes" value={mes} onChange={(e) => setMes(Number(e.target.value))}>
          {MESES.map((m, i) => (
            <option key={i} value={i + 1}>{m}</option>
          ))}
        </select>
        <select className="filtro-select" aria-label="Año" value={anio} onChange={(e) => setAnio(Number(e.target.value))}>
          {[2025, 2026, 2027].map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="loading-state">Cargando rendimiento mensual...</div>
      ) : error ? (
        <div role="alert" className="modal-error">{error}</div>
      ) : !data ? (
        <div className="empty-state">Sin datos para este período.</div>
      ) : (
        <>
          <div className="score-header">
            <ScoreCircle pct={parseFloat(data.porcentaje_mes ?? 0)} />
            <div className="score-stats">
              <StatItem label="Días con tareas" value={data.dias_con_tareas} />
              <StatItem label="Días cerrados"   value={data.dias_cerrados} color="green" />
              <StatItem label="Peso logrado"
                value={`${data.peso_total_cumplido} / ${data.peso_total_programado}`}
              />
              {data.acceso?.solo_lectura === true && (
                <span className="badge badge-tipo cerrado-badge">Solo lectura</span>
              )}
            </div>
          </div>

          {data.dias?.length > 0 && (
            <div className="dias-grid">
              {data.dias.map((d) => {
                const pct = parseFloat(d.porcentaje_dia ?? 0)
                return (
                  <div key={d.fecha} className="dia-card">
                    <p className="dia-fecha">{d.fecha.slice(5)}</p>
                    <p className={`dia-pct ${pct >= 80 ? 'pct-high' : pct >= 50 ? 'pct-mid' : 'pct-low'}`}>
                      {pct.toFixed(0)}%
                    </p>
                    <p className="dia-tareas">{d.tareas_cumplidas}/{d.tareas_programadas}</p>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}

/* ── Componentes auxiliares ── */

function ScoreCircle({ pct }) {
  const r = 36
  const circ = 2 * Math.PI * r
  const offset = circ - (pct / 100) * circ
  const color = pct >= 80 ? '#22c55e' : pct >= 50 ? '#f59e0b' : '#ef4444'

  return (
    <div className="score-circle-wrap">
      <svg width="96" height="96" viewBox="0 0 96 96">
        <circle cx="48" cy="48" r={r} fill="none" stroke="#f1f5f9" strokeWidth="8" />
        <circle
          cx="48" cy="48" r={r}
          fill="none" stroke={color} strokeWidth="8"
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 48 48)"
          style={{ transition: 'stroke-dashoffset 0.5s ease' }}
        />
      </svg>
      <span className="score-circle-pct" style={{ color }}>{pct.toFixed(0)}%</span>
    </div>
  )
}

function StatItem({ label, value, color }) {
  const colors = { green: '#16a34a', red: '#dc2626', gray: '#64748b' }
  return (
    <div className="stat-item">
      <span className="stat-label">{label}</span>
      <span className="stat-value" style={{ color: colors[color] ?? '#1e293b' }}>{value}</span>
    </div>
  )
}

function AjusteModal({ titulo, descripcion, accion, onConfirm, onClose }) {
  const [motivo, setMotivo]   = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  async function handleConfirm() {
    if (!motivo.trim()) { setError('El motivo es requerido.'); return }
    setLoading(true)
    setError('')
    try {
      await onConfirm(motivo.trim())
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
          <h2>{titulo}</h2>
          <button className="modal-close" onClick={onClose}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div className="modal-form">
          <p className="modal-confirm-text">{descripcion}</p>
          <div className="form-group">
            <label>Motivo</label>
            <input
              type="text"
              placeholder="Describe el motivo..."
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              autoFocus
            />
          </div>
          {error && <p className="modal-error">{error}</p>}
          <div className="modal-footer">
            <button className="btn-secondary" onClick={onClose}>Cancelar</button>
            <button className="btn-primary" onClick={handleConfirm} disabled={loading}>
              {loading ? 'Procesando...' : accion}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
