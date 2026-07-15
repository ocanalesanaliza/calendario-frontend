import { useState, useEffect } from 'react'
import { getMisTareas, registrarTarea, registrarTareasLote } from '../services/operacionService'
import { getTrabajosCampo, aceptarTrabajoCampo, rechazarTrabajoCampo } from '../../trabajosCampo/services/trabajosCampoService'
import './MisTareasPage.css'

const ESTADO_BADGE = {
  disponible:    'badge-green',
  registrada:    'badge-blue',
  cerrada:       'badge-red',
  programada:    'badge-yellow',
  bloqueada:     'badge-tipo',
  no_disponible: 'badge-tipo',
}

export default function MisTareasPage() {
  const [data, setData]         = useState(null)
  const [loading, setLoading]   = useState(true)
  const [jornada, setJornada]   = useState('manana')
  const [registrando, setRegistrando] = useState(null)
  const [notas, setNotas]       = useState('')
  const [savingId, setSavingId] = useState(null)
  const [regError, setRegError] = useState('')
  const [fecha, setFecha]       = useState('')
  const [trabajosCampo, setTrabajosCampo] = useState([])
  const [campoAction, setCampoAction]     = useState(null)
  const [seleccionadas, setSeleccionadas] = useState([])
  const [registrandoLote, setRegistrandoLote] = useState(false)
  const [loteError, setLoteError] = useState('')

  const busy = savingId !== null || registrandoLote

  useEffect(() => { loadTareas(); loadTrabajosCampo() }, [fecha])

  async function loadTareas() {
    setLoading(true)
    try {
      const params = fecha ? { fecha } : {}
      const res = await getMisTareas(params)
      setData(res)
      if (!fecha && res.meta?.jornada_servidor) {
        setJornada(res.meta.jornada_servidor)
      }
    } finally {
      setLoading(false)
    }
  }

  async function loadTrabajosCampo() {
    try {
      const params = { estado: 'pendiente' }
      if (fecha) params.fecha = fecha
      const res = await getTrabajosCampo(params)
      setTrabajosCampo(res.results ?? [])
    } catch {
      setTrabajosCampo([])
    }
  }

  async function handleAceptarCampo(id) {
    setCampoAction(id)
    try {
      await aceptarTrabajoCampo(id)
      await Promise.all([loadTareas(), loadTrabajosCampo()])
    } catch (err) {
      alert(err.message)
    } finally {
      setCampoAction(null)
    }
  }

  async function handleRechazarCampo(id) {
    setCampoAction(id)
    try {
      await rechazarTrabajoCampo(id)
      await loadTrabajosCampo()
    } catch (err) {
      alert(err.message)
    } finally {
      setCampoAction(null)
    }
  }

  async function handleRegistrar(tarea) {
    setSavingId(tarea.id_sucursal_tarea)
    setRegError('')
    try {
      await registrarTarea({
        id_tarea: tarea.tarea?.id_tarea,
        fecha:    data.meta?.fecha_consultada,
        notas:    notas || undefined,
      })
      setRegistrando(null)
      setNotas('')
      await loadTareas()
    } catch (err) {
      setRegError(err.message)
    } finally {
      setSavingId(null)
    }
  }

  function cancelarRegistro() {
    setRegistrando(null)
    setNotas('')
    setRegError('')
    setSeleccionadas([])
    setLoteError('')
  }

  function toggleSeleccion(id) {
    setSeleccionadas((prev) =>
      prev.includes(id) ? prev.filter((sid) => sid !== id) : [...prev, id]
    )
  }

  async function handleRegistrarSeleccionadas() {
    const tareas = tareasFiltradas.filter((t) => seleccionadas.includes(t.id_sucursal_tarea))
    setRegistrandoLote(true)
    setLoteError('')
    try {
      const res = await registrarTareasLote({
        fecha:     data.meta?.fecha_consultada,
        id_tareas: tareas.map((t) => t.tarea?.id_tarea),
      })
      if (res.errores?.length > 0) {
        const nombrePorId = new Map(
          tareas.map((t) => [t.tarea?.id_tarea, t.tarea?.nombre || `Tarea #${t.id_sucursal_tarea}`])
        )
        const nombres = res.errores.map((e) => nombrePorId.get(e.id_tarea) || `Tarea ${e.id_tarea}`)
        setLoteError(`No se pudieron registrar: ${nombres.join(', ')}`)
      }
    } catch (err) {
      setLoteError(err.message)
    } finally {
      setSeleccionadas([])
      await loadTareas()
      setRegistrandoLote(false)
    }
  }

  const tareasFiltradas = data?.results?.filter((t) => t.jornada === jornada) ?? []
  const resumen = data?.resumen

  return (
    <div className="mis-tareas-page">
      <div className="page-header">
        <div>
          <h1>Mis tareas</h1>
          {data?.meta && (
            <p>
              {data.meta.fecha_consultada} &mdash; {data.meta.hora_servidor}
              &nbsp;({data.meta.jornada_servidor === 'tarde' ? 'Tarde' : 'Mañana'})
            </p>
          )}
        </div>
        <input
          type="date"
          className="fecha-picker"
          value={fecha || data?.meta?.fecha_consultada || ''}
          onChange={(e) => { setFecha(e.target.value); cancelarRegistro() }}
          max={data?.meta?.fecha_servidor || undefined}
          disabled={busy}
        />
      </div>

      {resumen && (
        <div className="stats-row">
          <StatCard label="Total"       value={resumen.total} />
          <StatCard label="Disponibles" value={resumen.disponibles} color="green" />
          <StatCard label="Registradas" value={resumen.registradas} color="blue" />
          <StatCard label="Cerradas"    value={resumen.cerradas}    color="red" />
          {resumen.bloqueadas > 0 && (
            <StatCard label="Bloqueadas" value={resumen.bloqueadas} color="gray" />
          )}
        </div>
      )}

      {trabajosCampo.length > 0 && (
        <div className="campo-solicitudes">
          {trabajosCampo.map((tc) => (
            <div key={tc.id_trabajo_campo} className="campo-solicitud-card">
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
                </div>
              </div>
              <div className="campo-solicitud-actions">
                <button
                  className="btn-rechazar"
                  disabled={campoAction === tc.id_trabajo_campo}
                  onClick={() => handleRechazarCampo(tc.id_trabajo_campo)}
                >
                  Rechazar
                </button>
                <button
                  className="btn-aceptar"
                  disabled={campoAction === tc.id_trabajo_campo}
                  onClick={() => handleAceptarCampo(tc.id_trabajo_campo)}
                >
                  Aceptar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="jornada-tabs">
        <button
          className={`jornada-tab${jornada === 'manana' ? ' active' : ''}`}
          onClick={() => { setJornada('manana'); cancelarRegistro() }}
          disabled={busy}
        >
          Mañana
          {resumen?.manana && <span className="tab-count">{resumen.manana.total}</span>}
        </button>
        <button
          className={`jornada-tab${jornada === 'tarde' ? ' active' : ''}`}
          onClick={() => { setJornada('tarde'); cancelarRegistro() }}
          disabled={busy}
        >
          Tarde
          {resumen?.tarde && <span className="tab-count">{resumen.tarde.total}</span>}
        </button>
      </div>

      {seleccionadas.length > 0 && (
        <div className="seleccion-bar">
          <span>{seleccionadas.length} tarea{seleccionadas.length > 1 ? 's' : ''} seleccionada{seleccionadas.length > 1 ? 's' : ''}</span>
          {loteError && <p className="reg-error">{loteError}</p>}
          <div className="seleccion-actions">
            <button className="btn-secondary-sm" onClick={() => setSeleccionadas([])} disabled={busy}>
              Cancelar selección
            </button>
            <button className="btn-primary-sm" onClick={handleRegistrarSeleccionadas} disabled={busy}>
              {registrandoLote ? 'Registrando...' : `Registrar ${seleccionadas.length} seleccionada${seleccionadas.length > 1 ? 's' : ''}`}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="loading-state">Cargando tareas...</div>
      ) : tareasFiltradas.length === 0 ? (
        <div className="empty-state">Sin tareas para esta jornada.</div>
      ) : (
        <div className="tareas-cards">
          {tareasFiltradas.map((t) => (
            <div key={t.id_sucursal_tarea} className={`tarea-card estado-${t.estado_ui}`}>
              <div className="tarea-card-top">
                {t.disponible_para_registro && (
                  <input
                    type="checkbox"
                    className="tarea-checkbox"
                    checked={seleccionadas.includes(t.id_sucursal_tarea)}
                    onChange={() => toggleSeleccion(t.id_sucursal_tarea)}
                    disabled={busy}
                  />
                )}
                <div className="tarea-card-info">
                  <p className="tarea-card-nombre">
                    {t.tarea?.nombre || `Tarea #${t.id_sucursal_tarea}`}
                  </p>
                  <p className="tarea-card-hora">
                    Programada: {t.hora}
                    {t.hora_fin_registro && ` · ventana hasta ${t.hora_fin_registro}`}
                  </p>
                </div>
                <span className={`badge ${ESTADO_BADGE[t.estado_ui] ?? 'badge-tipo'}`}>
                  {t.estado_ui_label}
                </span>
              </div>

              {t.disponible_para_registro && registrando === t.id_sucursal_tarea ? (
                <div className="registrar-panel">
                  <input
                    type="text"
                    className="notas-input"
                    placeholder="Notas (opcional)"
                    value={notas}
                    onChange={(e) => setNotas(e.target.value)}
                    autoFocus
                  />
                  {regError && <p className="reg-error">{regError}</p>}
                  <div className="registrar-actions">
                    <button className="btn-secondary-sm" onClick={cancelarRegistro} disabled={busy}>
                      Cancelar
                    </button>
                    <button
                      className="btn-primary-sm"
                      onClick={() => handleRegistrar(t)}
                      disabled={busy}
                    >
                      {savingId === t.id_sucursal_tarea ? 'Registrando...' : 'Confirmar'}
                    </button>
                  </div>
                </div>
              ) : t.disponible_para_registro ? (
                <button
                  className="btn-registrar"
                  onClick={() => { setRegistrando(t.id_sucursal_tarea); setRegError('') }}
                  disabled={busy}
                >
                  Registrar
                </button>
              ) : t.motivo_no_disponible ? (
                <p className="motivo-label">{t.motivo_no_disponible.replace(/_/g, ' ')}</p>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, color }) {
  const bg   = { green: '#dcfce7', blue: '#dbeafe', red: '#fee2e2', gray: '#f1f5f9' }
  const text = { green: '#166534', blue: '#1d4ed8', red: '#991b1b', gray: '#475569' }
  return (
    <div className="stat-card" style={{ background: bg[color] ?? '#fff' }}>
      <span className="stat-value" style={{ color: text[color] ?? '#1e293b' }}>{value}</span>
      <span className="stat-label">{label}</span>
    </div>
  )
}
