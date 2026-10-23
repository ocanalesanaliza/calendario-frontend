import { useEffect, useRef, useState } from 'react'
import { createAdminMasterAssignment, getAdminMasterAssignments, revokeAdminMasterAssignment } from '../services/adminMasterAssignmentsService'
import './AdminMasterAssignmentsPage.css'

const isIsoDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`))
const fieldError = (errors, field) => Array.isArray(errors[field]) ? errors[field].join(' ') : errors[field]
const assignmentFields = ['profile_id', 'username', 'email', 'first_name', 'last_name', 'country_id', 'effective_on']
const revokeFields = ['effective_on', 'reason']
const submissionInFlight = { current: false }
const revokeSubmissionInFlight = { current: false }

function submissionErrors(error) {
  const fields = error.fields && typeof error.fields === 'object' && !Array.isArray(error.fields) ? error.fields : {}
  const knownErrors = Object.fromEntries(Object.entries(fields).filter(([field]) => assignmentFields.includes(field)))
  const globalErrors = Object.entries(fields)
    .filter(([field]) => !assignmentFields.includes(field))
    .map(([, value]) => Array.isArray(value) ? value.join(' ') : value)
    .filter(Boolean)
  const detail = globalErrors.join(' ') || (!Object.keys(knownErrors).length ? (error.status === 409 ? 'Ya existe una asignación que entra en conflicto.' : error.message) : '')

  return { ...knownErrors, detail }
}

function revokeSubmissionErrors(error) {
  const fields = error.fields && typeof error.fields === 'object' && !Array.isArray(error.fields) ? error.fields : {}
  const knownErrors = Object.fromEntries(Object.entries(fields).filter(([field]) => revokeFields.includes(field)))
  const globalErrors = Object.entries(fields)
    .filter(([field]) => !revokeFields.includes(field))
    .map(([, value]) => Array.isArray(value) ? value.join(' ') : value)
    .filter(Boolean)
  const detail = globalErrors.join(' ') || (!Object.keys(knownErrors).length ? error.message : '')

  return { ...knownErrors, detail }
}

function assignmentsFrom(data) {
  return Array.isArray(data) ? data : data?.results || []
}

function assignmentProfileId(assignment) {
  return assignment.profile?.id ?? assignment.user?.id
}

function profileName(assignment) {
  const profile = assignment.profile || assignment.user || {}
  return assignment.profile_name || profile.username || profile.email || '—'
}

function email(assignment) {
  const profile = assignment.profile || assignment.user || {}
  return assignment.email || profile.email || '—'
}

function country(assignment) {
  return assignment.country_name || assignment.country?.name || assignment.country || '—'
}

function lifecycleState(assignment) {
  return ({ active: 'Activa', revoked: 'Revocada', replaced: 'Reemplazada', transferred: 'Transferida' })[assignment.lifecycle_state] || assignment.lifecycle_state || '—'
}

function Modal({ title, children, onClose, closeAllowed = true }) {
  const dialogRef = useRef(null)
  const previousFocusRef = useRef(null)

  useEffect(() => {
    previousFocusRef.current = document.activeElement
    const dialog = dialogRef.current
    const initialFocus = dialog.querySelector('[data-autofocus]')
      || dialog.querySelector('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')

    ;(initialFocus || dialog).focus()

    return () => previousFocusRef.current?.focus()
  }, [])

  function handleKeyDown(event) {
    if (event.key === 'Escape') {
      event.preventDefault()
      if (closeAllowed) onClose()
      return
    }

    if (event.key !== 'Tab') return

    const focusable = [...dialogRef.current.querySelectorAll(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    )]
    const first = focusable[0]
    const last = focusable.at(-1)

    if (!first) {
      event.preventDefault()
      dialogRef.current.focus()
    } else if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  return (
    <div className="ama-modal-backdrop">
      <section ref={dialogRef} className="ama-modal" role="dialog" aria-modal="true" aria-label={title} tabIndex="-1" onKeyDown={handleKeyDown}>
        <header className="ama-modal-header"><h2>{title}</h2><button type="button" className="ama-modal-close" onClick={onClose} aria-label="Cerrar" disabled={!closeAllowed}>×</button></header>
        {children}
      </section>
    </div>
  )
}

function AssignmentModal({ eligibleProfiles, activeProfileIds, countries, onClose, onSubmit, submissionInFlightRef }) {
  const [mode, setMode] = useState('existing')
  const [form, setForm] = useState({ profile_id: '', username: '', email: '', first_name: '', last_name: '', country_id: '', effective_on: '' })
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  const update = (field) => (event) => setForm({ ...form, [field]: event.target.value })

  async function submit(event) {
    event.preventDefault()
    if (saving || submissionInFlightRef.current) return
    const nextErrors = {}
    if (!form.country_id || !/^\d+$/.test(form.country_id)) nextErrors.country_id = 'Selecciona un país válido.'
    if (form.effective_on && !isIsoDate(form.effective_on)) nextErrors.effective_on = 'Ingresa una fecha ISO válida (YYYY-MM-DD).'
    if (mode === 'existing' && (!form.profile_id || !/^\d+$/.test(form.profile_id))) nextErrors.profile_id = 'Selecciona un perfil válido.'
    if (mode === 'existing' && activeProfileIds.has(form.profile_id)) nextErrors.profile_id = 'Este perfil ya tiene una asignación activa y no puede asignarse a otro país.'
    if (mode === 'new' && !form.username.trim()) nextErrors.username = 'El nombre de usuario es obligatorio.'
    if (mode === 'new' && !form.email.trim()) nextErrors.email = 'El email es obligatorio.'
    if (mode === 'new' && !form.first_name.trim()) nextErrors.first_name = 'El nombre es obligatorio.'
    if (mode === 'new' && !form.last_name.trim()) nextErrors.last_name = 'El apellido es obligatorio.'
    if (Object.keys(nextErrors).length) return setErrors(nextErrors)

    const body = mode === 'existing'
      ? { mode, profile_id: Number(form.profile_id), country_id: Number(form.country_id), ...(form.effective_on ? { effective_on: form.effective_on } : {}) }
      : { mode, username: form.username.trim(), email: form.email.trim(), first_name: form.first_name.trim(), last_name: form.last_name.trim(), country_id: Number(form.country_id), ...(form.effective_on ? { effective_on: form.effective_on } : {}) }

    submissionInFlightRef.current = true
    setSaving(true)
    setErrors({})
    try {
      await onSubmit(body)
    } catch (error) {
      setErrors(submissionErrors(error))
      setSaving(false)
    } finally {
      submissionInFlightRef.current = false
    }
  }

  return (
    <Modal title="Nueva asignación de Admin Master" onClose={onClose}>
      <form className="ama-form ama-assignment-form" onSubmit={submit}>
        <fieldset className="ama-form-fieldset"><legend>Perfil</legend>
          <label className="ama-radio-label"><input className="ama-radio" type="radio" name="assignment-mode" checked={mode === 'existing'} onChange={() => setMode('existing')} disabled={saving} data-autofocus /> Existente</label>
          <label className="ama-radio-label"><input className="ama-radio" type="radio" name="assignment-mode" checked={mode === 'new'} onChange={() => setMode('new')} disabled={saving} /> Nuevo</label>
        </fieldset>
        {mode === 'existing' ? <SelectField label="Perfil existente" value={form.profile_id} onChange={update('profile_id')} disabled={saving} error={fieldError(errors, 'profile_id')}><option value="">Seleccionar perfil</option>{eligibleProfiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.username || profile.email || `Perfil ${profile.id}`}</option>)}</SelectField> : <>
          <FormField label="Nombre de usuario" value={form.username} onChange={update('username')} disabled={saving} error={fieldError(errors, 'username')} />
          <FormField label="Email" type="email" value={form.email} onChange={update('email')} disabled={saving} error={fieldError(errors, 'email')} />
          <FormField label="Nombre" value={form.first_name} onChange={update('first_name')} disabled={saving} error={fieldError(errors, 'first_name')} />
          <FormField label="Apellido" value={form.last_name} onChange={update('last_name')} disabled={saving} error={fieldError(errors, 'last_name')} />
        </>}
        <SelectField label="País" value={form.country_id} onChange={update('country_id')} disabled={saving} error={fieldError(errors, 'country_id')}><option value="">Seleccionar país</option>{countries.map((item) => <option key={item.id} value={item.id}>{item.label ?? item.name}</option>)}</SelectField>
        <FormField label="Fecha efectiva (opcional)" type="date" value={form.effective_on} onChange={update('effective_on')} disabled={saving} error={fieldError(errors, 'effective_on')} required={false} />
        {errors.detail && <p className="ama-error ama-form-error" role="alert">{errors.detail}</p>}
        <footer className="ama-modal-footer ama-modal-actions ama-assignment-modal-actions"><button type="button" className="ama-button ama-button--secondary" onClick={onClose}>Cancelar</button><button type="submit" className="ama-button ama-button--primary" disabled={saving}>{saving ? 'Guardando...' : 'Crear asignación'}</button></footer>
      </form>
    </Modal>
  )
}

function RevokeModal({ onClose, onSubmit, submissionInFlightRef }) {
  const [form, setForm] = useState({ effective_on: '', reason: '' })
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const update = (field) => (event) => setForm({ ...form, [field]: event.target.value })

  async function submit(event) {
    event.preventDefault()
    if (saving || submissionInFlightRef.current) return
    const nextErrors = {}
    if (!isIsoDate(form.effective_on)) nextErrors.effective_on = 'Ingresa una fecha ISO válida (YYYY-MM-DD).'
    if (!form.reason.trim()) nextErrors.reason = 'El motivo de revocación es obligatorio.'
    if (Object.keys(nextErrors).length) return setErrors(nextErrors)

    submissionInFlightRef.current = true
    setSaving(true)
    setErrors({})
    try {
      await onSubmit({ effective_on: form.effective_on, reason: form.reason.trim() })
    } catch (error) {
      setErrors(revokeSubmissionErrors(error))
      setSaving(false)
    } finally {
      submissionInFlightRef.current = false
    }
  }

  return <Modal title="Revocar asignación de Admin Master" onClose={onClose}>
    <form className="ama-form ama-revoke-form" onSubmit={submit}>
      <p className="ama-revoke-description">La revocación no crea una asignación de reemplazo.</p>
      <FormField label="Fecha efectiva de revocación" type="date" value={form.effective_on} onChange={update('effective_on')} disabled={saving} error={fieldError(errors, 'effective_on')} required={false} data-autofocus />
      <FormField label="Motivo de revocación" value={form.reason} onChange={update('reason')} disabled={saving} error={fieldError(errors, 'reason')} required={false} />
      {errors.detail && <p className="ama-error ama-form-error" role="alert">{errors.detail}</p>}
      <footer className="ama-modal-footer ama-modal-actions ama-revoke-modal-actions"><button type="button" className="ama-button ama-button--secondary" onClick={onClose} disabled={saving}>Cancelar</button><button type="submit" className="ama-button ama-button--primary" disabled={saving}>{saving ? 'Revocando...' : 'Revocar asignación'}</button></footer>
    </form>
  </Modal>
}

function FormField({ label, error, ...inputProps }) {
  const id = `ama-${label.replaceAll(' ', '-').toLowerCase()}`
  const inputClassName = `ama-input${inputProps.type === 'date' ? ' ama-date-input' : ''}${error ? ' ama-input--error' : ''}`
  return <div className="ama-field"><label className="ama-field-label" htmlFor={id}>{label}</label><input id={id} className={inputClassName} required aria-describedby={error ? `${id}-error` : undefined} {...inputProps} />{error && <span id={`${id}-error`} className="ama-error ama-field-error" role="alert">{error}</span>}</div>
}

function SelectField({ label, error, children, ...selectProps }) {
  const id = `ama-${label.replaceAll(' ', '-').toLowerCase()}`
  return <div className="ama-field"><label className="ama-field-label" htmlFor={id}>{label}</label><select id={id} className={`ama-select${error ? ' ama-select--error' : ''}`} required aria-describedby={error ? `${id}-error` : undefined} {...selectProps}>{children}</select>{error && <span id={`${id}-error`} className="ama-error ama-field-error" role="alert">{error}</span>}</div>
}

function TemporaryPasswordModal({ password, onClose }) {
  const [copyError, setCopyError] = useState('')
  const [copyStatus, setCopyStatus] = useState('')

  async function copy() {
    try {
      await navigator.clipboard.writeText(password)
      setCopyError('')
      setCopyStatus('Contraseña copiada.')
    } catch {
      setCopyStatus('')
      setCopyError('No se pudo copiar la contraseña. Cópiala manualmente.')
    }
  }
  return <Modal title="Contraseña temporal" onClose={onClose}><div className="ama-password ama-password-modal"><p>Guarda esta contraseña ahora. No volverá a mostrarse.</p><output className="ama-password-value">{password}</output>{copyError && <p className="ama-error ama-password-error" role="alert">{copyError}</p>}{copyStatus && <p className="ama-password-status" role="status">{copyStatus}</p>}<footer className="ama-modal-footer ama-modal-actions ama-password-modal-actions"><button type="button" className="ama-button ama-button--primary ama-password-copy" onClick={copy} data-autofocus>Copiar contraseña</button><button type="button" className="ama-button ama-button--secondary" onClick={onClose}>Cerrar</button></footer></div></Modal>
}

export default function AdminMasterAssignmentsPage() {
  const [assignments, setAssignments] = useState([])
  const [eligibleProfiles, setEligibleProfiles] = useState([])
  const [countries, setCountries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refreshError, setRefreshError] = useState('')
  const [filter, setFilter] = useState('active')
  const [modal, setModal] = useState(null)

  async function load({ refresh = false } = {}) {
    setLoading(true)
    if (refresh) setRefreshError('')
    else setError('')
    try {
      const data = await getAdminMasterAssignments()
      setAssignments(assignmentsFrom(data))
      setEligibleProfiles(data?.eligible_profiles || [])
      setCountries(data?.countries || [])
    } catch (requestError) {
      const message = requestError.message || 'No se pudieron cargar las asignaciones de Admin Master.'
      if (refresh) setRefreshError(message)
      else setError(message)
    } finally {
      setLoading(false)
    }
  }

  // The initial request is intentionally issued once when the Systems-only page mounts.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load() }, [])

  async function create(body) {
    const result = await createAdminMasterAssignment(body)
    setModal(result?.password_temporal ? { type: 'password', password: result.password_temporal } : null)
    void load({ refresh: true })
  }

  async function revoke(assignment, body) {
    await revokeAdminMasterAssignment(assignment.id || assignment.assignment_id, body)
    setModal(null)
    void load({ refresh: true })
  }

  const visibleAssignments = filter === 'active' ? assignments.filter((assignment) => assignment.is_current === true) : assignments
  const activeProfileIds = new Set(assignments
    .filter((assignment) => assignment.is_current === true)
    .map(assignmentProfileId)
    .filter((profileId) => profileId !== undefined && profileId !== null)
    .map(String))
  const availableProfiles = eligibleProfiles.filter((profile) => !activeProfileIds.has(String(profile.id)))
  return <main className="ama-page">
    <header className="ama-page-header"><div className="ama-page-heading"><h1>Admin Masters</h1><p>Asignaciones de Admin Master por país.</p></div><button type="button" className="ama-button ama-button--primary ama-page-action" onClick={() => setModal({ type: 'assignment' })}>Nueva asignación</button></header>
    <div className="ama-filter" role="group" aria-label="Filtro de estado"><button type="button" className="ama-filter-button" aria-pressed={filter === 'active'} onClick={() => setFilter('active')}>Activas</button><button type="button" className="ama-filter-button" aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>Todas</button></div>
    {loading ? <p className="ama-state ama-loading-state">Cargando asignaciones...</p> : error ? <section className="ama-state ama-error-state" role="alert"><p>{error}</p><button type="button" className="ama-button ama-button--secondary ama-retry-button" onClick={() => void load()}>Reintentar</button></section> : visibleAssignments.length === 0 ? <p className="ama-state ama-empty-state">No hay asignaciones para mostrar.</p> : <div className="ama-table-card"><table><thead><tr><th>Perfil</th><th>Email</th><th>Organización</th><th>País</th><th>Inicio</th><th>Fin</th><th>Vigencia</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>{visibleAssignments.map((assignment) => <tr key={assignment.id || assignment.assignment_id || `${email(assignment)}-${assignment.starts_on || assignment.effective_on}`}><td>{profileName(assignment)}</td><td>{email(assignment)}</td><td>{assignment.organization?.name || '—'}</td><td>{country(assignment)}</td><td>{assignment.starts_on || assignment.effective_on || '—'}</td><td>{assignment.ends_on || '—'}</td><td>{assignment.is_current === true ? 'Vigente' : 'Histórica'}</td><td>{lifecycleState(assignment)}</td><td>{assignment.is_current === true && <button type="button" className="ama-button ama-button--secondary ama-revoke-button" onClick={() => setModal({ type: 'revoke', assignment })}>Revocar</button>}</td></tr>)}</tbody></table></div>}
    {refreshError && <section className="ama-state ama-error-state" role="alert" aria-label="Error de actualización"><p>{refreshError}</p><button type="button" className="ama-button ama-button--secondary ama-retry-button" onClick={() => void load({ refresh: true })}>Reintentar actualización</button></section>}
    {modal?.type === 'assignment' && <AssignmentModal eligibleProfiles={availableProfiles} activeProfileIds={activeProfileIds} countries={countries} onClose={() => setModal(null)} onSubmit={create} submissionInFlightRef={submissionInFlight} />}
    {modal?.type === 'revoke' && <RevokeModal onClose={() => setModal(null)} onSubmit={(body) => revoke(modal.assignment, body)} submissionInFlightRef={revokeSubmissionInFlight} />}
    {modal?.type === 'password' && <TemporaryPasswordModal password={modal.password} onClose={() => setModal(null)} />}
  </main>
}
