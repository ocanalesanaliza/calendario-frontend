import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../auth/context/AuthContext'
import { getProfileCapabilities } from '../../auth/profilePolicies'
import {
  aceptarTrabajoCampo,
  cancelarTrabajoCampo,
  getTrabajosCampo,
  rechazarTrabajoCampo,
} from '../services/trabajosCampoService'
import {
  aceptarSolicitudVacacion,
  cancelarSolicitudVacacion,
  getSolicitudesVacacion,
  rechazarSolicitudVacacion,
} from '../../vacacionesProgramadas/services/vacacionesProgramadasService'
import { aceptarCobertura, getCoberturas, rechazarCobertura } from '../../coberturas/services/coberturasService'
import TrabajoCampoModal from '../components/TrabajoCampoModal'
import VacacionModal from '../../vacacionesProgramadas/components/VacacionModal'
import { Aviso, EstadoCarga, Icono, PageHeader } from '../../tuvet/components/TuvetUi'
import '../../tuvet/tuvet.css'
import './SolicitudesPendientesPage.css'

const GENERIC_ERROR = 'No se pudieron cargar las solicitudes. Intenta nuevamente.'
const ESTADO_CAMPO_BADGE = {
  pendiente: 'badge-yellow',
  aceptado: 'badge-green',
  rechazado: 'badge-red',
  cancelado: 'badge-tipo',
  vencida: 'badge-orange',
}
const OWN_REQUEST_PAGE_SIZE = 8
const OWN_REQUEST_STATUSES = [['all', 'Todas'], ['pending', 'Pendientes'], ['accepted', 'Aceptadas'], ['cancelled', 'Canceladas']]

function requestStatus(request) {
  const value = String(request.estado ?? request.status ?? '').toLowerCase()
  if (['pendiente', 'pending'].includes(value)) return 'pending'
  if (['aceptado', 'aceptada', 'accepted', 'approved'].includes(value)) return 'accepted'
  if (['cancelado', 'cancelada', 'cancelled'].includes(value)) return 'cancelled'
  return value
}

function formatRequestDate(date) {
  if (!date) return 'Fecha no disponible'
  const [year, month, day] = String(date).slice(0, 10).split('-').map(Number)
  if (!year || !month || !day) return String(date)
  return new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(year, month - 1, day))).replace('.', '')
}

function requestDateLabel(request) {
  const date = request.fecha ?? request.fecha_inicio
  const range = request.fecha_fin && request.fecha_fin !== date ? `${formatRequestDate(date)} al ${formatRequestDate(request.fecha_fin)}` : formatRequestDate(date)
  const jornada = request.jornada_label ?? (request.jornada === 'manana' ? 'Mañana' : request.jornada === 'tarde' ? 'Tarde' : '')
  return jornada ? `${range} · ${jornada}` : range
}

export default function SolicitudesPendientesPage() {
  const { perfil } = useAuth()
  const { canDecidePendingRequests } = getProfileCapabilities(perfil)

  return canDecidePendingRequests
    ? <DecisionRequestsView />
    : <BranchManagerRequestsView />
}

function DecisionRequestsView() {
  const [tab, setTab] = useState('pendientes')
  const [fieldWork, setFieldWork] = useState([])
  const [vacations, setVacations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [action, setAction] = useState(null)
  const [rejection, setRejection] = useState(null)

  const loadRequests = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [fieldWorkResponse, vacationResponse] = await Promise.all([
        getTrabajosCampo({ estado: 'pendiente' }),
        getSolicitudesVacacion({ estado: 'pendiente' }),
      ])
      setFieldWork(fieldWorkResponse.results ?? [])
      setVacations(vacationResponse.results ?? [])
    } catch {
      setError(GENERIC_ERROR)
    } finally {
      setLoading(false)
    }
  }, [])

  // Carga inicial y tras cada cambio de sus dependencias (sincronización con el servidor).
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void loadRequests() }, [loadRequests])

  async function decide(kind, id, decision, reason) {
    setAction(`${kind}-${id}`)
    setError('')
    try {
      const service = kind === 'fieldWork'
        ? (decision === 'approve' ? aceptarTrabajoCampo : rechazarTrabajoCampo)
        : (decision === 'approve' ? aceptarSolicitudVacacion : rechazarSolicitudVacacion)
      await (decision === 'reject' ? service(id, reason) : service(id))
      await loadRequests()
      return true
    } catch {
      setError(GENERIC_ERROR)
      return false
    } finally {
      setAction(null)
    }
  }

  function handleTabKeyDown(event) {
    if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return
    event.preventDefault()
    const nextTab = event.key === 'ArrowRight'
      ? (tab === 'pendientes' ? 'historial' : 'pendientes')
      : (tab === 'pendientes' ? 'historial' : 'pendientes')
    setTab(nextTab)
    event.currentTarget.parentElement?.querySelector(`[data-tab="${nextTab}"]`)?.focus()
  }

  return (
    <main className="tema-analiza tuvet-page solicitudes-pendientes-page">
      <PageHeader title="Solicitudes pendientes" description="Trabajo de campo y vacaciones programadas que te han solicitado" />
      <div className="tab-bar" role="tablist" aria-label="Solicitudes">
        <button id="solicitudes-pendientes-tab" data-tab="pendientes" className={`tab-btn${tab === 'pendientes' ? ' active' : ''}`} role="tab" aria-selected={tab === 'pendientes'} aria-controls="solicitudes-pendientes-panel" onKeyDown={handleTabKeyDown} onClick={() => setTab('pendientes')}>Pendientes</button>
        <button id="solicitudes-historial-tab" data-tab="historial" className={`tab-btn${tab === 'historial' ? ' active' : ''}`} role="tab" aria-selected={tab === 'historial'} aria-controls="solicitudes-historial-panel" onKeyDown={handleTabKeyDown} onClick={() => setTab('historial')}>Historial de solicitudes</button>
      </div>
      <div role="tabpanel" id={`solicitudes-${tab}-panel`} aria-labelledby={`solicitudes-${tab}-tab`}>
      {tab === 'pendientes' ? <>
        {error && <Aviso tipo="error">{error}</Aviso>}
        {loading ? <EstadoCarga loading /> : <>
          <RequestSection title="Trabajo de campo pendiente" requests={fieldWork} kind="fieldWork" idKey="id_trabajo_campo" action={action} onApprove={(id) => decide('fieldWork', id, 'approve')} onReject={(id) => setRejection({ kind: 'fieldWork', id })} />
          <RequestSection title="Vacaciones programadas pendientes" requests={vacations} kind="vacation" idKey="id_solicitud_vacacion" action={action} onApprove={(id) => decide('vacation', id, 'approve')} onReject={(id) => setRejection({ kind: 'vacation', id })} />
        </>}
      </> : <HistorialSolicitudes />}
      </div>
      {rejection && <RejectionReasonDialog onClose={() => setRejection(null)} onConfirm={async (reason) => {
        const succeeded = await decide(rejection.kind, rejection.id, 'reject', reason)
        if (succeeded) setRejection(null)
      }} />}
    </main>
  )
}

function RequestSection({ title, requests, kind, idKey, action, onApprove, onReject }) {
  return <section className="solicitudes-section">
    <div className="solicitudes-section-header"><h2>{title}</h2></div>
    {requests.length === 0 ? <EmptyState message="No tienes solicitudes pendientes." /> : <div className="campo-solicitudes">
      {requests.map((request) => {
        const id = request[idKey]
        const isFieldWork = kind === 'fieldWork'
        return <div key={id} className="campo-solicitud-card">
          <div className="campo-solicitud-info"><div><p className="campo-solicitud-titulo">{isFieldWork ? 'Solicitud de trabajo de campo' : 'Vacaciones programadas'} — {request.usuario?.nombre}<span className="badge badge-yellow">Pendiente</span></p><p className="campo-solicitud-meta">{isFieldWork ? `${request.fecha} · ${request.jornada === 'manana' ? 'Mañana' : 'Tarde'}` : `${request.fecha_inicio}${request.fecha_fin !== request.fecha_inicio ? ` al ${request.fecha_fin}` : ''}`}{request.motivo ? ` · ${request.motivo}` : ''}</p></div></div>
          <div className="campo-solicitud-actions"><button className="btn-rechazar" disabled={action === `${kind}-${id}`} onClick={() => onReject(id)}>Rechazar</button><button className="btn-aceptar" disabled={action === `${kind}-${id}`} onClick={() => onApprove(id)}>Aceptar</button></div>
        </div>
      })}
    </div>}
  </section>
}

const PAGE_SIZE_HISTORIAL = 10

function HistorialSolicitudes() {
  const [busqueda, setBusqueda] = useState('')
  const [page, setPage] = useState(1)
  const [data, setData] = useState({ results: [], count: 0, total_pages: 0 })
  const [loading, setLoading] = useState(true)


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

  // Carga inicial y tras cada cambio de sus dependencias (sincronización con el servidor).
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void loadHistorial() }, [loadHistorial])

  return <>
    <div className="toolbar"><div className="search-wrapper">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
      <input type="text" placeholder="Buscar por nombre, email o motivo..." value={busqueda} onChange={(event) => { setBusqueda(event.target.value); setPage(1) }} />
    </div></div>
    {loading ? <EstadoCarga loading /> : data.results.length === 0 ? <EmptyState message={busqueda ? `Sin resultados para «${busqueda}».` : 'No hay solicitudes en el historial.'} /> : <div className="campo-enviadas-list">
      {data.results.map((request) => <div key={request.id_trabajo_campo} className="campo-enviada-row">
        <div className="campo-enviada-info"><p className="campo-enviada-nombre">{request.usuario?.nombre}</p><p className="campo-enviada-meta">{request.fecha} · {request.jornada === 'manana' ? 'Mañana' : 'Tarde'}{request.motivo ? ` · ${request.motivo}` : ''}</p></div>
        <span className={`badge ${ESTADO_CAMPO_BADGE[request.estado] ?? 'badge-tipo'}`}>{request.estado_label}</span>
      </div>)}
    </div>}
    {data.total_pages > 1 && <div className="paginacion">
      <button className="btn-secondary" disabled={page <= 1} onClick={() => setPage((currentPage) => currentPage - 1)}>Anterior</button>
      <span className="paginacion-info">Página {page} de {data.total_pages}</span>
      <button className="btn-secondary" disabled={page >= data.total_pages} onClick={() => setPage((currentPage) => currentPage + 1)}>Siguiente</button>
    </div>}
  </>
}

function RejectionReasonDialog({ onClose, onConfirm }) {
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')

  async function submit(event) {
    event.preventDefault()
    const trimmedReason = reason.trim()
    if (!trimmedReason) {
      setError('El motivo de rechazo es obligatorio.')
      return
    }
    await onConfirm(trimmedReason)
  }

  return <div role="dialog" aria-label="Rechazar solicitud" aria-modal="true">
    <form onSubmit={submit}>
      <label htmlFor="rejection-reason">Motivo de rechazo</label>
      <textarea id="rejection-reason" value={reason} onChange={(event) => setReason(event.target.value)} />
      {error && <p role="alert">{error}</p>}
      <button type="button" onClick={onClose}>Cancelar</button>
      <button type="submit">Rechazar</button>
    </form>
  </div>
}

function BranchManagerRequestsView() {
  const { perfil } = useAuth()
  const [fieldWork, setFieldWork] = useState([])
  const [vacations, setVacations] = useState([])
  const [coverages, setCoverages] = useState([])
  const [activeSection, setActiveSection] = useState('field-work')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [fieldWorkModalOpen, setFieldWorkModalOpen] = useState(false)
  const [vacationModalOpen, setVacationModalOpen] = useState(false)
  const [coverageAction, setCoverageAction] = useState(null)
  const [coverageRejection, setCoverageRejection] = useState(null)

  const loadRequests = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [fieldWorkResponse, vacationResponse, coverageResponse] = await Promise.all([
        getTrabajosCampo({}),
        getSolicitudesVacacion({}),
        getCoberturas({ estado: 'pendiente' }),
      ])
      setFieldWork((fieldWorkResponse.results ?? []).filter((request) => request.solicitado_por?.id_usuario === perfil?.id))
      setVacations((vacationResponse.results ?? []).filter((request) => request.solicitado_por?.id_usuario === perfil?.id))
      setCoverages((coverageResponse.results ?? []).filter((coverage) => coverage.usuario_reemplazo?.id_usuario === perfil?.id))
    } catch {
      setError(GENERIC_ERROR)
    } finally {
      setLoading(false)
    }
  }, [perfil?.id])

  // Carga inicial y tras cada cambio de sus dependencias (sincronización con el servidor).
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void loadRequests() }, [loadRequests])

  async function cancel(service, id) {
    setError('')
    try {
      await service(id)
      await loadRequests()
    } catch {
      setError(GENERIC_ERROR)
    }
  }

  async function decideCoverage(id, decision, reason) {
    setCoverageAction(id)
    setError('')
    try {
      await (decision === 'accept' ? aceptarCobertura(id) : rechazarCobertura(id, reason))
      await loadRequests()
      return true
    } catch {
      setError(GENERIC_ERROR)
      return false
    } finally {
      setCoverageAction(null)
    }
  }

  function handleSectionTabKeyDown(event) {
    if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return
    event.preventDefault()
    const sections = ['field-work', 'vacations', 'coverages']
    const currentIndex = sections.indexOf(activeSection)
    const offset = event.key === 'ArrowRight' ? 1 : -1
    const nextSection = sections[(currentIndex + offset + sections.length) % sections.length]
    setActiveSection(nextSection)
    event.currentTarget.parentElement?.querySelector(`[data-gs-tab="${nextSection}"]`)?.focus()
  }

  return <main className="tema-analiza tuvet-page solicitudes-pendientes-page">
    <PageHeader title="Solicitudes pendientes" description="Gestioná tu trabajo de campo, vacaciones y coberturas." />
    {error && <Aviso tipo="error">{error}</Aviso>}
    {loading ? <EstadoCarga loading /> : <>
      <div className="sp-request-tabs" role="tablist" aria-label="Tipo de solicitud">
        <button id="gs-field-work-tab" data-gs-tab="field-work" className={activeSection === 'field-work' ? 'active' : ''} role="tab" aria-selected={activeSection === 'field-work'} aria-controls="gs-field-work-panel" onKeyDown={handleSectionTabKeyDown} onClick={() => setActiveSection('field-work')}>Trabajo de campo <span>{fieldWork.length}</span></button>
        <button id="gs-vacations-tab" data-gs-tab="vacations" className={activeSection === 'vacations' ? 'active' : ''} role="tab" aria-selected={activeSection === 'vacations'} aria-controls="gs-vacations-panel" onKeyDown={handleSectionTabKeyDown} onClick={() => setActiveSection('vacations')}>Vacaciones <span>{vacations.length}</span></button>
        <button id="gs-coverages-tab" data-gs-tab="coverages" className={activeSection === 'coverages' ? 'active' : ''} role="tab" aria-selected={activeSection === 'coverages'} aria-controls="gs-coverages-panel" onKeyDown={handleSectionTabKeyDown} onClick={() => setActiveSection('coverages')}>Coberturas <span>{coverages.length}</span></button>
      </div>
      <div role="tabpanel" id={`gs-${activeSection}-panel`} aria-labelledby={`gs-${activeSection}-tab`}>
        {activeSection === 'field-work' && <OwnRequestSection title="Mis solicitudes de trabajo de campo" requests={fieldWork} idKey="id_trabajo_campo" onNew={() => setFieldWorkModalOpen(true)} onCancel={(id) => cancel(cancelarTrabajoCampo, id)} />}
        {activeSection === 'vacations' && <OwnRequestSection title="Vacaciones programadas" requests={vacations} idKey="id_solicitud_vacacion" onNew={() => setVacationModalOpen(true)} onCancel={(id) => cancel(cancelarSolicitudVacacion, id)} />}
        {activeSection === 'coverages' && <CoverageRequestSection requests={coverages} action={coverageAction} onAccept={(id) => decideCoverage(id, 'accept')} onReject={(id) => setCoverageRejection(id)} />}
      </div>
    </>}
    {fieldWorkModalOpen && <TrabajoCampoModal onClose={() => setFieldWorkModalOpen(false)} onSuccess={() => { setFieldWorkModalOpen(false); loadRequests() }} />}
    {vacationModalOpen && <VacacionModal onClose={() => setVacationModalOpen(false)} onSuccess={() => { setVacationModalOpen(false); loadRequests() }} />}
    {coverageRejection && <RejectionReasonDialog onClose={() => setCoverageRejection(null)} onConfirm={async (reason) => {
      const succeeded = await decideCoverage(coverageRejection, 'reject', reason)
      if (succeeded) setCoverageRejection(null)
    }} />}
  </main>
}

function OwnRequestSection({ title, requests, idKey, onNew, onCancel }) {
  const [filter, setFilter] = useState('all')
  const [visibleCount, setVisibleCount] = useState(OWN_REQUEST_PAGE_SIZE)
  const counts = requests.reduce((summary, request) => {
    const status = requestStatus(request)
    if (status in summary) summary[status] += 1
    return summary
  }, { pending: 0, accepted: 0, cancelled: 0 })
  const filteredRequests = filter === 'all' ? requests : requests.filter((request) => requestStatus(request) === filter)
  const visibleRequests = filteredRequests.slice(0, visibleCount)

  function selectFilter(nextFilter) {
    setFilter(nextFilter)
    setVisibleCount(OWN_REQUEST_PAGE_SIZE)
  }

  return <section className="solicitudes-section"><div className="solicitudes-section-header"><h2>{title}</h2><button className="btn-primary" onClick={onNew}>Nueva solicitud</button></div>
    <div className="sp-status-filters" aria-label={`Filtrar ${title} por estado`}>
      {OWN_REQUEST_STATUSES.map(([status, label]) => {
        const count = status === 'all' ? requests.length : counts[status]
        return <button key={status} type="button" aria-pressed={filter === status} className={filter === status ? 'active' : ''} onClick={() => selectFilter(status)}>{label} ({count})</button>
      })}
    </div>
    {requests.length === 0 ? <EmptyState message="No has enviado solicitudes." /> : filteredRequests.length === 0 ? <EmptyState message="No hay solicitudes con este estado." /> : <><div className="campo-enviadas-list">{visibleRequests.map((request) => {
      const status = requestStatus(request)
      return <div key={request[idKey]} className={`campo-enviada-row ${status === 'pending' ? 'is-pending' : 'is-muted'}`}><div className="campo-enviada-info"><p className="campo-enviada-nombre">{requestDateLabel(request)}</p><p className="campo-enviada-meta">{request.motivo || 'Sin motivo indicado'}</p></div><div className="campo-enviada-actions"><span className={`badge ${ESTADO_CAMPO_BADGE[request.estado] ?? 'badge-tipo'}`}>{request.estado_label}</span>{status === 'pending' && <button className="campo-cancel-btn" aria-label="Cancelar solicitud" title="Cancelar solicitud" onClick={() => onCancel(request[idKey])}><Icono nombre="cerrar" /></button>}</div></div>
    })}</div>{visibleCount < filteredRequests.length && <button type="button" className="sp-show-more" onClick={() => setVisibleCount((count) => count + OWN_REQUEST_PAGE_SIZE)}>Ver más</button>}</>}
  </section>
}

function CoverageRequestSection({ requests, action, onAccept, onReject }) {
  return <section className="solicitudes-section">
    <div className="solicitudes-section-header"><h2>Coberturas pendientes</h2></div>
    {requests.length === 0 ? <EmptyState message="No tienes coberturas pendientes." /> : <div className="campo-solicitudes">
      {requests.map((coverage) => {
        const id = coverage.id_cobertura
        return <div key={id} className="campo-solicitud-card">
          <div className="campo-solicitud-info"><div><p className="campo-solicitud-titulo">Cobertura en {coverage.sucursal_destino?.nombre ?? 'sucursal asignada'}<span className="badge badge-yellow">Pendiente de tu aceptación</span></p><p className="campo-solicitud-meta">{coverage.fecha}{coverage.jornada_label ? ` · ${coverage.jornada_label}` : ''}{coverage.motivo ? ` · ${coverage.motivo}` : ''}</p></div></div>
          <div className="campo-solicitud-actions"><button className="btn-rechazar" disabled={action === id} onClick={() => onReject(id)}>Rechazar</button><button className="btn-aceptar" disabled={action === id} onClick={() => onAccept(id)}>Aceptar</button></div>
        </div>
      })}
    </div>}
  </section>
}

function EmptyState({ message }) {
  return <div className="sp-empty-state"><Icono nombre="vacio" /><p>{message}</p></div>
}
