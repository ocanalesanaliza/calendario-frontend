import { useEffect, useState } from 'react'
import {
  assignArea,
  createGerenteOperaciones,
  deactivateGerenteOperaciones,
  getGerentesOperaciones,
  reassignArea,
  resetGerenteOperacionesPassword,
  updateGerenteOperaciones,
} from '../services/gerentesOperacionesService'
// Kit de componentes compartido con Tuvet; los colores de Analiza llegan con la clase .tema-analiza.
import { Avatar, Aviso, EstadoCarga, Field, FormSection, Icono, Modal, PageHeader, SelectableList } from '../../tuvet/components/TuvetUi'
import { useConfirmacion } from '../../tuvet/components/useConfirmacion'
import '../../tuvet/tuvet.css'
// Se conserva: otras páginas podrían depender de sus clases genéricas (todos los CSS son globales).
import './GerentesOperacionesPage.css'
import './GerentesOperacionesKit.css'

const identityFields = ['nombre', 'apellido', 'email']
const ESTADOS = { todos: 'Todos', activos: 'Activos', inactivos: 'Inactivos' }

const normalizar = (texto) => String(texto ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
const etiquetaCampo = (field) => (field === 'email' ? 'Correo electrónico' : field[0].toUpperCase() + field.slice(1))

function fieldError(errors, field) {
  return Array.isArray(errors[field]) ? errors[field].join(' ') : errors[field]
}

function validationErrors(error) {
  if (error.status !== 400 || !error.fields || typeof error.fields !== 'object' || Array.isArray(error.fields)) {
    return {}
  }

  return error.fields
}

function hasFieldErrors(errors, fields) {
  return fields.some((field) => Boolean(fieldError(errors, field)))
}

function messageFor(error, fallback) {
  if (error.status === 403) return 'No tienes permisos para realizar esta acción.'
  if (error.status === 404) return 'El registro solicitado ya no existe.'

  return error.message || fallback
}

function passwordRecipientName(result, fallbackName) {
  return result.gerente_operaciones?.nombre
    || result.go?.nombre
    || result.gerente?.nombre
    || result.nombre
    || fallbackName
}

function IdentityFields({ prefix, form, setForm, errors }) {
  return (
    <>
      <div className="tuvet-form-grid">
        {identityFields.filter((field) => field !== 'email').map((field) => (
          <Field key={field} label={etiquetaCampo(field)} required error={fieldError(errors, field)}>
            <input
              id={`${prefix}-${field}`}
              type="text"
              value={form[field]}
              onChange={(event) => setForm({ ...form, [field]: event.target.value })}
              required
              autoComplete="off"
            />
          </Field>
        ))}
      </div>
      <Field label={etiquetaCampo('email')} required error={fieldError(errors, 'email')}>
        <input
          id={`${prefix}-email`}
          type="email"
          value={form.email}
          onChange={(event) => setForm({ ...form, email: event.target.value })}
          required
          autoComplete="off"
          placeholder="nombre@empresa.com"
        />
      </Field>
    </>
  )
}

function IdentityModal({ gerente, onClose, onSubmit }) {
  const [form, setForm] = useState({
    nombre: gerente.nombre || '',
    apellido: gerente.apellido || '',
    email: gerente.email || '',
  })
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  async function submit(event) {
    event.preventDefault()

    // Solo se envían los campos que cambiaron.
    const body = Object.fromEntries(
      Object.entries(form).filter(([key, value]) => value.trim() !== (gerente[key] || '').trim()),
    )

    if (!Object.keys(body).length) {
      onClose()
      return
    }

    setSaving(true)
    setErrors({})

    try {
      await onSubmit(body)
    } catch (error) {
      setErrors({
        ...validationErrors(error),
        detail: messageFor(error, 'No se pudieron guardar los cambios.'),
      })
      setSaving(false)
    }
  }

  return (
    <Modal
      title="Editar gerente de operaciones"
      subtitle={`${gerente.nombre} ${gerente.apellido || ''}`.trim()}
      icon="editar"
      onClose={saving ? () => {} : onClose}
      footer={(
        <>
          <button type="button" className="tuvet-btn tuvet-btn-secondary" onClick={onClose} disabled={saving}>Cancelar</button>
          <button type="submit" form="gok-editar-form" className="tuvet-btn" disabled={saving} aria-busy={saving}>{saving ? 'Guardando...' : 'Guardar cambios'}</button>
        </>
      )}
    >
      <form id="gok-editar-form" className="tuvet-form" onSubmit={submit}>
        {errors.detail && !hasFieldErrors(errors, identityFields) && <Aviso tipo="error">{errors.detail}</Aviso>}
        <IdentityFields prefix="go" form={form} setForm={setForm} errors={errors} />
      </form>
    </Modal>
  )
}

function AreaModal({ gerente, availableAreas, onClose, onAssign, onReassign }) {
  const [areaId, setAreaId] = useState('')
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  async function submit(operation) {
    setSaving(true)
    setErrors({})

    try {
      if (operation === 'assign') {
        await onAssign(Number(areaId))
      } else {
        await onReassign(Number(areaId))
      }
    } catch (error) {
      const conflict = operation === 'assign'
        ? 'El área seleccionada no está disponible para una asignación inmediata.'
        : 'No se puede programar la reasignación porque el área tiene un conflicto actual o futuro.'

      setErrors({
        ...validationErrors(error),
        detail: error.status === 409 ? conflict : messageFor(error, 'No se pudo actualizar el área.'),
      })
      setSaving(false)
    }
  }

  return (
    <Modal
      title="Gestionar áreas"
      subtitle={`${gerente.nombre} ${gerente.apellido || ''}`.trim()}
      icon="edificio"
      wide
      onClose={saving ? () => {} : onClose}
      footer={<button type="button" className="tuvet-btn tuvet-btn-secondary" onClick={onClose} disabled={saving}>Cancelar</button>}
    >
      <div className="tuvet-form">
        <div className="gok-areas-actuales">
          <span className="tuvet-hint">Áreas actuales</span>
          <AreasTags areas={gerente.areas} />
        </div>

        <Field label="Área" error={fieldError(errors, 'area_id')}>
          <select id="go-area" value={areaId} onChange={(event) => setAreaId(event.target.value)} required>
            <option value="">Seleccionar área</option>
            {availableAreas.map((area) => (
              <option value={area.id} key={area.id}>{area.codigo} — {area.nombre}</option>
            ))}
          </select>
        </Field>

        <div className="gok-operaciones" role="group" aria-label="Operación">
          <div className="gok-operacion">
            <div>
              <strong>Asignar ahora</strong>
              <p className="tuvet-hint">Si el área está libre, queda a su cargo desde hoy.</p>
            </div>
            <button type="button" className="tuvet-btn tuvet-btn-secondary" disabled={saving || !areaId} onClick={() => submit('assign')}>
              {saving ? 'Procesando...' : 'Asignar área disponible'}
            </button>
          </div>
          <div className="gok-operacion">
            <div>
              <strong>Programar reasignación</strong>
              <p className="tuvet-hint">Si el área ya tiene otro gerente, se la pasa a este.</p>
            </div>
            <button type="button" className="tuvet-btn" disabled={saving || !areaId} onClick={() => submit('reassign')}>
              {saving ? 'Procesando...' : 'Reasignar área ocupada'}
            </button>
          </div>
        </div>

        <Aviso tipo="error">{errors.detail}</Aviso>
      </div>
    </Modal>
  )
}

function PasswordModal({ result, recipientName, onClose }) {
  const [status, setStatus] = useState('')
  const deliveryPending = result.notification_delivery_status === 'notification_delivery_pending_retry'
  const nombre = passwordRecipientName(result, recipientName)

  async function copy() {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard API unavailable')

      await navigator.clipboard.writeText(result.password_temporal)
      setStatus('¡Copiado!')
    } catch {
      setStatus('No se pudo copiar la contraseña. Cópiala manualmente.')
    }
  }

  // La contraseña temporal solo vive en el estado del modal; se descarta al cerrarlo.
  return (
    <Modal
      title="Contraseña temporal"
      subtitle={nombre}
      icon="llave"
      tone="success"
      onClose={onClose}
      footer={<button type="button" className="tuvet-btn" onClick={onClose}>Entendido</button>}
    >
      <div className="tuvet-form">
        <p>Contraseña temporal para {nombre}. No se volverá a mostrar.</p>
        <div className="tuvet-password-box">
          <span className="tuvet-password" aria-label="Contraseña temporal">{result.password_temporal}</span>
          <button type="button" className="tuvet-btn tuvet-btn-secondary" onClick={copy}>Copiar contraseña</button>
        </div>
        {status && <p className="tuvet-hint" role="status">{status}</p>}
        {deliveryPending && (
          <Aviso tipo="warning">
            La cuenta se creó, pero el correo se entregará en un reintento. Comparte la contraseña temporal por un canal seguro si fuera necesario.
          </Aviso>
        )}
      </div>
    </Modal>
  )
}

function CreateModal({ areas, onClose, onSubmit }) {
  const [form, setForm] = useState({ nombre: '', apellido: '', email: '', area_ids: [] })
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  async function submit(event) {
    event.preventDefault()
    setSaving(true)
    setErrors({})

    const body = {
      nombre: form.nombre.trim(),
      apellido: form.apellido.trim(),
      email: form.email.trim(),
      ...(form.area_ids.length ? { area_ids: form.area_ids } : {}),
    }

    try {
      await onSubmit(body)
    } catch (error) {
      setErrors({
        ...validationErrors(error),
        detail: messageFor(error, 'No se pudo crear el gerente.'),
      })
      setSaving(false)
    }
  }

  return (
    <Modal
      title="Nuevo gerente de operaciones"
      subtitle="Recibirá una contraseña temporal por correo."
      icon="persona"
      wide
      onClose={saving ? () => {} : onClose}
      footer={(
        <>
          <button type="button" className="tuvet-btn tuvet-btn-secondary" onClick={onClose} disabled={saving}>Cancelar</button>
          <button type="submit" form="gok-crear-form" className="tuvet-btn" disabled={saving} aria-busy={saving}>{saving ? 'Creando...' : 'Crear gerente'}</button>
        </>
      )}
    >
      <form id="gok-crear-form" className="tuvet-form" onSubmit={submit}>
        {errors.detail && !hasFieldErrors(errors, identityFields) && <Aviso tipo="error">{errors.detail}</Aviso>}
        <FormSection title="Datos de la persona">
          <IdentityFields prefix="create-go" form={form} setForm={setForm} errors={errors} />
        </FormSection>
        <FormSection title="Áreas" description="Opcional. Puedes asignarlas después desde la tabla.">
          <SelectableList
            items={areas}
            selected={form.area_ids}
            onChange={(ids) => setForm((current) => ({ ...current, area_ids: ids }))}
            getLabel={(area) => `${area.codigo} — ${area.nombre}`}
            searchPlaceholder="Buscar área"
            emptyText="No hay áreas disponibles."
            disabled={saving}
          />
          {fieldError(errors, 'area_ids') && (
            <span className="tuvet-field-error" role="alert"><Icono nombre="error" className="tuvet-field-error-icon" />{fieldError(errors, 'area_ids')}</span>
          )}
        </FormSection>
      </form>
    </Modal>
  )
}

function AreasTags({ areas }) {
  if (!areas?.length) return <span className="tuvet-hint">Sin áreas asignadas</span>
  return (
    <span className="gok-areas">
      {areas.map((area) => (
        <span key={area.id ?? area.codigo ?? area.nombre} className="tuvet-tag" title={area.nombre}>{area.codigo || area.nombre}</span>
      ))}
    </span>
  )
}

export default function GerentesOperacionesPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modal, setModal] = useState(null)
  const [aviso, setAviso] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [estado, setEstado] = useState('todos')
  const [confirmar, dialogo] = useConfirmacion()

  async function loadData() {
    setLoading(true)
    setError('')

    try {
      setData(await getGerentesOperaciones())
    } catch (requestError) {
      setError(messageFor(requestError, 'No se pudieron cargar los gerentes de operaciones.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData()
  }, [])

  const close = () => setModal(null)
  const mutate = async (action) => {
    const result = await action()
    await loadData()
    close()
    return result
  }

  function abrir(type, gerente = null) {
    setAviso('')
    setModal({ type, gerente })
  }

  async function desactivar(gerente) {
    setAviso('')
    const ok = await confirmar({
      title: 'Desactivar gerente',
      message: `¿Deseas desactivar a ${gerente.nombre}? Ya no podrá iniciar sesión.`,
      detail: gerente.areas?.length ? `Tiene a su cargo: ${gerente.areas.map((area) => area.codigo || area.nombre).join(', ')}.` : undefined,
      confirmLabel: 'Desactivar',
      accion: async () => {
        try {
          await deactivateGerenteOperaciones(gerente.id)
        } catch (requestError) {
          throw new Error(messageFor(requestError, 'No se pudo completar la acción.'), { cause: requestError })
        }
      },
    })
    if (!ok) return
    setAviso(`${gerente.nombre} fue desactivado.`)
    await loadData()
  }

  function resetear(gerente) {
    setAviso('')
    void confirmar({
      title: 'Resetear contraseña',
      message: `Se generará una nueva contraseña temporal para ${gerente.nombre}.`,
      detail: 'Deberá cambiarla al iniciar sesión. La contraseña actual dejará de funcionar.',
      confirmLabel: 'Resetear',
      tone: 'primary',
      accion: async () => {
        let result
        try {
          result = await resetGerenteOperacionesPassword(gerente.id)
        } catch (requestError) {
          throw new Error(messageFor(requestError, 'No se pudo completar la acción.'), { cause: requestError })
        }
        await loadData()
        setModal({ type: 'password', result, recipientName: gerente.nombre })
      },
    })
  }

  const gerentes = data?.results || []
  const areas = data?.areas_disponibles || []
  const termino = normalizar(busqueda.trim())
  const cumple = (g, filtro = estado) => (
    (!termino || normalizar(`${g.nombre} ${g.apellido ?? ''} ${g.email} ${(g.areas ?? []).map((a) => `${a.codigo ?? ''} ${a.nombre ?? ''}`).join(' ')}`).includes(termino))
    && (filtro === 'todos' || (filtro === 'activos' ? g.activo : !g.activo))
  )
  const filtrados = gerentes.filter((g) => cumple(g))
  const activos = gerentes.filter((g) => g.activo).length
  const sinAreas = gerentes.filter((g) => g.activo && !g.areas?.length).length
  const hayFiltros = Boolean(termino) || estado !== 'todos'

  return (
    <div className="tema-analiza tuvet-page gerentes-operaciones-kit">
      <PageHeader
        title="Gerentes de operaciones"
        description={`${activos} activo${activos !== 1 ? 's' : ''} de ${gerentes.length}${sinAreas ? ` · ${sinAreas} sin áreas asignadas` : ''}.`}
      >
        <button type="button" className="tuvet-btn" onClick={() => abrir('create')}>Nuevo gerente de operaciones</button>
      </PageHeader>

      <div className="gok-barra">
        <div className="tuvet-search-bar" role="search">
          <Icono nombre="buscar" className="tuvet-search-icon" />
          <input
            type="search"
            value={busqueda}
            onChange={(event) => setBusqueda(event.target.value)}
            placeholder="Buscar por nombre, correo o área"
            aria-label="Buscar por nombre, correo o área"
          />
          {busqueda && <button type="button" className="tuvet-btn tuvet-btn-ghost" onClick={() => setBusqueda('')}>Limpiar</button>}
        </div>
        <div className="tuvet-filtros" role="group" aria-label="Filtrar por estado">
          {Object.entries(ESTADOS).map(([clave, etiqueta]) => (
            <button
              key={clave}
              type="button"
              className={`tuvet-chip ${estado === clave ? 'active' : ''}`}
              aria-pressed={estado === clave}
              onClick={() => setEstado(clave)}
            >
              {etiqueta} ({gerentes.filter((g) => cumple(g, clave)).length})
            </button>
          ))}
        </div>
      </div>

      <Aviso tipo="success">{aviso}</Aviso>

      <EstadoCarga
        loading={loading}
        error={error}
        onRetry={loadData}
        empty={!filtrados.length}
        emptyText={gerentes.length && hayFiltros ? 'Ningún gerente coincide con la búsqueda o el filtro.' : 'No hay gerentes de operaciones registrados.'}
        emptyAction={gerentes.length && hayFiltros
          ? <button type="button" className="tuvet-btn tuvet-btn-secondary" onClick={() => { setBusqueda(''); setEstado('todos') }}>Quitar filtros</button>
          : <button type="button" className="tuvet-btn" onClick={() => abrir('create')}>Crear el primero</button>}
      >
        <div className="tuvet-card gok-tabla-card">
          <div className="tuvet-table-wrap">
            <table className="tuvet-table gok-tabla">
              <thead>
                <tr>
                  <th scope="col">Gerente</th>
                  <th scope="col">Áreas</th>
                  <th scope="col">Estado</th>
                  <th scope="col"><span className="tuvet-visually-hidden">Acciones</span></th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((gerente) => {
                  const nombreCompleto = `${gerente.nombre} ${gerente.apellido || ''}`.trim()
                  return (
                    <tr key={gerente.id} className={gerente.activo ? '' : 'tuvet-row-inactiva'}>
                      <td>
                        <span className="gok-persona">
                          <Avatar nombre={nombreCompleto} size="sm" />
                          <span className="gok-persona-texto">
                            <strong className="gok-nombre"><span>{gerente.nombre}</span> {gerente.apellido && <span>{gerente.apellido}</span>}</strong>
                            <span className="gok-email" title={gerente.email}>{gerente.email}</span>
                          </span>
                        </span>
                      </td>
                      <td><AreasTags areas={gerente.areas} /></td>
                      <td>
                        <span className="tuvet-badges">
                          <span className={`tuvet-badge ${gerente.activo ? 'tuvet-badge-aprobada' : 'tuvet-badge-cancelada'}`}>
                            <Icono nombre={gerente.activo ? 'check' : 'cerrar'} className="tuvet-badge-icon" />
                            {gerente.activo ? 'Activo' : 'Inactivo'}
                          </span>
                          {gerente.debe_cambiar_password && (
                            <span className="tuvet-badge tuvet-badge-pendiente" title="Aún usa la contraseña temporal">
                              <Icono nombre="llave" className="tuvet-badge-icon" />
                              Cambiar contraseña
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="tuvet-cell-acciones">
                        <button type="button" className="tuvet-icon-action" title="Editar" aria-label={`Editar a ${nombreCompleto}`} onClick={() => abrir('edit', gerente)}>
                          <Icono nombre="editar" />
                        </button>
                        <button type="button" className="tuvet-icon-action" title="Gestionar áreas" aria-label={`Gestionar áreas de ${nombreCompleto}`} onClick={() => abrir('areas', gerente)}>
                          <Icono nombre="edificio" />
                        </button>
                        <button type="button" className="tuvet-icon-action" title="Resetear contraseña" aria-label={`Resetear contraseña de ${nombreCompleto}`} onClick={() => resetear(gerente)}>
                          <Icono nombre="llave" />
                        </button>
                        {gerente.activo && (
                          <button type="button" className="tuvet-icon-action tuvet-icon-action-danger" title="Desactivar" aria-label={`Desactivar a ${nombreCompleto}`} onClick={() => desactivar(gerente)}>
                            <Icono nombre="prohibido" />
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="gok-pie" aria-live="polite">Mostrando {filtrados.length} de {gerentes.length} gerentes</p>
        </div>
      </EstadoCarga>

      {modal?.type === 'create' && (
        <CreateModal
          areas={areas}
          onClose={close}
          onSubmit={async (form) => {
            const result = await createGerenteOperaciones(form)
            await loadData()
            setModal({ type: 'password', result, recipientName: form.nombre })
          }}
        />
      )}
      {modal?.type === 'edit' && (
        <IdentityModal
          gerente={modal.gerente}
          onClose={close}
          onSubmit={async (body) => {
            await mutate(() => updateGerenteOperaciones(modal.gerente.id, body))
            setAviso('Cambios guardados.')
          }}
        />
      )}
      {modal?.type === 'areas' && (
        <AreaModal
          gerente={modal.gerente}
          availableAreas={areas}
          onClose={close}
          onAssign={async (id) => { await mutate(() => assignArea(modal.gerente.id, id)); setAviso('Área asignada correctamente.') }}
          onReassign={async (id) => { await mutate(() => reassignArea(modal.gerente.id, id)); setAviso('Reasignación programada correctamente.') }}
        />
      )}
      {modal?.type === 'password' && (
        <PasswordModal result={modal.result} recipientName={modal.recipientName} onClose={close} />
      )}
      {dialogo}
    </div>
  )
}
