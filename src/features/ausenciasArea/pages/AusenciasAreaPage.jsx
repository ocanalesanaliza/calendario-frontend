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
const status = (item) => item?.status ?? item?.estado ?? 'pending'
const dateOf = (item) => item?.date ?? item?.fecha ?? item?.created_at?.slice(0, 10) ?? '—'
const reasonOf = (item) => item?.reason ?? item?.motivo ?? '—'
const isPending = (item) => ['pending', 'pendiente'].includes(status(item))
const statusLabel = (item) => ({ pending: 'Pendiente', pendiente: 'Pendiente', approved: 'Aprobada', aprobada: 'Aprobada', rejected: 'Rechazada', rechazada: 'Rechazada', cancelled: 'Cancelada', cancelada: 'Cancelada' }[status(item)] ?? status(item))
const gaOf = (item) => item?.gerente_area ?? item?.area_manager ?? item?.ga
const gaId = (item) => gaOf(item)?.id ?? gaOf(item)?.id_gerente_area ?? item?.gerente_area_id
const gaName = (item) => gaOf(item)?.nombre ?? gaOf(item)?.name ?? item?.gerente_area_nombre ?? `GA #${gaId(item)}`
const typeOf = (item) => item?.type ?? item?.tipo
const slotLabel = (slot) => slots.find(([value]) => value === slot)?.[1] ?? slot ?? '—'

function Modal({ title, children, onClose }) {
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
      <section ref={dialogRef} className="ausencias-modal" role="dialog" aria-modal="true" aria-labelledby="ausencias-modal-title" tabIndex="-1" onKeyDown={keyDown}>
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
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function update(index, field, value) {
    setSegments((current) => current.map((segment, i) => i === index ? { ...segment, [field]: value } : segment))
  }

  async function submit(event) {
    event.preventDefault()
    setError('')
    if (segments.some((segment) => !segment.date)) {
      setError('Cada segmento requiere una fecha.')
      return
    }
    setSaving(true)
    try {
      idempotencyKey.current ??= createIdempotencyKey()
      await onSubmit({ segments, ...(reason.trim() ? { reason: reason.trim() } : {}) }, idempotencyKey.current)
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
    <Modal title="Nueva solicitud de vacaciones" onClose={onClose}>
      <form onSubmit={submit}>
        {segments.map((segment, index) => (
          <fieldset key={index}>
            <legend>Segmento {index + 1}</legend>
            <label>Fecha<input data-autofocus={index === 0 ? true : undefined} type="date" value={segment.date} onChange={(event) => update(index, 'date', event.target.value)} disabled={saving} required /></label>
            <label>Jornada<select value={segment.slot} onChange={(event) => update(index, 'slot', event.target.value)} disabled={saving}>{slots.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            {segments.length > 1 && <button type="button" onClick={() => setSegments((current) => current.filter((_, i) => i !== index))} disabled={saving}>Quitar segmento</button>}
          </fieldset>
        ))}
        <button type="button" onClick={() => setSegments((current) => [...current, { date: '', slot: 'full_day' }])} disabled={saving}>Agregar fecha</button>
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
  const [form, setForm] = useState({ gerente_area_id: '', date: '', type: '', reason: '', slot: 'full_day' })
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
    onCatalogDateChange(date || undefined)
  }

  async function submit(event) {
    event.preventDefault()
    if (!ready) return
    setSaving(true)
    setError('')
    try {
      idempotencyKey.current ??= createIdempotencyKey()
      await onSubmit(form, idempotencyKey.current)
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
    <Modal title="Nueva situación especial de GA" onClose={onClose}>
      <form onSubmit={submit}>
        <p>El backend justificará automáticamente las ocurrencias afectadas. No debes seleccionarlas manualmente.</p>
        {catalogLoading && <p role="status">Cargando catálogo de situaciones...</p>}
        {catalogError && <div role="alert"><p>{catalogError}</p><button type="button" onClick={() => onCatalogRetry(form.date || undefined)} disabled={saving}>Reintentar</button></div>}
        {!catalogLoading && !catalogError && !ready && <p role="alert">No hay opciones disponibles para crear una situación en esta fecha.</p>}
        <label>Gerente de área<select data-autofocus value={form.gerente_area_id} onChange={set('gerente_area_id')} disabled={saving || !ready} required><option value="">Seleccionar GA</option>{candidates.map((ga) => <option key={ga.id} value={ga.id}>{ga.display}</option>)}</select></label>
        <label>Fecha<input type="date" value={form.date} onChange={setDate} disabled={saving} required /></label>
        <label>Tipo existente<select value={form.type} onChange={set('type')} disabled={saving || !ready} required><option value="">Seleccionar tipo</option>{types.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select></label>
        <label>Razón<textarea value={form.reason} onChange={set('reason')} disabled={saving || !ready} required /></label>
        <label>Jornada<select value={form.slot} onChange={set('slot')} disabled={saving || !ready}>{catalogSlots.map((slot) => <option key={slot.value} value={slot.value}>{slot.label}</option>)}</select></label>
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

  async function loadCatalog(date) {
    if (!canManageAreaAbsences) return
    const request = ++catalogRequest.current
    setCatalogLoading(true)
    setCatalogError('')
    try {
      const nextCatalog = await getCatalog(date)
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
    if (error) return <div role="alert"><p>{error}</p><button onClick={() => setRetry((value) => value + 1)}>Reintentar</button></div>
    if (loading) return <p role="status">Cargando ausencias...</p>

    return (
      <>
        <section className="ausencias-area-section">
          <h2>{isAreaManager ? 'Mis solicitudes' : 'Solicitudes de vacaciones'}</h2>
          {vacations.length === 0 ? <p>No hay solicitudes de vacaciones.</p> : (
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
              <table>
                <thead><tr><th>Fecha</th><th>Segmentos</th><th>Motivo</th><th>Estado</th><th>Acciones</th></tr></thead>
                <tbody>{vacations.map((request) => (
                  <tr key={idOf(request)}>
                    <td>{dateOf(request)}</td>
                    <td>{(request.segments ?? request.segmentos ?? []).map((segment) => `${segment.date ?? segment.fecha} · ${slotLabel(segment.slot ?? segment.jornada)}`).join(', ') || '—'}</td>
                    <td>{reasonOf(request)}</td><td>{status(request)}</td>
                    <td>{isPending(request) ? <><button onClick={() => setModal({ type: 'resolve', action: 'approve', request })}>Aprobar</button><button onClick={() => setModal({ type: 'resolve', action: 'reject', request })}>Rechazar</button></> : '—'}</td>
                  </tr>
                ))}</tbody>
              </table>
            )
          )}
        </section>
        {canManageAreaAbsences && (
          <section className="ausencias-area-section">
            <h2>Situaciones especiales de GA</h2>
            <p>Las ocurrencias se justificarán automáticamente por el backend.</p>
            {situations.length === 0 ? <p>No hay situaciones especiales registradas.</p> : (
              <table>
                <thead><tr><th>GA</th><th>Fecha</th><th>Tipo</th><th>Razón</th><th>Jornada</th><th>Estado</th><th>Acciones</th></tr></thead>
                <tbody>{situations.map((situation) => (
                  <tr key={idOf(situation)}>
                    <td>{gaName(situation)}</td><td>{dateOf(situation)}</td><td>{typeOf(situation) ?? '—'}</td><td>{reasonOf(situation)}</td>
                    <td>{slotLabel(situation.slot ?? situation.jornada)}</td>
                    <td>{situation.active === false || situation.activa === false ? 'Inactiva' : 'Activa'}</td>
                    <td>{situation.active === false || situation.activa === false ? '—' : <button onClick={() => setModal({ type: 'deactivate', situation })}>Desactivar</button>}</td>
                  </tr>
                ))}</tbody>
              </table>
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
        {isAreaManager && <button className="ausencias-area-page__new-request" type="button" onClick={() => setModal({ type: 'vacation' })}>Nueva solicitud</button>}
        {canManageAreaAbsences && <button onClick={() => setModal({ type: 'situation' })}>Nueva situación</button>}
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
