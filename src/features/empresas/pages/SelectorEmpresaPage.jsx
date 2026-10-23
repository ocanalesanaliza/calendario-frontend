import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/context/AuthContext'
import { getCompanies } from '../../organizacion/services/organizacionService'
import './SelectorEmpresaPage.css'

// Destino y presentación de cada módulo de calendario.
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

// Tarjeta de respaldo por módulo. Analiza es el calendario legado: sus usuarios no tienen
// empresa registrada (sin OrganizationIdentity cuentan como módulo "tareas"), así que puede
// no existir como fila en organization_company y aun así debe ofrecerse.
const EMPRESAS_POR_DEFECTO = [
  { id: 'tareas', name: 'Analiza', modulo_calendario: 'tareas' },
  { id: 'tuvet', name: 'Tuvet', modulo_calendario: 'tuvet' },
]

const lista = (data) => (Array.isArray(data) ? data : data?.results ?? [])

// Empresas registradas + una tarjeta de respaldo por cada módulo que no tenga ninguna.
function empresasConModulo(registradas) {
  const conModulo = registradas.filter((empresa) => MODULOS[empresa.modulo_calendario])
  const faltantes = EMPRESAS_POR_DEFECTO.filter(
    (respaldo) => !conModulo.some((empresa) => empresa.modulo_calendario === respaldo.modulo_calendario),
  )
  const orden = Object.keys(MODULOS)
  return [...conModulo, ...faltantes].sort(
    (a, b) => orden.indexOf(a.modulo_calendario) - orden.indexOf(b.modulo_calendario),
  )
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
  const { perfil, logout } = useAuth()
  const navigate = useNavigate()
  const [empresas, setEmpresas] = useState(null)
  const [aviso, setAviso] = useState('')

  useEffect(() => {
    let cancelado = false
    getCompanies()
      .then((data) => {
        if (cancelado) return
        setEmpresas(empresasConModulo(lista(data)))
      })
      .catch(() => {
        if (cancelado) return
        setEmpresas(EMPRESAS_POR_DEFECTO)
        setAviso('No se pudo cargar la lista de empresas; se muestran los calendarios disponibles.')
      })
    return () => { cancelado = true }
  }, [])

  function cerrarSesion() {
    logout()
    navigate('/Login')
  }

  const nombre = perfil?.nombre?.split(' ')[0]

  return (
    <div className="selector-empresa">
      <header className="selector-empresa-barra">
        <span className="selector-empresa-marca">Taskly</span>
        <button type="button" className="selector-empresa-salir" onClick={cerrarSesion}>Cerrar sesión</button>
      </header>

      <main className="selector-empresa-contenido" id="contenido-principal">
        <div className="selector-empresa-encabezado">
          <p className="selector-empresa-rol">Cuenta de Sistemas</p>
          <h1>{nombre ? `Hola, ${nombre}.` : 'Hola.'} ¿A qué empresa quieres entrar?</h1>
          <p>Elige el calendario que vas a administrar. Podrás cambiar de empresa en cualquier momento desde el menú de usuario.</p>
        </div>

        {aviso && <p className="selector-empresa-aviso" role="status">{aviso}</p>}

        {empresas === null ? (
          <div className="selector-empresa-tarjetas" role="status" aria-label="Cargando empresas">
            <div className="selector-empresa-esqueleto" />
            <div className="selector-empresa-esqueleto" />
          </div>
        ) : (
          <ul className="selector-empresa-tarjetas">
            {empresas.map((empresa) => {
              const modulo = MODULOS[empresa.modulo_calendario]
              const nombreEmpresa = empresa.name ?? empresa.nombre
              return (
                <li key={empresa.id}>
                  <Link
                    to={modulo.destino}
                    className={`selector-empresa-tarjeta selector-empresa-${empresa.modulo_calendario}`}
                    aria-label={`Entrar a ${nombreEmpresa}: ${modulo.etiqueta}`}
                  >
                    <span className="selector-empresa-icono"><IconoModulo modulo={empresa.modulo_calendario} /></span>
                    <span className="selector-empresa-texto">
                      <span className="selector-empresa-nombre">{nombreEmpresa}</span>
                      <span className="selector-empresa-modulo">{modulo.etiqueta}</span>
                      <span className="selector-empresa-descripcion">{modulo.descripcion}</span>
                    </span>
                    <span className="selector-empresa-entrar" aria-hidden="true">
                      Entrar
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </main>
    </div>
  )
}
