import { useState, useEffect, useMemo } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { getMisTareas, registrarTarea, registrarTareasLote } from '../services/operacionService'
import { getTrabajosCampo, aceptarTrabajoCampo, rechazarTrabajoCampo } from '../../trabajosCampo/services/trabajosCampoService'
import { useAuth } from '../../auth/context/AuthContext'
import { DepositDemoModal } from '../components/DepositDemoModal'
import { RevisionGuardiaModal } from '../components/RevisionGuardiaModal'
import './MisTareasPage.css'

const ESTADO_BADGE = {
  disponible:    'badge-green',
  registrada:    'badge-blue',
  cerrada:       'badge-red',
  programada:    'badge-yellow',
  bloqueada:     'badge-tipo',
  no_disponible: 'badge-tipo',
}

function esRevisionGuardia(tarea) {
  return tarea.tarea?.es_revision_guardia === true
}

function getStartTime(tarea) {
  const hora = typeof tarea.hora === 'string' ? tarea.hora.trim() : ''
  const match = hora.match(/^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/)
  return match ? hora.slice(0, 5) : null
}

function groupTasksByStartTime(tareas) {
  const groups = new Map()
  const unscheduledTasks = []

  tareas.forEach((tarea) => {
    const startTime = getStartTime(tarea)
    if (!startTime) {
      unscheduledTasks.push(tarea)
      return
    }

    const group = groups.get(startTime) ?? []
    group.push(tarea)
    groups.set(startTime, group)
  })

  const scheduledGroups = [...groups.entries()]
    .sort(([firstTime], [secondTime]) => firstTime.localeCompare(secondTime))
    .map(([startTime, tasks]) => ({ startTime, tasks }))

  return unscheduledTasks.length > 0
    ? [...scheduledGroups, { startTime: null, tasks: unscheduledTasks }]
    : scheduledGroups
}

function getTimeInMinutes(value) {
  const match = typeof value === 'string' && value.trim().match(/^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/)
  if (!match) return null

  const [hours, minutes] = value.trim().split(':').map(Number)
  return (hours * 60) + minutes
}

function getTaskPriority(tarea, meta) {
  if (tarea.estado_ui === 'no_disponible' || tarea.estado_ui === 'bloqueada') return 'neutral'
  if (!meta || meta.fecha_consultada !== meta.fecha_servidor) return null

  const serverTime = getTimeInMinutes(meta.hora_servidor)
  const deadline = getTimeInMinutes(tarea.hora_fin_registro)
  if (serverTime === null || deadline === null) return null

  const minutesRemaining = deadline - serverTime
  if (minutesRemaining < 0) return 'expired'
  if (minutesRemaining < 30) return { type: 'urgent', minutesRemaining }
  return null
}

export default function MisTareasPage({ className = 'mis-tareas-page', groupByStartTime = false, selectionUxVariant = false, scanabilityVariant = false, availableFilterVariant = false, priorityVariant = false }) {
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
  const [depositTask, setDepositTask] = useState(null)
  const [revisionGuardiaTask, setRevisionGuardiaTask] = useState(null)
  const [availableFilterActive, setAvailableFilterActive] = useState(false)

  const { perfil, revokeMyTasksAccess } = useAuth()
  const navigate = useNavigate()

  const busy = savingId !== null || registrandoLote
  const esGerenteArea = perfil?.type === 'gerente_area'
  const puedeAccederMisTareas = perfil?.can_access_my_tasks === true

  useEffect(() => {
    if (!puedeAccederMisTareas) return
    loadTareas()
    loadTrabajosCampo()
  }, [fecha, puedeAccederMisTareas])

  function handleForbidden(error) {
    if (error?.status !== 403) return false
    revokeMyTasksAccess()
    navigate('/', { replace: true })
    return true
  }

  async function loadTareas() {
    setLoading(true)
    try {
      const params = fecha ? { fecha } : {}
      const res = await getMisTareas(params)
      setData(res)
      if (availableFilterVariant && availableFilterActive) {
        const activeJornada = !fecha && res.meta?.jornada_servidor
          ? res.meta.jornada_servidor
          : jornada
        clearHiddenSelections(res.results?.filter((t) => t.jornada === activeJornada) ?? [])
      }
      if (!fecha && res.meta?.jornada_servidor) {
        setJornada(res.meta.jornada_servidor)
      }
    } catch (error) {
      handleForbidden(error)
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
    } catch (error) {
      if (!handleForbidden(error)) setTrabajosCampo([])
    }
  }

  async function handleAceptarCampo(id) {
    setCampoAction(id)
    try {
      await aceptarTrabajoCampo(id)
      await Promise.all([loadTareas(), loadTrabajosCampo()])
    } catch (err) {
      if (!handleForbidden(err)) alert(err.message)
    } finally {
      setCampoAction(null)
    }
  }

  function handleCardClick(event, tarea){
    if (esRevisionGuardia(tarea)) {
      if (!busy) setRevisionGuardiaTask(tarea)
      return
    }
    if (!tarea.disponible_para_registro || busy) return

    const clickedInteractiveElement = event.target.closest(
      'button, a, input, select, textarea, label, [role="button"], [role="link"], [contenteditable="true"]'
    )

    if (clickedInteractiveElement) return

    toggleSeleccion(tarea.id_sucursal_tarea)
  }

  async function handleRechazarCampo(id) {
    setCampoAction(id)
    try {
      await rechazarTrabajoCampo(id)
      await loadTrabajosCampo()
    } catch (err) {
      if (!handleForbidden(err)) alert(err.message)
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
      setSeleccionadas([])
      await loadTareas()
    } catch (err) {
      if (handleForbidden(err)) return
      setRegError(err.message)
    } finally {
      setSavingId(null)
    }
  }

  /* function cancelarRegistro() {
    setRegistrando(null)
    setNotas('')
    setRegError('')
    setSeleccionadas([])
    setLoteError('')
  } */

  function cancelarRegistroIndividual() {
    setRegistrando(null)
    setNotas('')
    setRegError('')
  }

  function reiniciarVista() {
    cancelarRegistroIndividual()
    setSeleccionadas([])
    setLoteError('')
  }

  function startRegistration(tarea) {
    if (esRevisionGuardia(tarea)) {
      setRevisionGuardiaTask(tarea)
      return
    }
    setRegistrando(tarea.id_sucursal_tarea)
    setRegError('')
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
    let accessRevoked = false
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
      accessRevoked = handleForbidden(err)
      if (!accessRevoked) setLoteError(err.message)
    } finally {
      setSeleccionadas([])
      if (!accessRevoked) await loadTareas()
      setRegistrandoLote(false)
    }
  }

  const tareasDeJornada = useMemo(
    () => data?.results?.filter((t) => t.jornada === jornada) ?? [],
    [data, jornada],
  )
  const tareasFiltradas = useMemo(
    () => availableFilterVariant && availableFilterActive
      ? tareasDeJornada.filter((t) => t.disponible_para_registro)
      : tareasDeJornada,
    [availableFilterActive, availableFilterVariant, tareasDeJornada],
  )
  const resumen = data?.resumen

  function clearHiddenSelections(tasks) {
    const visibleTaskIds = new Set(
      tasks
        .filter((t) => t.disponible_para_registro)
        .map((t) => t.id_sucursal_tarea),
    )
    setSeleccionadas((prev) => {
      const visibleSelections = prev.filter((id) => visibleTaskIds.has(id))
      return visibleSelections.length === prev.length ? prev : visibleSelections
    })
  }

  function handleAvailableFilterClick() {
    clearHiddenSelections(tareasDeJornada)
    setAvailableFilterActive(true)
  }

  if (!puedeAccederMisTareas) return <Navigate to="/" replace />

  function renderTaskCard(t) {
    const isRevisionGuardiaTask = esRevisionGuardia(t)
    const isSelectable = (t.disponible_para_registro || isRevisionGuardiaTask) && !busy
    const isSelected = seleccionadas.includes(t.id_sucursal_tarea)
    const taskName = t.tarea?.nombre || `Tarea #${t.id_sucursal_tarea}`
    const checkboxId = `mis-tareas-task-${t.id_sucursal_tarea}`
    const Card = selectionUxVariant && isSelectable
      ? (isRevisionGuardiaTask ? 'button' : 'label')
      : 'div'
    const taskSchedule = <>{t.hora}{t.hora_fin_registro && ` - ${t.hora_fin_registro}`}</>
    const statusBadge = <span className={`badge ${ESTADO_BADGE[t.estado_ui] ?? 'badge-tipo'}`}>{t.estado_ui_label}</span>
    const priority = priorityVariant ? getTaskPriority(t, data?.meta) : null
    const priorityClass = typeof priority === 'string' ? priority : priority?.type

    return (
      <Card key={t.id_sucursal_tarea} className={['tarea-card',
              `estado-${t.estado_ui}`,
              isSelectable && 'tarea-card--selectable',
              isSelected && 'tarea-card--selected',
              selectionUxVariant && isSelectable && 'tarea-card--selection-emphasis',
              selectionUxVariant && isSelected && 'tarea-card--selection-confirmed',
              scanabilityVariant && 'tarea-card--scanable',
              priorityVariant && priorityClass && `tarea-card--priority-${priorityClass}`,
              ].filter(Boolean).join(' ')}
        {...(selectionUxVariant && isSelectable
          ? (isRevisionGuardiaTask
              ? {
                  type: 'button',
                  onClick: () => setRevisionGuardiaTask(t),
                  'aria-label': `Abrir revisión de guardia: ${taskName}`,
                }
              : { htmlFor: checkboxId })
          : { onClick: (event) => handleCardClick(event, t) })}
      >
        {scanabilityVariant ? (
          <div className="tarea-card-top tarea-card-top--scanable">
            {t.disponible_para_registro && !esRevisionGuardia(t) && (
              <input
                id={checkboxId}
                type="checkbox"
                className="tarea-checkbox"
                aria-label={`Seleccionar ${taskName}`}
                checked={seleccionadas.includes(t.id_sucursal_tarea)}
                onChange={() => toggleSeleccion(t.id_sucursal_tarea)}
                onKeyDown={selectionUxVariant ? (event) => {
                  if (event.key === ' ') {
                    event.preventDefault()
                    toggleSeleccion(t.id_sucursal_tarea)
                  }
                } : undefined}
                disabled={busy}
              />
            )}
            <div className="tarea-card-info tarea-card-info--scanable">
              <p className="tarea-card-nombre tarea-card-nombre--clamped" title={taskName}>{taskName}</p>
              <div className="tarea-card-metadata">
                <p className="tarea-card-hora">{taskSchedule}</p>
                {statusBadge}
                {priority === 'expired' && <span className="tarea-priority tarea-priority--expired" role="status">Registro vencido</span>}
                {priority?.type === 'urgent' && <span className="tarea-priority tarea-priority--urgent" role="status">Quedan {priority.minutesRemaining} min</span>}
              </div>
            </div>
          </div>
        ) : (
          <div className="tarea-card-top">
            {t.disponible_para_registro && !esRevisionGuardia(t) && (
              <input
                id={checkboxId}
                type="checkbox"
                className="tarea-checkbox"
                aria-label={`Seleccionar ${taskName}`}
                checked={seleccionadas.includes(t.id_sucursal_tarea)}
                onChange={() => toggleSeleccion(t.id_sucursal_tarea)}
                onKeyDown={selectionUxVariant ? (event) => {
                  if (event.key === ' ') {
                    event.preventDefault()
                    toggleSeleccion(t.id_sucursal_tarea)
                  }
                } : undefined}
                disabled={busy}
              />
            )}
            <div className="tarea-card-info">
              <p className="tarea-card-nombre">{taskName}</p>
              <p className="tarea-card-hora">{taskSchedule}</p>
            </div>
            {statusBadge}
          </div>
        )}

        {selectionUxVariant && isSelected && t.disponible_para_registro && !esRevisionGuardia(t) && (
          <span className="tarea-selection-cue" aria-hidden="true">
            Seleccionada
          </span>
        )}

        {t.motivo_no_disponible && t.estado_ui !== 'registrada' && t.estado_ui !== 'programada' ? (
          <p className="motivo-label">{t.motivo_no_disponible.replace(/_/g, ' ')}</p>
        ) : null}
      </Card>
    )
  }

  return (
    <div className={`${className}${selectionUxVariant && seleccionadas.length > 0 ? ' mis-tareas-page--selection-active' : ''}`}>
      <div className="page-header mis-tareas-header">
        <div className="mis-tareas-heading">
          <h1>Mis tareas</h1>
          {data?.meta && (
            <p className="mis-tareas-context">
              {data.meta.fecha_consultada} &mdash; {data.meta.hora_servidor}
              <span className="jornada-context">Jornada de {data.meta.jornada_servidor === 'tarde' ? 'tarde' : 'mañana'}</span>
            </p>
          )}
        </div>
        <label className="fecha-control">
          <span>Fecha</span>
          <input
            type="date"
            className="fecha-picker"
            value={fecha || data?.meta?.fecha_consultada || ''}
            onChange={(e) => { setFecha(e.target.value); reiniciarVista() }}
            max={data?.meta?.fecha_servidor || undefined}
            disabled={busy}
          />
        </label>
      </div>

      {resumen && (
        <div className="stats-row">
          <StatCard label="Total"       value={resumen.total} />
          <StatCard
            label="Disponibles"
            value={resumen.disponibles}
            color="green"
            emphasis
            interactive={availableFilterVariant}
            active={availableFilterActive}
            onClick={handleAvailableFilterClick}
          />
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
              {esGerenteArea && (
                <div className="campo-solicitud-actions">
                  <button
                    className="btn-rechazar"
                    disabled={campoAction === tc.id_trabajo_campo}
                    onClick={() => handleRechazarCampo(tc.id_trabajo_campo)}
                  >
                    Rechazar
                  </button>

                  <button
                    className="btn-mistareas-aceptar"
                    disabled={campoAction === tc.id_trabajo_campo}
                    onClick={() => handleAceptarCampo(tc.id_trabajo_campo)}
                  >
                    Aceptar
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="jornada-tabs" role="group" aria-label="Jornada de tareas">
        <button
          className={`jornada-tab${jornada === 'manana' ? ' active' : ''}`}
          onClick={() => { setJornada('manana'); reiniciarVista() }}
          disabled={busy}
          aria-pressed={jornada === 'manana'}
        >
          Mañana
          {resumen?.manana && <span className="tab-count">{resumen.manana.total}</span>}
        </button>
        <button
          className={`jornada-tab${jornada === 'tarde' ? ' active' : ''}`}
          onClick={() => { setJornada('tarde'); reiniciarVista() }}
          disabled={busy}
          aria-pressed={jornada === 'tarde'}
        >
          Tarde
          {resumen?.tarde && <span className="tab-count">{resumen.tarde.total}</span>}
        </button>
      </div>

      {availableFilterVariant && availableFilterActive && (
        <div className="mis-tareas-available-filter" role="status" aria-live="polite">
          <span>Filtro activo: solo tareas disponibles de esta jornada.</span>
          <button type="button" className="btn-secondary-sm" onClick={() => setAvailableFilterActive(false)} disabled={busy}>
            Limpiar filtro
          </button>
        </div>
      )}

      {seleccionadas.length > 0 && (
        <div className={`seleccion-bar${selectionUxVariant ? ' seleccion-bar--v2-active seleccion-bar--v2-fixed' : ''}`}>
          <span>{seleccionadas.length} tarea{seleccionadas.length > 1 ? 's' : ''} seleccionada{seleccionadas.length > 1 ? 's' : ''}</span>
          {seleccionadas.length === 1 && registrando === seleccionadas[0] ? (
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
                <button className="btn-secondary-sm" onClick={cancelarRegistroIndividual} disabled={busy}>
                  Cancelar
                </button>
                <button
                  className="btn-primary-sm"
                  onClick={() => handleRegistrar(tareasFiltradas.find((t) => t.id_sucursal_tarea === seleccionadas[0]))}
                  disabled={busy}
                >
                  {savingId === seleccionadas[0] ? 'Registrando...' : 'Confirmar'}
                </button>
              </div>
            </div>
          ) : (
            <>
              {loteError && <p className="reg-error">{loteError}</p>}
              <div className="seleccion-actions">
                <button className="btn-secondary-sm" onClick={() => setSeleccionadas([])} disabled={busy}>
                  Cancelar selección
                </button>
                <button
                  className="btn-primary-sm"
                  onClick={() => {
                    if (seleccionadas.length === 1) {
                      startRegistration(tareasFiltradas.find((t) => t.id_sucursal_tarea === seleccionadas[0]))
                    } else {
                      handleRegistrarSeleccionadas()
                    }
                  }}
                  disabled={busy}
                >
                  {registrandoLote ? 'Registrando...' : `Registrar ${seleccionadas.length} ${seleccionadas.length === 1 ? 'tarea' : 'tareas'}`}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {loading ? (
        <div className="loading-state">Cargando tareas...</div>
      ) : tareasFiltradas.length === 0 ? (
        <div className="empty-state">Sin tareas para esta jornada.</div>
      ) : groupByStartTime ? (
        <div className="mis-tareas-time-groups">
          {groupTasksByStartTime(tareasFiltradas).map(({ startTime, tasks }) => {
            const heading = startTime ?? 'Horario no disponible'
            const headingId = `mis-tareas-time-group-${startTime ?? 'unscheduled'}`
            return (
              <section key={startTime ?? 'unscheduled'} className="mis-tareas-time-group" aria-labelledby={headingId}>
                <h2 id={headingId} className="mis-tareas-time-group-heading">{heading}</h2>
                <div className="tareas-cards">
                  {tasks.map(renderTaskCard)}
                </div>
              </section>
            )
          })}
        </div>
      ) : (
        <div className="tareas-cards">
          {tareasFiltradas.map(renderTaskCard)}
        </div>
      )}
      {depositTask && <DepositDemoModal tarea={depositTask} fecha={data?.meta?.fecha_consultada} sucursal={perfil?.sucursal?.nombre || 'Sucursal asignada'} onClose={() => setDepositTask(null)} />}
      {revisionGuardiaTask && (
        <RevisionGuardiaModal
          tarea={revisionGuardiaTask}
          fecha={data?.meta?.fecha_consultada}
          onClose={() => setRevisionGuardiaTask(null)}
          onSaved={async () => {
            await loadTareas()
            setRevisionGuardiaTask(null)
          }}
        />
      )}
    </div>
  )
}

function StatCard({ label, value, color, emphasis = false, interactive = false, active = false, onClick }) {
  const className = ['stat-card', color && `stat-card--${color}`, emphasis && 'stat-card--emphasis', interactive && 'stat-card--interactive', active && 'stat-card--active'].filter(Boolean).join(' ')
  const content = <>
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
    </>

  return interactive ? (
    <button type="button" className={className} onClick={onClick} aria-pressed={active}>
      {content}
    </button>
  ) : <div className={className}>{content}</div>
}
