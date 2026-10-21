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
import TrabajoCampoModal from '../components/TrabajoCampoModal'
import VacacionModal from '../../vacacionesProgramadas/components/VacacionModal'
import './SolicitudesPendientesPage.css'

const GENERIC_ERROR = 'No se pudieron cargar las solicitudes. Intenta nuevamente.'
const ESTADO_CAMPO_BADGE = {
  pendiente: 'badge-yellow',
  aceptado: 'badge-green',
  rechazado: 'badge-red',
  cancelado: 'badge-tipo',
  vencida: 'badge-orange',
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

  useEffect(() => { loadRequests() }, [loadRequests])

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

  return (
    <div className="solicitudes-pendientes-page">
      <div className="page-header"><div><h1>Solicitudes pendientes</h1><p>Trabajo de campo y vacaciones programadas que te han solicitado</p></div></div>
      <div className="tab-bar">
        <button className={`tab-btn${tab === 'pendientes' ? ' active' : ''}`} onClick={() => setTab('pendientes')}>Pendientes</button>
        <button className={`tab-btn${tab === 'historial' ? ' active' : ''}`} onClick={() => setTab('historial')}>Historial de solicitudes</button>
      </div>
      {tab === 'pendientes' ? <>
        {error && <p role="alert">{error}</p>}
        {loading ? <Loading /> : <>
          <RequestSection title="Trabajo de campo pendiente" requests={fieldWork} kind="fieldWork" idKey="id_trabajo_campo" action={action} onApprove={(id) => decide('fieldWork', id, 'approve')} onReject={(id) => setRejection({ kind: 'fieldWork', id })} />
          <RequestSection title="Vacaciones programadas pendientes" requests={vacations} kind="vacation" idKey="id_solicitud_vacacion" action={action} onApprove={(id) => decide('vacation', id, 'approve')} onReject={(id) => setRejection({ kind: 'vacation', id })} />
        </>}
      </> : <HistorialSolicitudes />}
      {rejection && <RejectionReasonDialog onClose={() => setRejection(null)} onConfirm={async (reason) => {
        const succeeded = await decide(rejection.kind, rejection.id, 'reject', reason)
        if (succeeded) setRejection(null)
      }} />}
    </div>
  )
}

function RequestSection({ title, requests, kind, idKey, action, onApprove, onReject }) {
  return <section className="solicitudes-section">
    <div className="solicitudes-section-header"><h2>{title}</h2></div>
    {requests.length === 0 ? <div className="empty-state">No tienes solicitudes pendientes.</div> : <div className="campo-solicitudes">
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

  return <>
    <div className="toolbar"><div className="search-wrapper">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
      <input type="text" placeholder="Buscar por nombre, email o motivo..." value={busqueda} onChange={(event) => setBusqueda(event.target.value)} />
    </div></div>
    {loading ? <Loading /> : data.results.length === 0 ? <div className="empty-state">No hay solicitudes en el historial.</div> : <div className="campo-enviadas-list">
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
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [fieldWorkModalOpen, setFieldWorkModalOpen] = useState(false)
  const [vacationModalOpen, setVacationModalOpen] = useState(false)

  const loadRequests = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [fieldWorkResponse, vacationResponse] = await Promise.all([getTrabajosCampo({}), getSolicitudesVacacion({})])
      setFieldWork((fieldWorkResponse.results ?? []).filter((request) => request.solicitado_por?.id_usuario === perfil?.id))
      setVacations((vacationResponse.results ?? []).filter((request) => request.solicitado_por?.id_usuario === perfil?.id))
    } catch {
      setError(GENERIC_ERROR)
    } finally {
      setLoading(false)
    }
  }, [perfil?.id])

  useEffect(() => { loadRequests() }, [loadRequests])

  async function cancel(service, id) {
    setError('')
    try {
      await service(id)
      await loadRequests()
    } catch {
      setError(GENERIC_ERROR)
    }
  }

  return <div className="solicitudes-pendientes-page">
    <div className="page-header"><div><h1>Solicitudes pendientes</h1><p>Tu trabajo de campo y vacaciones programadas</p></div></div>
    {error && <p role="alert">{error}</p>}
    {loading ? <Loading /> : <>
      <OwnRequestSection title="Mis solicitudes de trabajo de campo" requests={fieldWork} idKey="id_trabajo_campo" onNew={() => setFieldWorkModalOpen(true)} onCancel={(id) => cancel(cancelarTrabajoCampo, id)} />
      <OwnRequestSection title="Vacaciones programadas" requests={vacations} idKey="id_solicitud_vacacion" onNew={() => setVacationModalOpen(true)} onCancel={(id) => cancel(cancelarSolicitudVacacion, id)} />
    </>}
    {fieldWorkModalOpen && <TrabajoCampoModal onClose={() => setFieldWorkModalOpen(false)} onSuccess={() => { setFieldWorkModalOpen(false); loadRequests() }} />}
    {vacationModalOpen && <VacacionModal onClose={() => setVacationModalOpen(false)} onSuccess={() => { setVacationModalOpen(false); loadRequests() }} />}
  </div>
}

function OwnRequestSection({ title, requests, idKey, onNew, onCancel }) {
  return <section className="solicitudes-section"><div className="solicitudes-section-header"><h2>{title}</h2><button className="btn-primary" onClick={onNew}>Nueva solicitud</button></div>
    {requests.length === 0 ? <div className="empty-state">No has enviado solicitudes.</div> : <div className="campo-enviadas-list">{requests.map((request) => <div key={request[idKey]} className="campo-enviada-row"><div className="campo-enviada-info"><p className="campo-enviada-nombre">{request.fecha ?? request.fecha_inicio}</p><p className="campo-enviada-meta">{request.motivo || 'Sin motivo indicado'}</p></div><span className="badge">{request.estado_label}</span>{request.estado === 'pendiente' && <button className="campo-cancel-btn" aria-label="Cancelar solicitud" title="Cancelar solicitud" onClick={() => onCancel(request[idKey])}>✕</button>}</div>)}</div>}
  </section>
}

function Loading() {
  return <div className="loading-state"><div className="loading-bar"><div className="loading-bar-fill" /></div><span>Cargando...</span></div>
}
