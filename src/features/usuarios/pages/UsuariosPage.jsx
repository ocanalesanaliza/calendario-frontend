import { useCallback, useEffect, useRef, useState } from 'react'
import { getUsuarios, createUsuario, updateUsuario, cambiarSucursal, desactivarUsuario, resetPasswordUsuario } from '../services/usuariosService'
import { getSucursales } from '../../sucursales/services/sucursalesService'
// Kit de componentes compartido con Tuvet; los colores de Analiza llegan con la clase .tema-analiza.
import { Avatar, Aviso, EstadoCarga, Field, Icono, Modal, PageHeader, Toggle } from '../../tuvet/components/TuvetUi'
import { useConfirmacion } from '../../tuvet/components/useConfirmacion'
import { enfocarPrimerError } from '../../tuvet/utils/formularios'
import '../../tuvet/tuvet.css'
// Se conserva: otras páginas podrían depender de sus clases genéricas (todos los CSS son globales).
import './UsuariosPage.css'
import './UsuariosKit.css'

const FILTROS = { active: 'Activos', inactive: 'Inactivos' }

const normalizar = (texto) => String(texto ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState([])
  const [sucursales, setSucursales] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('active')
  const [busqueda, setBusqueda] = useState('')
  const [aviso, setAviso] = useState('')
  const [modal, setModal] = useState(null)
  const [confirmar, dialogo] = useConfirmacion()

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [u, s] = await Promise.all([getUsuarios(filter === 'inactive' ? { habilitado: 'false' } : {}), getSucursales()])
      setUsuarios(u)
      setSucursales(s)
    } catch (requestError) {
      setError(requestError.message || 'No se pudieron cargar los usuarios.')
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData()
  }, [loadData])

  function closeModal() { setModal(null) }

  function abrir(type, usuario = null) {
    setAviso('')
    setModal({ type, usuario })
  }

  async function handleCreate(form) {
    const data = await createUsuario(form)
    // La contraseña temporal solo vive en el estado del modal; se descarta al cerrarlo.
    setModal({
      type: 'password',
      password: data.password_temporal,
      nombre: data.usuario.nombre,
      correoEnviado: data.correo_enviado !== false,
    })
    void loadData().catch(() => {})
  }

  async function handleEdit(id, form) {
    await updateUsuario(id, form)
    await loadData()
    closeModal()
    setAviso(`Usuario “${form.nombre}” actualizado.`)
  }

  async function handleCambiarSucursal(usuario, form) {
    await cambiarSucursal(usuario.id_usuario, form)
    await loadData()
    closeModal()
    const destino = sucursales.find((s) => s.id_sucursal === form.id_sucursal)?.nombre
    setAviso(`${usuario.nombre} ahora está en ${destino ?? 'la nueva sucursal'}.`)
  }

  async function handleResetPassword(id) {
    const data = await resetPasswordUsuario(id)
    setModal({
      type: 'password',
      password: data.password_temporal,
      nombre: data.usuario.nombre,
      correoEnviado: data.correo_enviado !== false,
    })
    void loadData().catch(() => {})
  }

  async function desactivar(usuario) {
    setAviso('')
    const ok = await confirmar({
      title: 'Desactivar usuario',
      message: `¿Deseas desactivar a ${usuario.nombre}?`,
      detail: 'No podrá iniciar sesión y se cerrará su asignación de sucursal.',
      confirmLabel: 'Desactivar',
      accion: () => desactivarUsuario(usuario.id_usuario),
    })
    if (!ok) return
    setAviso(`${usuario.nombre} fue desactivado.`)
    await loadData()
  }

  function resetear(usuario) {
    setAviso('')
    void confirmar({
      title: 'Resetear contraseña',
      message: `Se generará una nueva contraseña temporal para ${usuario.nombre}.`,
      detail: 'Deberá cambiarla al iniciar sesión. La contraseña actual dejará de funcionar.',
      confirmLabel: 'Resetear',
      tone: 'primary',
      accion: () => handleResetPassword(usuario.id_usuario),
    })
  }

  const termino = normalizar(busqueda.trim())
  const filtrados = termino
    ? usuarios.filter((u) => normalizar(`${u.nombre} ${u.email} ${u.sucursal_actual?.nombre ?? ''} ${u.gerente_area_actual?.nombre ?? ''}`).includes(termino))
    : usuarios
  const pendientesPassword = usuarios.filter((u) => u.debe_cambiar_password).length
  const etiquetaFiltro = filter === 'inactive' ? 'inactivo' : 'activo'

  return (
    <div className="tema-analiza tuvet-page usuarios-kit">
      <PageHeader
        title="Usuarios"
        description={`${usuarios.length} usuario${usuarios.length !== 1 ? 's' : ''} ${etiquetaFiltro}${usuarios.length !== 1 ? 's' : ''}${pendientesPassword ? ` · ${pendientesPassword} debe${pendientesPassword !== 1 ? 'n' : ''} cambiar su contraseña` : ''}.`}
      >
        <button type="button" className="tuvet-btn" onClick={() => abrir('crear')}>Nuevo usuario</button>
      </PageHeader>

      <div className="uk-barra">
        <div className="tuvet-search-bar" role="search">
          <Icono nombre="buscar" className="tuvet-search-icon" />
          <input
            type="search"
            value={busqueda}
            onChange={(event) => setBusqueda(event.target.value)}
            placeholder="Buscar por nombre, correo, sucursal o gerente"
            aria-label="Buscar por nombre, correo, sucursal o gerente"
          />
          {busqueda && <button type="button" className="tuvet-btn tuvet-btn-ghost" onClick={() => setBusqueda('')}>Limpiar</button>}
        </div>
        <div className="tuvet-filtros" role="group" aria-label="Mostrar">
          {Object.entries(FILTROS).map(([clave, etiqueta]) => (
            <button
              key={clave}
              type="button"
              className={`tuvet-chip ${filter === clave ? 'active' : ''}`}
              aria-pressed={filter === clave}
              onClick={() => { setFilter(clave); setAviso('') }}
            >
              {etiqueta}
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
        emptyText={termino ? `Ningún usuario coincide con “${busqueda.trim()}”.` : 'No hay usuarios registrados.'}
        emptyAction={termino
          ? <button type="button" className="tuvet-btn tuvet-btn-secondary" onClick={() => setBusqueda('')}>Quitar búsqueda</button>
          : filter === 'active' && <button type="button" className="tuvet-btn" onClick={() => abrir('crear')}>Crear el primer usuario</button>}
      >
        <div className="tuvet-card uk-tabla-card">
          <div className="tuvet-table-wrap">
            <table className="tuvet-table uk-tabla">
              <thead>
                <tr>
                  <th scope="col">Usuario</th>
                  <th scope="col">Sucursal</th>
                  <th scope="col">Gerente de área</th>
                  <th scope="col">Estado</th>
                  <th scope="col"><span className="tuvet-visually-hidden">Acciones</span></th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((u) => (
                  <tr key={u.id_usuario} className={u.habilitado ? '' : 'tuvet-row-inactiva'}>
                    <td>
                      <span className="uk-persona">
                        <Avatar nombre={u.nombre} size="sm" />
                        <span className="uk-persona-texto">
                          <strong className="uk-nombre">{u.nombre}</strong>
                          <span className="uk-email" title={u.email}>{u.email}</span>
                        </span>
                      </span>
                    </td>
                    <td>{u.sucursal_actual?.nombre ?? <span className="tuvet-hint">Sin sucursal</span>}</td>
                    <td>{u.gerente_area_actual?.nombre ?? <span className="tuvet-hint">—</span>}</td>
                    <td>
                      <span className="tuvet-badges">
                        <span className={`tuvet-badge ${u.habilitado ? 'tuvet-badge-aprobada' : 'tuvet-badge-cancelada'}`}>
                          <Icono nombre={u.habilitado ? 'check' : 'cerrar'} className="tuvet-badge-icon" />
                          {u.habilitado ? 'Activo' : 'Inactivo'}
                        </span>
                        {u.debe_cambiar_password && (
                          <span className="tuvet-badge tuvet-badge-pendiente" title="Aún usa la contraseña temporal">
                            <Icono nombre="llave" className="tuvet-badge-icon" />
                            Cambiar contraseña
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="tuvet-cell-acciones">
                      <button type="button" className="tuvet-icon-action" title="Editar" aria-label={`Editar ${u.nombre}`} onClick={() => abrir('editar', u)}>
                        <Icono nombre="editar" />
                      </button>
                      <button type="button" className="tuvet-icon-action" title="Resetear contraseña" aria-label={`Resetear contraseña de ${u.nombre}`} onClick={() => resetear(u)}>
                        <Icono nombre="llave" />
                      </button>
                      <button type="button" className="tuvet-icon-action" title="Cambiar sucursal" aria-label={`Cambiar sucursal de ${u.nombre}`} onClick={() => abrir('sucursal', u)}>
                        <Icono nombre="edificio" />
                      </button>
                      {u.habilitado && (
                        <button type="button" className="tuvet-icon-action tuvet-icon-action-danger" title="Desactivar" aria-label={`Desactivar a ${u.nombre}`} onClick={() => desactivar(u)}>
                          <Icono nombre="prohibido" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="uk-pie" aria-live="polite">Mostrando {filtrados.length} de {usuarios.length} usuarios</p>
        </div>
      </EstadoCarga>

      {modal?.type === 'crear' && (
        <CrearModal sucursales={sucursales} onSubmit={handleCreate} onClose={closeModal} />
      )}

      {modal?.type === 'editar' && (
        <EditarModal
          usuario={modal.usuario}
          onSubmit={(form) => handleEdit(modal.usuario.id_usuario, form)}
          onClose={closeModal}
        />
      )}

      {modal?.type === 'sucursal' && (
        <CambiarSucursalModal
          usuario={modal.usuario}
          sucursales={sucursales}
          onSubmit={(form) => handleCambiarSucursal(modal.usuario, form)}
          onClose={closeModal}
        />
      )}

      {modal?.type === 'password' && (
        <PasswordModal
          nombre={modal.nombre}
          password={modal.password}
          correoEnviado={modal.correoEnviado}
          onClose={closeModal}
        />
      )}

      {dialogo}
    </div>
  )
}

/* ── Modales ── */

function CrearModal({ sucursales, onSubmit, onClose }) {
  const [form, setForm] = useState({ nombre: '', email: '', id_sucursal: '' })
  const [errores, setErrores] = useState({})
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const formRef = useRef(null)

  const set = (k) => (e) => {
    setForm((f) => ({ ...f, [k]: e.target.value }))
    setErrores((actual) => ({ ...actual, [k]: undefined }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    const nuevos = {}
    if (!form.nombre.trim()) nuevos.nombre = 'Escribe el nombre completo.'
    if (!form.email.trim()) nuevos.email = 'Escribe el correo; ahí recibirá su contraseña temporal.'
    else if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) nuevos.email = 'Revisa el correo; debe tener el formato nombre@dominio.com.'
    if (!form.id_sucursal) nuevos.id_sucursal = 'Elige la sucursal donde trabajará.'
    setErrores(nuevos)
    if (Object.keys(nuevos).length) {
      enfocarPrimerError(formRef.current)
      return
    }
    setLoading(true)
    try {
      await onSubmit({ ...form, id_sucursal: Number(form.id_sucursal) })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      title="Nuevo usuario"
      subtitle="Recibirá una contraseña temporal por correo."
      icon="persona"
      onClose={loading ? () => {} : onClose}
      footer={(
        <>
          <button type="button" className="tuvet-btn tuvet-btn-secondary" onClick={onClose} disabled={loading}>Cancelar</button>
          <button type="submit" form="uk-crear-form" className="tuvet-btn" disabled={loading} aria-busy={loading}>
            {loading ? 'Creando...' : 'Crear usuario'}
          </button>
        </>
      )}
    >
      <form id="uk-crear-form" ref={formRef} className="tuvet-form" onSubmit={handleSubmit} noValidate>
        <Aviso tipo="error">{error}</Aviso>
        <Field label="Nombre" required error={errores.nombre}>
          <input type="text" value={form.nombre} onChange={set('nombre')} autoComplete="off" placeholder="Ej. Ana Pérez" />
        </Field>
        <Field label="Email" required error={errores.email}>
          <input type="email" value={form.email} onChange={set('email')} autoComplete="off" placeholder="nombre@empresa.com" />
        </Field>
        <Field label="Sucursal" required error={errores.id_sucursal}>
          <select value={form.id_sucursal} onChange={set('id_sucursal')}>
            <option value="">Seleccionar sucursal</option>
            {sucursales.map((s) => (
              <option key={s.id_sucursal} value={s.id_sucursal}>{s.nombre}</option>
            ))}
          </select>
        </Field>
      </form>
    </Modal>
  )
}

function EditarModal({ usuario, onSubmit, onClose }) {
  const [form, setForm] = useState({
    nombre: usuario.nombre,
    email: usuario.email,
    habilitado: usuario.habilitado,
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
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
      title="Editar usuario"
      subtitle={usuario.nombre}
      icon="editar"
      onClose={loading ? () => {} : onClose}
      footer={(
        <>
          <button type="button" className="tuvet-btn tuvet-btn-secondary" onClick={onClose} disabled={loading}>Cancelar</button>
          <button type="submit" form="uk-editar-form" className="tuvet-btn" disabled={loading} aria-busy={loading}>
            {loading ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </>
      )}
    >
      <form id="uk-editar-form" className="tuvet-form" onSubmit={handleSubmit}>
        <Aviso tipo="error">{error}</Aviso>
        <Field label="Nombre" required>
          <input type="text" value={form.nombre} onChange={set('nombre')} required />
        </Field>
        <Field label="Email" required>
          <input type="email" value={form.email} onChange={set('email')} required />
        </Field>
        <Toggle
          label="Habilitado"
          description={form.habilitado ? 'Puede iniciar sesión.' : 'No podrá iniciar sesión.'}
          checked={form.habilitado}
          onChange={(valor) => setForm((f) => ({ ...f, habilitado: valor }))}
        />
      </form>
    </Modal>
  )
}

function CambiarSucursalModal({ usuario, sucursales, onSubmit, onClose }) {
  const [form, setForm] = useState({
    id_sucursal: usuario.sucursal_actual?.id_sucursal ?? '',
    fecha_inicio: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const body = { id_sucursal: Number(form.id_sucursal) }
      if (form.fecha_inicio) body.fecha_inicio = form.fecha_inicio
      await onSubmit(body)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      title="Cambiar sucursal"
      subtitle={usuario.nombre}
      icon="edificio"
      onClose={loading ? () => {} : onClose}
      footer={(
        <>
          <button type="button" className="tuvet-btn tuvet-btn-secondary" onClick={onClose} disabled={loading}>Cancelar</button>
          <button type="submit" form="uk-sucursal-form" className="tuvet-btn" disabled={loading} aria-busy={loading}>
            {loading ? 'Cambiando...' : 'Cambiar sucursal'}
          </button>
        </>
      )}
    >
      <form id="uk-sucursal-form" className="tuvet-form" onSubmit={handleSubmit}>
        <Aviso tipo="error">{error}</Aviso>
        <p className="uk-actual">
          <Icono nombre="edificio" className="uk-actual-icono" />
          Sucursal actual: <strong>{usuario.sucursal_actual?.nombre ?? 'sin sucursal'}</strong>
        </p>
        <Field label="Nueva sucursal" required>
          <select value={form.id_sucursal} onChange={set('id_sucursal')} required>
            <option value="">Seleccionar sucursal</option>
            {sucursales.map((s) => (
              <option key={s.id_sucursal} value={s.id_sucursal}>{s.nombre}</option>
            ))}
          </select>
        </Field>
        <Field label="Fecha de inicio" hint="Opcional. Si la dejas vacía, el cambio aplica desde hoy.">
          <input type="date" value={form.fecha_inicio} onChange={set('fecha_inicio')} />
        </Field>
      </form>
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
