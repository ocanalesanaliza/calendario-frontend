import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../../auth/context/AuthContext'
import { getProfileCapabilities } from '../../auth/profilePolicies'
import { createIdempotencyKey } from '../../calendarArea/services/calendarAreaApi'
import { actOnGAVacationRequest, createGAVacationRequest, getGAVacationRequests } from '../../calendarArea/services/gaVacationRequestsService'
import './AusenciasAreaPage.css'

const slots = [['full_day', 'Jornada completa'], ['morning', 'Mañana'], ['afternoon', 'Tarde']]
const records = (data) => Array.isArray(data) ? data : data?.results ?? data?.items ?? []
const idOf = (item) => item?.id ?? item?.id_request ?? item?.id_vacation_request
const status = (item) => item?.status ?? item?.estado ?? 'pending'
const isPending = (item) => ['pending', 'pendiente'].includes(status(item))
const errorText = (error, fallback) => error?.status === 409 ? 'La información cambió o entra en conflicto. Revisa el listado e inténtalo de nuevo.' : error?.message || fallback

function Modal({ title, children, onClose }) {
  const dialogRef = useRef(null)
  useEffect(() => { dialogRef.current?.querySelector('[data-autofocus]')?.focus() }, [])
  return <div className="ausencias-modal-backdrop"><section ref={dialogRef} className="ausencias-modal" role="dialog" aria-modal="true" aria-labelledby="ausencias-modal-title"><header><h2 id="ausencias-modal-title">{title}</h2><button type="button" aria-label="Cerrar" onClick={onClose}>×</button></header>{children}</section></div>
}

function VacationForm({ onClose, onSubmit }) {
  const [segments, setSegments] = useState([{ date: '', slot: 'full_day' }])
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const update = (index, field, value) => setSegments((current) => current.map((segment, i) => i === index ? { ...segment, [field]: value } : segment))
  async function submit(event) {
    event.preventDefault()
    if (segments.some((segment) => !segment.date)) return setError('Cada segmento requiere una fecha.')
    setSaving(true); setError('')
    try { await onSubmit({ segments, ...(reason.trim() ? { reason: reason.trim() } : {}) }, createIdempotencyKey()); onClose() } catch (requestError) { setError(errorText(requestError, 'No se pudo crear la solicitud.')) } finally { setSaving(false) }
  }
  return <Modal title="Nueva solicitud de vacaciones" onClose={onClose}><form onSubmit={submit}>{segments.map((segment, index) => <fieldset key={index}><legend>Segmento {index + 1}</legend><label>Fecha<input data-autofocus={index === 0 ? true : undefined} type="date" value={segment.date} onChange={(event) => update(index, 'date', event.target.value)} disabled={saving} required /></label><label>Jornada<select value={segment.slot} onChange={(event) => update(index, 'slot', event.target.value)} disabled={saving}>{slots.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>{segments.length > 1 && <button type="button" onClick={() => setSegments((current) => current.filter((_, i) => i !== index))}>Quitar segmento</button>}</fieldset>)}<button type="button" onClick={() => setSegments((current) => [...current, { date: '', slot: 'full_day' }])} disabled={saving}>Agregar fecha</button><label>Motivo <span>(opcional)</span><textarea value={reason} onChange={(event) => setReason(event.target.value)} disabled={saving} /></label>{error && <p role="alert">{error}</p>}<footer><button type="button" onClick={onClose} disabled={saving}>Cancelar</button><button type="submit" disabled={saving}>{saving ? 'Enviando...' : 'Solicitar vacaciones'}</button></footer></form></Modal>
}

function ResolveForm({ request, action, onClose, onSubmit }) {
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  async function submit(event) { event.preventDefault(); setSaving(true); try { await onSubmit(idOf(request), action, { reason: reason.trim() }, createIdempotencyKey()); onClose() } finally { setSaving(false) } }
  return <Modal title={action === 'approve' ? 'Aprobar vacaciones' : 'Rechazar vacaciones'} onClose={onClose}><form onSubmit={submit}><label>Motivo<textarea data-autofocus value={reason} onChange={(event) => setReason(event.target.value)} disabled={saving} required={action === 'reject'} /></label><footer><button type="button" onClick={onClose} disabled={saving}>Cancelar</button><button type="submit" disabled={saving}>{action === 'approve' ? 'Aprobar' : 'Rechazar'}</button></footer></form></Modal>
}

export default function AusenciasAreaPage() {
  const { perfil } = useAuth()
  const { isAreaManager, canManageAreaAbsences } = getProfileCapabilities(perfil)
  const [vacations, setVacations] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  async function load() { setLoading(true); try { setVacations(records(await getGAVacationRequests())) } finally { setLoading(false) } }
  useEffect(() => { void load() }, [])
  async function command(command, ...args) { await command(...args); await load() }
  return <section className="ausencias-area-page"><header className="page-header"><div><h1>Vacaciones y situaciones del área</h1><p>{isAreaManager ? 'Gestiona tus solicitudes de vacaciones.' : 'Resuelve vacaciones de gerentes de área.'}</p></div>{isAreaManager && <button onClick={() => setModal({ type: 'vacation' })}>Nueva solicitud</button>}</header>{loading ? <p role="status">Cargando ausencias...</p> : <section><h2>{isAreaManager ? 'Mis solicitudes' : 'Solicitudes de vacaciones'}</h2>{vacations.length === 0 ? <p>No hay solicitudes de vacaciones.</p> : <table><thead><tr><th>Fecha</th><th>Segmentos</th><th>Motivo</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>{vacations.map((request) => <tr key={idOf(request)}><td>{request.date ?? request.fecha ?? '—'}</td><td>{(request.segments ?? request.segmentos ?? []).map((segment) => `${segment.date ?? segment.fecha} · ${slots.find(([value]) => value === (segment.slot ?? segment.jornada))?.[1] ?? '—'}`).join(', ') || '—'}</td><td>{request.reason ?? request.motivo ?? '—'}</td><td>{status(request)}</td><td>{isAreaManager && isPending(request) ? <button onClick={() => command(actOnGAVacationRequest, idOf(request), 'cancel', { reason: '' }, createIdempotencyKey())}>Cancelar</button> : canManageAreaAbsences && isPending(request) ? <><button onClick={() => setModal({ type: 'resolve', action: 'approve', request })}>Aprobar</button><button onClick={() => setModal({ type: 'resolve', action: 'reject', request })}>Rechazar</button></> : '—'}</td></tr>)}</tbody></table>}</section>}{modal?.type === 'vacation' && <VacationForm onClose={() => setModal(null)} onSubmit={(body, key) => command(createGAVacationRequest, body, key)} />}{modal?.type === 'resolve' && <ResolveForm request={modal.request} action={modal.action} onClose={() => setModal(null)} onSubmit={(...args) => command(actOnGAVacationRequest, ...args)} />}</section>
}
