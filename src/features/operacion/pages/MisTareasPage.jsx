import { useState, useEffect } from 'react'
import { getMisTareas, registrarTarea } from '../services/operacionService'
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

  useEffect(() => { loadTareas() }, [fecha])

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
          onChange={(e) => { setFecha(e.target.value); setRegistrando(null) }}
          max={data?.meta?.fecha_servidor || undefined}
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

      <div className="jornada-tabs">
        <button
          className={`jornada-tab${jornada === 'manana' ? ' active' : ''}`}
          onClick={() => { setJornada('manana'); cancelarRegistro() }}
        >
          Mañana
          {resumen?.manana && <span className="tab-count">{resumen.manana.total}</span>}
        </button>
        <button
          className={`jornada-tab${jornada === 'tarde' ? ' active' : ''}`}
          onClick={() => { setJornada('tarde'); cancelarRegistro() }}
        >
          Tarde
          {resumen?.tarde && <span className="tab-count">{resumen.tarde.total}</span>}
        </button>
      </div>

      {loading ? (
        <div className="loading-state">Cargando tareas...</div>
      ) : tareasFiltradas.length === 0 ? (
        <div className="empty-state">Sin tareas para esta jornada.</div>
      ) : (
        <div className="tareas-cards">
          {tareasFiltradas.map((t) => (
            <div key={t.id_sucursal_tarea} className={`tarea-card estado-${t.estado_ui}`}>
              <div className="tarea-card-top">
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
                    <button className="btn-secondary-sm" onClick={cancelarRegistro}>
                      Cancelar
                    </button>
                    <button
                      className="btn-primary-sm"
                      onClick={() => handleRegistrar(t)}
                      disabled={savingId === t.id_sucursal_tarea}
                    >
                      {savingId === t.id_sucursal_tarea ? 'Registrando...' : 'Confirmar'}
                    </button>
                  </div>
                </div>
              ) : t.disponible_para_registro ? (
                <button className="btn-registrar" onClick={() => { setRegistrando(t.id_sucursal_tarea); setRegError('') }}>
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
