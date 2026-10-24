import { useCallback, useEffect, useRef, useState } from 'react'
import {
  getSucursales, createSucursal, getAreasElegibles, updateSucursal, desactivarSucursal,
  quitarGsSucursal,
  getHorarios, saveHorarios, updateHorario,
  getTareasSucursal,
} from '../services/sucursalesService'
import { getGerentes } from '../../gerentes/services/gerentesService'
import { getPlantillas, asignarSucursales } from '../../plantillas/services/plantillasService'
import { useAuth } from '../../auth/context/AuthContext'
import { getProfileCapabilities } from '../../auth/profilePolicies'
// Kit de componentes compartido con Tuvet; los colores de Analiza llegan con la clase .tema-analiza.
import { Avatar, Aviso, EstadoCarga, Field, FormSection, Icono, Modal, PageHeader } from '../../tuvet/components/TuvetUi'
import { useConfirmacion } from '../../tuvet/components/useConfirmacion'
import { enfocarPrimerError, erroresDelServidor } from '../../tuvet/utils/formularios'
import '../../tuvet/tuvet.css'
// Se conserva: otras páginas podrían depender de sus clases genéricas (todos los CSS son globales).
import './SucursalesPage.css'
import './SucursalesKit.css'

const DIAS = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
const JORNADA_LABEL = { manana: 'Mañana', tarde: 'Tarde' }
const ESTADOS = { todas: 'Todas', activa: 'Activas', inactiva: 'Inactivas' }

const normalizar = (texto) => String(texto ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

function PersonaCelda({ persona, vacio }) {
  if (!persona) return <span className="tuvet-hint">{vacio}</span>
  return (
    <span className="tuvet-persona-cell sk-persona" title={persona.nombre}>
      <Avatar nombre={persona.nombre} size="sm" />
      <span className="sk-persona-nombre">{persona.nombre}</span>
    </span>
  )
}

export default function SucursalesPage() {
  const { perfil } = useAuth()
  const esAdmin = getProfileCapabilities(perfil).isMasterAdmin
  const [sucursales, setSucursales] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('todas')
  const [modal, setModal] = useState(null)
  const [confirmar, dialogo] = useConfirmacion()

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setSucursales(await getSucursales())
    } catch (requestError) {
      setError(requestError.message || 'No se pudieron cargar las sucursales.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData()
  }, [loadData])

  async function handleCreate(form, idPlantilla, fechaPlantilla) {
    const resp = await createSucursal(form)
    const idSucursal = resp?.sucursal?.id_sucursal ?? resp?.id_sucursal
    await loadData()
    if (idPlantilla && idSucursal) {
      const assignment = { idSucursal, idPlantilla, fechaPlantilla }
      try {
        await assignTemplate(assignment)
      } catch (requestError) {
        setModal({ type: 'template-assignment-failed', assignment, error: requestError.message })
        return
      }
    }
    setModal(null)
    setAviso(`Sucursal “${form.nombre}” creada.`)
  }

  async function assignTemplate({ idSucursal, idPlantilla, fechaPlantilla }) {
    const body = { id_sucursal: idSucursal }
    if (fechaPlantilla) body.fecha_inicio = fechaPlantilla
    await asignarSucursales(idPlantilla, body)
  }

  async function retryTemplateAssignment() {
    const { assignment } = modal
    setModal({ type: 'template-assignment-failed', assignment, error: '', retrying: true })
    try {
      await assignTemplate(assignment)
      setModal(null)
      setAviso('Plantilla asignada correctamente.')
    } catch (requestError) {
      setModal({ type: 'template-assignment-failed', assignment, error: requestError.message })
    }
  }

  async function handleEdit(id, form) {
    await updateSucursal(id, form)
    await loadData()
    setModal(null)
    setAviso(`Sucursal “${form.nombre}” actualizada.`)
  }

  async function desactivar(sucursal) {
    setAviso('')
    const ok = await confirmar({
      title: 'Desactivar sucursal',
      message: `¿Desactivar la sucursal “${sucursal.nombre}”?`,
      confirmLabel: 'Desactivar',
      accion: () => desactivarSucursal(sucursal.id_sucursal),
    })
    if (!ok) return
    setAviso(`Sucursal “${sucursal.nombre}” desactivada.`)
    await loadData()
  }

  async function quitarGs(sucursal) {
    setAviso('')
    const ok = await confirmar({
      title: 'Quitar GS de la sucursal',
      message: `¿Quitar a ${sucursal.usuario_titular.nombre} de la sucursal ${sucursal.nombre}?`,
      detail: 'La cuenta del GS permanecerá activa y podrás asignarla nuevamente.',
      confirmLabel: 'Quitar GS',
      accion: () => quitarGsSucursal(sucursal.id_sucursal),
    })
    if (!ok) return
    setAviso(`${sucursal.usuario_titular.nombre} ya no está asignado a ${sucursal.nombre}.`)
    await loadData()
  }

  function abrir(type, sucursal = null) {
    setAviso('')
    setModal({ type, sucursal })
  }

  const termino = normalizar(busqueda.trim())
  const cumple = (s, estado = filtroEstado) => (
    (!termino || normalizar(`${s.nombre} ${s.codigo}`).includes(termino))
    && (estado === 'todas' || (estado === 'activa' ? s.activa : !s.activa))
  )
  const filtradas = sucursales.filter((s) => cumple(s))
  const activas = sucursales.filter((s) => s.activa).length
  const sinGs = sucursales.filter((s) => s.activa && !s.usuario_titular).length
  const hayFiltros = Boolean(termino) || filtroEstado !== 'todas'

  return (
    <div className="tema-analiza tuvet-page sucursales-kit">
      <PageHeader
        title="Sucursales"
        description={`${activas} activa${activas !== 1 ? 's' : ''} de ${sucursales.length} en total${sinGs ? ` · ${sinGs} sin gerente de sucursal asignado` : ''}.`}
      >
        <button type="button" className="tuvet-btn" onClick={() => abrir('crear')}>Nueva sucursal</button>
      </PageHeader>

      <div className="sk-barra">
        <div className="tuvet-search-bar" role="search">
          <Icono nombre="buscar" className="tuvet-search-icon" />
          <input
            type="search"
            value={busqueda}
            onChange={(event) => setBusqueda(event.target.value)}
            placeholder="Buscar por nombre o código"
            aria-label="Buscar por nombre o código"
          />
          {busqueda && <button type="button" className="tuvet-btn tuvet-btn-ghost" onClick={() => setBusqueda('')}>Limpiar</button>}
        </div>
        <div className="tuvet-filtros" role="group" aria-label="Filtrar por estado">
          {Object.entries(ESTADOS).map(([clave, etiqueta]) => (
            <button
              key={clave}
              type="button"
              className={`tuvet-chip ${filtroEstado === clave ? 'active' : ''}`}
              aria-pressed={filtroEstado === clave}
              onClick={() => setFiltroEstado(clave)}
            >
              {etiqueta} ({sucursales.filter((s) => cumple(s, clave)).length})
            </button>
          ))}
        </div>
      </div>

      <Aviso tipo="success">{aviso}</Aviso>

      <EstadoCarga
        loading={loading}
        error={error}
        onRetry={loadData}
        empty={!filtradas.length}
        emptyText={hayFiltros ? 'Ninguna sucursal coincide con la búsqueda o el filtro.' : 'No hay sucursales registradas.'}
        emptyAction={hayFiltros
          ? <button type="button" className="tuvet-btn tuvet-btn-secondary" onClick={() => { setBusqueda(''); setFiltroEstado('todas') }}>Quitar filtros</button>
          : <button type="button" className="tuvet-btn" onClick={() => abrir('crear')}>Crear sucursal</button>}
      >
        <div className="tuvet-card sk-tabla-card">
          <div className="tuvet-table-wrap">
            <table className="tuvet-table sk-tabla">
              <thead>
                <tr>
                  <th scope="col" className="sk-col-codigo">Código</th>
                  <th scope="col">Sucursal</th>
                  <th scope="col">Gerente de área</th>
                  <th scope="col">GS asignado</th>
                  {esAdmin && <th scope="col" className="sk-num">Guardias</th>}
                  <th scope="col">Estado</th>
                  <th scope="col"><span className="tuvet-visually-hidden">Acciones</span></th>
                </tr>
              </thead>
              <tbody>
                {filtradas.map((s) => (
                  <tr key={s.id_sucursal} className={s.activa ? '' : 'tuvet-row-inactiva'}>
                    <td className="sk-codigo">{s.codigo}</td>
                    <td className="sk-nombre"><strong>{s.nombre}</strong></td>
                    <td><PersonaCelda persona={s.gerente_area} vacio="—" /></td>
                    <td><PersonaCelda persona={s.usuario_titular} vacio="Sin GS" /></td>
                    {esAdmin && <td className="sk-num">{s.numero_guardias ?? 0}</td>}
                    <td>
                      <span className={`tuvet-badge ${s.activa ? 'tuvet-badge-aprobada' : 'tuvet-badge-cancelada'}`}>
                        <Icono nombre={s.activa ? 'check' : 'cerrar'} className="tuvet-badge-icon" />
                        {s.activa ? 'Activa' : 'Inactiva'}
                      </span>
                    </td>
                    <td className="tuvet-cell-acciones">
                      <button type="button" className="tuvet-icon-action" title="Horarios" aria-label={`Horarios de ${s.nombre}`} onClick={() => abrir('horarios', s)}>
                        <Icono nombre="reloj" />
                      </button>
                      <button type="button" className="tuvet-icon-action" title="Asignar plantilla" aria-label={`Asignar plantilla a ${s.nombre}`} onClick={() => abrir('plantilla', s)}>
                        <Icono nombre="plantilla" />
                      </button>
                      <button type="button" className="tuvet-icon-action" title="Editar" aria-label={`Editar ${s.nombre}`} onClick={() => abrir('editar', s)}>
                        <Icono nombre="editar" />
                      </button>
                      {s.usuario_titular && (
                        <button
                          type="button"
                          className="tuvet-icon-action tuvet-icon-action-danger"
                          title="Quitar GS"
                          aria-label={`Quitar a ${s.usuario_titular.nombre} de ${s.nombre}`}
                          onClick={() => quitarGs(s)}
                        >
                          <Icono nombre="quitar-persona" />
                        </button>
                      )}
                      {s.activa && (
                        <button type="button" className="tuvet-icon-action tuvet-icon-action-danger" title="Desactivar" aria-label={`Desactivar ${s.nombre}`} onClick={() => desactivar(s)}>
                          <Icono nombre="prohibido" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="sk-pie" aria-live="polite">Mostrando {filtradas.length} de {sucursales.length} sucursales</p>
        </div>
      </EstadoCarga>

      {modal?.type === 'crear' && (
        <SucursalModal esAdmin={esAdmin} conPlantilla onSubmit={handleCreate} onClose={() => setModal(null)} />
      )}
      {modal?.type === 'editar' && (
        <SucursalModal
          esAdmin={esAdmin}
          inicial={modal.sucursal}
          onSubmit={(form) => handleEdit(modal.sucursal.id_sucursal, form)}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === 'horarios' && (
        <HorariosModal sucursal={modal.sucursal} onClose={() => setModal(null)} />
      )}
      {modal?.type === 'plantilla' && (
        <PlantillaModal sucursal={modal.sucursal} onClose={() => setModal(null)} />
      )}
      {modal?.type === 'template-assignment-failed' && (
        <TemplateAssignmentFailureModal
          error={modal.error}
          retrying={modal.retrying}
          onRetry={retryTemplateAssignment}
          onClose={() => setModal(null)}
        />
      )}
      {dialogo}
    </div>
  )
}

/* ── Crear / editar sucursal ── */

function SucursalModal({ esAdmin, inicial, conPlantilla, onSubmit, onClose }) {
  const isCreating = !inicial
  const [gerentes, setGerentes] = useState([])
  const [areas, setAreas] = useState([])
  const [plantillas, setPlantillas] = useState([])
  const [form, setForm] = useState({
    nombre:          inicial?.nombre ?? '',
    codigo:          inicial?.codigo ?? '',
    id_gerente_area: inicial?.gerente_area?.id_gerente_area ?? '',
    calendar_area_id: '',
    numero_guardias: inicial?.numero_guardias ?? 0,
  })
  const [idPlantilla, setIdPlantilla]   = useState('')
  const [fechaPlantilla, setFechaPlantilla] = useState('')
  const [errorGeneral, setErrorGeneral] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [loading, setLoading] = useState(false)
  const [loadingAreas, setLoadingAreas] = useState(isCreating)
  const [areasError, setAreasError] = useState('')
  const formRef = useRef(null)

  useEffect(() => {
    let active = true
    if (isCreating) {
      getAreasElegibles()
        .then((data) => { if (active) setAreas(data) })
        .catch((requestError) => { if (active) setAreasError(requestError.message || 'No se pudieron cargar las áreas elegibles.') })
        .finally(() => { if (active) setLoadingAreas(false) })
    }
    if (esAdmin && !isCreating) getGerentes().then((data) => { if (active) setGerentes(data) }).catch(() => {})
    if (conPlantilla) getPlantillas().then((p) => { if (active) setPlantillas(p.filter((x) => x.activa)) }).catch(() => {})
    return () => { active = false }
  }, [esAdmin, conPlantilla, isCreating])

  const set = (k) => (e) => {
    setForm((f) => ({ ...f, [k]: e.target.value }))
    setFieldErrors((errors) => ({
      ...errors,
      [k]: undefined,
      ...(k === 'calendar_area_id' ? { country_id: undefined } : {}),
    }))
  }

  const selectedArea = areas.find((area) => String(area.id) === form.calendar_area_id)
  const sinAreas = isCreating && !loadingAreas && !areasError && areas.length === 0
  const areaError = Array.isArray(fieldErrors.calendar_area_id)
    ? fieldErrors.calendar_area_id.join(' ')
    : fieldErrors.calendar_area_id
  const countryError = Array.isArray(fieldErrors.country_id)
    ? fieldErrors.country_id.join(' ')
    : fieldErrors.country_id

  async function handleSubmit(e) {
    e.preventDefault()
    setErrorGeneral('')
    const encontrados = {}
    if (!form.nombre.trim()) encontrados.nombre = 'Escribe el nombre de la sucursal.'
    if (!form.codigo.trim()) encontrados.codigo = 'Escribe un código único, por ejemplo CENTRO-001.'
    if (isCreating && !form.calendar_area_id) encontrados.calendar_area_id = 'Selecciona el área a la que pertenece la sucursal.'
    const numeroGuardias = Number(form.numero_guardias)
    if (esAdmin && (!Number.isInteger(numeroGuardias) || numeroGuardias < 0 || numeroGuardias > 4)) {
      encontrados.numero_guardias = 'El número de guardias debe ser un entero entre 0 y 4.'
    }
    setFieldErrors(encontrados)
    if (Object.keys(encontrados).length) {
      enfocarPrimerError(formRef.current)
      return
    }
    setLoading(true)
    try {
      const body = { nombre: form.nombre, codigo: form.codigo }
      if (isCreating) {
        body.calendar_area_id = Number(form.calendar_area_id)
        if (selectedArea?.country?.id != null) body.country_id = Number(selectedArea.country.id)
      }
      if (esAdmin && !isCreating && form.id_gerente_area) body.id_gerente_area = Number(form.id_gerente_area)
      if (esAdmin) body.numero_guardias = numeroGuardias
      await onSubmit(body, idPlantilla ? Number(idPlantilla) : null, fechaPlantilla || null)
    } catch (err) {
      // country_id se muestra en el campo País (derivado del área), no como aviso general.
      const { porCampo, general } = erroresDelServidor(err, ['nombre', 'codigo', 'calendar_area_id', 'country_id', 'id_gerente_area', 'numero_guardias'])
      setFieldErrors(porCampo)
      setErrorGeneral(general)
      enfocarPrimerError(formRef.current)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      title={inicial ? 'Editar sucursal' : 'Nueva sucursal'}
      subtitle={inicial ? `${inicial.nombre} · ${inicial.codigo}` : 'Registra la sucursal y, si quieres, su plantilla inicial.'}
      icon="edificio"
      wide
      onClose={loading ? () => {} : onClose}
      footer={(
        <>
          <button type="button" className="tuvet-btn tuvet-btn-secondary" onClick={onClose} disabled={loading}>Cancelar</button>
          <button type="submit" form="sk-sucursal-form" className="tuvet-btn" disabled={loading || (isCreating && (loadingAreas || areas.length === 0 || !form.calendar_area_id))} aria-busy={loading}>
            {loading ? 'Guardando...' : inicial ? 'Guardar cambios' : 'Crear sucursal'}
          </button>
        </>
      )}
    >
      <form id="sk-sucursal-form" ref={formRef} className="tuvet-form" onSubmit={handleSubmit} noValidate>
        <Aviso tipo="error">{errorGeneral}</Aviso>

        <FormSection title="Datos de la sucursal">
          <div className="tuvet-form-grid">
            <Field label="Nombre" required error={fieldErrors.nombre}>
              <input type="text" value={form.nombre} onChange={set('nombre')} placeholder="Ej. Sucursal Centro" />
            </Field>
            <Field label="Código" required error={fieldErrors.codigo} hint="Identificador único de la sucursal.">
              <input type="text" value={form.codigo} onChange={set('codigo')} placeholder="Ej. CENTRO-001" />
            </Field>
          </div>
        </FormSection>

        {isCreating && (
          <FormSection title="Área">
            <Field label="Área" required error={areaError}>
              <select
                value={form.calendar_area_id}
                onChange={set('calendar_area_id')}
                required
                disabled={loadingAreas || areas.length === 0}
              >
                <option value="">{loadingAreas ? 'Cargando áreas...' : 'Seleccionar área'}</option>
                {areas.map((area) => (
                  <option key={area.id} value={area.id}>{area.codigo} — {area.nombre}</option>
                ))}
              </select>
            </Field>
            {areasError && <Aviso tipo="error">{areasError}</Aviso>}
            {sinAreas && <Aviso tipo="warning">No hay áreas elegibles disponibles para crear una sucursal.</Aviso>}
            {selectedArea?.country && (
              <Field label="País" error={countryError}>
                <p>{selectedArea.country.name}</p>
              </Field>
            )}
            {selectedArea?.gerente_area && (
              <div className="sk-gerente-asignado">
                <Avatar nombre={selectedArea.gerente_area.nombre} />
                <span className="tv-persona">
                  <span className="tuvet-hint">Gerente de área asignado</span>
                  <strong>{selectedArea.gerente_area.nombre}</strong>
                </span>
              </div>
            )}
          </FormSection>
        )}

        {esAdmin && (
          <FormSection title="Administración">
            <div className="tuvet-form-grid">
              {!isCreating && (
                <Field label="Gerente de área" error={fieldErrors.id_gerente_area}>
                  <select value={form.id_gerente_area} onChange={set('id_gerente_area')}>
                    <option value="">Seleccionar gerente</option>
                    {gerentes.filter((g) => g.activo).map((g) => (
                      <option key={g.id_gerente_area} value={g.id_gerente_area}>{g.nombre}</option>
                    ))}
                  </select>
                </Field>
              )}
              <Field label="Número de guardias" error={fieldErrors.numero_guardias} hint="De 0 a 4. Con 0 no se programa la Revisión de Guardia.">
                <input type="number" min="0" max="4" step="1" inputMode="numeric" value={form.numero_guardias} onChange={set('numero_guardias')} />
              </Field>
            </div>
          </FormSection>
        )}

        {conPlantilla && plantillas.length > 0 && (
          <FormSection title="Plantilla inicial" description="Opcional. Puedes asignarla ahora o más tarde desde la tabla.">
            <div className="tuvet-form-grid">
              <Field label="Plantilla">
                <select value={idPlantilla} onChange={(e) => setIdPlantilla(e.target.value)}>
                  <option value="">Sin plantilla</option>
                  {plantillas.map((p) => (
                    <option key={p.id_plantilla} value={p.id_plantilla}>{p.nombre}</option>
                  ))}
                </select>
              </Field>
              {idPlantilla && (
                <Field label="Fecha de inicio" hint="Si la dejas vacía, empieza de inmediato.">
                  <input type="date" value={fechaPlantilla} onChange={(e) => setFechaPlantilla(e.target.value)} />
                </Field>
              )}
            </div>
          </FormSection>
        )}
      </form>
    </Modal>
  )
}

function TemplateAssignmentFailureModal({ error, retrying, onRetry, onClose }) {
  return (
    <Modal
      title="No se pudo asignar la plantilla"
      icon="alerta"
      tone="danger"
      onClose={retrying ? () => {} : onClose}
      footer={(
        <>
          <button type="button" className="tuvet-btn tuvet-btn-secondary" onClick={onClose} disabled={retrying}>Cerrar</button>
          <button type="button" className="tuvet-btn" onClick={onRetry} disabled={retrying} aria-busy={retrying}>
            {retrying ? 'Reintentando...' : 'Reintentar asignación'}
          </button>
        </>
      )}
    >
      <Aviso tipo="error">
        La sucursal fue creada, pero no se pudo asignar la plantilla.{error ? ` ${error}` : ''}
      </Aviso>
    </Modal>
  )
}

/* ── Horarios ── */

function HorariosModal({ sucursal, onClose }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [errorCarga, setErrorCarga] = useState('')
  const [savingIdx, setSavingIdx] = useState(null)
  const [guardadoIdx, setGuardadoIdx] = useState(null)
  const [error, setError] = useState('')

  const loadHorarios = useCallback(async () => {
    setLoading(true)
    setErrorCarga('')
    try {
      const data = await getHorarios(sucursal.id_sucursal)
      setRows(data.map((h) => ({
        id_horario:    h.id_horario,
        dia_semana:    h.dia_semana,
        dia_nombre:    h.dia_nombre,
        abre:          h.abre,
        hora_apertura: h.hora_apertura ?? '',
        hora_cierre:   h.hora_cierre ?? '',
      })))
    } catch (err) {
      setErrorCarga(err.message)
    } finally {
      setLoading(false)
    }
  }, [sucursal.id_sucursal])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadHorarios()
  }, [loadHorarios])

  function updateRow(idx, key, value) {
    setGuardadoIdx(null)
    setRows((prev) => prev.map((r, i) => i === idx ? { ...r, [key]: value } : r))
  }

  async function handleSave(idx) {
    const row = rows[idx]
    if (row.abre && (!row.hora_apertura || !row.hora_cierre)) {
      setError(`Indica la hora de apertura y de cierre del ${DIAS[row.dia_semana].toLowerCase()}.`)
      return
    }
    setSavingIdx(idx)
    setError('')
    try {
      const body = { dia_semana: row.dia_semana, abre: row.abre }
      if (row.abre) {
        body.hora_apertura = row.hora_apertura
        body.hora_cierre   = row.hora_cierre
      }
      if (row.id_horario) {
        await updateHorario(sucursal.id_sucursal, row.id_horario, body)
      } else {
        await saveHorarios(sucursal.id_sucursal, body)
      }
      await loadHorarios()
      setGuardadoIdx(idx)
    } catch (err) {
      setError(err.message)
    } finally {
      setSavingIdx(null)
    }
  }

  return (
    <Modal
      title="Horarios"
      subtitle={sucursal.nombre}
      icon="reloj"
      wide
      onClose={onClose}
      footer={<button type="button" className="tuvet-btn" onClick={onClose}>Cerrar</button>}
    >
      <div className="tuvet-form">
        <Aviso tipo="error">{error}</Aviso>
        <EstadoCarga loading={loading} error={errorCarga} onRetry={loadHorarios}>
          <div className="tuvet-card sk-tabla-card">
            <div className="tuvet-table-wrap">
              <table className="tuvet-table sk-horarios">
                <thead>
                  <tr>
                    <th scope="col">Día</th>
                    <th scope="col">¿Abre?</th>
                    <th scope="col">Apertura</th>
                    <th scope="col">Cierre</th>
                    <th scope="col"><span className="tuvet-visually-hidden">Guardar</span></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, idx) => (
                    <tr key={row.dia_semana}>
                      <td><strong>{DIAS[row.dia_semana]}</strong></td>
                      <td>
                        <label className="sk-abre">
                          <input type="checkbox" checked={row.abre} onChange={(e) => updateRow(idx, 'abre', e.target.checked)} aria-label={`¿Abre el ${DIAS[row.dia_semana].toLowerCase()}?`} />
                          <span className={`tuvet-badge ${row.abre ? 'tuvet-badge-aprobada' : 'tuvet-badge-cancelada'}`}>{row.abre ? 'Abre' : 'Cerrado'}</span>
                        </label>
                      </td>
                      <td>
                        <input type="time" className="tuvet-input sk-hora" value={row.hora_apertura} disabled={!row.abre} aria-label={`Apertura del ${DIAS[row.dia_semana].toLowerCase()}`} onChange={(e) => updateRow(idx, 'hora_apertura', e.target.value)} />
                      </td>
                      <td>
                        <input type="time" className="tuvet-input sk-hora" value={row.hora_cierre} disabled={!row.abre} aria-label={`Cierre del ${DIAS[row.dia_semana].toLowerCase()}`} onChange={(e) => updateRow(idx, 'hora_cierre', e.target.value)} />
                      </td>
                      <td className="tuvet-cell-acciones">
                        {guardadoIdx === idx && <span className="sk-guardado"><Icono nombre="check" className="tuvet-badge-icon" />Guardado</span>}
                        <button type="button" className="tuvet-btn tuvet-btn-secondary" onClick={() => handleSave(idx)} disabled={savingIdx === idx} aria-busy={savingIdx === idx}>
                          {savingIdx === idx ? 'Guardando...' : 'Guardar'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </EstadoCarga>
      </div>
    </Modal>
  )
}

/* ── Plantilla de la sucursal ── */

function PlantillaModal({ sucursal, onClose }) {
  const [plantillas, setPlantillas]     = useState([])
  const [tareas, setTareas]             = useState([])
  const [loading, setLoading]           = useState(true)
  const [errorCarga, setErrorCarga]     = useState('')
  const [idPlantilla, setIdPlantilla]   = useState('')
  const [fechaInicio, setFechaInicio]   = useState('')
  const [saving, setSaving]             = useState(false)
  const [error, setError]               = useState('')
  const [success, setSuccess]           = useState('')

  const loadData = useCallback(async () => {
    setLoading(true)
    setErrorCarga('')
    try {
      const [p, t] = await Promise.all([
        getPlantillas(),
        getTareasSucursal(sucursal.id_sucursal),
      ])
      setPlantillas(p.filter((item) => item.activa))
      setTareas(t)
    } catch (err) {
      setErrorCarga(err.message)
    } finally {
      setLoading(false)
    }
  }, [sucursal.id_sucursal])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData()
  }, [loadData])

  async function handleAsignar(e) {
    e.preventDefault()
    if (!idPlantilla) {
      setError('Selecciona la plantilla que quieres asignar.')
      return
    }
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const body = { id_sucursal: sucursal.id_sucursal }
      if (fechaInicio) body.fecha_inicio = fechaInicio
      await asignarSucursales(idPlantilla, body)
      setSuccess('Plantilla asignada correctamente.')
      setIdPlantilla('')
      setFechaInicio('')
      await loadData()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const tareasActivas = tareas.filter((t) => t.activa)

  return (
    <Modal
      title="Asignar plantilla"
      subtitle={sucursal.nombre}
      icon="plantilla"
      wide
      onClose={saving ? () => {} : onClose}
      footer={<button type="button" className="tuvet-btn tuvet-btn-secondary" onClick={onClose} disabled={saving}>Cerrar</button>}
    >
      <div className="tuvet-form">
        <Aviso tipo="success">{success}</Aviso>

        <FormSection title="Nueva asignación">
          <form className="tuvet-inline-form" onSubmit={handleAsignar} noValidate>
            <Field label="Plantilla" required error={error}>
              <select value={idPlantilla} onChange={(e) => { setIdPlantilla(e.target.value); setError('') }}>
                <option value="">Seleccionar plantilla</option>
                {plantillas.map((p) => (
                  <option key={p.id_plantilla} value={p.id_plantilla}>{p.nombre}</option>
                ))}
              </select>
            </Field>
            <Field label="Fecha de inicio" hint="Opcional.">
              <input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} />
            </Field>
            <button type="submit" className="tuvet-btn" disabled={saving || !idPlantilla} aria-busy={saving}>
              {saving ? 'Asignando...' : 'Asignar plantilla'}
            </button>
          </form>
        </FormSection>

        <FormSection title={`Tareas activas de la sucursal${loading ? '' : ` (${tareasActivas.length})`}`}>
          <EstadoCarga loading={loading} error={errorCarga} onRetry={loadData} empty={!tareasActivas.length} emptyText="Esta sucursal todavía no tiene tareas activas.">
            <ul className="sk-tareas">
              {tareasActivas.map((ts) => (
                <li key={ts.id_sucursal_tarea} className="sk-tarea">
                  <strong>{ts.tarea?.nombre}</strong>
                  <span className="tuvet-tags">
                    <span className="tuvet-badge tuvet-badge-en_revision">{JORNADA_LABEL[ts.jornada] ?? ts.jornada}</span>
                    {ts.hora && <span className="tuvet-tag">{ts.hora}</span>}
                    {ts.tarea?.recurrencia_label && <span className="tuvet-tag">{ts.tarea.recurrencia_label}</span>}
                    <span className="tuvet-tag">Peso {ts.tarea?.peso ?? '—'}</span>
                  </span>
                </li>
              ))}
            </ul>
          </EstadoCarga>
        </FormSection>
      </div>
    </Modal>
  )
}
