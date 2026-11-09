import { useCallback, useEffect, useRef, useState } from 'react'
import { Aviso, Checkbox, ChipToggles, EstadoCarga, Field, FormSection, Modal, OptionCards, PageHeader, Toggle } from '../components/TuvetUi'
import { useConfirmacion } from '../components/useConfirmacion'
import { createTarea, desactivarTarea, getTareas, listItems, updateTarea } from '../services/tuvetService'
import { DIAS_SEMANA, TIPOS_RECURRENCIA, describirProgramacion } from '../utils/formato'
import { enfocarPrimerError, erroresDelServidor } from '../utils/formularios'
import { FORM_TAREA_VACIO, cambiosDesdeForm, formDesdeTarea, payloadDesdeForm } from './tareaForm'

const CAMPOS_TAREA = ['nombre', 'descripcion', 'tipo_programacion', 'tipo_recurrencia', 'valor_recurrencia', 'fecha_limite', 'requiere_aprobacion', 'requiere_documento']
const CAMPOS_PROGRAMACION = ['tipo_programacion', 'tipo_recurrencia', 'valor_recurrencia', 'fecha_limite']

function TareaModal({ tarea, onClose, onGuardada }) {
  const [form, setForm] = useState(() => (tarea ? formDesdeTarea(tarea) : FORM_TAREA_VACIO))
  const [errores, setErrores] = useState({})
  const [errorGeneral, setErrorGeneral] = useState('')
  const [guardando, setGuardando] = useState(false)
  const formRef = useRef(null)
  const diasError = errores.dias_semana

  function set(campo) {
    return (valor) => {
      setForm((actual) => ({ ...actual, [campo]: valor }))
      setErrores((actual) => (actual[campo] ? { ...actual, [campo]: undefined } : actual))
    }
  }

  async function guardar(event) {
    event.preventDefault()
    setErrorGeneral('')
    const resultado = tarea ? cambiosDesdeForm(tarea, form) : payloadDesdeForm(form)
    if (resultado.error) {
      if (resultado.campo) {
        setErrores({ [resultado.campo]: resultado.error })
        enfocarPrimerError(formRef.current)
      } else {
        setErrorGeneral(resultado.error)
      }
      return
    }
    setGuardando(true)
    setErrores({})
    try {
      const guardada = tarea ? await updateTarea(tarea.id, resultado.cambios) : await createTarea(resultado.payload)
      onGuardada(guardada, Boolean(tarea))
    } catch (err) {
      const { porCampo, general } = erroresDelServidor(err, CAMPOS_TAREA)
      // valor_recurrencia se muestra junto al control que lo define.
      if (porCampo.valor_recurrencia) {
        porCampo[form.tipo_recurrencia === 'semanal' ? 'dias_semana' : 'dias_mes'] = porCampo.valor_recurrencia
      }
      setErrores(porCampo)
      const cambiaProgramacion = tarea && CAMPOS_PROGRAMACION.some((campo) => campo in (resultado.cambios ?? {}))
      setErrorGeneral(
        cambiaProgramacion && err.status === 400
          ? `${general || 'No se pudo cambiar la programación.'} Si la tarea ya tiene ocurrencias futuras, desactívala y crea una nueva con la programación deseada.`
          : general,
      )
      setGuardando(false)
      enfocarPrimerError(formRef.current)
    }
  }

  return (
    <Modal
      title={tarea ? 'Editar tarea' : 'Nueva tarea'}
      subtitle={tarea ? tarea.nombre : 'Define qué hay que hacer, cuándo y cómo se verifica.'}
      icon="tarea"
      onClose={guardando ? () => {} : onClose}
      wide
      footer={(
        <>
          <button type="button" className="tuvet-btn tuvet-btn-secondary" onClick={onClose} disabled={guardando}>Cancelar</button>
          <button type="submit" form="tuvet-tarea-form" className="tuvet-btn" disabled={guardando} aria-busy={guardando}>
            {guardando ? 'Guardando...' : tarea ? 'Guardar cambios' : 'Crear tarea'}
          </button>
        </>
      )}
    >
      <form id="tuvet-tarea-form" ref={formRef} className="tuvet-form" onSubmit={guardar} noValidate>
        <Aviso tipo="error">{errorGeneral}</Aviso>

        <FormSection title="¿Qué hay que hacer?">
          <Field label="Nombre" required error={errores.nombre}>
            <input value={form.nombre} onChange={(event) => set('nombre')(event.target.value)} maxLength={200} placeholder="Ej. Verificar inventario de reactivos" />
          </Field>
          <Field label="Descripción" error={errores.descripcion} hint="Instrucciones para el gerente de sucursal (opcional).">
            <textarea value={form.descripcion} rows={3} onChange={(event) => set('descripcion')(event.target.value)} placeholder="Detalla los pasos o criterios de la tarea" />
          </Field>
        </FormSection>

        <FormSection title="¿Cuándo?">
          <OptionCards
            name="tipo_programacion"
            label="Tipo de programación"
            value={form.tipo_programacion}
            onChange={set('tipo_programacion')}
            options={[
              { value: 'recurrente', label: 'Recurrente', description: 'Se repite cada día, semana, quincena o mes.' },
              { value: 'puntual', label: 'Puntual', description: 'Se realiza una sola vez antes de una fecha límite.' },
            ]}
          />

          {form.tipo_programacion === 'puntual' ? (
            <Field label="Fecha y hora límite" required error={errores.fecha_limite}>
              <input type="datetime-local" value={form.fecha_limite} onChange={(event) => set('fecha_limite')(event.target.value)} />
            </Field>
          ) : (
            <>
              <Field label="Frecuencia" required error={errores.tipo_recurrencia}>
                <select value={form.tipo_recurrencia} onChange={(event) => set('tipo_recurrencia')(event.target.value)}>
                  {Object.entries(TIPOS_RECURRENCIA).map(([valor, etiqueta]) => <option key={valor} value={valor}>{etiqueta}</option>)}
                </select>
              </Field>
              {form.tipo_recurrencia === 'semanal' && (
                <div className={`tuvet-field ${diasError ? 'has-error' : ''}`}>
                  <span className="tuvet-label" id="tuvet-dias-label">
                    Días de la semana<span className="tuvet-required" aria-hidden="true"> *</span>
                  </span>
                  <ChipToggles
                    label="Días de la semana"
                    selected={form.dias_semana}
                    onChange={set('dias_semana')}
                    invalid={Boolean(diasError)}
                    describedBy={diasError ? 'tuvet-dias-error' : undefined}
                    options={DIAS_SEMANA.map((dia, indice) => ({ value: indice, label: dia.slice(0, 3), title: dia }))}
                  />
                  {diasError && <span id="tuvet-dias-error" className="tuvet-field-error" role="alert">{diasError}</span>}
                </div>
              )}
              {(form.tipo_recurrencia === 'quincenal' || form.tipo_recurrencia === 'mensual-dias') && (
                <Field
                  label={form.tipo_recurrencia === 'quincenal' ? 'Dos días del mes' : 'Días del mes'}
                  required
                  error={errores.dias_mes}
                  hint="Sepáralos con comas. Si un día no existe en el mes, se usa el último día hábil."
                >
                  <input
                    value={form.dias_mes}
                    onChange={(event) => set('dias_mes')(event.target.value)}
                    placeholder={form.tipo_recurrencia === 'quincenal' ? 'Ej. 1, 15' : 'Ej. 5, 20, 31'}
                    inputMode="numeric"
                  />
                </Field>
              )}
            </>
          )}
        </FormSection>

        <FormSection title="¿Cómo se verifica?">
          <Toggle
            label="Requiere aprobación"
            description="Al marcarla, quedará en revisión hasta que des el visto bueno."
            checked={form.requiere_aprobacion}
            onChange={set('requiere_aprobacion')}
          />
          <Toggle
            label="Requiere documento"
            description="El gerente de sucursal deberá adjuntar evidencia (PDF, imagen o Word)."
            checked={form.requiere_documento}
            onChange={set('requiere_documento')}
          />
        </FormSection>
      </form>
    </Modal>
  )
}

export default function TuvetTareasPage() {
  const [tareas, setTareas] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')
  const [editando, setEditando] = useState(null)
  const [mostrarInactivas, setMostrarInactivas] = useState(false)
  const [confirmar, dialogo] = useConfirmacion()

  const cargar = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setTareas(listItems(await getTareas()))
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void cargar()
  }, [cargar])

  function onGuardada(tarea, editada) {
    setEditando(null)
    setAviso(editada ? 'Tarea actualizada.' : 'Tarea creada.')
    setTareas((lista) => (editada ? lista.map((item) => (item.id === tarea.id ? tarea : item)) : [tarea, ...lista]))
  }

  async function desactivar(tarea) {
    setAviso('')
    const confirmado = await confirmar({
      title: 'Desactivar tarea',
      message: `¿Desactivar la tarea “${tarea.nombre}”?`,
      detail: 'Se cancelarán sus ocurrencias futuras pendientes. Las ya realizadas se conservan.',
      confirmLabel: 'Desactivar',
      accion: () => desactivarTarea(tarea.id),
    })
    if (!confirmado) return
    setAviso('Tarea desactivada.')
    await cargar()
  }

  function nueva() {
    setAviso('')
    setEditando('nueva')
  }

  const visibles = mostrarInactivas ? tareas : tareas.filter((tarea) => tarea.activa)

  return (
    <div className="tuvet-page">
      <PageHeader title="Tareas" description="Tus tareas. Solo tú puedes verlas y modificarlas.">
        <Checkbox label="Mostrar inactivas" checked={mostrarInactivas} onChange={setMostrarInactivas} />
        <button type="button" className="tuvet-btn" onClick={nueva}>Nueva tarea</button>
      </PageHeader>

      <Aviso tipo="success">{aviso}</Aviso>

      <EstadoCarga
        loading={loading}
        error={error}
        onRetry={cargar}
        empty={!visibles.length}
        emptyText="Todavía no tienes tareas. Crea la primera para poder incluirla en tus plantillas."
        emptyAction={<button type="button" className="tuvet-btn" onClick={nueva}>Crear tarea</button>}
      >
        <div className="tuvet-card">
          <div className="tuvet-table-wrap">
            <table className="tuvet-table">
              <thead>
                <tr>
                  <th scope="col">Tarea</th>
                  <th scope="col">Programación</th>
                  <th scope="col">Verificación</th>
                  <th scope="col">Estado</th>
                  <th scope="col"><span className="tuvet-visually-hidden">Acciones</span></th>
                </tr>
              </thead>
              <tbody>
                {visibles.map((tarea) => (
                  <tr key={tarea.id} className={tarea.activa ? '' : 'tuvet-row-inactiva'}>
                    <td>
                      <strong>{tarea.nombre}</strong>
                      {tarea.descripcion && <p className="tuvet-muted">{tarea.descripcion}</p>}
                    </td>
                    <td>{describirProgramacion(tarea)}</td>
                    <td>
                      <span className="tuvet-tags">
                        <span className="tuvet-tag">{tarea.requiere_aprobacion ? 'Con aprobación' : 'Sin aprobación'}</span>
                        {tarea.requiere_documento && <span className="tuvet-tag">Con documento</span>}
                      </span>
                    </td>
                    <td>
                      <span className={`tuvet-badge ${tarea.activa ? 'tuvet-badge-aprobada' : 'tuvet-badge-cancelada'}`}>
                        {tarea.activa ? 'Activa' : 'Inactiva'}
                      </span>
                    </td>
                    <td className="tuvet-cell-acciones">
                      {tarea.activa && (
                        <>
                          <button type="button" className="tuvet-btn tuvet-btn-secondary" onClick={() => { setAviso(''); setEditando(tarea) }}>Editar</button>
                          <button type="button" className="tuvet-btn tuvet-btn-danger" onClick={() => desactivar(tarea)}>Desactivar</button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </EstadoCarga>

      {editando && (
        <TareaModal tarea={editando === 'nueva' ? null : editando} onClose={() => setEditando(null)} onGuardada={onGuardada} />
      )}
      {dialogo}
    </div>
  )
}
