import { cloneElement, isValidElement, useEffect, useId, useRef, useState } from 'react'
import { ESTADOS_OCURRENCIA, MESES, moverMes, nombrePersona } from '../utils/formato'

const ICONOS = {
  persona: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><line x1="19" y1="8" x2="19" y2="14" /><line x1="22" y1="11" x2="16" y2="11" /></>,
  equipo: <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>,
  tarea: <><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></>,
  plantilla: <><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></>,
  enviar: <><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></>,
  rechazar: <><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></>,
  llave: <><circle cx="7.5" cy="15.5" r="5.5" /><path d="M21 2l-9.6 9.6" /><path d="M15.5 7.5l3 3L22 7l-3-3" /></>,
  edificio: <><rect x="4" y="2" width="16" height="20" rx="2" /><path d="M9 22v-4h6v4M8 6h.01M16 6h.01M12 6h.01M8 10h.01M16 10h.01M12 10h.01M8 14h.01M16 14h.01M12 14h.01" /></>,
  alerta: <><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></>,
  archivo: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></>,
  subir: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></>,
  editar: <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></>,
  vacio: <><circle cx="12" cy="12" r="10" /><path d="M8 15h8M9 9h.01M15 9h.01" /></>,
  error: <><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></>,
  check: <><polyline points="20 6 9 17 4 12" /></>,
  info: <><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></>,
  cerrar: <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>,
  buscar: <><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></>,
  reloj: <><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></>,
  'quitar-persona': <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><line x1="17" y1="11" x2="23" y2="11" /></>,
  prohibido: <><circle cx="12" cy="12" r="10" /><line x1="4.93" y1="4.93" x2="19.07" y2="19.07" /></>,
  calendario: <><rect x="3" y="4" width="18" height="17" rx="2" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></>,
}

export function Icono({ nombre, className = 'tuvet-icon' }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {ICONOS[nombre]}
    </svg>
  )
}

export function PageHeader({ title, description, children }) {
  return (
    <div className="tuvet-page-header">
      <div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {children && <div className="tuvet-page-actions">{children}</div>}
    </div>
  )
}

const ICONO_AVISO = { error: 'error', success: 'check', warning: 'alerta', info: 'info' }

// Los avisos se anuncian a lectores de pantalla sin robar el foco.
export function Aviso({ tipo = 'info', children }) {
  if (!children) return null
  return (
    <div className={`tuvet-aviso tuvet-aviso-${tipo}`} role={tipo === 'error' ? 'alert' : 'status'} aria-live={tipo === 'error' ? 'assertive' : 'polite'}>
      <Icono nombre={ICONO_AVISO[tipo]} className="tuvet-aviso-icon" />
      <p>{children}</p>
    </div>
  )
}

export function EstadoCarga({ loading, error, onRetry, empty, emptyText, emptyAction, children }) {
  if (loading) {
    return (
      <div className="tuvet-skeleton" role="status" aria-label="Cargando">
        <span /><span /><span />
      </div>
    )
  }
  if (error) {
    return (
      <div className="tuvet-aviso tuvet-aviso-error tuvet-error-state" role="alert">
        <Icono nombre="error" className="tuvet-aviso-icon" />
        <div>
          <p>{error}</p>
          {onRetry && <button type="button" className="tuvet-btn tuvet-btn-secondary" onClick={onRetry}>Reintentar</button>}
        </div>
      </div>
    )
  }
  if (empty) {
    return (
      <div className="tuvet-empty">
        <Icono nombre="vacio" className="tuvet-empty-icon" />
        <p>{emptyText}</p>
        {emptyAction}
      </div>
    )
  }
  return children
}

// Pila de modales abiertos: Escape y el ciclo de Tab solo actúan sobre el de arriba.
const pilaModales = []
const FOCUSABLES = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function Modal({ title, subtitle, icon, tone = 'primary', onClose, children, footer, wide = false, role = 'dialog' }) {
  const titleId = useId()
  const dialogRef = useRef(null)
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onCloseRef.current = onClose
  })

  useEffect(() => {
    const dialog = dialogRef.current
    const previo = document.activeElement
    pilaModales.push(dialog)

    const enfocables = () => [...dialog.querySelectorAll(FOCUSABLES)].filter((el) => !el.closest('[aria-hidden="true"]'))
    const inicial = dialog.querySelector('.tuvet-modal-body')?.querySelector(FOCUSABLES) ?? enfocables()[0] ?? dialog
    inicial.focus()

    function onKeyDown(event) {
      if (pilaModales[pilaModales.length - 1] !== dialog) return
      if (event.key === 'Escape') {
        event.preventDefault()
        onCloseRef.current()
        return
      }
      if (event.key !== 'Tab') return
      const lista = enfocables()
      if (!lista.length) return
      const primero = lista[0]
      const ultimo = lista[lista.length - 1]
      if (event.shiftKey && document.activeElement === primero) {
        event.preventDefault()
        ultimo.focus()
      } else if (!event.shiftKey && document.activeElement === ultimo) {
        event.preventDefault()
        primero.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      pilaModales.splice(pilaModales.indexOf(dialog), 1)
      if (previo instanceof HTMLElement && previo.isConnected) previo.focus()
    }
  }, [])

  return (
    <div className="tuvet-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onCloseRef.current() }}>
      <div ref={dialogRef} tabIndex={-1} className={`tuvet-modal ${wide ? 'tuvet-modal-wide' : ''}`} role={role} aria-modal="true" aria-labelledby={titleId}>
        <div className="tuvet-modal-header">
          <div className="tuvet-modal-heading">
            {icon && <span className={`tuvet-modal-icon tuvet-modal-icon-${tone}`}><Icono nombre={icon} /></span>}
            <div>
              <h2 id={titleId}>{title}</h2>
              {subtitle && <p className="tuvet-modal-subtitle">{subtitle}</p>}
            </div>
          </div>
          <button type="button" className="tuvet-icon-btn" onClick={() => onCloseRef.current()} aria-label="Cerrar">
            <Icono nombre="cerrar" />
          </button>
        </div>
        <div className="tuvet-modal-body">{children}</div>
        {footer && <div className="tuvet-modal-footer">{footer}</div>}
      </div>
    </div>
  )
}

// Diálogo de confirmación para acciones destructivas o irreversibles.
export function ConfirmDialog({ title, message, detail, confirmLabel = 'Confirmar', tone = 'danger', onConfirm, onCancel }) {
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')

  async function confirmar() {
    setEnviando(true)
    setError('')
    try {
      await onConfirm()
    } catch (err) {
      setError(err.message)
      setEnviando(false)
    }
  }

  return (
    <Modal
      title={title}
      icon={tone === 'danger' ? 'alerta' : 'info'}
      tone={tone}
      role="alertdialog"
      onClose={enviando ? () => {} : onCancel}
      footer={(
        <>
          <button type="button" className="tuvet-btn tuvet-btn-secondary" onClick={onCancel} disabled={enviando}>Cancelar</button>
          <button type="button" className={`tuvet-btn ${tone === 'danger' ? 'tuvet-btn-danger-solid' : ''}`} onClick={confirmar} disabled={enviando} aria-busy={enviando}>
            {enviando ? 'Procesando...' : confirmLabel}
          </button>
        </>
      )}
    >
      <div className="tuvet-form">
        <p className="tuvet-confirm-message">{message}</p>
        {detail && <p className="tuvet-hint">{detail}</p>}
        <Aviso tipo="error">{error}</Aviso>
      </div>
    </Modal>
  )
}

export function FormSection({ title, description, children }) {
  return (
    <fieldset className="tuvet-section">
      {title && <legend className="tuvet-visually-hidden">{title}</legend>}
      {(title || description) && (
        <div className="tuvet-section-header" aria-hidden="true">
          {title && <h3>{title}</h3>}
          {description && <p>{description}</p>}
        </div>
      )}
      <div className="tuvet-section-body">{children}</div>
    </fieldset>
  )
}

// Campo con etiqueta visible, ayuda persistente y error en línea enlazado al control.
export function Field({ label, hint, error, required = false, full = false, children }) {
  const id = useId()
  const controlId = (isValidElement(children) && children.props.id) || `${id}-control`
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined

  const control = isValidElement(children)
    ? cloneElement(children, {
      id: controlId,
      'aria-invalid': error ? true : undefined,
      'aria-describedby': describedBy,
      'aria-required': required || undefined,
    })
    : children

  return (
    <div className={`tuvet-field ${full ? 'tuvet-field-full' : ''} ${error ? 'has-error' : ''}`}>
      <label className="tuvet-label" htmlFor={controlId}>
        {label}
        {required && <span className="tuvet-required" aria-hidden="true"> *</span>}
      </label>
      {control}
      {error && (
        <span id={errorId} className="tuvet-field-error" role="alert">
          <Icono nombre="error" className="tuvet-field-error-icon" />
          {error}
        </span>
      )}
      {hint && <span id={hintId} className="tuvet-hint">{hint}</span>}
    </div>
  )
}

export function Avatar({ persona, nombre, size = 'md' }) {
  const texto = nombre ?? nombrePersona(persona)
  const iniciales = texto.split(/\s+/).filter(Boolean).slice(0, 2).map((parte) => parte[0].toUpperCase()).join('') || '?'
  return <span className={`tuvet-avatar tuvet-avatar-${size}`} aria-hidden="true">{iniciales}</span>
}

export function Toggle({ label, description, checked, onChange, disabled }) {
  const descripcionId = useId()
  return (
    <label className={`tuvet-toggle ${checked ? 'is-on' : ''}`}>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        disabled={disabled}
        aria-describedby={description ? descripcionId : undefined}
      />
      <span className="tuvet-toggle-track" aria-hidden="true"><span className="tuvet-toggle-thumb" /></span>
      <span className="tuvet-toggle-text">
        <span className="tuvet-toggle-label">{label}</span>
        {description && <span id={descripcionId} className="tuvet-hint">{description}</span>}
      </span>
    </label>
  )
}

export function OptionCards({ name, label, value, onChange, options }) {
  return (
    <div className="tuvet-option-cards" role="radiogroup" aria-label={label}>
      {options.map((opcion) => (
        <label key={opcion.value} className={`tuvet-option-card ${value === opcion.value ? 'is-selected' : ''}`}>
          <input type="radio" name={name} checked={value === opcion.value} onChange={() => onChange(opcion.value)} />
          <span className="tuvet-option-check" aria-hidden="true"><Icono nombre="check" /></span>
          <span className="tuvet-option-title">{opcion.label}</span>
          {opcion.description && <span className="tuvet-hint">{opcion.description}</span>}
        </label>
      ))}
    </div>
  )
}

export function ChipToggles({ label, options, selected, onChange, invalid = false, describedBy }) {
  function toggle(valor) {
    onChange(selected.includes(valor) ? selected.filter((item) => item !== valor) : [...selected, valor])
  }
  return (
    <div className={`tuvet-chip-toggles ${invalid ? 'has-error' : ''}`} role="group" aria-label={label} aria-describedby={describedBy}>
      {options.map((opcion) => (
        <button
          key={opcion.value}
          type="button"
          className={`tuvet-chip-toggle ${selected.includes(opcion.value) ? 'is-selected' : ''}`}
          aria-pressed={selected.includes(opcion.value)}
          aria-label={opcion.title ?? opcion.label}
          onClick={() => toggle(opcion.value)}
        >
          {opcion.label}
        </button>
      ))}
    </div>
  )
}

// Lista de selección múltiple con buscador, contador y acciones rápidas.
export function SelectableList({
  items,
  selected,
  onChange,
  getLabel,
  getMeta,
  withAvatar = false,
  searchPlaceholder = 'Buscar',
  emptyText = 'No hay elementos disponibles.',
  disabled = false,
}) {
  const [busqueda, setBusqueda] = useState('')
  const termino = busqueda.trim().toLowerCase()
  const visibles = termino
    ? items.filter((item) => `${getLabel(item)} ${getMeta?.(item) ?? ''}`.toLowerCase().includes(termino))
    : items

  function toggle(id) {
    onChange(selected.includes(id) ? selected.filter((item) => item !== id) : [...selected, id])
  }

  if (!items.length) return <p className="tuvet-state tuvet-state-empty">{emptyText}</p>

  return (
    <div className="tuvet-select">
      <div className="tuvet-select-toolbar">
        <input
          className="tuvet-input tuvet-input-search"
          type="search"
          placeholder={searchPlaceholder}
          value={busqueda}
          onChange={(event) => setBusqueda(event.target.value)}
          aria-label={searchPlaceholder}
        />
        <span className="tuvet-select-count" aria-live="polite">{selected.length} seleccionado(s)</span>
        <button type="button" className="tuvet-btn tuvet-btn-ghost" onClick={() => onChange([...new Set([...selected, ...visibles.map((item) => item.id)])])} disabled={disabled || !visibles.length}>
          Todos
        </button>
        <button type="button" className="tuvet-btn tuvet-btn-ghost" onClick={() => onChange([])} disabled={disabled || !selected.length}>
          Limpiar
        </button>
      </div>
      <div className="tuvet-select-list">
        {visibles.map((item) => {
          const marcado = selected.includes(item.id)
          const meta = getMeta?.(item)
          return (
            <label key={item.id} className={`tuvet-select-item ${marcado ? 'is-selected' : ''}`}>
              <input type="checkbox" checked={marcado} onChange={() => toggle(item.id)} disabled={disabled} />
              {withAvatar && <Avatar nombre={getLabel(item)} size="sm" />}
              <span className="tuvet-select-text">
                <span className="tuvet-select-label">{getLabel(item)}</span>
                {meta && <span className="tuvet-hint">{meta}</span>}
              </span>
            </label>
          )
        })}
        {!visibles.length && <p className="tuvet-state">Sin resultados para “{busqueda}”.</p>}
      </div>
    </div>
  )
}

export function FileDrop({ accept, file, onChange, disabled, hint, formatSize, invalid = false, describedBy }) {
  const inputRef = useRef(null)
  const [arrastrando, setArrastrando] = useState(false)

  function onDrop(event) {
    event.preventDefault()
    setArrastrando(false)
    if (disabled) return
    const dropped = event.dataTransfer.files?.[0]
    if (dropped) onChange(dropped)
  }

  return (
    <div
      className={`tuvet-dropzone ${arrastrando ? 'is-dragging' : ''} ${file ? 'has-file' : ''} ${invalid ? 'has-error' : ''}`}
      onDragOver={(event) => { event.preventDefault(); setArrastrando(true) }}
      onDragLeave={() => setArrastrando(false)}
      onDrop={onDrop}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="tuvet-visually-hidden"
        onChange={(event) => onChange(event.target.files?.[0] ?? null)}
        disabled={disabled}
        tabIndex={-1}
        aria-hidden="true"
      />
      {file ? (
        <div className="tuvet-dropzone-file">
          <span className="tuvet-file-icon"><Icono nombre="archivo" /></span>
          <span className="tuvet-select-text">
            <span className="tuvet-select-label">{file.name}</span>
            {formatSize && <span className="tuvet-hint">{formatSize(file.size)}</span>}
          </span>
          <button
            type="button"
            className="tuvet-btn tuvet-btn-ghost tuvet-text-danger"
            onClick={() => { onChange(null); if (inputRef.current) inputRef.current.value = '' }}
            disabled={disabled}
          >
            Quitar
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="tuvet-dropzone-empty"
          onClick={() => inputRef.current?.click()}
          disabled={disabled}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
        >
          <span className="tuvet-dropzone-icon"><Icono nombre="subir" /></span>
          <span className="tuvet-dropzone-title">Arrastra el archivo aquí o <u>búscalo</u></span>
          {hint && <span className="tuvet-hint">{hint}</span>}
        </button>
      )}
    </div>
  )
}

// La contraseña temporal solo vive en el estado del componente que la recibe y se descarta al cerrar.
export function PasswordTemporalModal({ persona, onClose }) {
  const [copiada, setCopiada] = useState(false)
  if (!persona?.password_temporal) return null

  async function copiar() {
    try {
      await navigator.clipboard.writeText(persona.password_temporal)
      setCopiada(true)
    } catch {
      setCopiada(false)
    }
  }

  return (
    <Modal
      title="Contraseña temporal"
      subtitle={nombrePersona(persona)}
      icon="llave"
      onClose={onClose}
      footer={<button type="button" className="tuvet-btn" onClick={onClose}>Entendido</button>}
    >
      <div className="tuvet-form">
        <p>Entrega esta contraseña a <strong>{nombrePersona(persona)}</strong>. Deberá cambiarla al iniciar sesión.</p>
        <div className="tuvet-password-box">
          <span className="tuvet-password" aria-label="Contraseña temporal">{persona.password_temporal}</span>
          <button type="button" className="tuvet-btn tuvet-btn-secondary" onClick={copiar} aria-live="polite">
            {copiada ? <><Icono nombre="check" /> Copiada</> : 'Copiar'}
          </button>
        </div>
        <Aviso tipo="warning">No volverá a mostrarse después de cerrar esta ventana.</Aviso>
      </div>
    </Modal>
  )
}

export function MesSelector({ value, onChange }) {
  return (
    <div className="tuvet-mes-selector" role="group" aria-label="Mes">
      <button type="button" className="tuvet-btn tuvet-btn-secondary tuvet-btn-icon" onClick={() => onChange(moverMes(value, -1))} aria-label="Mes anterior">‹</button>
      <span className="tuvet-mes-actual" aria-live="polite">{MESES[value.month - 1]} {value.year}</span>
      <button type="button" className="tuvet-btn tuvet-btn-secondary tuvet-btn-icon" onClick={() => onChange(moverMes(value, 1))} aria-label="Mes siguiente">›</button>
    </div>
  )
}

const ICONO_ESTADO = { pendiente: 'info', en_revision: 'enviar', aprobada: 'check', cancelada: 'cerrar' }

// El estado nunca se comunica solo con color: siempre lleva icono y texto.
export function EstadoBadge({ estado, vencida }) {
  return (
    <span className="tuvet-badges">
      <span className={`tuvet-badge tuvet-badge-${estado}`}>
        <Icono nombre={ICONO_ESTADO[estado] ?? 'info'} className="tuvet-badge-icon" />
        {ESTADOS_OCURRENCIA[estado] ?? estado}
      </span>
      {vencida && (
        <span className="tuvet-badge tuvet-badge-vencida">
          <Icono nombre="alerta" className="tuvet-badge-icon" />
          Vencida
        </span>
      )}
    </span>
  )
}

export function Checkbox({ label, checked, onChange, disabled }) {
  return (
    <label className="tuvet-check">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} disabled={disabled} />
      <span>{label}</span>
    </label>
  )
}
