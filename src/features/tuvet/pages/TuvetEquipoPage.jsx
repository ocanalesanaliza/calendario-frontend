import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '../../auth/context/AuthContext'
import { getCompanies } from '../../organizacion/services/organizacionService'
import {
  Avatar,
  Aviso,
  EstadoCarga,
  Field,
  FormSection,
  Icono,
  Modal,
  PageHeader,
  PasswordTemporalModal,
  SelectableList,
} from '../components/TuvetUi'
import { useConfirmacion } from '../components/useConfirmacion'
import {
  agregarEncargadoAGerenteSucursal,
  cambiarDepartamentoEncargado,
  createDepartamento,
  createEncargado,
  createGerenteOperaciones,
  createGerenteSucursal,
  desactivarDepartamento,
  desactivarEncargado,
  desvincularGoEncargado,
  getDepartamentos,
  getEncargados,
  getEncargadosDeGerenteSucursal,
  getGerentesOperaciones,
  getGerentesSucursal,
  getGoEncargados,
  listItems,
  resetPasswordEncargado,
  resetPasswordGerenteOperaciones,
  resetPasswordGerenteSucursal,
  retirarEncargadoDeGerenteSucursal,
  updateDepartamento,
  vincularGoEncargado,
} from '../services/tuvetService'
import { getTuvetCapabilities } from '../tuvetPolicies'
import { formatFecha, formatVigencia, nombrePersona } from '../utils/formato'
import { enfocarPrimerError, erroresDelServidor } from '../utils/formularios'

const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function useLista(loader, enabled = true) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(enabled)
  const [error, setError] = useState('')

  const cargar = useCallback(async () => {
    if (!enabled) return
    setLoading(true)
    setError('')
    try {
      setItems(listItems(await loader()))
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [loader, enabled])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void cargar()
  }, [cargar])

  return { items, loading, error, cargar }
}

// Búsqueda sin distinguir mayúsculas ni tildes.
const normalizar = (texto) => String(texto ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

const CAMPOS_BUSQUEDA = {
  persona: (persona) => [nombrePersona(persona), persona.email, persona.departamento?.nombre],
  departamento: (departamento) => [departamento.nombre, departamento.empresa?.nombre],
  relacion: (relacion) => [
    nombrePersona(relacion.gerente_operaciones), relacion.gerente_operaciones?.email,
    nombrePersona(relacion.encargado), relacion.encargado?.email,
  ],
}

function filtrar(items, termino, campos) {
  const buscado = normalizar(termino.trim())
  if (!buscado) return items
  const palabras = buscado.split(/\s+/)
  return items.filter((item) => {
    const texto = normalizar(campos(item).filter(Boolean).join(' '))
    return palabras.every((palabra) => texto.includes(palabra))
  })
}

function textoVacio(termino, porDefecto) {
  return termino.trim() ? `Sin resultados para “${termino.trim()}”.` : porDefecto
}

function useEmpresasTuvet(enabled) {
  const [empresas, setEmpresas] = useState([])
  useEffect(() => {
    if (!enabled) return
    getCompanies()
      .then((data) => {
        const lista = listItems(data)
        const tuvet = lista.filter((empresa) => empresa.modulo_calendario === 'tuvet')
        setEmpresas(tuvet.length ? tuvet : lista)
      })
      .catch(() => setEmpresas([]))
  }, [enabled])
  return empresas
}

function EmpresaSelect({ empresas, value, onChange, error, full = false }) {
  return (
    <Field label="Empresa" required full={full} error={error} hint="Como cuenta de Sistemas debes indicar la empresa.">
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Seleccionar empresa</option>
        {empresas.map((empresa) => <option key={empresa.id} value={empresa.id}>{empresa.name ?? empresa.nombre}</option>)}
      </select>
    </Field>
  )
}

const etiquetaEncargado = (encargado) => nombrePersona(encargado)
const metaEncargado = (encargado) => [encargado.departamento?.nombre, encargado.email].filter(Boolean).join(' · ')

function validarPersona(form, { conDepartamento, isSystems }) {
  const errores = {}
  if (isSystems && !form.empresa_id) errores.empresa_id = 'Selecciona la empresa a la que pertenecerá el usuario.'
  if (!form.nombre.trim()) errores.nombre = 'Escribe el nombre de la persona.'
  if (!form.email.trim()) errores.email = 'Escribe el correo; será su usuario para iniciar sesión.'
  else if (!EMAIL_VALIDO.test(form.email.trim())) errores.email = 'El correo no es válido. Revisa que tenga el formato usuario@dominio.com.'
  if (conDepartamento && !form.departamento_id) errores.departamento_id = 'Elige el departamento que gestionará este encargado.'
  return errores
}

function PersonaModal({ titulo, subtitulo, conDepartamento, departamentos, conEncargados, encargados = [], empresas, isSystems, onCrear, onClose, onCreada }) {
  const [form, setForm] = useState({ nombre: '', apellido: '', email: '', departamento_id: '', empresa_id: '' })
  const [encargadoIds, setEncargadoIds] = useState([])
  const [errores, setErrores] = useState({})
  const [errorGeneral, setErrorGeneral] = useState('')
  const [guardando, setGuardando] = useState(false)
  const formRef = useRef(null)

  function set(campo) {
    return (event) => {
      const valor = event.target.value
      setForm((actual) => ({ ...actual, [campo]: valor }))
      if (errores[campo]) setErrores((actual) => ({ ...actual, [campo]: undefined }))
    }
  }

  // Validación al salir del campo, no mientras se escribe.
  function validarCampo(campo) {
    const resultado = validarPersona(form, { conDepartamento, isSystems })
    setErrores((actual) => ({ ...actual, [campo]: resultado[campo] }))
  }

  async function guardar(event) {
    event.preventDefault()
    const encontrados = validarPersona(form, { conDepartamento, isSystems })
    setErrores(encontrados)
    setErrorGeneral('')
    if (Object.keys(encontrados).length) {
      enfocarPrimerError(formRef.current)
      return
    }
    setGuardando(true)
    try {
      const creada = await onCrear({
        nombre: form.nombre.trim(),
        apellido: form.apellido.trim() || undefined,
        email: form.email.trim(),
        departamento_id: conDepartamento ? Number(form.departamento_id) : undefined,
        empresa_id: isSystems ? Number(form.empresa_id) : undefined,
        encargado_ids: conEncargados && encargadoIds.length ? encargadoIds : undefined,
      })
      onCreada(creada)
    } catch (err) {
      const { porCampo, general } = erroresDelServidor(err, ['nombre', 'apellido', 'email', 'departamento_id', 'empresa_id', 'encargado_ids'])
      setErrores(porCampo)
      setErrorGeneral(general)
      setGuardando(false)
      enfocarPrimerError(formRef.current)
    }
  }

  return (
    <Modal
      title={titulo}
      subtitle={subtitulo}
      icon="persona"
      wide={conEncargados}
      onClose={guardando ? () => {} : onClose}
      footer={(
        <>
          <button type="button" className="tuvet-btn tuvet-btn-secondary" onClick={onClose} disabled={guardando}>Cancelar</button>
          <button type="submit" form="tuvet-persona-form" className="tuvet-btn" disabled={guardando} aria-busy={guardando}>{guardando ? 'Creando...' : 'Crear usuario'}</button>
        </>
      )}
    >
      <form id="tuvet-persona-form" ref={formRef} className="tuvet-form" onSubmit={guardar} noValidate>
        <Aviso tipo="error">{errorGeneral}</Aviso>
        <FormSection title="Datos personales" description="Se generará una contraseña temporal que deberá cambiar al iniciar sesión.">
          <div className="tuvet-form-grid">
            {isSystems && (
              <EmpresaSelect
                full
                empresas={empresas}
                value={form.empresa_id}
                error={errores.empresa_id}
                onChange={(valor) => { setForm((actual) => ({ ...actual, empresa_id: valor })); setErrores((actual) => ({ ...actual, empresa_id: undefined })) }}
              />
            )}
            <Field label="Nombre" required error={errores.nombre}>
              <input value={form.nombre} onChange={set('nombre')} onBlur={() => validarCampo('nombre')} placeholder="Ej. Ana" autoComplete="given-name" />
            </Field>
            <Field label="Apellido" error={errores.apellido} hint="Opcional.">
              <input value={form.apellido} onChange={set('apellido')} autoComplete="family-name" />
            </Field>
            <Field label="Correo electrónico" required full error={errores.email} hint="Será su usuario para iniciar sesión.">
              <input type="email" inputMode="email" value={form.email} onChange={set('email')} onBlur={() => validarCampo('email')} placeholder="usuario@tuvet.com" autoComplete="email" />
            </Field>
            {conDepartamento && (
              <Field label="Departamento" required full error={errores.departamento_id}>
                <select value={form.departamento_id} onChange={set('departamento_id')} onBlur={() => validarCampo('departamento_id')}>
                  <option value="">Seleccionar departamento</option>
                  {departamentos.filter((item) => item.activo).map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}
                </select>
              </Field>
            )}
          </div>
        </FormSection>
        {conEncargados && (
          <FormSection title="Encargados" description="Opcional. Un gerente de sucursal puede depender de varios encargados; también puedes agregarlos después.">
            <SelectableList
              items={encargados}
              selected={encargadoIds}
              onChange={setEncargadoIds}
              getLabel={etiquetaEncargado}
              getMeta={metaEncargado}
              withAvatar
              searchPlaceholder="Buscar encargado"
              emptyText="No hay encargados activos."
              disabled={guardando}
            />
            {errores.encargado_ids && <Aviso tipo="error">{errores.encargado_ids}</Aviso>}
          </FormSection>
        )}
      </form>
    </Modal>
  )
}

function EncargadosGerenteSucursalModal({ gerente, encargados, puedeEditar, onClose }) {
  const [relaciones, setRelaciones] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')
  const [errorCampo, setErrorCampo] = useState('')
  const [nuevo, setNuevo] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [confirmar, dialogo] = useConfirmacion()

  const cargar = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setRelaciones(listItems(await getEncargadosDeGerenteSucursal(gerente.id)))
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [gerente.id])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void cargar()
  }, [cargar])

  const vinculados = new Set(relaciones.map((relacion) => relacion.encargado?.id))
  const candidatos = encargados.filter((encargado) => !vinculados.has(encargado.id))

  async function agregar(event) {
    event.preventDefault()
    setAviso('')
    if (!nuevo) {
      setErrorCampo('Elige el encargado que quieres agregar.')
      return
    }
    setGuardando(true)
    setErrorCampo('')
    try {
      await agregarEncargadoAGerenteSucursal(gerente.id, Number(nuevo))
      setNuevo('')
      setAviso('Encargado agregado.')
      await cargar()
    } catch (err) {
      setErrorCampo(err.message)
    } finally {
      setGuardando(false)
    }
  }

  async function retirar(relacion) {
    setAviso('')
    const confirmado = await confirmar({
      title: 'Retirar encargado',
      message: `¿Retirar a ${nombrePersona(relacion.encargado)} como encargado de ${nombrePersona(gerente)}?`,
      detail: 'La baja es inmediata. Los demás encargados no se modifican.',
      confirmLabel: 'Retirar',
      accion: async () => {
        const resultado = await retirarEncargadoDeGerenteSucursal(gerente.id, relacion.encargado.id)
        // La baja es inmediata: con removed=true la relación sale de la lista sin esperar al GET.
        if (resultado?.removed) {
          setRelaciones((actuales) => actuales.filter((item) => item.encargado?.id !== relacion.encargado.id))
        }
      },
    })
    if (!confirmado) return
    setAviso(`${nombrePersona(relacion.encargado)} ya no es encargado de ${nombrePersona(gerente)}.`)
    await cargar()
  }

  return (
    <Modal
      title="Encargados"
      subtitle={`${nombrePersona(gerente)}${gerente.email ? ` · ${gerente.email}` : ''}`}
      icon="equipo"
      onClose={onClose}
      wide
      footer={<button type="button" className="tuvet-btn tuvet-btn-secondary" onClick={onClose}>Cerrar</button>}
    >
      <div className="tuvet-form">
        <Aviso tipo="success">{aviso}</Aviso>
        <FormSection
          title={`Encargados vigentes${loading ? '' : ` (${relaciones.length})`}`}
          description="Un gerente de sucursal puede tener varios encargados. Agregar uno no retira a los demás."
        >
          <EstadoCarga loading={loading} error={error} onRetry={cargar} empty={!relaciones.length} emptyText="Todavía no tiene encargados asignados.">
            <ul className="tuvet-person-list">
              {relaciones.map((relacion) => (
                <li key={relacion.id} className="tuvet-person-row">
                  <Avatar persona={relacion.encargado} />
                  <span className="tuvet-select-text">
                    <span className="tuvet-select-label">{nombrePersona(relacion.encargado)}</span>
                    <span className="tuvet-hint">
                      {[relacion.encargado?.departamento?.nombre, formatVigencia(relacion.vigencia)].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                  {puedeEditar && (
                    <button type="button" className="tuvet-btn tuvet-btn-danger" onClick={() => retirar(relacion)}>Retirar</button>
                  )}
                </li>
              ))}
            </ul>
          </EstadoCarga>
        </FormSection>
        {puedeEditar && (
          <FormSection title="Agregar encargado">
            <form className="tuvet-inline-form" onSubmit={agregar} noValidate>
              <Field
                label="Encargado"
                error={errorCampo}
                hint={candidatos.length ? undefined : 'Todos los encargados disponibles ya están asignados.'}
              >
                <select value={nuevo} onChange={(event) => { setNuevo(event.target.value); setErrorCampo('') }} disabled={!candidatos.length}>
                  <option value="">{candidatos.length ? 'Seleccionar encargado' : 'Sin encargados disponibles'}</option>
                  {candidatos.map((encargado) => (
                    <option key={encargado.id} value={encargado.id}>
                      {nombrePersona(encargado)}{encargado.departamento ? ` · ${encargado.departamento.nombre}` : ''}
                    </option>
                  ))}
                </select>
              </Field>
              <button type="submit" className="tuvet-btn" disabled={guardando || !candidatos.length} aria-busy={guardando}>{guardando ? 'Agregando...' : 'Agregar'}</button>
            </form>
          </FormSection>
        )}
      </div>
      {dialogo}
    </Modal>
  )
}

function SelectorModal({ titulo, subtitulo, etiqueta, opciones, descripcion, onConfirmar, onClose }) {
  const [valor, setValor] = useState('')
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  async function confirmar(event) {
    event.preventDefault()
    if (!valor) {
      setError(`Elige una opción en “${etiqueta}” para continuar.`)
      return
    }
    setGuardando(true)
    setError('')
    try {
      await onConfirmar(Number(valor))
    } catch (err) {
      setError(err.message)
      setGuardando(false)
    }
  }

  return (
    <Modal
      title={titulo}
      subtitle={subtitulo}
      icon="edificio"
      onClose={guardando ? () => {} : onClose}
      footer={(
        <>
          <button type="button" className="tuvet-btn tuvet-btn-secondary" onClick={onClose} disabled={guardando}>Cancelar</button>
          <button type="submit" form="tuvet-selector-form" className="tuvet-btn" disabled={guardando} aria-busy={guardando}>{guardando ? 'Guardando...' : 'Guardar'}</button>
        </>
      )}
    >
      <form id="tuvet-selector-form" className="tuvet-form" onSubmit={confirmar} noValidate>
        <Field label={etiqueta} required error={error} hint={descripcion}>
          <select value={valor} onChange={(event) => { setValor(event.target.value); setError('') }}>
            <option value="">Seleccionar</option>
            {opciones.map((opcion) => <option key={opcion.id} value={opcion.id}>{opcion.label}</option>)}
          </select>
        </Field>
      </form>
    </Modal>
  )
}

function RenombrarDepartamentoModal({ departamento, onClose, onGuardado }) {
  const [nombre, setNombre] = useState(departamento.nombre)
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  async function guardar(event) {
    event.preventDefault()
    const limpio = nombre.trim()
    if (!limpio) {
      setError('Escribe el nuevo nombre del departamento.')
      return
    }
    if (limpio === departamento.nombre) {
      setError('El nombre es igual al actual. Escribe uno distinto o cancela.')
      return
    }
    setGuardando(true)
    setError('')
    try {
      await updateDepartamento(departamento.id, { nombre: limpio })
      onGuardado()
    } catch (err) {
      setError(erroresDelServidor(err, ['nombre']).porCampo.nombre ?? err.message)
      setGuardando(false)
    }
  }

  return (
    <Modal
      title="Renombrar departamento"
      subtitle={departamento.nombre}
      icon="editar"
      onClose={guardando ? () => {} : onClose}
      footer={(
        <>
          <button type="button" className="tuvet-btn tuvet-btn-secondary" onClick={onClose} disabled={guardando}>Cancelar</button>
          <button type="submit" form="tuvet-renombrar-form" className="tuvet-btn" disabled={guardando} aria-busy={guardando}>{guardando ? 'Guardando...' : 'Guardar'}</button>
        </>
      )}
    >
      <form id="tuvet-renombrar-form" className="tuvet-form" onSubmit={guardar} noValidate>
        <Field label="Nombre" required error={error}>
          <input value={nombre} onChange={(event) => { setNombre(event.target.value); setError('') }} />
        </Field>
      </form>
    </Modal>
  )
}

function PersonasTabla({ personas, columnas = [], acciones }) {
  return (
    <div className="tuvet-table-wrap">
      <table className="tuvet-table">
        <thead>
          <tr><th scope="col">Nombre</th><th scope="col">Correo</th>{columnas.map((columna) => <th key={columna.titulo} scope="col">{columna.titulo}</th>)}<th scope="col"><span className="tuvet-visually-hidden">Acciones</span></th></tr>
        </thead>
        <tbody>
          {personas.map((persona) => (
            <tr key={persona.id}>
              <td>
                <span className="tuvet-persona-cell">
                  <Avatar persona={persona} size="sm" />
                  <span>{nombrePersona(persona)}</span>
                  {persona.debe_cambiar_password && <span className="tuvet-tag">Contraseña temporal</span>}
                </span>
              </td>
              <td>{persona.email}</td>
              {columnas.map((columna) => <td key={columna.titulo}>{columna.valor(persona)}</td>)}
              <td className="tuvet-cell-acciones">{acciones(persona)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function crearResetPassword(confirmar, resetear, onPassword) {
  return (persona) => confirmar({
    title: 'Restablecer contraseña',
    message: `¿Generar una contraseña temporal nueva para ${nombrePersona(persona)}?`,
    detail: 'Sus sesiones actuales dejarán de ser válidas y deberá cambiarla al iniciar sesión.',
    confirmLabel: 'Restablecer',
    tone: 'primary',
    accion: async () => onPassword(await resetear(persona.id)),
  })
}

function DepartamentosTab({ lista, filtro, empresas, isSystems, onAviso }) {
  const { items, loading, error, cargar } = lista
  const visibles = filtrar(items, filtro, CAMPOS_BUSQUEDA.departamento)
  const [nombre, setNombre] = useState('')
  const [empresaId, setEmpresaId] = useState('')
  const [errores, setErrores] = useState({})
  const [guardando, setGuardando] = useState(false)
  const [renombrando, setRenombrando] = useState(null)
  const [confirmar, dialogo] = useConfirmacion()
  const formRef = useRef(null)

  async function crear(event) {
    event.preventDefault()
    const encontrados = {}
    if (isSystems && !empresaId) encontrados.empresa_id = 'Selecciona la empresa del departamento.'
    if (!nombre.trim()) encontrados.nombre = 'Escribe el nombre del departamento, por ejemplo “Laboratorio”.'
    setErrores(encontrados)
    if (Object.keys(encontrados).length) {
      enfocarPrimerError(formRef.current)
      return
    }
    setGuardando(true)
    try {
      await createDepartamento({ nombre: nombre.trim(), empresa_id: isSystems ? Number(empresaId) : undefined })
      setNombre('')
      onAviso('Departamento creado.')
      await cargar()
    } catch (err) {
      const { porCampo, general } = erroresDelServidor(err, ['nombre', 'empresa_id'])
      setErrores({ ...porCampo, nombre: porCampo.nombre ?? (general || undefined) })
      enfocarPrimerError(formRef.current)
    } finally {
      setGuardando(false)
    }
  }

  async function desactivar(departamento) {
    const confirmado = await confirmar({
      title: 'Desactivar departamento',
      message: `¿Desactivar “${departamento.nombre}”?`,
      detail: 'Se desactivarán sus tareas, plantillas y asignaciones vigentes, y se cancelarán las ocurrencias futuras pendientes.',
      confirmLabel: 'Desactivar',
      accion: () => desactivarDepartamento(departamento.id),
    })
    if (!confirmado) return
    onAviso('Departamento desactivado.')
    await cargar()
  }

  async function reactivar(departamento) {
    const confirmado = await confirmar({
      title: 'Reactivar departamento',
      message: `¿Reactivar “${departamento.nombre}”?`,
      confirmLabel: 'Reactivar',
      tone: 'primary',
      accion: () => updateDepartamento(departamento.id, { activo: true }),
    })
    if (!confirmado) return
    onAviso('Departamento reactivado.')
    await cargar()
  }

  return (
    <>
      <div className="tuvet-tab-section">
        <FormSection title="Nuevo departamento" description="Por ejemplo: Laboratorio, Compras o Calidad.">
          <form ref={formRef} className="tuvet-inline-form" onSubmit={crear} noValidate>
            {isSystems && (
              <EmpresaSelect empresas={empresas} value={empresaId} error={errores.empresa_id} onChange={(valor) => { setEmpresaId(valor); setErrores((actual) => ({ ...actual, empresa_id: undefined })) }} />
            )}
            <Field label="Nombre" required error={errores.nombre}>
              <input value={nombre} onChange={(event) => { setNombre(event.target.value); setErrores((actual) => ({ ...actual, nombre: undefined })) }} placeholder="Ej. Laboratorio" />
            </Field>
            <button type="submit" className="tuvet-btn" disabled={guardando} aria-busy={guardando}>{guardando ? 'Creando...' : 'Crear departamento'}</button>
          </form>
        </FormSection>
      </div>
      <EstadoCarga loading={loading} error={error} onRetry={cargar} empty={!visibles.length} emptyText={textoVacio(filtro, 'Todavía no hay departamentos. Crea el primero con el formulario de arriba.')}>
        <div className="tuvet-table-wrap">
          <table className="tuvet-table">
            <thead><tr><th scope="col">Departamento</th><th scope="col">Empresa</th><th scope="col">Estado</th><th scope="col"><span className="tuvet-visually-hidden">Acciones</span></th></tr></thead>
            <tbody>
              {visibles.map((departamento) => (
                <tr key={departamento.id} className={departamento.activo ? '' : 'tuvet-row-inactiva'}>
                  <td>{departamento.nombre}</td>
                  <td>{departamento.empresa?.nombre}</td>
                  <td>
                    <span className={`tuvet-badge ${departamento.activo ? 'tuvet-badge-aprobada' : 'tuvet-badge-cancelada'}`}>
                      <Icono nombre={departamento.activo ? 'check' : 'cerrar'} className="tuvet-badge-icon" />
                      {departamento.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="tuvet-cell-acciones">
                    <button type="button" className="tuvet-btn tuvet-btn-secondary" onClick={() => setRenombrando(departamento)}>Renombrar</button>
                    {departamento.activo
                      ? <button type="button" className="tuvet-btn tuvet-btn-danger" onClick={() => desactivar(departamento)}>Desactivar</button>
                      : <button type="button" className="tuvet-btn" onClick={() => reactivar(departamento)}>Reactivar</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </EstadoCarga>
      {renombrando && (
        <RenombrarDepartamentoModal
          departamento={renombrando}
          onClose={() => setRenombrando(null)}
          onGuardado={() => { setRenombrando(null); onAviso('Departamento actualizado.'); void cargar() }}
        />
      )}
      {dialogo}
    </>
  )
}

function EncargadosTab({ lista, filtro, capacidades, empresas, onAviso, onPassword }) {
  const { canManageStructure, isOperationsManager, isSystemsAccount } = capacidades
  const { items, loading, error, cargar } = lista
  const visibles = filtrar(items, filtro, CAMPOS_BUSQUEDA.persona)
  const puedeCambiarDepartamento = canManageStructure || isOperationsManager
  const [departamentos, setDepartamentos] = useState([])
  const [creando, setCreando] = useState(false)
  const [cambiando, setCambiando] = useState(null)
  const [confirmar, dialogo] = useConfirmacion()
  const reset = crearResetPassword(confirmar, resetPasswordEncargado, onPassword)

  useEffect(() => {
    if (!puedeCambiarDepartamento) return
    getDepartamentos().then((data) => setDepartamentos(listItems(data))).catch(() => setDepartamentos([]))
  }, [puedeCambiarDepartamento])

  async function desactivar(encargado) {
    const confirmado = await confirmar({
      title: 'Desactivar encargado',
      message: `¿Desactivar a ${nombrePersona(encargado)}?`,
      detail: 'Se desactivarán sus tareas, plantillas y asignaciones, se cancelarán sus ocurrencias futuras pendientes y se desactivará su cuenta.',
      confirmLabel: 'Desactivar',
      accion: () => desactivarEncargado(encargado.id),
    })
    if (!confirmado) return
    onAviso('Encargado desactivado.')
    await cargar()
  }

  const botonCrear = canManageStructure && (
    <button type="button" className="tuvet-btn" onClick={() => setCreando(true)}>Nuevo encargado</button>
  )

  return (
    <>
      {botonCrear && <div className="tuvet-toolbar">{botonCrear}</div>}
      <EstadoCarga
        loading={loading}
        error={error}
        onRetry={cargar}
        empty={!visibles.length}
        emptyText={textoVacio(filtro, 'No hay encargados visibles.')}
        emptyAction={!filtro.trim() && botonCrear}
      >
        <PersonasTabla
          personas={visibles}
          columnas={[{ titulo: 'Departamento', valor: (persona) => persona.departamento?.nombre ?? '—' }]}
          acciones={(encargado) => (
            <>
              {puedeCambiarDepartamento && <button type="button" className="tuvet-btn tuvet-btn-secondary" onClick={() => setCambiando(encargado)}>Cambiar departamento</button>}
              <button type="button" className="tuvet-btn tuvet-btn-secondary" onClick={() => reset(encargado)}>Restablecer contraseña</button>
              {canManageStructure && <button type="button" className="tuvet-btn tuvet-btn-danger" onClick={() => desactivar(encargado)}>Desactivar</button>}
            </>
          )}
        />
      </EstadoCarga>

      {creando && (
        <PersonaModal
          titulo="Nuevo encargado de departamento"
          subtitulo="Creará y asignará tareas a los gerentes de sucursal."
          conDepartamento
          departamentos={departamentos}
          empresas={empresas}
          isSystems={isSystemsAccount}
          onCrear={createEncargado}
          onClose={() => setCreando(false)}
          onCreada={(persona) => { setCreando(false); onAviso('Encargado creado.'); onPassword(persona); void cargar() }}
        />
      )}

      {cambiando && (
        <SelectorModal
          titulo="Cambiar departamento"
          subtitulo={`${nombrePersona(cambiando)}${cambiando.departamento ? ` · actualmente en ${cambiando.departamento.nombre}` : ''}`}
          etiqueta="Nuevo departamento"
          descripcion="Si ya tenía departamento, el cambio entra en vigor al día siguiente."
          opciones={departamentos.filter((item) => item.activo).map((item) => ({ id: item.id, label: item.nombre }))}
          onClose={() => setCambiando(null)}
          onConfirmar={async (departamentoId) => {
            const resultado = await cambiarDepartamentoEncargado(cambiando.id, departamentoId)
            setCambiando(null)
            onAviso(resultado.changed
              ? `Departamento cambiado a ${resultado.departamento?.nombre}. Vigente desde ${formatFecha(resultado.vigencia?.inicio)}.`
              : 'El encargado ya tenía ese departamento.')
            await cargar()
          }}
        />
      )}
      {dialogo}
    </>
  )
}

function GerentesOperacionesTab({ lista, filtro, capacidades, empresas, onAviso, onPassword }) {
  const { canManageStructure, isSystemsAccount } = capacidades
  const { items, loading, error, cargar } = lista
  const visibles = filtrar(items, filtro, CAMPOS_BUSQUEDA.persona)
  const [creando, setCreando] = useState(false)
  const [confirmar, dialogo] = useConfirmacion()
  const reset = crearResetPassword(confirmar, resetPasswordGerenteOperaciones, onPassword)

  const botonCrear = canManageStructure && (
    <button type="button" className="tuvet-btn" onClick={() => setCreando(true)}>Nuevo gerente de operaciones</button>
  )

  return (
    <>
      {botonCrear && <div className="tuvet-toolbar">{botonCrear}</div>}
      <EstadoCarga
        loading={loading}
        error={error}
        onRetry={cargar}
        empty={!visibles.length}
        emptyText={textoVacio(filtro, 'No hay gerentes de operaciones visibles.')}
        emptyAction={!filtro.trim() && botonCrear}
      >
        <PersonasTabla
          personas={visibles}
          acciones={(persona) => <button type="button" className="tuvet-btn tuvet-btn-secondary" onClick={() => reset(persona)}>Restablecer contraseña</button>}
        />
      </EstadoCarga>
      {creando && (
        <PersonaModal
          titulo="Nuevo gerente de operaciones"
          subtitulo="Supervisará a uno o varios encargados."
          empresas={empresas}
          isSystems={isSystemsAccount}
          onCrear={createGerenteOperaciones}
          onClose={() => setCreando(false)}
          onCreada={(persona) => { setCreando(false); onAviso('Gerente de operaciones creado.'); onPassword(persona); void cargar() }}
        />
      )}
      {dialogo}
    </>
  )
}

function GerentesSucursalTab({ lista, filtro, capacidades, empresas, onAviso, onPassword }) {
  const { canManageStructure, isOperationsManager, isSystemsAccount } = capacidades
  const { items, loading, error, cargar } = lista
  const visibles = filtrar(items, filtro, CAMPOS_BUSQUEDA.persona)
  const puedeGestionarEncargados = canManageStructure || isOperationsManager
  const [encargados, setEncargados] = useState([])
  const [creando, setCreando] = useState(false)
  const [viendoEncargados, setViendoEncargados] = useState(null)
  const [confirmar, dialogo] = useConfirmacion()
  const reset = crearResetPassword(confirmar, resetPasswordGerenteSucursal, onPassword)

  useEffect(() => {
    if (!puedeGestionarEncargados) return
    getEncargados().then((data) => setEncargados(listItems(data))).catch(() => setEncargados([]))
  }, [puedeGestionarEncargados])

  const botonCrear = canManageStructure && (
    <button type="button" className="tuvet-btn" onClick={() => setCreando(true)}>Nuevo gerente de sucursal</button>
  )

  return (
    <>
      {botonCrear && <div className="tuvet-toolbar">{botonCrear}</div>}
      <EstadoCarga
        loading={loading}
        error={error}
        onRetry={cargar}
        empty={!visibles.length}
        emptyText={textoVacio(filtro, 'No hay gerentes de sucursal visibles.')}
        emptyAction={!filtro.trim() && botonCrear}
      >
        <PersonasTabla
          personas={visibles}
          acciones={(persona) => (
            <>
              {puedeGestionarEncargados && <button type="button" className="tuvet-btn tuvet-btn-secondary" onClick={() => setViendoEncargados(persona)}>Encargados</button>}
              <button type="button" className="tuvet-btn tuvet-btn-secondary" onClick={() => reset(persona)}>Restablecer contraseña</button>
            </>
          )}
        />
      </EstadoCarga>
      {creando && (
        <PersonaModal
          titulo="Nuevo gerente de sucursal"
          subtitulo="Recibirá y ejecutará las tareas de los encargados."
          conEncargados
          encargados={encargados}
          empresas={empresas}
          isSystems={isSystemsAccount}
          onCrear={createGerenteSucursal}
          onClose={() => setCreando(false)}
          onCreada={(persona) => {
            const vinculados = persona.asignaciones_encargados?.length ?? 0
            setCreando(false)
            onAviso(vinculados ? `Gerente de sucursal creado con ${vinculados} encargado(s).` : 'Gerente de sucursal creado.')
            onPassword(persona)
            void cargar()
          }}
        />
      )}
      {viendoEncargados && (
        <EncargadosGerenteSucursalModal
          gerente={viendoEncargados}
          encargados={encargados}
          puedeEditar={puedeGestionarEncargados}
          onClose={() => setViendoEncargados(null)}
        />
      )}
      {dialogo}
    </>
  )
}

function RelacionesTab({ lista, filtro, capacidades, onAviso }) {
  const { canManageStructure } = capacidades
  const { items, loading, error, cargar } = lista
  const visibles = filtrar(items, filtro, CAMPOS_BUSQUEDA.relacion)
  const [gerentes, setGerentes] = useState([])
  const [encargados, setEncargados] = useState([])
  const [goId, setGoId] = useState('')
  const [encargadoId, setEncargadoId] = useState('')
  const [errores, setErrores] = useState({})
  const [guardando, setGuardando] = useState(false)
  const [confirmar, dialogo] = useConfirmacion()
  const formRef = useRef(null)

  useEffect(() => {
    if (!canManageStructure) return
    getGerentesOperaciones().then((data) => setGerentes(listItems(data))).catch(() => setGerentes([]))
    getEncargados().then((data) => setEncargados(listItems(data))).catch(() => setEncargados([]))
  }, [canManageStructure])

  async function vincular(event) {
    event.preventDefault()
    const encontrados = {}
    if (!goId) encontrados.go = 'Elige el gerente de operaciones que supervisará.'
    if (!encargadoId) encontrados.encargado = 'Elige el encargado supervisado.'
    setErrores(encontrados)
    if (Object.keys(encontrados).length) {
      enfocarPrimerError(formRef.current)
      return
    }
    setGuardando(true)
    try {
      await vincularGoEncargado(Number(goId), Number(encargadoId))
      onAviso('Relación registrada.')
      setEncargadoId('')
      await cargar()
    } catch (err) {
      setErrores({ encargado: err.message })
      enfocarPrimerError(formRef.current)
    } finally {
      setGuardando(false)
    }
  }

  async function desvincular(relacion) {
    const confirmado = await confirmar({
      title: 'Desvincular',
      message: `¿Desvincular a ${nombrePersona(relacion.encargado)} de ${nombrePersona(relacion.gerente_operaciones)}?`,
      detail: 'El gerente de operaciones dejará de supervisar a este encargado.',
      confirmLabel: 'Desvincular',
      accion: () => desvincularGoEncargado(relacion.gerente_operaciones.id, relacion.encargado.id),
    })
    if (!confirmado) return
    onAviso('Relación cerrada.')
    await cargar()
  }

  return (
    <>
      {canManageStructure && (
        <div className="tuvet-tab-section">
          <FormSection
            title="Vincular gerente de operaciones y encargado"
            description="Un gerente de operaciones puede supervisar a varios encargados y un encargado puede tener varios gerentes de operaciones."
          >
            <form ref={formRef} className="tuvet-inline-form" onSubmit={vincular} noValidate>
              <Field label="Gerente de operaciones" required error={errores.go}>
                <select value={goId} onChange={(event) => { setGoId(event.target.value); setErrores((actual) => ({ ...actual, go: undefined })) }}>
                  <option value="">Seleccionar</option>
                  {gerentes.map((item) => <option key={item.id} value={item.id}>{nombrePersona(item)}</option>)}
                </select>
              </Field>
              <Field label="Encargado" required error={errores.encargado}>
                <select value={encargadoId} onChange={(event) => { setEncargadoId(event.target.value); setErrores((actual) => ({ ...actual, encargado: undefined })) }}>
                  <option value="">Seleccionar</option>
                  {encargados.map((item) => <option key={item.id} value={item.id}>{nombrePersona(item)}{item.departamento ? ` · ${item.departamento.nombre}` : ''}</option>)}
                </select>
              </Field>
              <button type="submit" className="tuvet-btn" disabled={guardando} aria-busy={guardando}>{guardando ? 'Vinculando...' : 'Vincular'}</button>
            </form>
          </FormSection>
        </div>
      )}
      <EstadoCarga loading={loading} error={error} onRetry={cargar} empty={!visibles.length} emptyText={textoVacio(filtro, 'No hay relaciones vigentes.')}>
        <div className="tuvet-table-wrap">
          <table className="tuvet-table">
            <thead><tr><th scope="col">Gerente de operaciones</th><th scope="col">Encargado</th><th scope="col">Vigencia</th><th scope="col"><span className="tuvet-visually-hidden">Acciones</span></th></tr></thead>
            <tbody>
              {visibles.map((relacion) => (
                <tr key={relacion.id}>
                  <td>{nombrePersona(relacion.gerente_operaciones)}</td>
                  <td>{nombrePersona(relacion.encargado)}</td>
                  <td>{formatVigencia(relacion.vigencia)}</td>
                  <td className="tuvet-cell-acciones">
                    <button type="button" className="tuvet-btn tuvet-btn-danger" onClick={() => desvincular(relacion)}>Desvincular</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </EstadoCarga>
      {dialogo}
    </>
  )
}

export default function TuvetEquipoPage() {
  const { perfil } = useAuth()
  const capacidades = getTuvetCapabilities(perfil)
  const { canManageStructure, isCountryManager, isOperationsManager, isDepartmentManager, isSystemsAccount } = capacidades
  const empresas = useEmpresasTuvet(isSystemsAccount)

  const visible = {
    departamentos: canManageStructure,
    encargados: canManageStructure || isCountryManager || isOperationsManager,
    go: canManageStructure || isCountryManager,
    gs: canManageStructure || isCountryManager || isOperationsManager || isDepartmentManager,
    relaciones: canManageStructure || isOperationsManager,
  }

  // Las listas se cargan en la página para que el buscador cuente coincidencias en todas las pestañas.
  const listas = {
    departamentos: useLista(getDepartamentos, visible.departamentos),
    encargados: useLista(getEncargados, visible.encargados),
    go: useLista(getGerentesOperaciones, visible.go),
    gs: useLista(getGerentesSucursal, visible.gs),
    relaciones: useLista(getGoEncargados, visible.relaciones),
  }

  const pestanas = [
    { key: 'departamentos', label: 'Departamentos', campos: CAMPOS_BUSQUEDA.departamento },
    { key: 'encargados', label: 'Encargados', campos: CAMPOS_BUSQUEDA.persona },
    { key: 'go', label: 'Gerentes de operaciones', campos: CAMPOS_BUSQUEDA.persona },
    { key: 'gs', label: isDepartmentManager ? 'Mis gerentes de sucursal' : 'Gerentes de sucursal', campos: CAMPOS_BUSQUEDA.persona },
    { key: 'relaciones', label: 'GO ↔ encargados', campos: CAMPOS_BUSQUEDA.relacion },
  ].filter((pestana) => visible[pestana.key])

  const [activa, setActiva] = useState(() => pestanas[0]?.key)
  const [busqueda, setBusqueda] = useState('')
  const [aviso, setAviso] = useState('')
  const [password, setPassword] = useState(null)

  const buscando = busqueda.trim().length > 0
  const conteos = Object.fromEntries(pestanas.map((pestana) => {
    const lista = listas[pestana.key]
    return [pestana.key, lista.loading ? null : filtrar(lista.items, busqueda, pestana.campos).length]
  }))
  const otrasConResultados = buscando && conteos[activa] === 0
    ? pestanas.filter((pestana) => pestana.key !== activa && conteos[pestana.key] > 0)
    : []

  function cambiarPestana(key) {
    setActiva(key)
    setAviso('')
    // Refresca la pestaña: una acción en otra (p. ej. desactivar un encargado) puede haberla cambiado.
    if (key !== activa) void listas[key].cargar()
  }

  // Flechas izquierda/derecha para moverse entre pestañas (patrón ARIA tabs).
  function onTabKeyDown(event, indice) {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return
    event.preventDefault()
    const siguiente = (indice + (event.key === 'ArrowRight' ? 1 : -1) + pestanas.length) % pestanas.length
    cambiarPestana(pestanas[siguiente].key)
    document.getElementById(`tuvet-tab-${pestanas[siguiente].key}`)?.focus()
  }

  const props = {
    filtro: busqueda,
    capacidades,
    empresas,
    isSystems: isSystemsAccount,
    onAviso: setAviso,
    onPassword: setPassword,
  }

  return (
    <div className="tuvet-page">
      <PageHeader
        title={canManageStructure ? 'Estructura' : 'Equipo'}
        description={canManageStructure ? 'Departamentos, personas y jerarquía del Calendario Tuvet.' : 'Personas dentro de tu ámbito.'}
      />

      <div className="tuvet-search-bar" role="search">
        <svg className="tuvet-search-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="search"
          value={busqueda}
          onChange={(event) => setBusqueda(event.target.value)}
          placeholder="Buscar persona, correo o departamento en todos los roles"
          aria-label="Buscar en la estructura"
        />
        {buscando && <button type="button" className="tuvet-btn tuvet-btn-ghost" onClick={() => setBusqueda('')}>Limpiar</button>}
      </div>

      <div className="tuvet-tabs" role="tablist" aria-label="Secciones de la estructura">
        {pestanas.map((pestana, indice) => (
          <button
            key={pestana.key}
            id={`tuvet-tab-${pestana.key}`}
            type="button"
            role="tab"
            aria-selected={activa === pestana.key}
            aria-controls="tuvet-tabpanel"
            tabIndex={activa === pestana.key ? 0 : -1}
            className={`tuvet-tab ${activa === pestana.key ? 'active' : ''}`}
            onClick={() => cambiarPestana(pestana.key)}
            onKeyDown={(event) => onTabKeyDown(event, indice)}
          >
            {pestana.label}
            {conteos[pestana.key] !== null && (
              <span className={`tuvet-tab-count ${buscando && conteos[pestana.key] > 0 ? 'is-match' : ''}`}>{conteos[pestana.key]}</span>
            )}
          </button>
        ))}
      </div>

      <Aviso tipo="success">{aviso}</Aviso>

      {otrasConResultados.length > 0 && (
        <div className="tuvet-aviso tuvet-aviso-info tuvet-search-hint" role="status">
          <span>No hay coincidencias aquí, pero sí en:</span>
          {otrasConResultados.map((pestana) => (
            <button key={pestana.key} type="button" className="tuvet-chip active" onClick={() => cambiarPestana(pestana.key)}>
              {pestana.label} ({conteos[pestana.key]})
            </button>
          ))}
        </div>
      )}

      <section id="tuvet-tabpanel" className="tuvet-card" role="tabpanel" aria-labelledby={`tuvet-tab-${activa}`}>
        {activa === 'departamentos' && <DepartamentosTab {...props} lista={listas.departamentos} />}
        {activa === 'encargados' && <EncargadosTab {...props} lista={listas.encargados} />}
        {activa === 'go' && <GerentesOperacionesTab {...props} lista={listas.go} />}
        {activa === 'gs' && <GerentesSucursalTab {...props} lista={listas.gs} />}
        {activa === 'relaciones' && <RelacionesTab {...props} lista={listas.relaciones} />}
      </section>

      <PasswordTemporalModal key={password?.id ?? 'sin-password'} persona={password} onClose={() => setPassword(null)} />
    </div>
  )
}
