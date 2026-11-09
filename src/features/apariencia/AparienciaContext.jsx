import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../auth/context/AuthContext'
import { aplicarApariencia, moduloDe } from './aplicarApariencia'
import { getAparienciaActual } from './services/aparienciaService'

/*
 * Apariencia por calendario: cada calendario (tareas = Analiza, tuvet = Tuvet) tiene la de su empresa y país,
 * y cada una se aplica solo a sus pantallas.
 *  - Un usuario normal pertenece a un calendario: recibe la de su empresa y país.
 *  - Una cuenta de sistemas elige qué empresa y país ver en CADA calendario; la elección se recuerda
 *    en su navegador por calendario ({ tareas: {...}, tuvet: {...} }).
 */
const CLAVE_VISTA_SISTEMAS = 'apariencia-vista-sistemas'
const MODULOS = ['tareas', 'tuvet']

const VACIO = { configurada: false, empresa: null, pais: null, apariencia: null }
const SIN_DATOS = { tareas: VACIO, tuvet: VACIO }

const AparienciaContext = createContext(null)

const POR_DEFECTO = {
  ...VACIO,
  logo: null,
  vistaSistemas: null,
  recargar: () => {},
  setVistaPrevia: () => {},
  verComoSistemas: () => {},
}

function leerVistasSistemas() {
  try {
    const guardado = JSON.parse(localStorage.getItem(CLAVE_VISTA_SISTEMAS) ?? 'null')
    if (!guardado || typeof guardado !== 'object') return {}
    return Object.fromEntries(MODULOS
      .filter((modulo) => guardado[modulo]?.company_id && guardado[modulo]?.country_id)
      .map((modulo) => [modulo, guardado[modulo]]))
  } catch {
    return {}
  }
}

function guardarVistasSistemas(vistas) {
  try {
    localStorage.setItem(CLAVE_VISTA_SISTEMAS, JSON.stringify(vistas))
  } catch {
    // Sin almacenamiento local la elección solo dura esta sesión.
  }
}

export function AparienciaProvider({ children }) {
  const { perfil } = useAuth() ?? {}
  const [porModulo, setPorModulo] = useState(SIN_DATOS)
  const [vistasSistemas, setVistasSistemas] = useState(leerVistasSistemas)
  // Valores en edición mostrados en las pantallas de un calendario antes de guardar: { modulo, valores }.
  const [vistaPrevia, setVistaPreviaEstado] = useState(null)

  const recargar = useCallback(async () => {
    if (!perfil) {
      setPorModulo(SIN_DATOS)
      return
    }
    if (perfil.es_cuenta_sistemas) {
      const resultados = await Promise.all(MODULOS.map(async (modulo) => {
        const vista = vistasSistemas[modulo]
        if (!vista) return [modulo, VACIO]
        try {
          return [modulo, await getAparienciaActual(vista)]
        } catch {
          return [modulo, VACIO]
        }
      }))
      setPorModulo(Object.fromEntries(resultados))
      return
    }
    try {
      const data = await getAparienciaActual()
      const modulo = moduloDe(data.empresa?.modulo_calendario ?? perfil.modulo_calendario)
      setPorModulo({ ...SIN_DATOS, [modulo]: data })
    } catch {
      setPorModulo(SIN_DATOS)
    }
  }, [perfil, vistasSistemas])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void recargar()
  }, [recargar])

  const efectivas = useMemo(() => Object.fromEntries(MODULOS.map((modulo) => [
    modulo,
    vistaPrevia?.modulo === modulo ? vistaPrevia.valores : porModulo[modulo].apariencia,
  ])), [porModulo, vistaPrevia])

  useEffect(() => {
    MODULOS.forEach((modulo) => aplicarApariencia(efectivas[modulo], modulo))
  }, [efectivas])

  const setVistaPrevia = useCallback((modulo, valores) => {
    setVistaPreviaEstado(valores ? { modulo: moduloDe(modulo), valores } : null)
  }, [])

  // Sistemas: qué empresa y país ver en un calendario (null para volver a los colores del sistema).
  const verComoSistemas = useCallback((modulo, companyId, countryId) => {
    const clave = moduloDe(modulo)
    setVistasSistemas((actuales) => {
      const siguientes = { ...actuales }
      if (companyId && countryId) siguientes[clave] = { company_id: companyId, country_id: countryId }
      else delete siguientes[clave]
      guardarVistasSistemas(siguientes)
      return siguientes
    })
  }, [])

  const valor = useMemo(() => ({ porModulo, efectivas, vistasSistemas, recargar, setVistaPrevia, verComoSistemas }),
    [porModulo, efectivas, vistasSistemas, recargar, setVistaPrevia, verComoSistemas])

  return <AparienciaContext.Provider value={valor}>{children}</AparienciaContext.Provider>
}

// Apariencia de un calendario: 'tareas' (Analiza) o 'tuvet'.
// eslint-disable-next-line react-refresh/only-export-components
export function useApariencia(modulo = 'tareas') {
  const contexto = useContext(AparienciaContext)
  const clave = moduloDe(modulo)
  // Funciones estables (dependen solo de las del proveedor, que no cambian): la página las usa en
  // dependencias de efectos y, si cambiaran con cada render, la vista previa entraría en bucle.
  const fijarVistaPrevia = contexto?.setVistaPrevia
  const fijarVistaSistemas = contexto?.verComoSistemas
  const setVistaPrevia = useCallback((valores) => fijarVistaPrevia?.(clave, valores), [fijarVistaPrevia, clave])
  const verComoSistemas = useCallback(
    (companyId, countryId) => fijarVistaSistemas?.(clave, companyId, countryId),
    [fijarVistaSistemas, clave],
  )
  return useMemo(() => {
    if (!contexto) return POR_DEFECTO
    const efectiva = contexto.efectivas[clave]
    return {
      ...contexto.porModulo[clave],
      apariencia: efectiva,
      logo: efectiva?.logo_base64 ?? null,
      vistaSistemas: contexto.vistasSistemas[clave] ?? null,
      recargar: contexto.recargar,
      setVistaPrevia,
      verComoSistemas,
    }
  }, [contexto, clave, setVistaPrevia, verComoSistemas])
}
