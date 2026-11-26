import { useCallback, useEffect, useMemo, useState } from 'react'
import { getCoberturas, getCoberturaCatalogo, createCobertura, activarCobertura, cancelarCobertura, completarCobertura } from '../services/coberturasService'
import Toast from '../../../components/Toast/Toast'
import { Aviso, EstadoCarga, Field, FormSection, Icono, Modal, PageHeader } from '../../tuvet/components/TuvetUi'
import { useConfirmacion } from '../../tuvet/components/useConfirmacion'
import '../../tuvet/tuvet.css'
import './CoberturasPage.css'
import './CoberturasKit.css'

const ESTADOS = [['', 'Todas'], ['pendiente', 'Pendientes'], ['programada', 'Programadas'], ['activa', 'Activas'], ['completada', 'Completadas'], ['cancelada', 'Canceladas']]
const JORNADA_LABEL = { manana: 'Mañana', tarde: 'Tarde', dia_completo: 'Día completo' }
const ESTADO_META = { pendiente: ['pendiente', 'info'], programada: ['programada', 'calendario'], activa: ['activa', 'check'], completada: ['completada', 'check'], cancelada: ['cancelada', 'cerrar'], rechazada: ['cancelada', 'cerrar'] }

function dayOfWeek(date) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  if (!match) return null
  const [, year, month, day] = match.map(Number)
  const localDate = new Date(year, month - 1, day)
  return localDate.getFullYear() === year && localDate.getMonth() === month - 1 && localDate.getDate() === day ? localDate.getDay() : null
}

function isSunday(date) { return dayOfWeek(date) === 0 }
function isWeekend(date) { const day = dayOfWeek(date); return day === 0 || day === 6 }

function EstadoCobertura({ estado, label }) {
  const [clase, icono] = ESTADO_META[estado] ?? ['pendiente', 'info']
  return <span className={`tuvet-badge coberturas-kit__estado coberturas-kit__estado--${clase}`}><Icono nombre={icono} className="tuvet-badge-icon" />{label ?? estado}</span>
}

export default function CoberturasPage() {
  const [coberturas, setCoberturas] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')
  const [modal, setModal] = useState(null)
  const [toast, setToast] = useState(null)
  const [confirmar, dialogo] = useConfirmacion()

  const loadData = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const data = await getCoberturas()
      setCoberturas(data.results ?? [])
      setTotal(data.count ?? data.results?.length ?? 0)
    } catch (err) {
      setCoberturas([]); setTotal(0); setError(err.message || 'No fue posible cargar las coberturas.')
    } finally { setLoading(false) }
  }, [])
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData()
  }, [loadData])

  const conteoPorEstado = useMemo(() => Object.fromEntries(ESTADOS.map(([estado]) => [estado, estado ? coberturas.filter((cobertura) => cobertura.estado === estado).length : coberturas.length])), [coberturas])
  const filas = useMemo(() => filtroEstado ? coberturas.filter((cobertura) => cobertura.estado === filtroEstado) : coberturas, [coberturas, filtroEstado])

  async function handleAccion(cobertura, accion) {
    if (accion === 'cancelar') {
      const ok = await confirmar({ title: 'Cancelar cobertura', message: `¿Cancelar la cobertura de ${cobertura.usuario_reemplazo?.nombre ?? 'este usuario'}?`, detail: 'La cobertura ya no podrá activarse ni completarse.', confirmLabel: 'Cancelar cobertura', tone: 'danger', accion: () => cancelarCobertura(cobertura.id_cobertura) })
      if (ok) await loadData()
      return
    }
    try {
      if (accion === 'activar') await activarCobertura(cobertura.id_cobertura)
      if (accion === 'completar') await completarCobertura(cobertura.id_cobertura)
      await loadData()
    } catch (err) { setToast({ message: err.message, type: 'error' }) }
  }

  async function handleCreate(form) {
    await createCobertura(form); await loadData(); setModal(null); setToast({ message: 'Cobertura creada correctamente', type: 'success' })
  }

  return <main className="tema-analiza tuvet-page coberturas-kit">
    <PageHeader title="Coberturas temporales" description="Organizá reemplazos temporales entre sucursales y mantené su estado al día.">
      <button type="button" className="tuvet-btn" onClick={() => setModal({ type: 'crear' })}>Nueva cobertura</button>
    </PageHeader>
    <section className="tuvet-card coberturas-kit__toolbar" aria-label="Filtros de coberturas">
      <div className="tuvet-filtros" role="group" aria-label="Filtrar por estado">
        {ESTADOS.map(([estado, etiqueta]) => <button key={estado || 'todas'} type="button" className={`tuvet-chip ${filtroEstado === estado ? 'active' : ''}`} aria-pressed={filtroEstado === estado} onClick={() => setFiltroEstado(estado)}>{etiqueta} ({conteoPorEstado[estado]})</button>)}
      </div>
      <p className="coberturas-kit__resultados" aria-live="polite">{filas.length} de {total} cobertura{total !== 1 ? 's' : ''}</p>
    </section>
    <section aria-label="Listado de coberturas">
      <EstadoCarga loading={loading} error={error} onRetry={loadData} empty={!filas.length} emptyText={filtroEstado ? 'No hay coberturas con ese estado. Probá con otro filtro.' : 'No hay coberturas registradas todavía.'} emptyAction={!filtroEstado && <button type="button" className="tuvet-btn" onClick={() => setModal({ type: 'crear' })}>Nueva cobertura</button>}>
        <div className="tuvet-card coberturas-kit__table-card"><div className="tuvet-table-wrap" tabIndex="0" aria-label="Tabla de coberturas; desplazate horizontalmente si es necesario"><table className="tuvet-table coberturas-kit__table">
          <thead><tr><th scope="col">Reemplazo</th><th scope="col">Titular</th><th scope="col">Sucursal</th><th scope="col">Fecha</th><th scope="col">Jornada</th><th scope="col">Estado</th><th scope="col">Acciones</th></tr></thead>
          <tbody>{filas.map((cobertura) => <tr key={cobertura.id_cobertura}>
            <td><strong>{cobertura.usuario_reemplazo?.nombre ?? '—'}</strong></td><td>{cobertura.usuario_titular?.nombre ?? <span className="tuvet-hint">—</span>}</td><td>{cobertura.sucursal_destino?.nombre ?? '—'}</td><td className="coberturas-kit__numeric">{cobertura.fecha}</td><td>{cobertura.jornada_label ?? JORNADA_LABEL[cobertura.jornada] ?? cobertura.jornada}</td><td><EstadoCobertura estado={cobertura.estado} label={cobertura.estado_label} /></td>
            <td className="tuvet-cell-acciones"><div className="coberturas-kit__actions">{cobertura.estado === 'programada' && <button type="button" className="tuvet-btn tuvet-btn-secondary" onClick={() => handleAccion(cobertura, 'activar')}>Activar</button>}{cobertura.estado === 'activa' && <button type="button" className="tuvet-btn tuvet-btn-secondary" onClick={() => handleAccion(cobertura, 'completar')}>Completar</button>}{['pendiente', 'programada', 'activa'].includes(cobertura.estado) && <button type="button" className="tuvet-btn tuvet-btn-danger" onClick={() => handleAccion(cobertura, 'cancelar')}>Cancelar</button>}</div></td>
          </tr>)}</tbody>
        </table></div></div>
      </EstadoCarga>
    </section>
    {modal?.type === 'crear' && <CoberturaModal onSubmit={handleCreate} onClose={() => setModal(null)} showToast={(message) => setToast({ message, type: 'error' })} />}
    {dialogo}
    {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
  </main>
}

function CoberturaModal({ onSubmit, onClose, showToast }) {
  const [usuarios, setUsuarios] = useState([])
  const [sucursales, setSucursales] = useState([])
  const [branchQuery, setBranchQuery] = useState('')
  const [branchOpen, setBranchOpen] = useState(false)
  const [activeBranchIndex, setActiveBranchIndex] = useState(-1)
  const [catalogDate, setCatalogDate] = useState(null)
  const [form, setForm] = useState({ id_usuario_reemplazo: '', id_sucursal_destino: '', fecha: '', jornada: 'dia_completo', motivo: '' })
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let vigente = true
    getCoberturaCatalogo(form.fecha).then(({ reemplazos = [], sucursales: branches = [] }) => { if (vigente) { setUsuarios(reemplazos); setSucursales(branches); setCatalogDate(form.fecha) } }).catch(() => { if (vigente) setErrors((current) => ({ ...current, catalogo: 'No fue posible cargar el catálogo de cobertura.' })) })
    return () => { vigente = false }
  }, [form.fecha])

  const filteredBranches = sucursales.filter((branch) => { const search = branchQuery.trim().toLocaleLowerCase(); return !search || [branch.nombre, branch.codigo, branch.area?.nombre].filter(Boolean).some((value) => value.toLocaleLowerCase().includes(search)) })
  const selectedBranch = sucursales.find((branch) => String(branch.id_sucursal) === form.id_sucursal_destino)
  const esFinDeSemana = isWeekend(form.fecha)
  function update(key, value) { setForm((current) => ({ ...current, [key]: value })); setErrors((current) => ({ ...current, [key]: undefined, catalogo: undefined })) }
  function selectBranch(branch) { update('id_sucursal_destino', String(branch.id_sucursal)); setBranchQuery(branch.nombre); setBranchOpen(false); setActiveBranchIndex(-1) }
  function validate() {
    const next = {}
    if (!form.id_usuario_reemplazo) next.id_usuario_reemplazo = 'Seleccioná quién realizará la cobertura.'
    if (!form.id_sucursal_destino) next.id_sucursal_destino = 'Buscá y seleccioná una sucursal destino.'
    if (!form.fecha) next.fecha = 'Ingresá la fecha de la cobertura.'
    if (esFinDeSemana && form.jornada !== 'dia_completo') next.jornada = 'Los fines de semana la cobertura debe ser de día completo.'
    if (isSunday(form.fecha) && selectedBranch && !selectedBranch.abre_domingo) next.id_sucursal_destino = 'La sucursal seleccionada no abre los domingos.'
    setErrors(next); return next
  }
  function validateField(key) {
    const next = {}
    if (key === 'id_usuario_reemplazo' && !form.id_usuario_reemplazo) next[key] = 'Seleccioná quién realizará la cobertura.'
    if (key === 'id_sucursal_destino' && !form.id_sucursal_destino) next[key] = 'Buscá y seleccioná una sucursal destino.'
    if (key === 'id_sucursal_destino' && isSunday(form.fecha) && selectedBranch && !selectedBranch.abre_domingo) next[key] = 'La sucursal seleccionada no abre los domingos.'
    if (key === 'fecha' && !form.fecha) next[key] = 'Ingresá la fecha de la cobertura.'
    if (key === 'jornada' && esFinDeSemana && form.jornada !== 'dia_completo') next[key] = 'Los fines de semana la cobertura debe ser de día completo.'
    setErrors((current) => ({ ...current, [key]: next[key] }))
  }
  async function handleSubmit(event) {
    event.preventDefault(); const next = validate()
    if (Object.keys(next).length) { requestAnimationFrame(() => document.querySelector('.coberturas-kit [aria-invalid="true"]')?.focus()); return }
    setLoading(true)
    try { await onSubmit({ id_usuario_reemplazo: Number(form.id_usuario_reemplazo), id_sucursal_destino: Number(form.id_sucursal_destino), fecha: form.fecha, jornada: form.jornada, motivo: form.motivo }) } catch (err) { showToast(err.message) } finally { setLoading(false) }
  }
  const usuariosActivos = usuarios.filter((usuario) => usuario.habilitado)
  return <Modal title="Nueva cobertura" subtitle="Definí quién cubrirá la sucursal y cuándo." icon="calendario" onClose={onClose} wide className="coberturas-kit__modal" footer={<><button type="button" className="tuvet-btn tuvet-btn-secondary" onClick={onClose} disabled={loading}>Cancelar</button><button type="submit" form="cobertura-form" className="tuvet-btn" disabled={loading} aria-busy={loading}>{loading ? 'Guardando…' : 'Crear cobertura'}</button></>}>
    <form id="cobertura-form" className="tuvet-form coberturas-kit__form" onSubmit={handleSubmit} noValidate>
      <Aviso tipo="error">{errors.catalogo}</Aviso>
      <FormSection title="Asignación" description="¿Quién cubre la sucursal y a quién reemplaza?"><Field label="Usuario reemplazo" required error={errors.id_usuario_reemplazo}><select id="cobertura-usuario-reemplazo" value={form.id_usuario_reemplazo} onChange={(event) => update('id_usuario_reemplazo', event.target.value)} onBlur={() => validateField('id_usuario_reemplazo')}><option value="">Seleccionar usuario</option>{usuariosActivos.map((usuario) => <option key={usuario.id_usuario} value={usuario.id_usuario}>{usuario.nombre}</option>)}</select></Field><div className="coberturas-kit__combobox"><Field label="Sucursal destino" required error={errors.id_sucursal_destino}><input id="cobertura-sucursal-destino" type="text" role="combobox" aria-autocomplete="list" aria-controls="cobertura-sucursal-listbox" aria-expanded={branchOpen} aria-activedescendant={activeBranchIndex >= 0 ? `cobertura-sucursal-option-${activeBranchIndex}` : undefined} value={branchQuery} onChange={(event) => { setBranchQuery(event.target.value); setBranchOpen(true); setActiveBranchIndex(-1); update('id_sucursal_destino', '') }} onFocus={() => setBranchOpen(true)} onBlur={() => validateField('id_sucursal_destino')} onKeyDown={(event) => { if (event.key === 'ArrowDown') { event.preventDefault(); setBranchOpen(true); setActiveBranchIndex((index) => Math.min(index + 1, filteredBranches.length - 1)) } else if (event.key === 'ArrowUp') { event.preventDefault(); setActiveBranchIndex((index) => Math.max(index - 1, 0)) } else if (event.key === 'Enter' && activeBranchIndex >= 0) { event.preventDefault(); selectBranch(filteredBranches[activeBranchIndex]) } else if (event.key === 'Escape') setBranchOpen(false) }} placeholder="Buscar por nombre, código o área" /></Field>{branchOpen && <ul id="cobertura-sucursal-listbox" role="listbox" className="coberturas-kit__combobox-list">{filteredBranches.length ? filteredBranches.map((branch, index) => <li key={branch.id_sucursal} id={`cobertura-sucursal-option-${index}`} role="option" aria-selected={String(branch.id_sucursal) === form.id_sucursal_destino} className={index === activeBranchIndex ? 'is-active' : ''} onMouseDown={(event) => event.preventDefault()} onClick={() => selectBranch(branch)}>{branch.nombre}</li>) : <li className="coberturas-kit__combobox-empty" role="status">No hay sucursales que coincidan.</li>}</ul>}</div><Field label="Titular"><input value={!form.id_sucursal_destino ? '' : !form.fecha ? 'Seleccioná una fecha para ver el titular' : catalogDate !== form.fecha ? 'Buscando titular…' : selectedBranch?.titular?.nombre ?? 'Sin titular asignado'} disabled placeholder="Seleccioná una sucursal destino" /></Field></FormSection>
      <FormSection title="Programación" description="¿Cuándo se realizará la cobertura?"><Field label="Fecha" required error={errors.fecha}><input id="cobertura-fecha" type="date" value={form.fecha} onChange={(event) => { const fecha = event.target.value; update('fecha', fecha); if (isWeekend(fecha)) update('jornada', 'dia_completo') }} onBlur={validate} /></Field><Field label="Jornada" error={errors.jornada}><select id="cobertura-jornada" value={form.jornada} onChange={(event) => update('jornada', esFinDeSemana ? 'dia_completo' : event.target.value)} onBlur={validate}><option value="dia_completo">Día completo</option><option value="manana" disabled={esFinDeSemana}>Mañana</option><option value="tarde" disabled={esFinDeSemana}>Tarde</option></select></Field>{esFinDeSemana && <p className="tuvet-hint coberturas-kit__weekend-note">Los fines de semana la cobertura debe ser de día completo.</p>}</FormSection>
      <FormSection title="Detalle"><Field label="Motivo" hint="Opcional."><input id="cobertura-motivo" type="text" value={form.motivo} onChange={(event) => update('motivo', event.target.value)} placeholder="Ej. descanso dominical" /></Field></FormSection>
    </form>
  </Modal>
}
