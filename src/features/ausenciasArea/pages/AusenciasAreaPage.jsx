import { useEffect, useId, useRef, useState } from 'react'
import { useAuth } from '../../auth/context/AuthContext'
import { getProfileCapabilities } from '../../auth/profilePolicies'
import { createIdempotencyKey } from '../../calendarArea/services/calendarAreaApi'
import { actOnGAVacationRequest, createGAVacationRequest, getGAVacationRequests } from '../../calendarArea/services/gaVacationRequestsService'
import { createGASpecialSituation, deactivateGASpecialSituation, getCatalog, getGASpecialSituations } from '../../calendarArea/services/gaSpecialSituationsService'
// Kit de componentes compartido con Tuvet; los colores de Analiza llegan con la clase .tema-analiza.
import { Avatar, Aviso, EstadoCarga, Icono, PageHeader } from '../../tuvet/components/TuvetUi'
import '../../tuvet/tuvet.css'
import './AusenciasKit.css'

const slots = [['full_day', 'Jornada completa'], ['morning', 'Mañana'], ['afternoon', 'Tarde']]
const records = (data) => Array.isArray(data) ? data : data?.results ?? data?.items ?? []
const idOf = (item) => item?.id ?? item?.id_request ?? item?.id_vacation_request ?? item?.id_ga_special_situation
const errorText = (error, fallback) => {
  if ([403, 404].includes(error?.status)) return 'No tienes permisos para realizar esta acción. El servidor mantiene la autorización.'
  if (error?.status === 409) return 'La información cambió o entra en conflicto. Revisa el listado e inténtalo de nuevo.'
  if (error?.status === 400) return `Revisa los datos enviados. ${error.message || ''}`.trim()
  return error?.message || fallback
}
const invalidatesCommandKey = (error) => [400, 403, 409].includes(error?.status)
const rawStatus = (item) => String(item?.state ?? item?.status ?? item?.estado ?? 'pending').trim().toLowerCase()
const status = (item) => ({ accepted: 'approved', aceptada: 'approved', aceptado: 'approved', aprobada: 'approved', aprobado: 'approved', pendiente: 'pending', rechazada: 'rejected', cancelada: 'cancelled' }[rawStatus(item)] ?? rawStatus(item))
const dateOf = (item) => item?.date ?? item?.fecha ?? item?.created_at?.slice(0, 10) ?? '—'
const reasonOf = (item) => item?.reason ?? item?.motivo ?? '—'
const isPending = (item) => status(item) === 'pending'
const statusLabel = (item) => ({ pending: 'Pendiente', approved: 'Aprobada', rejected: 'Rechazada', cancelled: 'Cancelada' }[status(item)] ?? status(item))
// Estado de la solicitud → insignia del kit (color + icono, nunca solo color).
const STATUS_BADGE = {
  pending: ['tuvet-badge-pendiente', 'reloj'],
  approved: ['tuvet-badge-aprobada', 'check'],
  rejected: ['tuvet-badge-vencida', 'rechazar'],
  cancelled: ['tuvet-badge-cancelada', 'cerrar'],
}
const gaOf = (item) => item?.gerente_area ?? item?.area_manager ?? item?.ga
const gaId = (item) => gaOf(item)?.id ?? gaOf(item)?.id_gerente_area ?? item?.gerente_area_id
const gaName = (item) => gaOf(item)?.nombre ?? gaOf(item)?.name ?? item?.gerente_area_nombre ?? `GA #${gaId(item)}`
const typeOf = (item) => item?.type ?? item?.tipo
const isActive = (situation) => situation.active !== false && situation.activa !== false
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
  const [, endYear, endMonth] = end
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
const isSunday = (date) => {
  const match = String(date ?? '').match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return false
  const [, year, month, day] = match
  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day))).getUTCDay() === 0
}
const requestedDays = (startDate, endDate = startDate) => inclusiveRange(startDate, endDate).filter((date) => !isSunday(date)).length
const requestedDaysLabel = (days) => `${days} ${days === 1 ? 'día solicitado' : 'días solicitados'}`
const vacationRangeSummary = (startDate, endDate) => {
  const days = requestedDays(startDate, endDate || startDate)
  if (!endDate) return `${localizedDate(startDate)} · ${requestedDaysLabel(days)}`
  if (startDate === endDate) return `El ${localizedDate(startDate)} · ${requestedDaysLabel(days)}`
  return `${localizedDateRange(startDate, endDate)} · ${requestedDaysLabel(days)}`
}
const specialSituationRangeError = (startDate, endDate) => {
  if (!startDate || !endDate) return ''
  if (endDate < startDate) return 'La fecha de fin no puede ser anterior a la fecha de inicio.'
  if (inclusiveRange(startDate, endDate).length > 31) return 'El rango no puede superar 31 días, incluidos ambos extremos.'
  return ''
}
const plural = (count, singular, pluralForm) => `${count} ${count === 1 ? singular : pluralForm}`

function StatusBadge({ item, className = '' }) {
  const [badge, icon] = STATUS_BADGE[status(item)] ?? ['tuvet-badge-cancelada', 'info']
  return (
    <span className={`tuvet-badge ${badge} ${className}`.trim()}>
      <Icono nombre={icon} className="tuvet-badge-icon" />
      {statusLabel(item)}
    </span>
  )
}

// Modal propio de la página (enfoca [data-autofocus]); con el aspecto del kit.
function Modal({ title, icon, tone = 'primary', children, onClose, className = '' }) {
  const titleId = useId()
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
    <div className="tuvet-modal-backdrop">
      <section ref={dialogRef} className={`tuvet-modal ${className}`.trim()} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex="-1" onKeyDown={keyDown}>
        <header className="tuvet-modal-header">
          <div className="tuvet-modal-heading">
            {icon && <span className={`tuvet-modal-icon tuvet-modal-icon-${tone}`}><Icono nombre={icon} /></span>}
            <h2 id={titleId}>{title}</h2>
          </div>
          <button type="button" className="tuvet-icon-btn" aria-label="Cerrar" onClick={onClose}><Icono nombre="cerrar" /></button>
        </header>
        <div className="tuvet-modal-body">{children}</div>
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
  const summary = range.startDate ? vacationRangeSummary(range.startDate, range.endDate) : 'Selecciona una fecha para ver el resumen.'

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
    <Modal title="Nueva solicitud de vacaciones" icon="calendario" onClose={onClose} className="ausencias-vacation-modal">
      <form className="tuvet-form ak-form" onSubmit={submit}>
        {advanced ? (
          <>
            <p className="tuvet-hint">Añade las fechas y jornadas que necesites, incluso si no son consecutivas.</p>
            {segments.map((segment, index) => (
              <fieldset key={index} className="ak-segmento">
                <legend>Segmento {index + 1}</legend>
                <label className="ak-label">Fecha<input className="tuvet-input" data-autofocus={index === 0 ? true : undefined} type="date" value={segment.date} onChange={(event) => update(index, 'date', event.target.value)} disabled={saving} required /></label>
                <label className="ak-label">Jornada<select className="tuvet-input" value={segment.slot} onChange={(event) => update(index, 'slot', event.target.value)} disabled={saving}>{slots.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                {segments.length > 1 && <button type="button" className="tuvet-btn tuvet-btn-ghost" onClick={() => setSegments((current) => current.filter((_, i) => i !== index))} disabled={saving}>Quitar segmento</button>}
              </fieldset>
            ))}
            <div className="ak-modo">
              <button className="tuvet-btn tuvet-btn-secondary" type="button" onClick={() => setSegments((current) => [...current, { date: '', slot: 'full_day' }])} disabled={saving}>Agregar fecha</button>
              <button className="tuvet-btn tuvet-btn-ghost" type="button" onClick={() => setAdvanced(false)} disabled={saving}>Volver al formulario de rango</button>
            </div>
          </>
        ) : (
          <>
            <div className="tuvet-form-grid">
              <label className="ak-label">Fecha de inicio<input className="tuvet-input" data-autofocus type="date" value={range.startDate} onChange={(event) => setRange((current) => ({ ...current, startDate: event.target.value }))} disabled={saving} required /></label>
              <label className="ak-label">Fecha de fin (opcional)<input className="tuvet-input" type="date" value={range.endDate} onChange={(event) => setRange((current) => ({ ...current, endDate: event.target.value }))} disabled={saving} aria-describedby={isRange ? 'vacation-range-note' : undefined} /></label>
            </div>
            {isRange ? <p id="vacation-range-note" className="tuvet-hint">El rango se solicitará por jornadas completas.</p> : <label className="ak-label">Jornada<select className="tuvet-input" value={range.slot} onChange={(event) => setRange((current) => ({ ...current, slot: event.target.value }))} disabled={saving}>{slots.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>}
            <p className="ak-resumen" aria-live="polite"><Icono nombre="calendario" className="ak-resumen-icon" /><span><strong>Resumen:</strong> {summary}</span></p>
            <button className="tuvet-btn tuvet-btn-ghost ak-link" type="button" onClick={() => setAdvanced(true)} disabled={saving}>¿Necesitas fechas o jornadas no consecutivas?</button>
          </>
        )}
        <label className="ak-label">Motivo <span className="tuvet-hint">(opcional)</span><textarea className="tuvet-input" rows={3} value={reason} onChange={(event) => setReason(event.target.value)} disabled={saving} /></label>
        <Aviso tipo="error">{error}</Aviso>
        <footer className="ak-footer"><button type="button" className="tuvet-btn tuvet-btn-secondary" onClick={onClose} disabled={saving}>Cancelar</button><button type="submit" className="tuvet-btn" disabled={saving} aria-busy={saving}>{saving ? 'Enviando...' : 'Solicitar vacaciones'}</button></footer>
      </form>
    </Modal>
  )
}

function ResolveForm({ request, action, onClose, onConflict, onSubmit }) {
  const idempotencyKey = useRef(null)
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const approve = action === 'approve'

  async function submit(event) {
    event.preventDefault()
    const trimmedReason = reason.trim()
    if (action === 'reject' && !trimmedReason) {
      setError('El motivo es obligatorio para rechazar la solicitud.')
      return
    }
    setSaving(true)
    setError('')
    try {
      idempotencyKey.current ??= createIdempotencyKey()
      await onSubmit(idOf(request), action, { reason: trimmedReason }, idempotencyKey.current)
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
    <Modal title={approve ? 'Aprobar vacaciones' : 'Rechazar vacaciones'} icon={approve ? 'check' : 'rechazar'} tone={approve ? 'success' : 'danger'} onClose={onClose}>
      <form className="tuvet-form ak-form" onSubmit={submit}>
        <p className="ak-periodo"><Icono nombre="calendario" className="ak-resumen-icon" />{vacationPeriodOf(request)}</p>
        <label className="ak-label">Motivo<textarea className="tuvet-input" rows={3} data-autofocus value={reason} onChange={(event) => setReason(event.target.value)} disabled={saving} required={!approve} placeholder={approve ? 'Ej. Cobertura validada' : 'Explica por qué no se puede aprobar'} /></label>
        <Aviso tipo="error">{error}</Aviso>
        <footer className="ak-footer"><button type="button" className="tuvet-btn tuvet-btn-secondary" onClick={onClose} disabled={saving}>Cancelar</button><button type="submit" className={`tuvet-btn ${approve ? '' : 'tuvet-btn-danger-solid'}`} disabled={saving} aria-busy={saving}>{saving ? 'Guardando...' : approve ? 'Aprobar' : 'Rechazar'}</button></footer>
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
    <Modal title={title} icon="alerta" tone="danger" onClose={onClose}>
      <div className="tuvet-form ak-form">
        <p className="tuvet-confirm-message">{message}</p>
        <Aviso tipo="error">{error}</Aviso>
        <footer className="ak-footer">
          <button type="button" className="tuvet-btn tuvet-btn-secondary" disabled={saving} onClick={onClose}>Volver</button>
          <button type="button" className="tuvet-btn tuvet-btn-danger-solid" data-autofocus disabled={saving} aria-busy={saving} onClick={confirm}>{saving ? 'Guardando...' : confirmLabel}</button>
        </footer>
      </div>
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
    <Modal title="Nueva situación especial de GA" icon="alerta" tone="warning" onClose={onClose} className="ausencias-area-admin-situation-modal tuvet-modal-wide">
      <form className="ausencias-area-admin-situation-form tuvet-form ak-form" onSubmit={submit}>
        {catalogLoading && <p role="status" className="tuvet-state">Cargando catálogo de situaciones...</p>}
        {catalogError && <div role="alert" className="tuvet-aviso tuvet-aviso-error"><Icono nombre="error" className="tuvet-aviso-icon" /><div><p>{catalogError}</p><button type="button" className="tuvet-btn tuvet-btn-secondary" onClick={() => onCatalogRetry(form.date || undefined, form.end_date || undefined)} disabled={saving}>Reintentar</button></div></div>}
        {!catalogLoading && !catalogError && !ready && <p role="alert" className="tuvet-aviso tuvet-aviso-warning">No hay opciones disponibles para crear una situación en esta fecha.</p>}
        <div className="tuvet-form-grid">
          <label className="ak-label">Fecha<input className="tuvet-input" type="date" value={form.date} onChange={setDate} disabled={saving} required /></label>
          <label className="ak-label">Fecha fin <span className="tuvet-hint">(opcional)</span><input className="tuvet-input" type="date" value={form.end_date} onChange={setEndDate} disabled={saving} /></label>
        </div>
        <label className="ak-label">Gerente de área<select className="tuvet-input" data-autofocus value={form.gerente_area_id} onChange={set('gerente_area_id')} disabled={saving || !ready} required><option value="">Seleccionar GA</option>{candidates.map((ga) => <option key={ga.id} value={ga.id}>{ga.display_name}</option>)}</select></label>
        <div className="tuvet-form-grid">
          <label className="ak-label">Tipo existente<select className="tuvet-input" value={form.type} onChange={set('type')} disabled={saving || !ready} required><option value="">Seleccionar tipo</option>{types.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select></label>
          <label className="ak-label">Jornada<select className="tuvet-input" value={form.slot} onChange={set('slot')} disabled={saving || !ready}>{catalogSlots.map((slot) => <option key={slot.value} value={slot.value}>{slotLabel(slot.value)}</option>)}</select></label>
        </div>
        <label className="ak-label">Razón<textarea className="tuvet-input" rows={3} value={form.reason} onChange={set('reason')} disabled={saving || !ready} required /></label>
        <Aviso tipo="error">{error}</Aviso>
        <footer className="ak-footer"><button type="button" className="tuvet-btn tuvet-btn-secondary" onClick={onClose} disabled={saving}>Cancelar</button><button type="submit" className="tuvet-btn" disabled={saving || !ready} aria-busy={saving}>{saving ? 'Creando...' : 'Crear situación'}</button></footer>
      </form>
    </Modal>
  )
}

const VACATION_FILTERS = [['all', 'Todas'], ['pending', 'Pendientes'], ['approved', 'Aprobadas'], ['rejected', 'Rechazadas'], ['cancelled', 'Canceladas']]

export default function AusenciasAreaPage() {
  const { perfil } = useAuth()
  const { isAreaManager, canSubmitOwnGAVacations, canDecideGAVacations, canCancelOwnGAVacations, canManageGASpecialSituations } = getProfileCapabilities(perfil)
  const [vacations, setVacations] = useState([])
  const [situations, setSituations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  const [modal, setModal] = useState(null)
  const [tab, setTab] = useState('vacations')
  const [vacationFilter, setVacationFilter] = useState('all')
  const [catalog, setCatalog] = useState(null)
  const [catalogLoading, setCatalogLoading] = useState(canManageGASpecialSituations)
  const [catalogError, setCatalogError] = useState('')
  const catalogRequest = useRef(0)
  const tabRefs = useRef({})

  async function loadCatalog(date, endDate) {
    if (!canManageGASpecialSituations) return
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
      const [requests, special] = await Promise.all([getGAVacationRequests(), canManageGASpecialSituations ? getGASpecialSituations() : Promise.resolve([])])
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
  }, [retry, canManageGASpecialSituations])

  async function command(command, ...args) {
    await command(...args)
    await load()
  }

  async function refreshAfterConflict() {
    await Promise.all([load(), canManageGASpecialSituations ? loadCatalog() : Promise.resolve()])
  }

  const pendingCount = vacations.filter(isPending).length
  const activeSituations = situations.filter(isActive).length
  const typeLabel = (situation) => catalog?.types?.find((type) => type.value === typeOf(situation))?.label ?? typeOf(situation) ?? '—'
  const filteredVacations = vacationFilter === 'all' ? vacations : vacations.filter((request) => status(request) === vacationFilter)

  const tabs = [
    { key: 'vacations', icon: 'calendario', tone: 'vacaciones', title: 'Vacaciones', description: 'Solicitudes de los gerentes de área para ausentarse.', count: plural(pendingCount, 'pendiente', 'pendientes') },
    { key: 'situations', icon: 'alerta', tone: 'situaciones', title: 'Situaciones especiales', description: 'Capacitaciones, permisos e imprevistos que ajustan el rendimiento.', count: plural(activeSituations, 'activa', 'activas') },
  ]

  function onTabKeyDown(event, index) {
    if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return
    event.preventDefault()
    const next = tabs[(index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length].key
    setTab(next)
    tabRefs.current[next]?.focus()
  }

  function renderVacationsAdmin() {
    return (
      <>
        <div className="tuvet-filtros" role="group" aria-label="Filtrar solicitudes por estado">
          {VACATION_FILTERS.map(([key, label]) => (
            <button key={key} type="button" className={`tuvet-chip ${vacationFilter === key ? 'active' : ''}`} aria-pressed={vacationFilter === key} onClick={() => setVacationFilter(key)}>
              {`${label} (${key === 'all' ? vacations.length : vacations.filter((request) => status(request) === key).length})`}
            </button>
          ))}
        </div>
        {filteredVacations.length === 0 ? (
          <div className="tuvet-empty"><Icono nombre="calendario" className="tuvet-empty-icon" /><p>{vacations.length ? 'Ninguna solicitud con ese estado.' : 'No hay solicitudes de vacaciones.'}</p></div>
        ) : (
          <div className="tuvet-card ak-tabla-card ak-acento-vacaciones">
            <div className="tuvet-table-wrap">
              <table className="tuvet-table ak-tabla">
                <thead><tr><th scope="col">Período solicitado</th><th scope="col">Motivo</th><th scope="col">Estado</th><th scope="col"><span className="tuvet-visually-hidden">Acciones</span></th></tr></thead>
                <tbody>{filteredVacations.map((request) => (
                  <tr key={idOf(request)}>
                    <td className="ak-periodo-cell">{vacationPeriodOf(request)}</td>
                    <td className="ak-motivo">{vacationReasonOf(request)}</td>
                    <td><StatusBadge item={request} className={`ausencias-area-admin-badge ausencias-area-admin-badge--${status(request)}`} /></td>
                    <td className="tuvet-cell-acciones">{canDecideGAVacations && isPending(request) ? (
                      <>
                        <button className="tuvet-btn" type="button" onClick={() => setModal({ type: 'resolve', action: 'approve', request })}>Aprobar</button>
                        <button className="tuvet-btn tuvet-btn-danger" type="button" onClick={() => setModal({ type: 'resolve', action: 'reject', request })}>Rechazar</button>
                      </>
                    ) : <span className="tuvet-hint">—</span>}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </div>
        )}
      </>
    )
  }

  function renderVacationsGA() {
    if (vacations.length === 0) {
      return <div className="tuvet-empty"><Icono nombre="calendario" className="tuvet-empty-icon" /><p>No hay solicitudes de vacaciones.</p><button type="button" className="tuvet-btn" onClick={() => setModal({ type: 'vacation' })}>Crear mi primera solicitud</button></div>
    }
    return (
      <div className="ak-solicitudes">
        {vacations.map((request) => (
          <article key={idOf(request)} className={`ak-solicitud ak-solicitud--${status(request)}`}>
            <span className="ak-solicitud-icono" aria-hidden="true"><Icono nombre="calendario" /></span>
            <div className="ak-solicitud-cuerpo">
              <div className="ak-solicitud-titulo">
                <h3>Solicitud de vacaciones</h3>
                <span className="tuvet-hint">{dateOf(request)}</span>
              </div>
              <p className="ak-solicitud-segmentos">{vacationSegmentsOf(request).map((segment) => `${segmentDateOf(segment)} · ${slotLabel(segment.slot ?? segment.jornada)}`).join(', ') || '—'}</p>
              <p className="tuvet-hint">{reasonOf(request)}</p>
            </div>
            <StatusBadge item={request} className="ausencias-area-status-badge" />
            {canCancelOwnGAVacations && isPending(request) && <button className="tuvet-icon-action tuvet-icon-action-danger" type="button" aria-label="Cancelar solicitud" title="Cancelar solicitud" onClick={() => setModal({ type: 'cancel', request })}><Icono nombre="cerrar" /></button>}
          </article>
        ))}
      </div>
    )
  }

  function renderSituations() {
    if (situations.length === 0) {
      return <div className="tuvet-empty"><Icono nombre="alerta" className="tuvet-empty-icon" /><p>No hay situaciones especiales registradas.</p><button type="button" className="tuvet-btn" onClick={() => setModal({ type: 'situation' })}>Registrar situación</button></div>
    }
    return (
      <div className="tuvet-card ak-tabla-card ak-acento-situaciones">
        <div className="tuvet-table-wrap">
          <table className="tuvet-table ak-tabla">
            <thead><tr><th scope="col">Gerente de área</th><th scope="col">Fecha</th><th scope="col">Tipo</th><th scope="col">Razón</th><th scope="col">Jornada</th><th scope="col">Estado</th><th scope="col"><span className="tuvet-visually-hidden">Acciones</span></th></tr></thead>
            <tbody>{situations.map((situation) => (
              <tr key={idOf(situation)} className={isActive(situation) ? undefined : 'tuvet-row-inactiva'}>
                <td><span className="tuvet-persona-cell"><Avatar nombre={gaName(situation)} size="sm" /><strong>{gaName(situation)}</strong></span></td>
                <td className="ak-nowrap">{localizedDate(dateOf(situation))}</td>
                <td><span className="tuvet-badge ak-tipo">{typeLabel(situation)}</span></td>
                <td className="ak-motivo">{reasonOf(situation)}</td>
                <td className="ak-nowrap">{slotLabel(situation.slot ?? situation.jornada)}</td>
                <td>
                  <span className={`tuvet-badge ${isActive(situation) ? 'tuvet-badge-aprobada' : 'tuvet-badge-cancelada'}`}>
                    <Icono nombre={isActive(situation) ? 'check' : 'cerrar'} className="tuvet-badge-icon" />
                    {isActive(situation) ? 'Activa' : 'Inactiva'}
                  </span>
                </td>
                <td className="tuvet-cell-acciones">{isActive(situation)
                  ? <button className="tuvet-btn tuvet-btn-danger" type="button" onClick={() => setModal({ type: 'deactivate', situation })}>Desactivar</button>
                  : <span className="tuvet-hint">—</span>}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </div>
    )
  }

  function renderContent() {
    if (!canManageGASpecialSituations) {
      return (
        <section className="ak-panel" aria-labelledby="ak-mis-solicitudes">
          <div className="ak-panel-header ak-acento-vacaciones">
            <span className="ak-panel-icono"><Icono nombre="calendario" /></span>
            <div><h2 id="ak-mis-solicitudes">{isAreaManager ? 'Mis solicitudes' : 'Solicitudes de vacaciones'}</h2><p>{plural(pendingCount, 'solicitud pendiente', 'solicitudes pendientes')} de respuesta.</p></div>
          </div>
          {isAreaManager ? renderVacationsGA() : renderVacationsAdmin()}
        </section>
      )
    }

    const current = tabs.find((item) => item.key === tab)
    return (
      <>
        <div className="ak-tabs" role="tablist" aria-label="Tipo de ausencia">
          {tabs.map((item, index) => (
            <button
              key={item.key}
              ref={(node) => { tabRefs.current[item.key] = node }}
              id={`ak-tab-${item.key}`}
              type="button"
              role="tab"
              aria-selected={tab === item.key}
              aria-controls="ak-tabpanel"
              tabIndex={tab === item.key ? 0 : -1}
              className={`ak-tab ak-acento-${item.tone} ${tab === item.key ? 'is-active' : ''}`}
              onClick={() => setTab(item.key)}
              onKeyDown={(event) => onTabKeyDown(event, index)}
            >
              <span className="ak-panel-icono"><Icono nombre={item.icon} /></span>
              <span className="ak-tab-texto">
                <span className="ak-tab-titulo">{item.title}</span>
                <span className="ak-tab-descripcion">{item.description}</span>
              </span>
              <span className="ak-tab-contador">{item.count}</span>
            </button>
          ))}
        </div>
        <section id="ak-tabpanel" role="tabpanel" aria-labelledby={`ak-tab-${current.key}`} className="ak-panel">
          {tab === 'vacations' ? renderVacationsAdmin() : renderSituations()}
        </section>
      </>
    )
  }

  return (
    <div className="tema-analiza tuvet-page ausencias-kit">
      <PageHeader
        title="Vacaciones y situaciones del área"
        description={isAreaManager ? 'Gestiona tus solicitudes de vacaciones.' : 'Resuelve vacaciones y administra situaciones especiales de gerentes de área.'}
      >
        {canSubmitOwnGAVacations && <button className="tuvet-btn" type="button" onClick={() => setModal({ type: 'vacation' })}>Nueva solicitud</button>}
        {canManageGASpecialSituations && <button className="tuvet-btn ausencias-area-admin-new-situation" type="button" onClick={() => { setTab('situations'); setModal({ type: 'situation' }) }}>Nueva situación</button>}
      </PageHeader>
      <EstadoCarga loading={loading} error={error} onRetry={() => setRetry((value) => value + 1)}>
        {renderContent()}
      </EstadoCarga>
      {modal?.type === 'vacation' && <VacationForm onClose={() => setModal(null)} onConflict={refreshAfterConflict} onSubmit={(body, key) => command(createGAVacationRequest, body, key)} />}
      {modal?.type === 'resolve' && <ResolveForm request={modal.request} action={modal.action} onClose={() => setModal(null)} onConflict={refreshAfterConflict} onSubmit={(...args) => command(actOnGAVacationRequest, ...args)} />}
      {modal?.type === 'cancel' && <Confirmation title="Cancelar solicitud" message="¿Deseas cancelar esta solicitud pendiente?" confirmLabel="Confirmar cancelación" onClose={() => setModal(null)} onConflict={refreshAfterConflict} onConfirm={(key) => command(actOnGAVacationRequest, idOf(modal.request), 'cancel', { reason: '' }, key)} />}
      {modal?.type === 'situation' && <SituationForm catalog={catalog} catalogError={catalogError} catalogLoading={catalogLoading} onCatalogDateChange={loadCatalog} onCatalogRetry={loadCatalog} onClose={() => setModal(null)} onConflict={refreshAfterConflict} onSubmit={(body, key) => command(createGASpecialSituation, body, key)} />}
      {modal?.type === 'deactivate' && <Confirmation title="Desactivar situación" message={`¿Deseas desactivar la situación de ${gaName(modal.situation)} del ${localizedDate(dateOf(modal.situation))}?`} confirmLabel="Confirmar desactivación" onClose={() => setModal(null)} onConflict={refreshAfterConflict} onConfirm={(key) => command(deactivateGASpecialSituation, idOf(modal.situation), key)} />}
    </div>
  )
}
