import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../../auth/context/AuthContext'
import { getProfileCapabilities } from '../../auth/profilePolicies'
import { createIdempotencyKey } from '../../calendarArea/services/calendarAreaApi'
import { actOnGAVacationRequest, createGAVacationRequest, getGAVacationRequests } from '../../calendarArea/services/gaVacationRequestsService'
import { createGASpecialSituation, deactivateGASpecialSituation, getCatalog, getGASpecialSituations } from '../../calendarArea/services/gaSpecialSituationsService'
import './AusenciasAreaPage.css'

const slots = [['full_day', 'Jornada completa'], ['morning', 'Mañana'], ['afternoon', 'Tarde']]
const records = (data) => Array.isArray(data) ? data : data?.results ?? data?.items ?? []
const idOf = (item) => item?.id ?? item?.id_request ?? item?.id_vacation_request ?? item?.id_ga_special_situation
const errorText = (error, fallback) => {
  if (error?.status === 403) return 'No tienes permisos para realizar esta acción. El servidor mantiene la autorización.'
  if (error?.status === 409) return 'La información cambió o entra en conflicto. Revisa el listado e inténtalo de nuevo.'
  if (error?.status === 400) return `Revisa los datos enviados. ${error.message || ''}`.trim()
  return error?.message || fallback
}
const invalidatesCommandKey = (error) => [400, 403, 409].includes(error?.status)
const rawStatus = (item) => String(item?.state ?? item?.status ?? item?.estado ?? 'pending').trim().toLowerCase()
const status = (item) => ({ accepted: 'approved', aceptada: 'approved', aceptado: 'approved', aprobada: 'approved', aprobado: 'approved' }[rawStatus(item)] ?? rawStatus(item))
const dateOf = (item) => item?.date ?? item?.fecha ?? item?.created_at?.slice(0, 10) ?? '—'
const reasonOf = (item) => item?.reason ?? item?.motivo ?? '—'
const isPending = (item) => ['pending', 'pendiente'].includes(status(item))
const statusLabel = (item) => ({ pending: 'Pendiente', pendiente: 'Pendiente', approved: 'Aprobada', rejected: 'Rechazada', rechazada: 'Rechazada', cancelled: 'Cancelada', cancelada: 'Cancelada' }[status(item)] ?? status(item))
const gaOf = (item) => item?.gerente_area ?? item?.area_manager ?? item?.ga
const gaId = (item) => gaOf(item)?.id ?? gaOf(item)?.id_gerente_area ?? item?.gerente_area_id
const gaName = (item) => gaOf(item)?.nombre ?? gaOf(item)?.name ?? item?.gerente_area_nombre ?? `GA #${gaId(item)}`
const typeOf = (item) => item?.type ?? item?.tipo
const slotLabel = (slot) => slots.find(([value]) => value === slot)?.[1] ?? slot ?? '—'
const vacationSegmentsOf = (request) => request?.segments ?? request?.segmentos ?? []
const segmentDateOf = (segment) => segment?.date ?? segment?.fecha
const localizedDate = (date) => {
  const match = String(date ?? '').match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!match) return date || '—'
  const [, year, month, day] = match
  return new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(year, Number(month) - 1, day)))
}
const localizedDateRange = (startDate, endDate) => {
  const start = String(startDate).match(/^(\d{4})-(\d{2})-(\d{2})/)
  const end = String(endDate).match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!start || !end) return `Del ${localizedDate(startDate)} al ${localizedDate(endDate)}`
  const [, startYear, startMonth, startDay] = start
  const [, endYear, endMonth, endDay] = end
  if (startYear === endYear && startMonth === endMonth) return `Del ${Number(startDay)} al ${localizedDate(endDate)}`
  if (startYear === endYear) return `Del ${localizedDate(startDate).replace(` de ${startYear}`, '')} al ${localizedDate(endDate)}`
  return `Del ${localizedDate(startDate)} al ${localizedDate(endDate)}`
}
const vacationReasonOf = (request) => String(request?.reason ?? request?.motivo ?? '').trim() || 'Sin motivo especificado'
const vacationDateOf = (request) => {
  const segmentDates = vacationSegmentsOf(request).map(segmentDateOf).filter(Boolean)
  return request?.date ?? request?.fecha ?? (segmentDates.join(', ') || request?.created_at?.slice(0, 10) || '—')
}
const vacationPeriodOf = (request) => {
  const segments = vacationSegmentsOf(request)
    .map((segment) => ({ date: segmentDateOf(segment), slot: segment.slot ?? segment.jornada }))
    .filter((segment) => segment.date)
  if (!segments.length) return [localizedDate(vacationDateOf(request)), request?.slot ?? request?.jornada].filter(Boolean).map((value, index) => index === 0 ? value : slotLabel(value)).join(' · ') || '—'

  const ordered = [...segments].sort((a, b) => a.date.localeCompare(b.date))
  const isFullDayRange = ordered.length > 1
    && ordered.every((segment) => segment.slot === 'full_day')
    && ordered.every((segment, index) => index === 0 || segment.date === nextDate(ordered[index - 1].date))
  if (isFullDayRange) return `${localizedDateRange(ordered[0].date, ordered.at(-1).date)} · Jornada completa`

  return ordered.map((segment) => `${localizedDate(segment.date)} · ${slotLabel(segment.slot)}`).join(', ')
}
const nextDate = (date) => {
  let [year, month, day] = date.split('-').map(Number)
  const daysInMonth = [31, year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  day += 1
  if (day > daysInMonth[month - 1]) {
    day = 1
    month += 1
    if (month > 12) {
      month = 1
      year += 1
    }
  }
  return [year, String(month).padStart(2, '0'), String(day).padStart(2, '0')].join('-')
}
const inclusiveRange = (startDate, endDate) => {
  const dates = []
  for (let date = startDate; date <= endDate; date = nextDate(date)) dates.push(date)
  return dates
}
const specialSituationRangeError = (startDate, endDate) => {
  if (!startDate || !endDate) return ''
  if (endDate < startDate) return 'La fecha de fin no puede ser anterior a la fecha de inicio.'
  if (inclusiveRange(startDate, endDate).length > 31) return 'El rango no puede superar 31 días, incluidos ambos extremos.'
  return ''
}

function Modal({ title, children, onClose, className = '' }) {
  const dialogRef = useRef(null)
  const previous = useRef(null)

  useEffect(() => {
    previous.current = document.activeElement
    dialogRef.current?.querySelector('[data-autofocus]')?.focus()
    return () => previous.current?.focus()
  }, [])

  function keyDown(event) {
    if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
      return
    }
    if (event.key !== 'Tab') return

    const nodes = [...dialogRef.current.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])')]
    const first = nodes[0]
    const last = nodes.at(-1)
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last?.focus()
    }
    if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first?.focus()
    }
  }

  return (
    <div className="ausencias-modal-backdrop">
      <section ref={dialogRef} className={`ausencias-modal ${className}`.trim()} role="dialog" aria-modal="true" aria-labelledby="ausencias-modal-title" tabIndex="-1" onKeyDown={keyDown}>
        <header>
          <h2 id="ausencias-modal-title">{title}</h2>
          <button type="button" aria-label="Cerrar" onClick={onClose}>×</button>
        </header>
        {children}
      </section>
    </div>
  )
}

function VacationForm({ onClose, onConflict, onSubmit }) {
  const idempotencyKey = useRef(null)
  const [segments, setSegments] = useState([{ date: '', slot: 'full_day' }])
  const [range, setRange] = useState({ startDate: '', endDate: '', slot: 'full_day' })
  const [advanced, setAdvanced] = useState(false)
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const isRange = Boolean(range.endDate)
  const summary = range.startDate
    ? isRange ? `Del ${range.startDate} al ${range.endDate}` : range.startDate
    : 'Selecciona una fecha para ver el resumen.'

  function update(index, field, value) {
    setSegments((current) => current.map((segment, i) => i === index ? { ...segment, [field]: value } : segment))
  }

  async function submit(event) {
    event.preventDefault()
    setError('')
    if (!advanced && !range.startDate) {
      setError('La fecha de inicio es obligatoria.')
      return
    }
    if (!advanced && isRange && range.endDate < range.startDate) {
      setError('La fecha de fin no puede ser anterior a la fecha de inicio.')
      return
    }
    if (advanced && segments.some((segment) => !segment.date)) {
      setError('Cada segmento requiere una fecha.')
      return
    }
    const requestSegments = advanced
      ? segments
      : isRange
        ? inclusiveRange(range.startDate, range.endDate).map((date) => ({ date, slot: 'full_day' }))
        : [{ date: range.startDate, slot: range.slot }]
    setSaving(true)
    try {
      idempotencyKey.current ??= createIdempotencyKey()
      await onSubmit({ segments: requestSegments, ...(reason.trim() ? { reason: reason.trim() } : {}) }, idempotencyKey.current)
      onClose()
    } catch (requestError) {
      if (invalidatesCommandKey(requestError)) {
        idempotencyKey.current = null
        if (requestError.status === 409) await onConflict()
      }
      setError(errorText(requestError, 'No se pudo crear la solicitud.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="Nueva solicitud de vacaciones" onClose={onClose} className="ausencias-vacation-modal">
      <form className="ausencias-vacation-form" onSubmit={submit}>
        {advanced ? (
          <>
            <p className="ausencias-vacation-form__hint">Añade las fechas y jornadas que necesites, incluso si no son consecutivas.</p>
            {segments.map((segment, index) => (
              <fieldset key={index}>
                <legend>Segmento {index + 1}</legend>
                <label>Fecha<input data-autofocus={index === 0 ? true : undefined} type="date" value={segment.date} onChange={(event) => update(index, 'date', event.target.value)} disabled={saving} required /></label>
                <label>Jornada<select value={segment.slot} onChange={(event) => update(index, 'slot', event.target.value)} disabled={saving}>{slots.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                {segments.length > 1 && <button type="button" onClick={() => setSegments((current) => current.filter((_, i) => i !== index))} disabled={saving}>Quitar segmento</button>}
              </fieldset>
            ))}
            <button className="ausencias-vacation-form__mode" type="button" onClick={() => setSegments((current) => [...current, { date: '', slot: 'full_day' }])} disabled={saving}>Agregar fecha</button>
            <button className="ausencias-vacation-form__mode" type="button" onClick={() => setAdvanced(false)} disabled={saving}>Volver al formulario de rango</button>
          </>
        ) : (
          <>
            <div className="ausencias-vacation-form__range">
              <label>Fecha de inicio<input data-autofocus type="date" value={range.startDate} onChange={(event) => setRange((current) => ({ ...current, startDate: event.target.value }))} disabled={saving} required /></label>
              <label>Fecha de fin (opcional)<input type="date" value={range.endDate} onChange={(event) => setRange((current) => ({ ...current, endDate: event.target.value }))} disabled={saving} aria-describedby={isRange ? 'vacation-range-note' : undefined} /></label>
            </div>
            {isRange ? <p id="vacation-range-note" className="ausencias-vacation-form__hint">El rango se solicitará por jornadas completas.</p> : <label>Jornada<select value={range.slot} onChange={(event) => setRange((current) => ({ ...current, slot: event.target.value }))} disabled={saving}>{slots.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>}
            <p className="ausencias-vacation-form__summary" aria-live="polite"><strong>Resumen:</strong> {summary}</p>
            <button className="ausencias-vacation-form__mode" type="button" onClick={() => setAdvanced(true)} disabled={saving}>¿Necesitas fechas o jornadas no consecutivas?</button>
          </>
        )}
        <label>Motivo <span>(opcional)</span><textarea value={reason} onChange={(event) => setReason(event.target.value)} disabled={saving} /></label>
        {error && <p role="alert">{error}</p>}
        <footer><button type="button" onClick={onClose} disabled={saving}>Cancelar</button><button type="submit" disabled={saving}>{saving ? 'Enviando...' : 'Solicitar vacaciones'}</button></footer>
      </form>
    </Modal>
  )
}

function ResolveForm({ request, action, onClose, onConflict, onSubmit }) {
  const idempotencyKey = useRef(null)
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function submit(event) {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      idempotencyKey.current ??= createIdempotencyKey()
      await onSubmit(idOf(request), action, { reason: reason.trim() }, idempotencyKey.current)
      onClose()
    } catch (requestError) {
      if (invalidatesCommandKey(requestError)) {
        idempotencyKey.current = null
        if (requestError.status === 409) await onConflict()
      }
      setError(errorText(requestError, 'No se pudo actualizar la solicitud.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={action === 'approve' ? 'Aprobar vacaciones' : 'Rechazar vacaciones'} onClose={onClose}>
      <form onSubmit={submit}>
        <label>Motivo<textarea data-autofocus value={reason} onChange={(event) => setReason(event.target.value)} disabled={saving} required={action === 'reject'} /></label>
        {error && <p role="alert">{error}</p>}
        <footer><button type="button" onClick={onClose} disabled={saving}>Cancelar</button><button type="submit" disabled={saving}>{saving ? 'Guardando...' : action === 'approve' ? 'Aprobar' : 'Rechazar'}</button></footer>
      </form>
    </Modal>
  )
}

function Confirmation({ title, message, confirmLabel, onClose, onConflict, onConfirm }) {
  const idempotencyKey = useRef(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function confirm() {
    setSaving(true)
    setError('')
    try {
      idempotencyKey.current ??= createIdempotencyKey()
      await onConfirm(idempotencyKey.current)
      onClose()
    } catch (requestError) {
      if (invalidatesCommandKey(requestError)) {
        idempotencyKey.current = null
        if (requestError.status === 409) await onConflict()
      }
      setError(errorText(requestError, 'No se pudo completar la acción.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={title} onClose={onClose}>
      <p>{message}</p>
      {error && <p role="alert">{error}</p>}
      <button data-autofocus disabled={saving} onClick={confirm}>{saving ? 'Guardando...' : confirmLabel}</button>
      <button disabled={saving} onClick={onClose}>Volver</button>
    </Modal>
  )
}

function SituationForm({ catalog, catalogError, catalogLoading, onCatalogDateChange, onCatalogRetry, onClose, onConflict, onSubmit }) {
  const idempotencyKey = useRef(null)
  const [form, setForm] = useState({ gerente_area_id: '', date: '', end_date: '', type: '', reason: '', slot: 'full_day' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const candidates = catalog?.area_managers ?? []
  const types = catalog?.types ?? []
  const catalogSlots = catalog?.slots ?? []
  const ready = !catalogLoading && !catalogError && candidates.length > 0 && types.length > 0 && catalogSlots.length > 0
  const set = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }))
  function setDate(event) {
    const date = event.target.value
    setForm((current) => ({ ...current, date, gerente_area_id: '' }))
    if (!specialSituationRangeError(date, form.end_date)) onCatalogDateChange(date || undefined, form.end_date || undefined)
  }
  function setEndDate(event) {
    const endDate = event.target.value
    setForm((current) => ({ ...current, end_date: endDate, gerente_area_id: '' }))
    if (form.date && !specialSituationRangeError(form.date, endDate)) onCatalogDateChange(form.date, endDate || undefined)
  }

  async function submit(event) {
    event.preventDefault()
    if (!ready) return
    const rangeError = specialSituationRangeError(form.date, form.end_date)
    if (rangeError) {
      setError(rangeError)
      return
    }
    setSaving(true)
    setError('')
    try {
      idempotencyKey.current ??= createIdempotencyKey()
      const { end_date: endDate, ...dailyBody } = form
      await onSubmit({ ...dailyBody, ...(endDate ? { end_date: endDate } : {}) }, idempotencyKey.current)
      onClose()
    } catch (requestError) {
      if (invalidatesCommandKey(requestError)) {
        idempotencyKey.current = null
        if (requestError.status === 409) await onConflict()
      }
      setError(errorText(requestError, 'No se pudo crear la situación.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="Nueva situación especial de GA" onClose={onClose} className="ausencias-area-admin-situation-modal">
      <form className="ausencias-area-admin-situation-form" onSubmit={submit}>
        {catalogLoading && <p role="status">Cargando catálogo de situaciones...</p>}
        {catalogError && <div role="alert"><p>{catalogError}</p><button type="button" onClick={() => onCatalogRetry(form.date || undefined, form.end_date || undefined)} disabled={saving}>Reintentar</button></div>}
        {!catalogLoading && !catalogError && !ready && <p role="alert">No hay opciones disponibles para crear una situación en esta fecha.</p>}
        <label>Gerente de área<select data-autofocus value={form.gerente_area_id} onChange={set('gerente_area_id')} disabled={saving || !ready} required><option value="">Seleccionar GA</option>{candidates.map((ga) => <option key={ga.id} value={ga.id}>{ga.display_name}</option>)}</select></label>
        <label>Fecha<input type="date" value={form.date} onChange={setDate} disabled={saving} required /></label>
        <label>Fecha fin <span>(opcional)</span><input type="date" value={form.end_date} onChange={setEndDate} disabled={saving} /></label>
        <label>Tipo existente<select value={form.type} onChange={set('type')} disabled={saving || !ready} required><option value="">Seleccionar tipo</option>{types.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select></label>
        <label>Razón<textarea value={form.reason} onChange={set('reason')} disabled={saving || !ready} required /></label>
        <label>Jornada<select value={form.slot} onChange={set('slot')} disabled={saving || !ready}>{catalogSlots.map((slot) => <option key={slot.value} value={slot.value}>{slotLabel(slot.value)}</option>)}</select></label>
        {error && <p role="alert">{error}</p>}
        <footer><button type="button" onClick={onClose} disabled={saving}>Cancelar</button><button type="submit" disabled={saving || !ready}>{saving ? 'Creando...' : 'Crear situación'}</button></footer>
      </form>
    </Modal>
  )
}

export default function AusenciasAreaPage() {
  const { perfil } = useAuth()
  const { isAreaManager, canManageAreaAbsences } = getProfileCapabilities(perfil)
  const [vacations, setVacations] = useState([])
  const [situations, setSituations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  const [modal, setModal] = useState(null)
  const [catalog, setCatalog] = useState(null)
  const [catalogLoading, setCatalogLoading] = useState(canManageAreaAbsences)
  const [catalogError, setCatalogError] = useState('')
  const catalogRequest = useRef(0)

  async function loadCatalog(date, endDate) {
    if (!canManageAreaAbsences) return
    const request = ++catalogRequest.current
    setCatalogLoading(true)
    setCatalogError('')
    try {
      const nextCatalog = endDate ? await getCatalog(date, endDate) : await getCatalog(date)
      if (request !== catalogRequest.current) return
      setCatalog(nextCatalog)
    } catch (requestError) {
      if (request !== catalogRequest.current) return
      setCatalog(null)
      setCatalogError(errorText(requestError, 'No se pudo cargar el catálogo de situaciones especiales.'))
    } finally {
      if (request === catalogRequest.current) setCatalogLoading(false)
    }
  }

  async function load() {
    setLoading(true)
    setError('')
    try {
      const [requests, special] = await Promise.all([getGAVacationRequests(), canManageAreaAbsences ? getGASpecialSituations() : Promise.resolve([])])
      setVacations(records(requests))
      setSituations(records(special))
    } catch (requestError) {
      setError(errorText(requestError, 'No se pudieron cargar las ausencias.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    void loadCatalog()
  }, [retry, canManageAreaAbsences])

  async function command(command, ...args) {
    await command(...args)
    await load()
  }

  async function refreshAfterConflict() {
    await Promise.all([load(), canManageAreaAbsences ? loadCatalog() : Promise.resolve()])
  }

  function renderContent() {
    if (error) return <div role="alert" className={canManageAreaAbsences ? 'ausencias-area-admin-state ausencias-area-admin-state--error' : undefined}><p>{error}</p><button className={canManageAreaAbsences ? 'ausencias-area-admin-state__retry' : undefined} onClick={() => setRetry((value) => value + 1)}>Reintentar</button></div>
    if (loading) return <p role="status" className={canManageAreaAbsences ? 'ausencias-area-admin-state' : undefined}>Cargando ausencias...</p>

    return (
      <>
        <section className="ausencias-area-section">
          <h2>{isAreaManager ? 'Mis solicitudes' : 'Solicitudes de vacaciones'}</h2>
          {vacations.length === 0 ? <p className={canManageAreaAbsences ? 'ausencias-area-admin-state ausencias-area-admin-state--empty' : undefined}>No hay solicitudes de vacaciones.</p> : (
            isAreaManager ? (
              <div className="ausencias-area-request-list">
                {vacations.map((request) => (
                  <article key={idOf(request)} className="ausencias-area-request-card">
                    <div className="ausencias-area-request-card__header">
                      <div className="ausencias-area-request-card__summary">
                        <div className="ausencias-area-request-card__title-row">
                          <h3>Solicitud de vacaciones</h3>
                          <span>{dateOf(request)}</span>
                        </div>
                        <p><span>{(request.segments ?? request.segmentos ?? []).map((segment) => `${segment.date ?? segment.fecha} · ${slotLabel(segment.slot ?? segment.jornada)}`).join(', ') || '—'}</span><span>{reasonOf(request)}</span></p>
                      </div>
                      <span className="ausencias-area-status-badge">{statusLabel(request)}</span>
                      {isPending(request) && <button className="ausencias-area-request-card__cancel" type="button" aria-label="Cancelar solicitud" title="Cancelar solicitud" onClick={() => setModal({ type: 'cancel', request })}><span aria-hidden="true">×</span></button>}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="ausencias-area-admin-table-card">
              <table className="ausencias-area-admin-table ausencias-area-admin-table--vacations">
                <thead><tr><th>Período solicitado</th><th>Motivo</th><th>Estado</th><th>Acciones</th></tr></thead>
                <tbody>{vacations.map((request) => (
                  <tr key={idOf(request)}>
                    <td className="ausencias-area-admin-table__period">{vacationPeriodOf(request)}</td>
                    <td className="ausencias-area-admin-table__reason">{vacationReasonOf(request)}</td><td><span className={`ausencias-area-admin-badge ausencias-area-admin-badge--${status(request)}`}>{statusLabel(request)}</span></td>
                    <td>{isPending(request) ? <div className="ausencias-area-admin-actions"><button className="ausencias-area-admin-action ausencias-area-admin-action--approve" type="button" aria-label="Aprobar" title="Aprobar" onClick={() => setModal({ type: 'resolve', action: 'approve', request })}><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12" /></svg></button><button className="ausencias-area-admin-action ausencias-area-admin-action--reject" type="button" aria-label="Rechazar" title="Rechazar" onClick={() => setModal({ type: 'resolve', action: 'reject', request })}><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg></button></div> : '—'}</td>
                  </tr>
                ))}</tbody>
              </table>
              </div>
            )
          )}
        </section>
        {canManageAreaAbsences && (
          <section className="ausencias-area-section">

            {situations.length === 0 ? <p className="ausencias-area-admin-state ausencias-area-admin-state--empty">No hay situaciones especiales registradas.</p> : (
              <div className="ausencias-area-admin-table-card">
              <table className="ausencias-area-admin-table">
                <thead><tr><th>GA</th><th>Fecha</th><th>Tipo</th><th>Razón</th><th>Jornada</th><th>Estado</th><th>Acciones</th></tr></thead>
                <tbody>{situations.map((situation) => (
                  <tr key={idOf(situation)} className={situation.active === false || situation.activa === false ? 'ausencias-area-admin-table__row--inactive' : undefined}>
                    <td className="ausencias-area-admin-table__name">{gaName(situation)}</td><td>{dateOf(situation)}</td><td><span className="ausencias-area-admin-badge ausencias-area-admin-badge--type">{typeOf(situation) ?? '—'}</span></td><td className="ausencias-area-admin-table__reason">{reasonOf(situation)}</td>
                    <td>{slotLabel(situation.slot ?? situation.jornada)}</td>
                    <td><span className={`ausencias-area-admin-badge ${situation.active === false || situation.activa === false ? 'ausencias-area-admin-badge--inactive' : 'ausencias-area-admin-badge--active'}`}>{situation.active === false || situation.activa === false ? 'Inactiva' : 'Activa'}</span></td>
                    <td>{situation.active === false || situation.activa === false ? '—' : <div className="ausencias-area-admin-actions"><button className="ausencias-area-admin-action ausencias-area-admin-action--deactivate" type="button" aria-label="Desactivar" title="Desactivar" onClick={() => setModal({ type: 'deactivate', situation })}><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10" /><line x1="4.93" y1="4.93" x2="19.07" y2="19.07" /></svg></button></div>}</td>
                  </tr>
                ))}</tbody>
              </table>
              </div>
            )}
          </section>
        )}
      </>
    )
  }

  return (
    <section className="ausencias-area-page">
      <header className="page-header ausencias-area-page__header">
        <div><h1>Vacaciones y situaciones del área</h1><p>{isAreaManager ? 'Gestiona tus solicitudes de vacaciones.' : 'Resuelve vacaciones y administra situaciones especiales de gerentes de área.'}</p></div>
        {isAreaManager && <button className="ausencias-area-page__new-request" type="button" onClick={() => setModal({ type: 'vacation' })}><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>Nueva solicitud</button>}
        {canManageAreaAbsences && <button className="ausencias-area-admin-new-situation" type="button" onClick={() => setModal({ type: 'situation' })}><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>Nueva situación</button>}
      </header>
      {renderContent()}
      {modal?.type === 'vacation' && <VacationForm onClose={() => setModal(null)} onConflict={refreshAfterConflict} onSubmit={(body, key) => command(createGAVacationRequest, body, key)} />}
      {modal?.type === 'resolve' && <ResolveForm request={modal.request} action={modal.action} onClose={() => setModal(null)} onConflict={refreshAfterConflict} onSubmit={(...args) => command(actOnGAVacationRequest, ...args)} />}
      {modal?.type === 'cancel' && <Confirmation title="Cancelar solicitud" message="¿Deseas cancelar esta solicitud pendiente?" confirmLabel="Confirmar cancelación" onClose={() => setModal(null)} onConflict={refreshAfterConflict} onConfirm={(key) => command(actOnGAVacationRequest, idOf(modal.request), 'cancel', { reason: '' }, key)} />}
      {modal?.type === 'situation' && <SituationForm catalog={catalog} catalogError={catalogError} catalogLoading={catalogLoading} onCatalogDateChange={loadCatalog} onCatalogRetry={loadCatalog} onClose={() => setModal(null)} onConflict={refreshAfterConflict} onSubmit={(body, key) => command(createGASpecialSituation, body, key)} />}
      {modal?.type === 'deactivate' && <Confirmation title="Desactivar situación" message="¿Deseas desactivar esta situación especial?" confirmLabel="Confirmar desactivación" onClose={() => setModal(null)} onConflict={refreshAfterConflict} onConfirm={(key) => command(deactivateGASpecialSituation, idOf(modal.situation), key)} />}
    </section>
  )
}
