import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/context/AuthContext'
import { getCompanies, getCountries, getRegions } from '../../organizacion/services/organizacionService'
import { clearOrganizationContext, setOrganizationContext } from '../../../services/organizationContext'
import './SelectorEmpresaPage.css'

const MODULOS = {
  tareas: {
    destino: '/calendario',
    etiqueta: 'Calendario de tareas',
    descripcion: 'Sucursales, áreas, plantillas, rendimiento y operación diaria.',
  },
  tuvet: {
    destino: '/tuvet',
    etiqueta: 'Calendario Tuvet',
    descripcion: 'Departamentos, encargados, seguimiento y asignación de tareas.',
  },
}

const lista = (data) => (Array.isArray(data) ? data : data?.results ?? [])

async function empresasConPaises(registradas) {
  return Promise.all(registradas.filter(
    (empresa) => MODULOS[empresa.modulo_calendario],
  ).map(async (empresa) => {
    const regiones = lista(await getRegions(empresa.id))
    const paises = (await Promise.all(
      regiones.map((region) => getCountries(region.id).then(lista)),
    )).flat()
    return { ...empresa, paises }
  }))
}

function IconoModulo({ modulo }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
      {modulo === 'tuvet'
        ? <polyline points="9 15 11 17 15 13" />
        : <><circle cx="8" cy="15" r="1" fill="currentColor" stroke="none" /><circle cx="12" cy="15" r="1" fill="currentColor" stroke="none" /><circle cx="16" cy="15" r="1" fill="currentColor" stroke="none" /></>}
    </svg>
  )
}

export default function SelectorEmpresaPage() {
  const { perfil, logout, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const [empresas, setEmpresas] = useState(null)
  const [moduloSeleccionado, setModuloSeleccionado] = useState('')
  const [empresaSeleccionadaId, setEmpresaSeleccionadaId] = useState('')
  const [aviso, setAviso] = useState('')
  const [entrando, setEntrando] = useState(false)

  useEffect(() => {
    let cancelado = false
    clearOrganizationContext()
    getCompanies()
      .then((data) => empresasConPaises(lista(data)))
      .then((data) => {
        if (!cancelado) setEmpresas(data)
      })
      .catch(() => {
        if (cancelado) return
        setEmpresas([])
        setAviso('No se pudo cargar la jerarquía de empresas y países.')
      })
    return () => { cancelado = true }
  }, [])

  function cerrarSesion() {
    logout()
    navigate('/Login')
  }

  async function entrar(empresa, pais) {
    setEntrando(true)
    setAviso('')
    setOrganizationContext({
      company_id: empresa.id,
      country_id: pais.id,
      company_name: empresa.name ?? empresa.nombre,
      country_name: pais.name ?? pais.nombre,
      modulo_calendario: empresa.modulo_calendario,
    })
    try {
      const perfilActualizado = await refreshProfile()
      if (perfilActualizado?.modulo_calendario !== empresa.modulo_calendario) {
        throw new Error('El backend no confirmó el módulo seleccionado.')
      }
      navigate(MODULOS[empresa.modulo_calendario].destino)
    } catch {
      clearOrganizationContext()
      setAviso('No se pudo activar el módulo, la organización y el país seleccionados. Intenta nuevamente.')
    } finally {
      setEntrando(false)
    }
  }

  const nombre = perfil?.nombre?.split(' ')[0]
  const empresasDelModulo = empresas?.filter(
    (empresa) => empresa.modulo_calendario === moduloSeleccionado,
  ) ?? []
  const empresaSeleccionada = empresasDelModulo.find(
    (empresa) => String(empresa.id) === empresaSeleccionadaId,
  ) ?? null

  function seleccionarModulo(modulo) {
    setModuloSeleccionado(modulo)
    setEmpresaSeleccionadaId('')
  }

  return (
    <div className="selector-empresa">
      <header className="selector-empresa-barra">
        <span className="selector-empresa-marca">Taskly</span>
        <button type="button" className="selector-empresa-salir" onClick={cerrarSesion}>Cerrar sesión</button>
      </header>

      <main className="selector-empresa-contenido" id="contenido-principal">
        <div className="selector-empresa-encabezado">
          <p className="selector-empresa-rol">Cuenta de Sistemas</p>
          <h1>{nombre ? `Hola, ${nombre}.` : 'Hola.'} Elige módulo, organización y país</h1>
          <p>Las tres selecciones definen el módulo que abrirás y limitan todas las consultas y cambios al ámbito elegido.</p>
        </div>

        {aviso && <p className="selector-empresa-aviso" role="status">{aviso}</p>}

        {empresas === null ? (
          <div className="selector-empresa-tarjetas" role="status" aria-label="Cargando empresas">
            <div className="selector-empresa-esqueleto" />
            <div className="selector-empresa-esqueleto" />
          </div>
        ) : empresas.length === 0 ? (
          <div className="selector-empresa-aviso">
            <p>No hay empresas configuradas. Crea primero la jerarquía organizacional.</p>
            <button type="button" className="selector-empresa-configurar" onClick={() => navigate('/organizacion')}>Administrar organización</button>
          </div>
        ) : (
          <div className="selector-contexto">
            <section className="selector-contexto-paso" aria-labelledby="selector-modulo-titulo">
              <div className="selector-contexto-titulo">
                <span>1</span>
                <div><h2 id="selector-modulo-titulo">Módulo</h2><p>Selecciona el calendario que deseas administrar.</p></div>
              </div>
              <div className="selector-modulos">
                {Object.entries(MODULOS).map(([clave, modulo]) => {
                  const cantidad = empresas.filter((empresa) => empresa.modulo_calendario === clave).length
                  return (
                    <button
                      key={clave}
                      type="button"
                      className={`selector-modulo selector-empresa-${clave}${moduloSeleccionado === clave ? ' seleccionado' : ''}`}
                      aria-pressed={moduloSeleccionado === clave}
                      onClick={() => seleccionarModulo(clave)}
                    >
                      <span className="selector-empresa-icono"><IconoModulo modulo={clave} /></span>
                      <span className="selector-empresa-texto">
                        <span className="selector-empresa-modulo">{modulo.etiqueta}</span>
                        <span className="selector-empresa-descripcion">{modulo.descripcion}</span>
                        <span className="selector-modulo-cantidad">{cantidad} {cantidad === 1 ? 'organización' : 'organizaciones'}</span>
                      </span>
                    </button>
                  )
                })}
              </div>
            </section>

            <section className="selector-contexto-paso" aria-labelledby="selector-organizacion-titulo">
              <div className="selector-contexto-titulo">
                <span>2</span>
                <div><h2 id="selector-organizacion-titulo">Organización</h2><p>Solo aparecen organizaciones configuradas para el módulo elegido.</p></div>
              </div>
              {!moduloSeleccionado ? (
                <p className="selector-contexto-pendiente">Selecciona primero un módulo.</p>
              ) : empresasDelModulo.length === 0 ? (
                <div className="selector-contexto-pendiente">
                  <p>No hay organizaciones configuradas para {MODULOS[moduloSeleccionado].etiqueta}.</p>
                  <button type="button" className="selector-empresa-configurar" onClick={() => navigate('/organizacion')}>Administrar organización</button>
                </div>
              ) : (
                <label className="selector-organizacion-campo">
                  Organización
                  <select value={empresaSeleccionadaId} onChange={(event) => setEmpresaSeleccionadaId(event.target.value)}>
                    <option value="">Seleccionar organización</option>
                    {empresasDelModulo.map((empresa) => (
                      <option key={empresa.id} value={empresa.id}>{empresa.name ?? empresa.nombre}</option>
                    ))}
                  </select>
                </label>
              )}
            </section>

            <section className="selector-contexto-paso" aria-labelledby="selector-pais-titulo">
              <div className="selector-contexto-titulo">
                <span>3</span>
                <div><h2 id="selector-pais-titulo">País</h2><p>Entrarás únicamente al territorio seleccionado.</p></div>
              </div>
              {!empresaSeleccionada ? (
                <p className="selector-contexto-pendiente">Selecciona primero una organización.</p>
              ) : empresaSeleccionada.paises.length ? (
                <div className={`selector-paises selector-empresa-${moduloSeleccionado}`}>
                  {empresaSeleccionada.paises.map((pais) => (
                    <button
                      key={pais.id}
                      type="button"
                      className="selector-empresa-entrar"
                      disabled={entrando}
                      onClick={() => entrar(empresaSeleccionada, pais)}
                    >
                      {entrando ? 'Activando contexto...' : `Entrar en ${pais.name ?? pais.nombre}`}
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
                    </button>
                  ))}
                </div>
              ) : <span className="selector-empresa-sin-pais">Configura al menos un país para entrar.</span>}
            </section>
          </div>
        )}
      </main>
    </div>
  )
}
