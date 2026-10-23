import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams, useNavigate, useLocation } from 'react-router-dom'
import { getPlantilla, updatePlantilla, desactivarPlantilla, duplicarPlantilla, addTarea, updateTarea, desactivarTarea, asignarSucursales } from '../services/plantillasService'
import { getTareas } from '../../tareas/services/tareasService'
import RecurrenceSelector from '../../tareas/components/RecurrenceSelector'
import {
  construirReglasRecurrencia,
  obtenerLabelReglas,
  recurrenciaDesdeReglas,
  validarValorRecurrencia,
} from '../../tareas/recurrenceConfig'
import { getSucursales } from '../../sucursales/services/sucursalesService'
// Kit de componentes compartido con Tuvet; los colores de Analiza llegan con la clase .tema-analiza.
import { Aviso, EstadoCarga, Field, FormSection, Icono, Modal, OptionCards, SelectableList, Toggle } from '../../tuvet/components/TuvetUi'
import { useConfirmacion } from '../../tuvet/components/useConfirmacion'
import { enfocarPrimerError, erroresDelServidor } from '../../tuvet/utils/formularios'
import '../../tuvet/tuvet.css'
// Se conservan: estilos del selector de recurrencia y clases genéricas que otras páginas podrían usar.
import '../../tareas/pages/TareasCatalogo.css'
import './PlantillaDetallePage.css'
import './PlantillasKit.css'

const JORNADA_LABEL = { manana: 'Mañana', tarde: 'Tarde' }

export default function PlantillaDetallePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const [plantilla, setPlantilla] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modal, setModal] = useState(null)
  const [buscarTarea, setBuscarTarea] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const successMessageTemplateId = useRef(null)
  const [confirmar, dialogo] = useConfirmacion()

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setPlantilla(await getPlantilla(id))
    } catch (requestError) {
      setError(requestError.message || 'No se pudo cargar la plantilla.')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData()
  }, [loadData])

  useEffect(() => {
    const duplication = location.state?.templateDuplication
    if (duplication?.kind !== 'template-duplicated' || String(duplication.templateId) !== String(id)) return

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSuccessMessage('Plantilla duplicada correctamente.')
    successMessageTemplateId.current = String(id)
    navigate(location.pathname, { replace: true, state: null })
  }, [id, location.key, location.pathname, location.state, navigate])

  useEffect(() => {
    if (successMessageTemplateId.current && successMessageTemplateId.current !== String(id)) {
      setSuccessMessage('')
      successMessageTemplateId.current = null
    }
  }, [id])

  async function handleUpdatePlantilla(form) {
    await updatePlantilla(id, form)
    await loadData()
    setModal(null)
    setSuccessMessage('Plantilla actualizada.')
  }

  async function handleDuplicarPlantilla() {
    const data = await duplicarPlantilla(id)
    const idPlantillaDuplicada = data?.id_plantilla ?? data?.id ?? data?.plantilla?.id_plantilla ?? data?.plantilla?.id
    if (idPlantillaDuplicada == null) throw new Error('No se pudo identificar la plantilla duplicada.')

    setModal(null)
    navigate(`/plantillas/${idPlantillaDuplicada}`, {
      state: {
        templateDuplication: {
          kind: 'template-duplicated',
          templateId: idPlantillaDuplicada,
        },
      },
    })
  }

  async function handleAddTarea(form) {
    for (const id_tarea of form.ids_tareas) {
      if (form.aplica_ambas_jornadas) {
        await addTarea(id, { id_tarea, jornada: 'manana', hora_sugerida: form.hora_manana || null, aplica_ambas_jornadas: false })
        await addTarea(id, { id_tarea, jornada: 'tarde', hora_sugerida: form.hora_tarde || null, aplica_ambas_jornadas: false })
      } else {
        await addTarea(id, { id_tarea, jornada: form.jornada, hora_sugerida: form.hora_sugerida || null, aplica_ambas_jornadas: false })
      }
    }
    await loadData()
    setModal(null)
    setSuccessMessage(`${form.ids_tareas.length} tarea${form.ids_tareas.length !== 1 ? 's' : ''} agregada${form.ids_tareas.length !== 1 ? 's' : ''} a la plantilla.`)
  }

  async function handleUpdateTarea(idPT, form) {
    await updateTarea(id, idPT, form)
    await loadData()
    setModal(null)
    setSuccessMessage('Tarea actualizada.')
  }

  async function handleAsignar(form) {
    return asignarSucursales(id, form)
  }

  function confirmarDuplicar() {
    setSuccessMessage('')
    void confirmar({
      title: 'Duplicar plantilla',
      message: 'Se creará una nueva plantilla activa e independiente. Comenzará sin asignaciones de sucursales. Solo se copiarán las tareas activas y las reglas de recurrencia activas. La plantilla original no se modificará.',
      confirmLabel: 'Confirmar',
      tone: 'primary',
      accion: handleDuplicarPlantilla,
    })
  }

  async function confirmarDesactivarPlantilla() {
    setSuccessMessage('')
    const ok = await confirmar({
      title: 'Desactivar plantilla',
      message: `¿Deseas desactivar “${plantilla.nombre}”?`,
      detail: 'Dejará de estar disponible para nuevas asignaciones.',
      confirmLabel: 'Confirmar',
      accion: () => desactivarPlantilla(id),
    })
    if (ok) navigate('/plantillas')
  }

  async function confirmarDesactivarTarea(pt) {
    setSuccessMessage('')
    const ok = await confirmar({
      title: 'Desactivar tarea',
      message: `¿Deseas desactivar “${pt.tarea?.nombre}” de esta plantilla?`,
      confirmLabel: 'Desactivar',
      accion: () => desactivarTarea(id, pt.id_plantilla_tarea),
    })
    if (!ok) return
    setSuccessMessage(`Tarea “${pt.tarea?.nombre}” desactivada de la plantilla.`)
    await loadData()
  }

  function abrir(type, tarea = null) {
    setSuccessMessage('')
    setModal({ type, tarea })
  }

  const tareasActivas = plantilla?.tareas?.filter((t) => t.activa) ?? []
  const tareasInactivas = plantilla?.tareas?.filter((t) => !t.activa) ?? []
  const nombreBuscado = buscarTarea.trim().toLocaleLowerCase()
  const tareasFiltradas = [...tareasActivas, ...tareasInactivas].filter((pt) =>
    (pt.tarea?.nombre ?? '').toLocaleLowerCase().includes(nombreBuscado)
  )
  const enManana = tareasActivas.filter((pt) => pt.jornada === 'manana').length
  const enTarde = tareasActivas.filter((pt) => pt.jornada === 'tarde').length

  return (
    <div className="tema-analiza tuvet-page plantillas-kit">
      <Link to="/plantillas" className="pd-volver">‹ Plantillas</Link>

      <Aviso tipo="success">{successMessage}</Aviso>

      <EstadoCarga loading={loading} error={error} onRetry={loadData} empty={!plantilla} emptyText="Plantilla no encontrada.">
        {plantilla && (
          <>
            <div className="tuvet-page-header">
              <div>
                <div className="pd-titulo">
                  <h1>{plantilla.nombre}</h1>
                  <span className={`tuvet-badge ${plantilla.activa ? 'tuvet-badge-aprobada' : 'tuvet-badge-cancelada'}`}>
                    <Icono nombre={plantilla.activa ? 'check' : 'cerrar'} className="tuvet-badge-icon" />
                    {plantilla.activa ? 'Activa' : 'Inactiva'}
                  </span>
                </div>
                {plantilla.descripcion && <p>{plantilla.descripcion}</p>}
              </div>
              <div className="tuvet-page-actions">
                {plantilla.activa && (
                  <button type="button" className="tuvet-btn" onClick={() => abrir('asignar')}>Asignar sucursales</button>
                )}
                <button type="button" className="tuvet-btn tuvet-btn-secondary" onClick={() => abrir('editar')}>Editar</button>
                <button type="button" className="tuvet-btn tuvet-btn-secondary" onClick={confirmarDuplicar}>Duplicar plantilla</button>
                {plantilla.activa && (
                  <button type="button" className="tuvet-btn tuvet-btn-danger pd-desactivar-plantilla" onClick={confirmarDesactivarPlantilla}>Desactivar</button>
                )}
              </div>
            </div>

            <section className="pd-resumen" aria-label="Resumen de la plantilla">
              <div><strong>{tareasActivas.length}</strong>Tareas activas</div>
              <div><strong>{enManana}</strong>En jornada de mañana</div>
              <div><strong>{enTarde}</strong>En jornada de tarde</div>
            </section>

            <div className="pd-seccion">
              <div>
                <h2>Tareas</h2>
                <p>{tareasActivas.length} activa{tareasActivas.length !== 1 ? 's' : ''}{tareasInactivas.length ? ` · ${tareasInactivas.length} inactiva${tareasInactivas.length !== 1 ? 's' : ''}` : ''}</p>
              </div>
              {plantilla.activa && (
                <button type="button" className="tuvet-btn" onClick={() => abrir('agregar-tarea')}>Agregar tarea</button>
              )}
            </div>

            <div className="tuvet-search-bar" role="search">
              <Icono nombre="buscar" className="tuvet-search-icon" />
              <input
                id="buscar-tarea-plantilla"
                type="search"
                placeholder="Buscar tarea por nombre"
                aria-label="Buscar tarea por nombre"
                value={buscarTarea}
                onChange={(e) => setBuscarTarea(e.target.value)}
              />
              {buscarTarea && <button type="button" className="tuvet-btn tuvet-btn-ghost" onClick={() => setBuscarTarea('')}>Limpiar</button>}
            </div>

            {plantilla.tareas?.length === 0 ? (
              <div className="tuvet-empty">
                <Icono nombre="vacio" className="tuvet-empty-icon" />
                <p>Esta plantilla no tiene tareas aún.</p>
                {plantilla.activa && <button type="button" className="tuvet-btn" onClick={() => abrir('agregar-tarea')}>Agregar tareas</button>}
              </div>
            ) : tareasFiltradas.length === 0 ? (
              <p className="tuvet-state tuvet-state-empty" role="status">No se encontraron tareas con ese nombre.</p>
            ) : (
              <div className="tuvet-card pk-tabla-card">
                <div className="tuvet-table-wrap">
                  <table className="tuvet-table pk-tabla">
                    <thead>
                      <tr>
                        <th scope="col">Tarea</th>
                        <th scope="col">Recurrencia</th>
                        <th scope="col">Jornada</th>
                        <th scope="col">Hora sugerida</th>
                        <th scope="col" className="pk-num">Peso</th>
                        <th scope="col">Estado</th>
                        <th scope="col"><span className="tuvet-visually-hidden">Acciones</span></th>
                      </tr>
                    </thead>
                    <tbody>
                      {tareasFiltradas.map((pt) => (
                        <tr key={pt.id_plantilla_tarea} className={pt.activa ? '' : 'tuvet-row-inactiva'}>
                          <td><strong>{pt.tarea?.nombre ?? '—'}</strong></td>
                          <td>
                            <span className="tuvet-tag pd-recurrencia">
                              {obtenerLabelReglas(pt.reglas_recurrencia, pt.tarea?.recurrencia_label ?? '—')}
                            </span>
                          </td>
                          <td>
                            <span className={`tuvet-badge pd-jornada-${pt.jornada}`}>{JORNADA_LABEL[pt.jornada] ?? pt.jornada}</span>
                          </td>
                          <td className="pk-nowrap">{pt.hora_sugerida ?? <span className="tuvet-hint">—</span>}</td>
                          <td className="pk-num">{pt.tarea?.peso ?? '—'}</td>
                          <td>
                            <span className={`tuvet-badge ${pt.activa ? 'tuvet-badge-aprobada' : 'tuvet-badge-cancelada'}`}>
                              {pt.activa ? 'Activa' : 'Inactiva'}
                            </span>
                          </td>
                          <td className="tuvet-cell-acciones">
                            {pt.activa && (
                              <>
                                <button type="button" className="tuvet-btn tuvet-btn-secondary" aria-label={`Editar ${pt.tarea?.nombre}`} onClick={() => abrir('editar-tarea', pt)}>Editar</button>
                                <button type="button" className="tuvet-btn tuvet-btn-danger" aria-label={`Desactivar ${pt.tarea?.nombre}`} onClick={() => confirmarDesactivarTarea(pt)}>Desactivar</button>
                              </>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </EstadoCarga>

      {modal?.type === 'editar' && plantilla && (
        <EditarPlantillaModal plantilla={plantilla} onSubmit={handleUpdatePlantilla} onClose={() => setModal(null)} />
      )}
      {modal?.type === 'agregar-tarea' && (
        <TareaModal tareasActivas={tareasActivas} onSubmit={handleAddTarea} onClose={() => setModal(null)} />
      )}
      {modal?.type === 'editar-tarea' && (
        <TareaModal
          inicial={modal.tarea}
          onSubmit={(form) => handleUpdateTarea(modal.tarea.id_plantilla_tarea, form)}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === 'asignar' && plantilla && (
        <AsignarModal plantilla={plantilla} onSubmit={handleAsignar} onClose={() => setModal(null)} />
      )}
      {dialogo}
    </div>
  )
}

/* ── Editar plantilla ── */

function EditarPlantillaModal({ plantilla, onSubmit, onClose }) {
  const [form, setForm] = useState({ nombre: plantilla.nombre, descripcion: plantilla.descripcion ?? '' })
  const [errores, setErrores] = useState({})
  const [errorGeneral, setErrorGeneral] = useState('')
  const [loading, setLoading] = useState(false)
  const formRef = useRef(null)

  const set = (k) => (e) => {
    setForm((f) => ({ ...f, [k]: e.target.value }))
    setErrores((actual) => ({ ...actual, [k]: undefined }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setErrorGeneral('')
    if (!form.nombre.trim()) {
      setErrores({ nombre: 'El nombre de la plantilla no puede quedar vacío.' })
      enfocarPrimerError(formRef.current)
      return
    }
    setLoading(true)
    try {
      await onSubmit(form)
    } catch (err) {
      const { porCampo, general } = erroresDelServidor(err, ['nombre', 'descripcion'])
      setErrores(porCampo)
      setErrorGeneral(general)
      setLoading(false)
    }
  }

  return (
    <Modal
      title="Editar plantilla"
      subtitle={plantilla.nombre}
      icon="editar"
      onClose={loading ? () => {} : onClose}
      footer={(
        <>
          <button type="button" className="tuvet-btn tuvet-btn-secondary" onClick={onClose} disabled={loading}>Cancelar</button>
          <button type="submit" form="pd-editar-form" className="tuvet-btn" disabled={loading} aria-busy={loading}>{loading ? 'Guardando...' : 'Guardar'}</button>
        </>
      )}
    >
      <form id="pd-editar-form" ref={formRef} className="tuvet-form" onSubmit={handleSubmit} noValidate>
        <Aviso tipo="error">{errorGeneral}</Aviso>
        <Field label="Nombre" required error={errores.nombre}>
          <input type="text" value={form.nombre} onChange={set('nombre')} />
        </Field>
        <Field label="Descripción" hint="Opcional." error={errores.descripcion}>
          <textarea rows={3} value={form.descripcion} onChange={set('descripcion')} />
        </Field>
      </form>
    </Modal>
  )
}

/* ── Agregar / editar tarea de la plantilla ── */

// Mañana: 06:00–11:00 | Tarde: 12:00–19:00 (rangos separados, sin solapamiento)
const HORAS_MANANA = ['06:00','07:00','08:00','09:00','10:00','11:00']
const HORAS_TARDE  = ['12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00']

function normalizarHora(hora) {
  if (!hora) return ''
  return hora.slice(0, 2) + ':00'
}

function TareaModal({ inicial, tareasActivas = [], onSubmit, onClose }) {
  const reglasIniciales = inicial?.reglas_recurrencia?.length
    ? inicial.reglas_recurrencia
    : inicial?.tarea?.reglas_sugeridas ?? []
  const recurrenciaInicial = recurrenciaDesdeReglas(reglasIniciales)
  const [catalogoTareas, setCatalogoTareas] = useState([])
  const [cargandoCatalogo, setCargandoCatalogo] = useState(!inicial)
  const [seleccionadas, setSeleccionadas] = useState([])
  const [buscar, setBuscar] = useState('')
  const [form, setForm] = useState({
    jornada: inicial?.jornada ?? 'manana',
    hora_sugerida: normalizarHora(inicial?.hora_sugerida) || (inicial?.jornada === 'tarde' ? HORAS_TARDE[0] : HORAS_MANANA[0]),
    hora_manana: HORAS_MANANA[0],
    hora_tarde: HORAS_TARDE[0],
    aplica_ambas_jornadas: inicial?.aplica_ambas_jornadas ?? false,
    tipo_recurrencia: recurrenciaInicial.tipo,
    valor_recurrencia: recurrenciaInicial.valor,
  })
  const [recurrenciaModificada, setRecurrenciaModificada] = useState(false)
  const [errorTareas, setErrorTareas] = useState('')
  const [errorRecurrencia, setErrorRecurrencia] = useState('')
  const [errorGeneral, setErrorGeneral] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (inicial) return
    getTareas('sucursal')
      .then((tareas) => setCatalogoTareas(
        tareas.filter((tarea) => tarea.es_revision_guardia !== true),
      ))
      .catch(() => {})
      .finally(() => setCargandoCatalogo(false))
  }, [inicial])

  function calcDuplicada(idTarea, ambas, jornada) {
    if (ambas) {
      return (
        tareasActivas.some((pt) => pt.tarea?.id_tarea === idTarea && (pt.jornada === 'manana' || pt.aplica_ambas_jornadas)) ||
        tareasActivas.some((pt) => pt.tarea?.id_tarea === idTarea && (pt.jornada === 'tarde'  || pt.aplica_ambas_jornadas))
      )
    }
    return tareasActivas.some((pt) => pt.tarea?.id_tarea === idTarea && (pt.aplica_ambas_jornadas || pt.jornada === jornada))
  }

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  function handleJornadaChange(jornada) {
    setForm((f) => ({ ...f, jornada, hora_sugerida: jornada === 'tarde' ? HORAS_TARDE[0] : HORAS_MANANA[0] }))
    if (!inicial) {
      setSeleccionadas((prev) => prev.filter((idTarea) => !calcDuplicada(idTarea, form.aplica_ambas_jornadas, jornada)))
    }
  }

  function handleAmbasJornadasChange(aplicaAmbas) {
    setForm((actual) => ({ ...actual, aplica_ambas_jornadas: aplicaAmbas }))
    if (!inicial) {
      setSeleccionadas((prev) => prev.filter((idTarea) => !calcDuplicada(idTarea, aplicaAmbas, form.jornada)))
    }
  }

  function handleTipoRecurrenciaChange(tipo) {
    setRecurrenciaModificada(true)
    setErrorRecurrencia('')
    setForm((actual) => ({
      ...actual,
      tipo_recurrencia: tipo,
      valor_recurrencia: tipo === actual.tipo_recurrencia ? actual.valor_recurrencia : '',
    }))
  }

  function handleValorRecurrenciaChange(valor) {
    setRecurrenciaModificada(true)
    setErrorRecurrencia('')
    setForm((actual) => ({ ...actual, valor_recurrencia: valor }))
  }

  function toggleTarea(idTarea) {
    setErrorTareas('')
    setSeleccionadas((prev) => (prev.includes(idTarea) ? prev.filter((idItem) => idItem !== idTarea) : [...prev, idTarea]))
  }

  const tareasFiltradas = catalogoTareas.filter((t) => t.nombre.toLowerCase().includes(buscar.toLowerCase()))

  async function handleSubmit(e) {
    e.preventDefault()
    setErrorGeneral('')
    if (!inicial && seleccionadas.length === 0) {
      setErrorTareas('Selecciona al menos una tarea del catálogo para agregarla.')
      return
    }
    if (inicial && recurrenciaModificada) {
      const errorValidacion = validarValorRecurrencia(form.tipo_recurrencia, form.valor_recurrencia)
      if (errorValidacion) {
        setErrorRecurrencia(errorValidacion)
        return
      }
    }
    setLoading(true)
    try {
      if (inicial) {
        const body = {
          id_tarea: inicial.tarea.id_tarea,
          jornada: form.jornada,
          hora_sugerida: form.hora_sugerida || null,
          hora_manana: form.hora_manana || null,
          hora_tarde: form.hora_tarde || null,
          aplica_ambas_jornadas: form.aplica_ambas_jornadas,
        }
        if (recurrenciaModificada) {
          const reglas = construirReglasRecurrencia(
            form.tipo_recurrencia,
            form.valor_recurrencia,
            reglasIniciales.length === 1 ? reglasIniciales[0] : null,
          )
          if (reglas !== null) body.reglas_recurrencia = reglas
        }
        await onSubmit(body)
      } else {
        await onSubmit({
          ids_tareas: seleccionadas,
          jornada: form.jornada,
          hora_sugerida: form.hora_sugerida || null,
          hora_manana: form.hora_manana || null,
          hora_tarde: form.hora_tarde || null,
          aplica_ambas_jornadas: form.aplica_ambas_jornadas,
        })
      }
    } catch (err) {
      setErrorGeneral(err.message)
    } finally {
      setLoading(false)
    }
  }

  const horasSingle = form.jornada === 'tarde' ? HORAS_TARDE : HORAS_MANANA

  return (
    <Modal
      title={inicial ? 'Editar tarea' : 'Agregar tareas'}
      subtitle={inicial ? inicial.tarea?.nombre : 'Elige tareas del catálogo y en qué jornada se realizan.'}
      icon="tarea"
      wide
      onClose={loading ? () => {} : onClose}
      footer={(
        <>
          <button type="button" className="tuvet-btn tuvet-btn-secondary" onClick={onClose} disabled={loading}>Cancelar</button>
          <button type="submit" form="pd-tarea-form" className="tuvet-btn" disabled={loading} aria-busy={loading}>
            {loading
              ? 'Guardando...'
              : inicial
                ? 'Guardar cambios'
                : seleccionadas.length > 0
                  ? `Agregar ${seleccionadas.length} tarea${seleccionadas.length !== 1 ? 's' : ''}`
                  : 'Agregar tareas'}
          </button>
        </>
      )}
    >
      <form id="pd-tarea-form" className="tuvet-form" onSubmit={handleSubmit} noValidate>
        <Aviso tipo="error">{errorGeneral}</Aviso>

        {!inicial && (
          <FormSection title="Tareas del catálogo" description="Las que ya están en la plantilla para esa jornada aparecen bloqueadas.">
            <div className="tuvet-select">
              <div className="tuvet-select-toolbar">
                <input
                  className="tuvet-input tuvet-input-search"
                  type="search"
                  placeholder="Buscar tarea"
                  aria-label="Buscar tarea"
                  value={buscar}
                  onChange={(e) => setBuscar(e.target.value)}
                />
                <span className="tuvet-select-count" aria-live="polite">{seleccionadas.length} seleccionada(s)</span>
              </div>
              <div className="tuvet-select-list pd-catalogo">
                {cargandoCatalogo ? (
                  <p className="tuvet-state">Cargando...</p>
                ) : tareasFiltradas.length === 0 ? (
                  <p className="tuvet-state">Sin resultados.</p>
                ) : tareasFiltradas.map((t) => {
                  const duplicada = calcDuplicada(t.id_tarea, form.aplica_ambas_jornadas, form.jornada)
                  const checked = seleccionadas.includes(t.id_tarea)
                  return (
                    <label key={t.id_tarea} className={`tuvet-select-item ${checked ? 'is-selected' : ''} ${duplicada ? 'is-disabled' : ''}`}>
                      <input type="checkbox" checked={checked} disabled={duplicada} onChange={() => toggleTarea(t.id_tarea)} />
                      <span className="tuvet-select-text">
                        <span className="tuvet-select-label">{t.nombre}</span>
                        {t.recurrencia_label && <span className="tuvet-hint">{t.recurrencia_label}</span>}
                      </span>
                      {duplicada && <span className="tuvet-tag">Ya agregada</span>}
                    </label>
                  )
                })}
              </div>
            </div>
            {errorTareas && (
              <span className="tuvet-field-error" role="alert"><Icono nombre="error" className="tuvet-field-error-icon" />{errorTareas}</span>
            )}
          </FormSection>
        )}

        <FormSection title="Jornada y hora">
          <Toggle
            label="Aplica ambas jornadas"
            description={inicial ? 'No se puede cambiar al editar.' : 'Se agrega una vez en la mañana y otra en la tarde.'}
            checked={form.aplica_ambas_jornadas}
            onChange={handleAmbasJornadasChange}
            disabled={!!inicial}
          />
          {form.aplica_ambas_jornadas ? (
            <div className="tuvet-form-grid">
              <Field label="Hora mañana" required>
                <select value={form.hora_manana} onChange={set('hora_manana')}>
                  {HORAS_MANANA.map((h) => <option key={h} value={h}>{h}</option>)}
                </select>
              </Field>
              <Field label="Hora tarde" required>
                <select value={form.hora_tarde} onChange={set('hora_tarde')}>
                  {HORAS_TARDE.map((h) => <option key={h} value={h}>{h}</option>)}
                </select>
              </Field>
            </div>
          ) : (
            <>
              <OptionCards
                name="jornada"
                label="Jornada"
                value={form.jornada}
                onChange={handleJornadaChange}
                options={[
                  { value: 'manana', label: 'Mañana', description: 'De 06:00 a 11:00.' },
                  { value: 'tarde', label: 'Tarde', description: 'De 12:00 a 19:00.' },
                ]}
              />
              <Field label="Hora sugerida" required>
                <select value={form.hora_sugerida} onChange={set('hora_sugerida')}>
                  {horasSingle.map((h) => <option key={h} value={h}>{h}</option>)}
                </select>
              </Field>
            </>
          )}
        </FormSection>

        {inicial && (
          <FormSection title="Recurrencia en esta plantilla">
            <div className={`tc-recurrencia ${errorRecurrencia ? 'has-error' : ''}`}>
              <RecurrenceSelector
                tipo={form.tipo_recurrencia}
                valor={form.valor_recurrencia}
                onTipoChange={handleTipoRecurrenciaChange}
                onValorChange={handleValorRecurrenciaChange}
                permitirManual
                permitirEspecial={recurrenciaInicial.especial}
              />
              {errorRecurrencia && (
                <span className="tuvet-field-error" role="alert"><Icono nombre="error" className="tuvet-field-error-icon" />{errorRecurrencia}</span>
              )}
            </div>
          </FormSection>
        )}
      </form>
    </Modal>
  )
}

/* ── Asignar a sucursales ── */

function AsignarModal({ plantilla, onSubmit, onClose }) {
  const [sucursales, setSucursales] = useState([])
  const [cargando, setCargando] = useState(true)
  const [seleccionadas, setSeleccionadas] = useState([])
  const [form, setForm] = useState({
    fecha_inicio: '',
    aplicar: true,
    desactivar_no_incluidas: false,
    sobrescribir_reglas: false,
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [resultados, setResultados] = useState(null)
  const asignacionEnCurso = useRef(false)

  useEffect(() => {
    getSucursales()
      .then((data) => setSucursales((data ?? []).filter((s) => s.activa)))
      .catch(() => {})
      .finally(() => setCargando(false))
  }, [])

  const setCheck = (k) => (valor) => setForm((f) => ({ ...f, [k]: valor }))

  async function handleSubmit(e) {
    e.preventDefault()
    if (seleccionadas.length === 0) { setError('Marca al menos una sucursal en la lista.'); return }
    if (asignacionEnCurso.current) return
    asignacionEnCurso.current = true
    setError('')
    setLoading(true)
    try {
      const body = { ids_sucursales: seleccionadas, ...form }
      if (!form.fecha_inicio) delete body.fecha_inicio
      const respuesta = await onSubmit(body)
      const resumen = (respuesta.resultados ?? []).reduce(
        (total, resultado) => ({
          sucursales_procesadas: total.sucursales_procesadas + 1,
          tareas_creadas: total.tareas_creadas + resultado.tareas_creadas,
          tareas_actualizadas: total.tareas_actualizadas + resultado.tareas_actualizadas,
          reglas_creadas: total.reglas_creadas + resultado.reglas_creadas,
          tareas_desactivadas: total.tareas_desactivadas + resultado.tareas_desactivadas,
        }),
        { sucursales_procesadas: 0, tareas_creadas: 0, tareas_actualizadas: 0, reglas_creadas: 0, tareas_desactivadas: 0 },
      )
      setResultados(resumen)
    } catch (err) {
      setError(err.message || 'No fue posible asignar la plantilla. Inténtalo de nuevo.')
    } finally {
      asignacionEnCurso.current = false
      setLoading(false)
    }
  }

  if (resultados) {
    return (
      <Modal
        title="Plantilla asignada"
        subtitle={plantilla.nombre}
        icon="check"
        tone="success"
        onClose={onClose}
        footer={<button type="button" className="tuvet-btn" onClick={onClose}>Cerrar</button>}
      >
        <div className="tuvet-form">
          <Aviso tipo="success">Plantilla asignada correctamente. La asignación se completó para las sucursales seleccionadas.</Aviso>
          <dl className="pd-resultados">
            <div><dt>Sucursales procesadas</dt><dd>{resultados.sucursales_procesadas ?? 0}</dd></div>
            <div><dt>Tareas creadas</dt><dd>{resultados.tareas_creadas ?? 0}</dd></div>
            <div><dt>Tareas actualizadas</dt><dd>{resultados.tareas_actualizadas ?? 0}</dd></div>
            <div><dt>Reglas creadas</dt><dd>{resultados.reglas_creadas ?? 0}</dd></div>
            {resultados.tareas_desactivadas > 0 && (
              <div><dt>Tareas desactivadas</dt><dd>{resultados.tareas_desactivadas}</dd></div>
            )}
          </dl>
        </div>
      </Modal>
    )
  }

  return (
    <Modal
      title="Asignar a sucursales"
      subtitle={plantilla.nombre}
      icon="enviar"
      wide
      onClose={loading ? () => {} : onClose}
      footer={(
        <>
          <button type="button" className="tuvet-btn tuvet-btn-secondary" onClick={onClose} disabled={loading}>Cancelar</button>
          <button type="submit" form="pd-asignar-form" className="tuvet-btn" disabled={loading} aria-busy={loading}>
            {loading ? 'Asignando...' : seleccionadas.length ? `Asignar a ${seleccionadas.length}` : 'Asignar'}
          </button>
        </>
      )}
    >
      <form id="pd-asignar-form" className="tuvet-form" onSubmit={handleSubmit} noValidate>
        <FormSection title="Sucursales">
          {cargando ? (
            <p className="tuvet-state" role="status">Cargando...</p>
          ) : (
            <SelectableList
              items={sucursales.map((s) => ({ ...s, id: s.id_sucursal }))}
              selected={seleccionadas}
              onChange={(ids) => { setSeleccionadas(ids); setError('') }}
              getLabel={(s) => s.nombre}
              getMeta={(s) => s.codigo}
              searchPlaceholder="Buscar sucursal"
              emptyText="No hay sucursales activas."
              disabled={loading}
            />
          )}
          {error && <span className="tuvet-field-error" role="alert"><Icono nombre="error" className="tuvet-field-error-icon" />{error}</span>}
        </FormSection>

        <FormSection title="Opciones">
          <Field label="Fecha de inicio" hint="Opcional. Si la dejas vacía, empieza de inmediato.">
            <input type="date" value={form.fecha_inicio} onChange={(e) => setForm((f) => ({ ...f, fecha_inicio: e.target.value }))} disabled={loading} />
          </Field>
          <Toggle label="Aplicar tareas en sucursales" checked={form.aplicar} onChange={setCheck('aplicar')} disabled={loading} />
          <Toggle label="Desactivar tareas no incluidas" checked={form.desactivar_no_incluidas} onChange={setCheck('desactivar_no_incluidas')} disabled={loading} />
          <Toggle label="Sobrescribir reglas existentes" checked={form.sobrescribir_reglas} onChange={setCheck('sobrescribir_reglas')} disabled={loading} />
        </FormSection>
      </form>
    </Modal>
  )
}
