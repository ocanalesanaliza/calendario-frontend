import { useCallback, useEffect, useRef, useState } from 'react'
import { getTareas, createTarea, updateTarea, desactivarTarea, getSubtareas, createSubtarea, updateSubtarea, desactivarSubtarea } from '../services/tareasService'
import RecurrenceSelector from '../components/RecurrenceSelector'
import {
  RECURRENCIA_LABEL,
  TIPOS_CATALOGO,
  normalizarValorRecurrencia,
  validarValorRecurrencia,
} from '../recurrenceConfig'
// Kit de componentes compartido con Tuvet; los colores de Analiza llegan con la clase .tema-analiza.
import {
  Aviso,
  EstadoCarga,
  Field,
  FormSection,
  Icono,
  Modal,
  OptionCards,
  PageHeader,
  Toggle,
} from '../../tuvet/components/TuvetUi'
import { useConfirmacion } from '../../tuvet/components/useConfirmacion'
import { enfocarPrimerError } from '../../tuvet/utils/formularios'
import '../../tuvet/tuvet.css'
// Se conserva por los estilos del selector de recurrencia, compartido con Plantillas y Mis tareas.
import './TareasPage.css'
import './TareasCatalogo.css'

const AMBITO_LABEL = { sucursal: 'Sucursal', area: 'Área' }
const TIPOS_FILTRO_RECURRENCIA = [...TIPOS_CATALOGO, 'variable']
const ESTADOS = { todos: 'Todas', activa: 'Activas', inactiva: 'Inactivas' }

const normalizar = (texto) => String(texto ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

export default function TareasPage() {
  const [tareas, setTareas] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('todos')
  const [filtroEstado, setFiltroEstado] = useState('todos')
  const [filtroAmbito, setFiltroAmbito] = useState('todos')
  const [modal, setModal] = useState(null)
  const [confirmar, dialogo] = useConfirmacion()

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setTareas(await getTareas())
    } catch (err) {
      setError(err.message || 'No se pudieron cargar las tareas.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData()
  }, [loadData])

  async function handleCreate(form) {
    await createTarea(form)
    setModal(null)
    setAviso(`Tarea “${form.nombre}” creada.`)
    await loadData()
  }

  async function handleEdit(id, form) {
    await updateTarea(id, form)
    setModal(null)
    setAviso(`Tarea “${form.nombre}” actualizada.`)
    await loadData()
  }

  async function desactivar(tarea) {
    setAviso('')
    const confirmado = await confirmar({
      title: 'Desactivar tarea',
      message: `¿Desactivar la tarea “${tarea.nombre}”?`,
      detail: 'Dejará de estar disponible para nuevas plantillas y asignaciones.',
      confirmLabel: 'Desactivar',
      accion: () => desactivarTarea(tarea.id_tarea),
    })
    if (!confirmado) return
    setAviso(`Tarea “${tarea.nombre}” desactivada.`)
    await loadData()
  }

  function abrir(tipo, tarea = null) {
    setAviso('')
    setModal({ type: tipo, tarea })
  }

  const termino = normalizar(busqueda.trim())
  const cumple = (t, { estado = filtroEstado, ambito = filtroAmbito } = {}) => (
    (!termino || normalizar(t.nombre).includes(termino))
    && (filtroTipo === 'todos' || t.tipo_recurrencia === filtroTipo)
    && (estado === 'todos' || (estado === 'activa' ? t.activa : !t.activa))
    && (ambito === 'todos' || t.ambito === ambito)
  )
  const filtradas = tareas.filter((t) => cumple(t))
  const activas = tareas.filter((t) => t.activa).length
  const hayFiltros = Boolean(termino) || filtroTipo !== 'todos' || filtroEstado !== 'todos' || filtroAmbito !== 'todos'

  function limpiarFiltros() {
    setBusqueda('')
    setFiltroTipo('todos')
    setFiltroEstado('todos')
    setFiltroAmbito('todos')
  }

  return (
    <div className="tema-analiza tuvet-page tareas-catalogo">
      <PageHeader
        title="Catálogo de tareas"
        description={`${activas} activa${activas !== 1 ? 's' : ''} de ${tareas.length} en total. Es la fuente oficial de nombre, recurrencia y peso de cada tarea.`}
      >
        <button type="button" className="tuvet-btn" onClick={() => abrir('crear')}>+ Nueva tarea</button>
      </PageHeader>

      <div className="tuvet-search-bar" role="search">
        <Icono nombre="buscar" className="tuvet-search-icon" />
        <input
          type="search"
          value={busqueda}
          onChange={(event) => setBusqueda(event.target.value)}
          placeholder="Buscar tarea por nombre"
          aria-label="Buscar tarea por nombre"
        />
        {busqueda && <button type="button" className="tuvet-btn tuvet-btn-ghost" onClick={() => setBusqueda('')}>Limpiar</button>}
      </div>

      <section className="tc-filtros" aria-label="Filtros">
        <div className="tc-filtro-grupo">
          <span className="tc-filtro-titulo" id="tc-filtro-estado">Estado</span>
          <div className="tuvet-filtros" role="group" aria-labelledby="tc-filtro-estado">
            {Object.entries(ESTADOS).map(([clave, etiqueta]) => (
              <button
                key={clave}
                type="button"
                className={`tuvet-chip ${filtroEstado === clave ? 'active' : ''}`}
                aria-pressed={filtroEstado === clave}
                onClick={() => setFiltroEstado(clave)}
              >
                {etiqueta} ({tareas.filter((t) => cumple(t, { estado: clave })).length})
              </button>
            ))}
          </div>
        </div>
        <div className="tc-filtro-grupo">
          <span className="tc-filtro-titulo" id="tc-filtro-ambito">Ámbito</span>
          <div className="tuvet-filtros" role="group" aria-labelledby="tc-filtro-ambito">
            {[['todos', 'Todos'], ...Object.entries(AMBITO_LABEL)].map(([clave, etiqueta]) => (
              <button
                key={clave}
                type="button"
                className={`tuvet-chip ${filtroAmbito === clave ? 'active' : ''}`}
                aria-pressed={filtroAmbito === clave}
                onClick={() => setFiltroAmbito(clave)}
              >
                {etiqueta} ({tareas.filter((t) => cumple(t, { ambito: clave })).length})
              </button>
            ))}
          </div>
        </div>
        <label className="tuvet-field tc-filtro-tipo">
          <span className="tuvet-label">Recurrencia</span>
          <select value={filtroTipo} onChange={(event) => setFiltroTipo(event.target.value)}>
            <option value="todos">Todos los tipos</option>
            {TIPOS_FILTRO_RECURRENCIA.map((value) => (
              <option key={value} value={value}>{RECURRENCIA_LABEL[value]}</option>
            ))}
          </select>
        </label>
      </section>

      <Aviso tipo="success">{aviso}</Aviso>

      <EstadoCarga
        loading={loading}
        error={error}
        onRetry={loadData}
        empty={!filtradas.length}
        emptyText={hayFiltros ? 'Ninguna tarea coincide con los filtros aplicados.' : 'Todavía no hay tareas en el catálogo. Crea la primera para poder incluirla en plantillas.'}
        emptyAction={hayFiltros
          ? <button type="button" className="tuvet-btn tuvet-btn-secondary" onClick={limpiarFiltros}>Quitar filtros</button>
          : <button type="button" className="tuvet-btn" onClick={() => abrir('crear')}>Crear tarea</button>}
      >
        <div className="tuvet-card tc-tabla-card">
          <div className="tuvet-table-wrap">
            <table className="tuvet-table tc-tabla">
              <thead>
                <tr>
                  <th scope="col">Tarea</th>
                  <th scope="col">Ámbito</th>
                  <th scope="col">Recurrencia</th>
                  <th scope="col" className="tc-num">Peso</th>
                  <th scope="col">Características</th>
                  <th scope="col">Estado</th>
                  <th scope="col"><span className="tuvet-visually-hidden">Acciones</span></th>
                </tr>
              </thead>
              <tbody>
                {filtradas.map((t) => (
                  <tr key={t.id_tarea} className={t.activa ? '' : 'tuvet-row-inactiva'}>
                    <td><strong>{t.nombre}</strong></td>
                    <td>{AMBITO_LABEL[t.ambito] ?? t.ambito}</td>
                    <td><span className="tuvet-badge tuvet-badge-en_revision">{t.recurrencia_label ?? RECURRENCIA_LABEL[t.tipo_recurrencia] ?? t.tipo_recurrencia}</span></td>
                    <td className="tc-num">{t.peso}</td>
                    <td>
                      <span className="tuvet-tags">
                        {t.es_recordatorio && <span className="tuvet-tag">Recordatorio</span>}
                        {t.bloquea_jornada_posterior && <span className="tuvet-tag tuvet-tag-retraso">Bloquea jornada</span>}
                        {!t.es_recordatorio && !t.bloquea_jornada_posterior && <span className="tuvet-hint">—</span>}
                      </span>
                    </td>
                    <td>
                      <span className={`tuvet-badge ${t.activa ? 'tuvet-badge-aprobada' : 'tuvet-badge-cancelada'}`}>
                        <Icono nombre={t.activa ? 'check' : 'cerrar'} className="tuvet-badge-icon" />
                        {t.activa ? 'Activa' : 'Inactiva'}
                      </span>
                    </td>
                    <td className="tuvet-cell-acciones">
                      <button type="button" className="tuvet-btn tuvet-btn-secondary" onClick={() => abrir('subtareas', t)}>Subtareas</button>
                      <button type="button" className="tuvet-btn tuvet-btn-secondary" onClick={() => abrir('editar', t)}>Editar</button>
                      {t.activa && <button type="button" className="tuvet-btn tuvet-btn-danger" onClick={() => desactivar(t)}>Desactivar</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="tc-pie" aria-live="polite">Mostrando {filtradas.length} de {tareas.length} tareas</p>
        </div>
      </EstadoCarga>

      {modal?.type === 'crear' && (
        <TareaModal onSubmit={handleCreate} onClose={() => setModal(null)} />
      )}
      {modal?.type === 'editar' && (
        <TareaModal inicial={modal.tarea} onSubmit={(form) => handleEdit(modal.tarea.id_tarea, form)} onClose={() => setModal(null)} />
      )}
      {modal?.type === 'subtareas' && (
        <SubtareasModal tarea={modal.tarea} onClose={() => setModal(null)} />
      )}
      {dialogo}
    </div>
  )
}

/* ── Formulario de tarea ── */

function validarTarea(form) {
  const errores = {}
  if (!form.nombre.trim()) errores.nombre = 'Escribe el nombre de la tarea; es el que verán plantillas y sucursales.'
  const peso = Number(form.peso)
  if (form.peso === '' || Number.isNaN(peso)) errores.peso = 'Indica el peso con un número, por ejemplo 1.00.'
  else if (peso < 0) errores.peso = 'El peso no puede ser negativo.'
  const errorRecurrencia = validarValorRecurrencia(form.tipo_recurrencia, form.valor_recurrencia)
  if (errorRecurrencia) errores.recurrencia = errorRecurrencia
  return errores
}

function TareaModal({ inicial, onSubmit, onClose }) {
  const [form, setForm] = useState({
    nombre:                   inicial?.nombre ?? '',
    ambito:                   inicial?.ambito ?? 'sucursal',
    tipo_recurrencia:         inicial?.tipo_recurrencia ?? 'diario',
    valor_recurrencia:        normalizarValorRecurrencia(
      inicial?.tipo_recurrencia ?? 'diario',
      inicial?.valor_recurrencia ?? '',
    ),
    peso:                     inicial?.peso ?? '1.00',
    es_recordatorio:          inicial?.es_recordatorio ?? false,
    bloquea_jornada_posterior: inicial?.bloquea_jornada_posterior ?? false,
  })
  const [errores, setErrores] = useState({})
  const [errorGeneral, setErrorGeneral] = useState('')
  const [loading, setLoading] = useState(false)
  const formRef = useRef(null)

  function set(campo, valor) {
    setForm((actual) => ({ ...actual, [campo]: valor }))
    setErrores((actual) => (actual[campo] ? { ...actual, [campo]: undefined } : actual))
  }

  function handleTipoRecurrenciaChange(tipo) {
    setForm((actual) => ({
      ...actual,
      tipo_recurrencia: tipo,
      valor_recurrencia: tipo === actual.tipo_recurrencia ? actual.valor_recurrencia : '',
    }))
    setErrores((actual) => ({ ...actual, recurrencia: undefined }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setErrorGeneral('')
    const encontrados = validarTarea(form)
    setErrores(encontrados)
    if (Object.keys(encontrados).length) {
      enfocarPrimerError(formRef.current)
      return
    }
    setLoading(true)
    try {
      await onSubmit({
        ...form,
        nombre: form.nombre.trim(),
        valor_recurrencia: normalizarValorRecurrencia(form.tipo_recurrencia, form.valor_recurrencia) || null,
      })
    } catch (err) {
      setErrorGeneral(err.message)
      setLoading(false)
    }
  }

  return (
    <Modal
      title={inicial ? 'Editar tarea' : 'Nueva tarea'}
      subtitle={inicial ? inicial.nombre : 'Define la tarea, cuándo se repite y su peso en el rendimiento.'}
      icon="tarea"
      wide
      onClose={loading ? () => {} : onClose}
      footer={(
        <>
          <button type="button" className="tuvet-btn tuvet-btn-secondary" onClick={onClose} disabled={loading}>Cancelar</button>
          <button type="submit" form="tc-tarea-form" className="tuvet-btn" disabled={loading} aria-busy={loading}>
            {loading ? 'Guardando...' : inicial ? 'Guardar cambios' : 'Crear tarea'}
          </button>
        </>
      )}
    >
      <form id="tc-tarea-form" ref={formRef} className="tuvet-form" onSubmit={handleSubmit} noValidate>
        <Aviso tipo="error">{errorGeneral}</Aviso>

        <FormSection title="¿Qué tarea es?">
          <Field label="Nombre" required error={errores.nombre}>
            <input value={form.nombre} onChange={(event) => set('nombre', event.target.value)} placeholder="Ej. Revisión de caja" maxLength={200} />
          </Field>
          <div className="tuvet-field">
            <span className="tuvet-label" id="tc-ambito">Ámbito<span className="tuvet-required" aria-hidden="true"> *</span></span>
            <OptionCards
              name="ambito"
              label="Ámbito"
              value={form.ambito}
              onChange={(valor) => set('ambito', valor)}
              options={[
                { value: 'sucursal', label: 'Sucursal', description: 'La realizan los gerentes de sucursal.' },
                { value: 'area', label: 'Área', description: 'La realizan los gerentes de área.' },
              ]}
            />
          </div>
        </FormSection>

        <FormSection title="¿Cuándo se repite?">
          <div className={`tc-recurrencia ${errores.recurrencia ? 'has-error' : ''}`}>
            <RecurrenceSelector
              tipo={form.tipo_recurrencia}
              valor={form.valor_recurrencia}
              onTipoChange={handleTipoRecurrenciaChange}
              onValorChange={(valor) => {
                setForm((actual) => ({ ...actual, valor_recurrencia: valor }))
                setErrores((actual) => ({ ...actual, recurrencia: undefined }))
              }}
              permitirVariable={inicial?.tipo_recurrencia === 'variable'}
            />
            {errores.recurrencia && (
              <span className="tuvet-field-error" role="alert">
                <Icono nombre="error" className="tuvet-field-error-icon" />
                {errores.recurrencia}
              </span>
            )}
          </div>
        </FormSection>

        <FormSection title="Rendimiento y comportamiento">
          <Field
            label="Peso"
            required
            error={errores.peso}
            hint="Peso oficial de la tarea en el rendimiento. Plantillas y sucursales lo toman de aquí."
          >
            <input type="number" step="0.01" min="0" inputMode="decimal" value={form.peso} onChange={(event) => set('peso', event.target.value)} />
          </Field>
          <Toggle label="Es recordatorio" checked={form.es_recordatorio} onChange={(valor) => set('es_recordatorio', valor)} />
          <Toggle label="Bloquea jornada posterior" checked={form.bloquea_jornada_posterior} onChange={(valor) => set('bloquea_jornada_posterior', valor)} />
        </FormSection>
      </form>
    </Modal>
  )
}

/* ── Subtareas ── */

function SubtareasModal({ tarea, onClose }) {
  const [subtareas, setSubtareas] = useState([])
  const [loading, setLoading] = useState(true)
  const [errorCarga, setErrorCarga] = useState('')
  const [editando, setEditando] = useState(null)
  const [nuevaNombre, setNuevaNombre] = useState('')
  const [nuevoOrden, setNuevoOrden] = useState('')
  const [errorNueva, setErrorNueva] = useState('')
  const [errorAccion, setErrorAccion] = useState('')
  const [aviso, setAviso] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmar, dialogo] = useConfirmacion()

  const loadSubtareas = useCallback(async () => {
    setLoading(true)
    setErrorCarga('')
    try {
      setSubtareas(await getSubtareas(tarea.id_tarea, { incluir_inactivas: true }))
    } catch (err) {
      setErrorCarga(err.message)
    } finally {
      setLoading(false)
    }
  }, [tarea.id_tarea])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadSubtareas()
  }, [loadSubtareas])

  async function handleCreate(event) {
    event.preventDefault()
    setAviso('')
    if (!nuevaNombre.trim()) {
      setErrorNueva('Escribe el nombre de la subtarea.')
      return
    }
    setSaving(true)
    setErrorNueva('')
    try {
      const body = { nombre: nuevaNombre.trim() }
      if (nuevoOrden) body.orden = parseInt(nuevoOrden, 10)
      await createSubtarea(tarea.id_tarea, body)
      setNuevaNombre('')
      setNuevoOrden('')
      setAviso('Subtarea agregada.')
      await loadSubtareas()
    } catch (err) {
      setErrorNueva(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleEdit(id) {
    if (!editando.nombre.trim()) {
      setErrorAccion('El nombre de la subtarea no puede quedar vacío.')
      return
    }
    setSaving(true)
    setErrorAccion('')
    setAviso('')
    try {
      const body = { nombre: editando.nombre.trim() }
      if (editando.orden !== '') body.orden = parseInt(editando.orden, 10)
      await updateSubtarea(tarea.id_tarea, id, body)
      setEditando(null)
      setAviso('Subtarea actualizada.')
      await loadSubtareas()
    } catch (err) {
      setErrorAccion(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDesactivar(subtarea) {
    setAviso('')
    setErrorAccion('')
    const confirmado = await confirmar({
      title: 'Desactivar subtarea',
      message: `¿Desactivar la subtarea “${subtarea.nombre}”?`,
      confirmLabel: 'Desactivar',
      accion: () => desactivarSubtarea(tarea.id_tarea, subtarea.id_subtarea),
    })
    if (!confirmado) return
    setAviso('Subtarea desactivada.')
    await loadSubtareas()
  }

  const activas = subtareas.filter((st) => st.activa).length

  return (
    <Modal
      title="Subtareas"
      subtitle={tarea.nombre}
      icon="plantilla"
      wide
      onClose={onClose}
      footer={<button type="button" className="tuvet-btn tuvet-btn-secondary" onClick={onClose}>Cerrar</button>}
    >
      <div className="tuvet-form">
        <Aviso tipo="success">{aviso}</Aviso>
        <Aviso tipo="error">{errorAccion}</Aviso>

        <FormSection title={`Pasos de la tarea${loading ? '' : ` (${activas} activas)`}`} description="Se muestran en este orden al realizar la tarea.">
          <EstadoCarga loading={loading} error={errorCarga} onRetry={loadSubtareas} empty={!subtareas.length} emptyText="Esta tarea todavía no tiene subtareas.">
            <ol className="tc-subtareas">
              {subtareas.map((st) => (
                <li key={st.id_subtarea} className={`tc-subtarea ${st.activa ? '' : 'tuvet-row-inactiva'}`}>
                  {editando?.id === st.id_subtarea ? (
                    <div className="tuvet-inline-form tc-subtarea-edicion">
                      <Field label="Nombre">
                        <input value={editando.nombre} onChange={(event) => setEditando((actual) => ({ ...actual, nombre: event.target.value }))} />
                      </Field>
                      <Field label="Orden">
                        <input type="number" min="1" inputMode="numeric" value={editando.orden} onChange={(event) => setEditando((actual) => ({ ...actual, orden: event.target.value }))} />
                      </Field>
                      <button type="button" className="tuvet-btn" onClick={() => handleEdit(st.id_subtarea)} disabled={saving}>Guardar</button>
                      <button type="button" className="tuvet-btn tuvet-btn-secondary" onClick={() => setEditando(null)} disabled={saving}>Cancelar</button>
                    </div>
                  ) : (
                    <>
                      <span className="tc-subtarea-orden" aria-hidden="true">{st.orden}</span>
                      <span className="tc-subtarea-nombre">
                        <span className="tuvet-visually-hidden">Paso {st.orden}: </span>
                        {st.nombre}
                      </span>
                      {!st.activa && <span className="tuvet-badge tuvet-badge-cancelada">Inactiva</span>}
                      {st.activa && (
                        <span className="tuvet-cell-acciones">
                          <button type="button" className="tuvet-btn tuvet-btn-secondary" onClick={() => { setErrorAccion(''); setEditando({ id: st.id_subtarea, nombre: st.nombre, orden: st.orden ?? '' }) }}>Editar</button>
                          <button type="button" className="tuvet-btn tuvet-btn-danger" onClick={() => handleDesactivar(st)} disabled={saving}>Desactivar</button>
                        </span>
                      )}
                    </>
                  )}
                </li>
              ))}
            </ol>
          </EstadoCarga>
        </FormSection>

        <FormSection title="Agregar subtarea">
          <form className="tuvet-inline-form" onSubmit={handleCreate} noValidate>
            <Field label="Nombre" required error={errorNueva}>
              <input value={nuevaNombre} onChange={(event) => { setNuevaNombre(event.target.value); setErrorNueva('') }} placeholder="Ej. Contar efectivo" />
            </Field>
            <Field label="Orden" hint="Opcional; si lo dejas vacío va al final.">
              <input type="number" min="1" inputMode="numeric" value={nuevoOrden} onChange={(event) => setNuevoOrden(event.target.value)} placeholder="Auto" />
            </Field>
            <button type="submit" className="tuvet-btn" disabled={saving} aria-busy={saving}>{saving ? 'Guardando...' : 'Agregar subtarea'}</button>
          </form>
        </FormSection>
      </div>
      {dialogo}
    </Modal>
  )
}
