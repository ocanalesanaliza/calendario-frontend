import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getPlantillas, createPlantilla, desactivarPlantilla } from '../services/plantillasService'
// Kit de componentes compartido con Tuvet; los colores de Analiza llegan con la clase .tema-analiza.
import { Aviso, EstadoCarga, Field, Icono, Modal, PageHeader } from '../../tuvet/components/TuvetUi'
import { useConfirmacion } from '../../tuvet/components/useConfirmacion'
import { enfocarPrimerError, erroresDelServidor } from '../../tuvet/utils/formularios'
import '../../tuvet/tuvet.css'
// Se conserva: otras páginas podrían depender de sus clases genéricas (todos los CSS son globales).
import './PlantillasPage.css'
import './PlantillasKit.css'

const ESTADOS = { todas: 'Todas', activa: 'Activas', inactiva: 'Inactivas' }

const normalizar = (texto) => String(texto ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

function formatFecha(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function PlantillasPage() {
  const [plantillas, setPlantillas] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('todas')
  const [creando, setCreando] = useState(false)
  const [confirmar, dialogo] = useConfirmacion()
  const navigate = useNavigate()

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setPlantillas(await getPlantillas())
    } catch (requestError) {
      setError(requestError.message || 'No se pudieron cargar las plantillas.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData()
  }, [loadData])

  async function handleCreate(form) {
    await createPlantilla(form)
    setCreando(false)
    setAviso(`Plantilla “${form.nombre}” creada. Ábrela para agregarle tareas.`)
    await loadData()
  }

  async function desactivar(plantilla) {
    setAviso('')
    const ok = await confirmar({
      title: 'Desactivar plantilla',
      message: `¿Desactivar la plantilla “${plantilla.nombre}”?`,
      confirmLabel: 'Desactivar',
      accion: () => desactivarPlantilla(plantilla.id_plantilla),
    })
    if (!ok) return
    setAviso(`Plantilla “${plantilla.nombre}” desactivada.`)
    await loadData()
  }

  function nueva() {
    setAviso('')
    setCreando(true)
  }

  const termino = normalizar(busqueda.trim())
  const cumple = (p, estado = filtroEstado) => (
    (!termino || normalizar(`${p.nombre} ${p.descripcion ?? ''}`).includes(termino))
    && (estado === 'todas' || (estado === 'activa' ? p.activa : !p.activa))
  )
  const filtradas = plantillas.filter((p) => cumple(p))
  const activas = plantillas.filter((p) => p.activa).length
  const hayFiltros = Boolean(termino) || filtroEstado !== 'todas'

  return (
    <div className="tema-analiza tuvet-page plantillas-kit">
      <PageHeader
        title="Plantillas"
        description={`${activas} activa${activas !== 1 ? 's' : ''} de ${plantillas.length} en total. Agrupan tareas para asignarlas a las sucursales.`}
      >
        <button type="button" className="tuvet-btn" onClick={nueva}>Nueva plantilla</button>
      </PageHeader>

      <div className="pk-barra">
        <div className="tuvet-search-bar" role="search">
          <Icono nombre="buscar" className="tuvet-search-icon" />
          <input
            type="search"
            value={busqueda}
            onChange={(event) => setBusqueda(event.target.value)}
            placeholder="Buscar plantilla por nombre o descripción"
            aria-label="Buscar plantilla por nombre o descripción"
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
              {etiqueta} ({plantillas.filter((p) => cumple(p, clave)).length})
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
        emptyText={hayFiltros ? 'Ninguna plantilla coincide con la búsqueda o el filtro.' : 'No hay plantillas registradas.'}
        emptyAction={hayFiltros
          ? <button type="button" className="tuvet-btn tuvet-btn-secondary" onClick={() => { setBusqueda(''); setFiltroEstado('todas') }}>Quitar filtros</button>
          : <button type="button" className="tuvet-btn" onClick={nueva}>Crear plantilla</button>}
      >
        <div className="tuvet-card pk-tabla-card">
          <div className="tuvet-table-wrap">
            <table className="tuvet-table pk-tabla">
              <thead>
                <tr>
                  <th scope="col">Plantilla</th>
                  <th scope="col" className="pk-num">Tareas</th>
                  <th scope="col">Creada por</th>
                  <th scope="col">Fecha</th>
                  <th scope="col">Estado</th>
                  <th scope="col"><span className="tuvet-visually-hidden">Acciones</span></th>
                </tr>
              </thead>
              <tbody>
                {filtradas.map((p) => (
                  <tr key={p.id_plantilla} className={p.activa ? '' : 'tuvet-row-inactiva'}>
                    <td className="pk-plantilla">
                      <Link to={`/plantillas/${p.id_plantilla}`} className="pk-enlace">{p.nombre}</Link>
                      {p.descripcion && <span className="pk-descripcion" title={p.descripcion}>{p.descripcion}</span>}
                    </td>
                    <td className="pk-num">{p.total_tareas ?? 0}</td>
                    <td className="pk-nowrap">{p.creada_por?.nombre ?? <span className="tuvet-hint">—</span>}</td>
                    <td className="pk-nowrap">{formatFecha(p.created_at)}</td>
                    <td>
                      <span className={`tuvet-badge ${p.activa ? 'tuvet-badge-aprobada' : 'tuvet-badge-cancelada'}`}>
                        <Icono nombre={p.activa ? 'check' : 'cerrar'} className="tuvet-badge-icon" />
                        {p.activa ? 'Activa' : 'Inactiva'}
                      </span>
                    </td>
                    <td className="tuvet-cell-acciones">
                      <button type="button" className="tuvet-btn tuvet-btn-secondary" onClick={() => navigate(`/plantillas/${p.id_plantilla}`)} aria-label={`Ver detalle de ${p.nombre}`}>
                        Ver detalle
                      </button>
                      {p.activa && (
                        <button type="button" className="tuvet-btn tuvet-btn-danger" onClick={() => desactivar(p)} aria-label={`Desactivar ${p.nombre}`}>
                          Desactivar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="pk-pie" aria-live="polite">Mostrando {filtradas.length} de {plantillas.length} plantillas</p>
        </div>
      </EstadoCarga>

      {creando && <CrearModal onSubmit={handleCreate} onClose={() => setCreando(false)} />}
      {dialogo}
    </div>
  )
}

function CrearModal({ onSubmit, onClose }) {
  const [form, setForm] = useState({ nombre: '', descripcion: '' })
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
      setErrores({ nombre: 'Escribe un nombre para identificar la plantilla, por ejemplo “Apertura de sucursal”.' })
      enfocarPrimerError(formRef.current)
      return
    }
    setLoading(true)
    try {
      await onSubmit({ nombre: form.nombre.trim(), descripcion: form.descripcion.trim() })
    } catch (err) {
      const { porCampo, general } = erroresDelServidor(err, ['nombre', 'descripcion'])
      setErrores(porCampo)
      setErrorGeneral(general)
      setLoading(false)
      enfocarPrimerError(formRef.current)
    }
  }

  return (
    <Modal
      title="Nueva plantilla"
      subtitle="Después podrás agregarle tareas y asignarla a sucursales."
      icon="plantilla"
      onClose={loading ? () => {} : onClose}
      footer={(
        <>
          <button type="button" className="tuvet-btn tuvet-btn-secondary" onClick={onClose} disabled={loading}>Cancelar</button>
          <button type="submit" form="pk-crear-form" className="tuvet-btn" disabled={loading} aria-busy={loading}>{loading ? 'Creando...' : 'Crear plantilla'}</button>
        </>
      )}
    >
      <form id="pk-crear-form" ref={formRef} className="tuvet-form" onSubmit={handleSubmit} noValidate>
        <Aviso tipo="error">{errorGeneral}</Aviso>
        <Field label="Nombre" required error={errores.nombre}>
          <input type="text" value={form.nombre} onChange={set('nombre')} placeholder="Ej. Apertura de sucursal" />
        </Field>
        <Field label="Descripción" hint="Opcional." error={errores.descripcion}>
          <textarea rows={3} value={form.descripcion} onChange={set('descripcion')} placeholder="¿Para qué sirve esta plantilla?" />
        </Field>
      </form>
    </Modal>
  )
}
