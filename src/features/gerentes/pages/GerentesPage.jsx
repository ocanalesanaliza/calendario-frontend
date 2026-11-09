import { useState, useEffect, useRef } from 'react'
import { getGerentes, createGerente, updateGerente, desactivarGerente, prepararDesactivacionGerente, resetPasswordGerente } from '../services/gerentesService'
import { useAuth } from '../../auth/context/AuthContext'
import AreaManagerAssignmentModal from '../../asignaciones/components/AreaManagerAssignmentModal'
import { assignAreaToManager, getEligibleAreas, reassignAreaToManager } from '../../asignaciones/services/areaManagerAssignmentService'
import { getProfileCapabilities } from '../../auth/profilePolicies'
// Kit de componentes compartido con Tuvet; los colores de Analiza llegan con la clase .tema-analiza.
import { Avatar, Aviso, EstadoCarga, Field, Icono, Modal, PageHeader, Toggle } from '../../tuvet/components/TuvetUi'
import { useConfirmacion } from '../../tuvet/components/useConfirmacion'
import { enfocarPrimerError } from '../../tuvet/utils/formularios'
import '../../tuvet/tuvet.css'
// Se conserva: otras páginas podrían depender de sus clases genéricas (todos los CSS son globales).
import './GerentesPage.css'
import './GerentesKit.css'

const ESTADOS = { todos: 'Todos', activos: 'Activos', inactivos: 'Inactivos' }

const normalizar = (texto) => String(texto ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

export default function GerentesPage() {
  const { perfil } = useAuth()
  const [gerentes, setGerentes] = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')
  const [modal, setModal]       = useState(null)
  const [aviso, setAviso]       = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [estado, setEstado]     = useState('activos')
  const [confirmar, dialogo]    = useConfirmacion()
  const { canManageOperationsManagers: canManageGerentes, canManageAreaManagers: canManageAssignments, isSystemsAccount } = getProfileCapabilities(perfil)

  useEffect(() => { void loadData() }, [])

  async function loadData() {
    setLoading(true)
    setError('')
    try {
      const data = await getGerentes()
      setGerentes(data)
    } catch (requestError) {
      setError(requestError.message || 'No se pudieron cargar los gerentes.')
    } finally {
      setLoading(false)
    }
  }

  function abrir(type, gerente = null) {
    setAviso('')
    setModal({ type, gerente })
  }

  async function handleCreate(form) {
    const data = await createGerente(form)
    // La contraseña temporal solo vive en el estado del modal; se descarta al cerrarlo.
    setModal({
      type: 'password',
      password: data.password_temporal,
      nombre: data.gerente_area.nombre,
      correoEnviado: data.correo_enviado !== false,
    })
    void loadData().catch(() => {})
  }

  async function handleEdit(id, form) {
    await updateGerente(id, form)
    await loadData()
    setModal(null)
    setAviso(`Gerente “${form.nombre}” actualizado.`)
  }

  async function handleDesactivar(id, idNuevoGerenteArea) {
    const data = await desactivarGerente(id, idNuevoGerenteArea)
    await loadData()
    setModal(null)
    setAviso(data.detail)
  }

  async function handleResetPassword(id) {
    const data = await resetPasswordGerente(id)
    setModal({
      type: 'password',
      password: data.password_temporal,
      nombre: data.gerente_area.nombre,
      correoEnviado: data.correo_enviado !== false,
    })
    void loadData().catch(() => {})
  }

  function resetear(gerente) {
    setAviso('')
    void confirmar({
      title: 'Resetear contraseña',
      message: `Se generará una nueva contraseña temporal para ${gerente.nombre}.`,
      detail: 'Deberá cambiarla al iniciar sesión. La contraseña actual dejará de funcionar.',
      confirmLabel: 'Resetear',
      tone: 'primary',
      accion: () => handleResetPassword(gerente.id_gerente_area),
    })
  }

  async function assignArea(gerente, areaId) {
    await assignAreaToManager(gerente.id_gerente_area, areaId)
    await loadData()
    setModal(null)
    setAviso('Área asignada correctamente.')
  }

  async function reassignArea(gerente, areaId) {
    await reassignAreaToManager(gerente.id_gerente_area, areaId)
    await loadData()
    setModal(null)
    setAviso('Reasignación programada correctamente.')
  }

  const termino = normalizar(busqueda.trim())
  const cumple = (g, filtro = estado) => (
    (!termino || normalizar(`${g.nombre} ${g.email}`).includes(termino))
    && (filtro === 'todos' || (filtro === 'activos' ? g.activo : !g.activo))
  )
  const filtrados = gerentes.filter((g) => cumple(g))
  const activos = gerentes.filter((g) => g.activo).length
  const admins = gerentes.filter((g) => g.activo && g.es_admin_maestro).length
  const hayFiltros = Boolean(termino) || estado !== 'todos'

  return (
    <div className="tema-analiza tuvet-page gerentes-kit">
      <PageHeader
        title="Gerentes de área"
        description={`${activos} activo${activos !== 1 ? 's' : ''} de ${gerentes.length}${admins ? ` · ${admins} admin${admins !== 1 ? 's' : ''} maestro${admins !== 1 ? 's' : ''}` : ''}.`}
      >
        {canManageGerentes && <button type="button" className="tuvet-btn" onClick={() => abrir('crear')}>Nuevo gerente</button>}
      </PageHeader>

      <div className="gk-barra">
        <div className="tuvet-search-bar" role="search">
          <Icono nombre="buscar" className="tuvet-search-icon" />
          <input
            type="search"
            value={busqueda}
            onChange={(event) => setBusqueda(event.target.value)}
            placeholder="Buscar por nombre o correo"
            aria-label="Buscar por nombre o correo"
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
        emptyText={gerentes.length && hayFiltros ? 'Ningún gerente coincide con la búsqueda o el filtro.' : 'No hay gerentes registrados.'}
        emptyAction={gerentes.length && hayFiltros
          ? <button type="button" className="tuvet-btn tuvet-btn-secondary" onClick={() => { setBusqueda(''); setEstado('todos') }}>Quitar filtros</button>
          : canManageGerentes && <button type="button" className="tuvet-btn" onClick={() => abrir('crear')}>Crear el primer gerente</button>}
      >
        <div className="tuvet-card gk-tabla-card">
          <div className="tuvet-table-wrap">
            <table className="tuvet-table gk-tabla">
              <thead>
                <tr>
                  <th scope="col">Gerente</th>
                  <th scope="col">Rol</th>
                  <th scope="col">Estado</th>
                  <th scope="col"><span className="tuvet-visually-hidden">Acciones</span></th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((g) => (
                  <tr key={g.id_gerente_area} className={g.activo ? '' : 'tuvet-row-inactiva'}>
                    <td>
                      <span className="gk-persona">
                        <Avatar nombre={g.nombre} size="sm" />
                        <span className="gk-persona-texto">
                          <strong className="gk-nombre">{g.nombre}</strong>
                          <span className="gk-email" title={g.email}>{g.email}</span>
                        </span>
                      </span>
                    </td>
                    <td>
                      {g.es_admin_maestro ? (
                        <span className="tuvet-badge gk-badge-admin"><Icono nombre="llave" className="tuvet-badge-icon" />Admin maestro</span>
                      ) : (
                        <span className="tuvet-badge gk-badge-ga">Gerente de área</span>
                      )}
                    </td>
                    <td>
                      <span className={`tuvet-badge ${g.activo ? 'tuvet-badge-aprobada' : 'tuvet-badge-cancelada'}`}>
                        <Icono nombre={g.activo ? 'check' : 'cerrar'} className="tuvet-badge-icon" />
                        {g.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="tuvet-cell-acciones">
                      {canManageGerentes && (
                        <button type="button" className="tuvet-icon-action" title="Editar" aria-label={`Editar a ${g.nombre}`} onClick={() => abrir('editar', g)}>
                          <Icono nombre="editar" />
                        </button>
                      )}
                      {canManageAssignments && g.activo && (
                        <button type="button" className="tuvet-icon-action" title="Asignar área" aria-label={`Asignar área a ${g.nombre}`} onClick={() => abrir('assign-area', g)}>
                          <Icono nombre="edificio" />
                        </button>
                      )}
                      {canManageGerentes && (
                        <button type="button" className="tuvet-icon-action" title="Resetear contraseña" aria-label={`Resetear contraseña de ${g.nombre}`} onClick={() => resetear(g)}>
                          <Icono nombre="llave" />
                        </button>
                      )}
                      {canManageGerentes && g.activo && (
                        <button type="button" className="tuvet-icon-action tuvet-icon-action-danger" title="Desactivar" aria-label={`Desactivar a ${g.nombre}`} onClick={() => abrir('desactivar', g)}>
                          <Icono nombre="prohibido" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="gk-pie" aria-live="polite">Mostrando {filtrados.length} de {gerentes.length} gerentes</p>
        </div>
      </EstadoCarga>

      {modal?.type === 'crear' && (
        <CrearModal onSubmit={handleCreate} onClose={() => setModal(null)} />
      )}
      {modal?.type === 'editar' && (
        <EditarModal
          gerente={modal.gerente}
          onSubmit={(form) => handleEdit(modal.gerente.id_gerente_area, form)}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === 'desactivar' && (
        <DesactivarModal
          key={modal.gerente.id_gerente_area}
          gerente={modal.gerente}
          onConfirm={(idNuevoGerenteArea) => handleDesactivar(modal.gerente.id_gerente_area, idNuevoGerenteArea)}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === 'password' && (
        <PasswordModal
          nombre={modal.nombre}
          password={modal.password}
          correoEnviado={modal.correoEnviado}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === 'assign-area' && (
        <AreaManagerAssignmentModal
          target={modal.gerente}
          targetType="manager"
          loadEligible={() => getEligibleAreas(modal.gerente.id_gerente_area)}
          onAssign={(areaId) => assignArea(modal.gerente, areaId)}
          onReassign={isSystemsAccount ? (areaId) => reassignArea(modal.gerente, areaId) : undefined}
          onClose={() => setModal(null)}
        />
      )}
      {dialogo}
    </div>
  )
}

/* ── Modales ── */

function GerenteForm({ id, form, setForm, errores, setErrores, formRef, onSubmit }) {
  const set = (k) => (e) => {
    setForm((f) => ({ ...f, [k]: e.target.value }))
    setErrores((actual) => ({ ...actual, [k]: undefined }))
  }
  return (
    <form id={id} ref={formRef} className="tuvet-form" onSubmit={onSubmit} noValidate>
      <Field label="Nombre" required error={errores.nombre}>
        <input type="text" value={form.nombre} onChange={set('nombre')} autoComplete="off" placeholder="Ej. Ana Pérez" />
      </Field>
      <Field label="Email" required error={errores.email}>
        <input type="email" value={form.email} onChange={set('email')} autoComplete="off" placeholder="nombre@empresa.com" />
      </Field>
      <Toggle
        label="Es admin maestro"
        description="Puede administrar usuarios, gerentes y la configuración."
        checked={form.es_admin_maestro}
        onChange={(valor) => setForm((f) => ({ ...f, es_admin_maestro: valor }))}
      />
    </form>
  )
}

function validarGerente(form) {
  const errores = {}
  if (!form.nombre.trim()) errores.nombre = 'Escribe el nombre completo.'
  if (!form.email.trim()) errores.email = 'Escribe el correo; ahí recibirá su contraseña temporal.'
  else if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) errores.email = 'Revisa el correo; debe tener el formato nombre@dominio.com.'
  return errores
}

function CrearModal({ onSubmit, onClose }) {
  const [form, setForm]     = useState({ nombre: '', email: '', es_admin_maestro: false })
  const [errores, setErrores] = useState({})
  const [error, setError]   = useState('')
  const [loading, setLoading] = useState(false)
  const formRef = useRef(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    const nuevos = validarGerente(form)
    setErrores(nuevos)
    if (Object.keys(nuevos).length) {
      enfocarPrimerError(formRef.current)
      return
    }
    setLoading(true)
    try {
      await onSubmit(form)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      title="Nuevo gerente de área"
      subtitle="Recibirá una contraseña temporal por correo."
      icon="persona"
      onClose={loading ? () => {} : onClose}
      footer={(
        <>
          <button type="button" className="tuvet-btn tuvet-btn-secondary" onClick={onClose} disabled={loading}>Cancelar</button>
          <button type="submit" form="gk-crear-form" className="tuvet-btn" disabled={loading} aria-busy={loading}>
            {loading ? 'Creando...' : 'Crear gerente'}
          </button>
        </>
      )}
    >
      <Aviso tipo="error">{error}</Aviso>
      <GerenteForm id="gk-crear-form" form={form} setForm={setForm} errores={errores} setErrores={setErrores} formRef={formRef} onSubmit={handleSubmit} />
    </Modal>
  )
}

function EditarModal({ gerente, onSubmit, onClose }) {
  const [form, setForm] = useState({
    nombre:          gerente.nombre,
    email:           gerente.email,
    es_admin_maestro: gerente.es_admin_maestro,
  })
  const [errores, setErrores] = useState({})
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)
  const formRef = useRef(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    const nuevos = validarGerente(form)
    setErrores(nuevos)
    if (Object.keys(nuevos).length) {
      enfocarPrimerError(formRef.current)
      return
    }
    setLoading(true)
    try {
      await onSubmit(form)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      title="Editar gerente"
      subtitle={gerente.nombre}
      icon="editar"
      onClose={loading ? () => {} : onClose}
      footer={(
        <>
          <button type="button" className="tuvet-btn tuvet-btn-secondary" onClick={onClose} disabled={loading}>Cancelar</button>
          <button type="submit" form="gk-editar-form" className="tuvet-btn" disabled={loading} aria-busy={loading}>
            {loading ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </>
      )}
    >
      <Aviso tipo="error">{error}</Aviso>
      <GerenteForm id="gk-editar-form" form={form} setForm={setForm} errores={errores} setErrores={setErrores} formRef={formRef} onSubmit={handleSubmit} />
    </Modal>
  )
}

function DesactivarModal({ gerente, onConfirm, onClose }) {
  const [preparacion, setPreparacion] = useState(null)
  const [cargandoPreparacion, setCargandoPreparacion] = useState(true)
  const [idNuevoGerenteArea, setIdNuevoGerenteArea] = useState('')
  const [errorDestino, setErrorDestino] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  useEffect(() => {
    let activo = true

    async function cargarPreparacion() {
      try {
        const data = await prepararDesactivacionGerente(gerente.id_gerente_area)
        if (activo) setPreparacion(data)
      } catch (err) {
        if (activo) setError(`No se pudo preparar la desactivación del gerente: ${err.message}`)
      } finally {
        if (activo) setCargandoPreparacion(false)
      }
    }

    cargarPreparacion()
    return () => { activo = false }
  }, [gerente.id_gerente_area])

  async function handleConfirm() {
    if (preparacion.requiere_reasignacion && !idNuevoGerenteArea) {
      setErrorDestino('Elige a qué gerente pasarán sus sucursales.')
      return
    }

    setError('')
    setLoading(true)
    try { await onConfirm(idNuevoGerenteArea ? Number(idNuevoGerenteArea) : undefined) }
    catch (err) { setError(err.message); setLoading(false) }
  }

  return (
    <Modal
      title="Desactivar gerente"
      subtitle={preparacion?.gerente_area?.nombre ?? gerente.nombre}
      icon="alerta"
      tone="danger"
      role="alertdialog"
      wide
      onClose={loading ? () => {} : onClose}
      footer={(
        <>
          <button type="button" className="tuvet-btn tuvet-btn-secondary" onClick={onClose} disabled={loading}>Cancelar</button>
          <button type="button" className="tuvet-btn tuvet-btn-danger-solid" onClick={handleConfirm} disabled={cargandoPreparacion || !preparacion || loading} aria-busy={loading}>
            {loading ? 'Desactivando...' : 'Desactivar'}
          </button>
        </>
      )}
    >
      <div className="tuvet-form">
        {cargandoPreparacion ? (
          <p className="tuvet-state" role="status">Revisando sucursales y usuarios a cargo...</p>
        ) : preparacion && (
          <>
            <p className="tuvet-confirm-message">
              ¿Deseas desactivar a <strong>{preparacion.gerente_area?.nombre ?? gerente.nombre}</strong>? No podrá iniciar sesión.
            </p>
            {gerente.es_admin_maestro && (
              <Aviso tipo="warning">Es admin maestro: el sistema no permite desactivar al último admin activo.</Aviso>
            )}
            <div className="gk-impacto">
              <div><strong>{preparacion.sucursales_count}</strong>Sucursal{preparacion.sucursales_count !== 1 ? 'es' : ''} a su cargo</div>
              <div><strong>{preparacion.usuarios_asignados_count}</strong>Usuario{preparacion.usuarios_asignados_count !== 1 ? 's' : ''} asignado{preparacion.usuarios_asignados_count !== 1 ? 's' : ''}</div>
            </div>
            {preparacion.sucursales.length > 0 && (
              <ul className="gk-sucursales">
                {preparacion.sucursales.map((sucursal) => (
                  <li key={sucursal.id_sucursal}><span className="tuvet-tag">{sucursal.codigo}</span>{sucursal.nombre}</li>
                ))}
              </ul>
            )}
            {preparacion.requiere_reasignacion && (
              <Field label="Gerente de destino" required hint="Recibirá sus sucursales y usuarios." error={errorDestino}>
                <select value={idNuevoGerenteArea} onChange={(e) => { setIdNuevoGerenteArea(e.target.value); setErrorDestino('') }} disabled={loading}>
                  <option value="">Seleccionar gerente de destino</option>
                  {preparacion.gerentes_destino.map((destino) => (
                    <option key={destino.id_gerente_area} value={destino.id_gerente_area}>{destino.nombre}</option>
                  ))}
                </select>
              </Field>
            )}
          </>
        )}
        <Aviso tipo="error">{error}</Aviso>
      </div>
    </Modal>
  )
}

function PasswordModal({ nombre, password, correoEnviado = true, onClose }) {
  const [copiada, setCopiada] = useState(false)

  async function copiar() {
    try {
      await navigator.clipboard.writeText(password)
      setCopiada(true)
      setTimeout(() => setCopiada(false), 2000)
    } catch {
      setCopiada(false)
    }
  }

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
        <p>Contraseña temporal para <strong>{nombre}</strong>. Deberá cambiarla al iniciar sesión.</p>
        {!correoEnviado && (
          <p className="tuvet-aviso tuvet-aviso-warning" role="alert">
            El sistema no pudo confirmar el envío del correo. Copia y comparte esta contraseña por un canal seguro.
          </p>
        )}
        <div className="tuvet-password-box">
          <span className="tuvet-password" aria-label="Contraseña temporal">{password}</span>
          <button type="button" className="tuvet-btn tuvet-btn-secondary" onClick={copiar} aria-live="polite">
            {copiada ? <><Icono nombre="check" /> Copiada</> : 'Copiar'}
          </button>
        </div>
        <Aviso tipo="warning">No volverá a mostrarse después de cerrar esta ventana.</Aviso>
      </div>
    </Modal>
  )
}
