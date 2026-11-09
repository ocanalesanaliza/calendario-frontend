import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Aviso, Checkbox, EstadoCarga, Field, FormSection, Modal, PageHeader, SelectableList } from '../components/TuvetUi'
import { useConfirmacion } from '../components/useConfirmacion'
import { enfocarPrimerError, erroresDelServidor } from '../utils/formularios'
import {
  createPlantilla,
  desactivarPlantilla,
  getPlantillas,
  getTareas,
  listItems,
  updatePlantilla,
} from '../services/tuvetService'
import { describirProgramacion } from '../utils/formato'

const mismosIds = (a, b) => JSON.stringify([...a].sort((x, y) => x - y)) === JSON.stringify([...b].sort((x, y) => x - y))

function PlantillaModal({ plantilla, tareas, onClose, onGuardada }) {
  const [nombre, setNombre] = useState(plantilla?.nombre ?? '')
  const [descripcion, setDescripcion] = useState(plantilla?.descripcion ?? '')
  const [tareaIds, setTareaIds] = useState(() => (plantilla?.tareas ?? []).map((tarea) => tarea.id))
  const [errores, setErrores] = useState({})
  const [errorGeneral, setErrorGeneral] = useState('')
  const [guardando, setGuardando] = useState(false)
  const formRef = useRef(null)
  const tareasActivas = tareas.filter((tarea) => tarea.activa)

  async function guardar(event) {
    event.preventDefault()
    setErrorGeneral('')
    const nombreLimpio = nombre.trim()
    if (!nombreLimpio) {
      setErrores({ nombre: 'Escribe un nombre para identificar la plantilla, por ejemplo “Control diario”.' })
      enfocarPrimerError(formRef.current)
      return
    }

    let body = { nombre: nombreLimpio, descripcion: descripcion.trim(), tarea_ids: tareaIds }
    if (plantilla) {
      body = {}
      if (nombreLimpio !== plantilla.nombre) body.nombre = nombreLimpio
      if (descripcion.trim() !== (plantilla.descripcion ?? '')) body.descripcion = descripcion.trim()
      if (!mismosIds(tareaIds, (plantilla.tareas ?? []).map((tarea) => tarea.id))) body.tarea_ids = tareaIds
      if (!Object.keys(body).length) {
        setErrorGeneral('No hay cambios para guardar. Modifica algún dato o cancela.')
        return
      }
    }

    setGuardando(true)
    setErrores({})
    try {
      const guardada = plantilla ? await updatePlantilla(plantilla.id, body) : await createPlantilla(body)
      onGuardada(guardada, Boolean(plantilla))
    } catch (err) {
      const { porCampo, general } = erroresDelServidor(err, ['nombre', 'descripcion', 'tarea_ids'])
      setErrores(porCampo)
      setErrorGeneral(general)
      setGuardando(false)
      enfocarPrimerError(formRef.current)
    }
  }

  return (
    <Modal
      title={plantilla ? 'Editar plantilla' : 'Nueva plantilla'}
      subtitle={plantilla ? plantilla.nombre : 'Agrupa tareas para asignarlas juntas a los gerentes de sucursal.'}
      icon="plantilla"
      onClose={guardando ? () => {} : onClose}
      wide
      footer={(
        <>
          <button type="button" className="tuvet-btn tuvet-btn-secondary" onClick={onClose} disabled={guardando}>Cancelar</button>
          <button type="submit" form="tuvet-plantilla-form" className="tuvet-btn" disabled={guardando} aria-busy={guardando}>{guardando ? 'Guardando...' : plantilla ? 'Guardar cambios' : 'Crear plantilla'}</button>
        </>
      )}
    >
      <form id="tuvet-plantilla-form" ref={formRef} className="tuvet-form" onSubmit={guardar} noValidate>
        <Aviso tipo="error">{errorGeneral}</Aviso>
        <FormSection title="Datos de la plantilla">
          <Field label="Nombre" required error={errores.nombre}>
            <input value={nombre} onChange={(event) => { setNombre(event.target.value); setErrores((actual) => ({ ...actual, nombre: undefined })) }} maxLength={200} placeholder="Ej. Control diario de laboratorio" />
          </Field>
          <Field label="Descripción" hint="Opcional." error={errores.descripcion}>
            <textarea value={descripcion} rows={2} onChange={(event) => setDescripcion(event.target.value)} placeholder="¿Para qué sirve esta plantilla?" />
          </Field>
        </FormSection>
        <FormSection
          title="Tareas incluidas"
          description={plantilla ? 'Quitar tareas cancela sus ocurrencias futuras pendientes.' : 'Selecciona las tareas activas que formarán parte de la plantilla.'}
        >
          <SelectableList
            items={tareasActivas}
            selected={tareaIds}
            onChange={setTareaIds}
            getLabel={(tarea) => tarea.nombre}
            getMeta={describirProgramacion}
            searchPlaceholder="Buscar tarea"
            emptyText="No tienes tareas activas. Créalas primero en la sección Tareas."
            disabled={guardando}
          />
          {errores.tarea_ids && <Aviso tipo="error">{errores.tarea_ids}</Aviso>}
        </FormSection>
      </form>
    </Modal>
  )
}

export default function TuvetPlantillasPage() {
  const [plantillas, setPlantillas] = useState([])
  const [tareas, setTareas] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')
  const [editando, setEditando] = useState(null)
  const [preguntarAsignar, setPreguntarAsignar] = useState(null)
  const navigate = useNavigate()
  const irAAsignar = (plantilla) => navigate(`/tuvet/asignar?plantilla=${plantilla.id}`)
  const [mostrarInactivas, setMostrarInactivas] = useState(false)
  const [confirmar, dialogo] = useConfirmacion()

  const cargar = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [listaPlantillas, listaTareas] = await Promise.all([getPlantillas(), getTareas()])
      setPlantillas(listItems(listaPlantillas))
      setTareas(listItems(listaTareas))
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

  function onGuardada(plantilla, editada) {
    setEditando(null)
    setPlantillas((lista) => (editada ? lista.map((item) => (item.id === plantilla.id ? plantilla : item)) : [plantilla, ...lista]))
    if (editada) setAviso('Plantilla actualizada.')
    else setPreguntarAsignar(plantilla)
  }

  async function desactivar(plantilla) {
    setAviso('')
    const confirmado = await confirmar({
      title: 'Desactivar plantilla',
      message: `¿Desactivar la plantilla “${plantilla.nombre}”?`,
      detail: 'Se retirarán sus asignaciones y se cancelarán las ocurrencias futuras pendientes.',
      confirmLabel: 'Desactivar',
      accion: () => desactivarPlantilla(plantilla.id),
    })
    if (!confirmado) return
    setAviso('Plantilla desactivada.')
    await cargar()
  }

  function nueva() {
    setAviso('')
    setEditando('nueva')
  }

  const visibles = mostrarInactivas ? plantillas : plantillas.filter((plantilla) => plantilla.activa)

  return (
    <div className="tuvet-page">
      <PageHeader title="Plantillas" description="Agrupa tus tareas y asígnalas a los gerentes de sucursal.">
        <Checkbox label="Mostrar inactivas" checked={mostrarInactivas} onChange={setMostrarInactivas} />
        <button type="button" className="tuvet-btn" onClick={nueva}>Nueva plantilla</button>
      </PageHeader>

      <Aviso tipo="success">{aviso}</Aviso>

      <EstadoCarga
        loading={loading}
        error={error}
        onRetry={cargar}
        empty={!visibles.length}
        emptyText="Todavía no tienes plantillas. Agrupa tus tareas en una plantilla para asignarlas a los gerentes de sucursal."
        emptyAction={<button type="button" className="tuvet-btn" onClick={nueva}>Crear plantilla</button>}
      >
        <div className="tuvet-cards">
          {visibles.map((plantilla) => (
            <article key={plantilla.id} className={`tuvet-card ${plantilla.activa ? '' : 'tuvet-row-inactiva'}`}>
              <div className="tuvet-card-header">
                <div>
                  <h2>{plantilla.nombre}</h2>
                  <p className="tuvet-muted">{plantilla.departamento?.nombre}{plantilla.activa ? '' : ' · Inactiva'}</p>
                </div>
              </div>
              {plantilla.descripcion && <p>{plantilla.descripcion}</p>}
              <ul className="tuvet-lista-simple">
                {(plantilla.tareas ?? []).map((tarea) => (
                  <li key={tarea.id}><strong>{tarea.nombre}</strong> <span className="tuvet-muted">· {describirProgramacion(tarea)}</span></li>
                ))}
                {!plantilla.tareas?.length && <li className="tuvet-muted">Sin tareas.</li>}
              </ul>
              {plantilla.activa && (
                <div className="tuvet-card-acciones">
                  <button type="button" className="tuvet-btn" onClick={() => irAAsignar(plantilla)}>Asignar</button>
                  <button type="button" className="tuvet-btn tuvet-btn-secondary" onClick={() => { setAviso(''); setEditando(plantilla) }}>Editar</button>
                  <button type="button" className="tuvet-btn tuvet-btn-danger" onClick={() => desactivar(plantilla)}>Desactivar</button>
                </div>
              )}
            </article>
          ))}
        </div>
      </EstadoCarga>

      {editando && (
        <PlantillaModal plantilla={editando === 'nueva' ? null : editando} tareas={tareas} onClose={() => setEditando(null)} onGuardada={onGuardada} />
      )}

      {preguntarAsignar && (
        <Modal
          title="Plantilla creada"
          subtitle={preguntarAsignar.nombre}
          icon="plantilla"
          tone="success"
          onClose={() => setPreguntarAsignar(null)}
          footer={(
            <>
              <button type="button" className="tuvet-btn tuvet-btn-secondary" onClick={() => setPreguntarAsignar(null)}>Ahora no</button>
              <button type="button" className="tuvet-btn" onClick={() => irAAsignar(preguntarAsignar)}>Sí, asignar</button>
            </>
          )}
        >
          <p>¿Deseas asignar <strong>{preguntarAsignar.nombre}</strong> a gerentes de sucursal ahora?</p>
        </Modal>
      )}

      {dialogo}
    </div>
  )
}
