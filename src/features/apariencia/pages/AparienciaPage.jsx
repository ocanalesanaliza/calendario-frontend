import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Aviso, EstadoCarga, Field, Icono, PageHeader } from '../../tuvet/components/TuvetUi'
import { useConfirmacion } from '../../tuvet/components/useConfirmacion'
import { useAuth } from '../../auth/context/AuthContext'
import { useApariencia } from '../AparienciaContext'
import { moduloDe, pilaFuente, urlFuente } from '../aplicarApariencia'
import {
  getApariencia,
  getDestinosApariencia,
  getRecomendaciones,
  guardarApariencia,
  restablecerApariencia,
} from '../services/aparienciaService'
import { contraste, esHexValido, mezclar, MIN_CONTRASTE, revisarContrastes, rgba } from '../utils/color'
import {
  ajustarLogo,
  analizarLogo,
  evaluarLogo,
  LOGO_ARCHIVO_MAX_BYTES,
  pesoDeDataUrl,
  pesoLegible,
  RECOMENDACIONES_LOGO,
} from '../utils/logo'
import '../../tuvet/tuvet.css'
import './AparienciaPage.css'

const TIPOS_LOGO = ['image/png', 'image/jpeg', 'image/webp']

function leerArchivo(file) {
  return new Promise((resolve, reject) => {
    const lector = new FileReader()
    lector.onload = () => resolve(lector.result)
    lector.onerror = () => reject(new Error('No se pudo leer el archivo.'))
    lector.readAsDataURL(file)
  })
}

function formatoFecha(iso) {
  if (!iso) return ''
  return new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
}

// Carga en el navegador la fuente elegida para la muestra (solo familias permitidas).
function useFuenteDeMuestra(fuente) {
  useEffect(() => {
    const href = urlFuente(fuente)
    if (!href || document.querySelector(`link[data-muestra-fuente="${fuente}"]`)) return
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = href
    link.dataset.muestraFuente = fuente
    document.head.appendChild(link)
  }, [fuente])
}

export default function AparienciaPage({ tema = 'analiza' }) {
  const { perfil } = useAuth()
  // Cada calendario edita y ve solo las empresas de su módulo (tareas = Analiza, tuvet = Tuvet).
  const modulo = tema === 'tuvet' ? 'tuvet' : 'tareas'
  const nombreCalendario = modulo === 'tuvet' ? 'Tuvet' : 'Analiza'
  const contexto = useApariencia(modulo)
  const { setVistaPrevia, recargar, verComoSistemas } = contexto
  const [confirmar, dialogo] = useConfirmacion()
  const [destinos, setDestinos] = useState(null)
  const [catalogo, setCatalogo] = useState(null)
  const [errorDestinos, setErrorDestinos] = useState('')
  const [seleccion, setSeleccion] = useState({ empresa: '', pais: '' })
  const [detalle, setDetalle] = useState(null)
  const [valores, setValores] = useState(null)
  const [cargandoDetalle, setCargandoDetalle] = useState(false)
  const [errorDetalle, setErrorDetalle] = useState('')
  const [errores, setErrores] = useState({})
  const [errorGeneral, setErrorGeneral] = useState('')
  const [aviso, setAviso] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [enVivo, setEnVivo] = useState(false)
  const [colorBase, setColorBase] = useState('#4F46E5')
  const [recomendaciones, setRecomendaciones] = useState(null)
  const [errorRecomendaciones, setErrorRecomendaciones] = useState('')
  const inputLogo = useRef(null)
  // Análisis del logo cargado (píxeles): se asocia al data URL analizado para no mezclar resultados.
  const [analisisLogo, setAnalisisLogo] = useState({ logo: null, info: null, error: '' })
  const [ajustandoLogo, setAjustandoLogo] = useState(false)

  const cargarDestinos = useCallback(async () => {
    setErrorDestinos('')
    try {
      const data = await getDestinosApariencia()
      const propios = (data.results ?? []).filter((item) => moduloDe(item.empresa.modulo_calendario) === modulo)
      setDestinos(propios)
      setCatalogo(data.catalogo ?? null)
      // Preselecciona la empresa y país que se ven ahora en este calendario, o el primero disponible.
      const propio = propios.find((item) => item.empresa.id === contexto.empresa?.id)
      const destino = propio ?? propios[0]
      const pais = destino?.paises.find((item) => item.id === contexto.pais?.id) ?? destino?.paises[0]
      if (destino && pais) setSeleccion({ empresa: String(destino.empresa.id), pais: String(pais.id) })
    } catch (error) {
      setErrorDestinos(error.message)
      setDestinos([])
    }
  }, [contexto.empresa?.id, contexto.pais?.id, modulo])

  useEffect(() => {
    void cargarDestinos()
    // Solo al entrar: la selección no debe reiniciarse cuando cambia el contexto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const cargarDetalle = useCallback(async () => {
    if (!seleccion.empresa || !seleccion.pais) return
    setCargandoDetalle(true)
    setErrorDetalle('')
    try {
      const data = await getApariencia(seleccion.empresa, seleccion.pais)
      setDetalle(data)
      setValores(data.apariencia)
      setErrores({})
      setErrorGeneral('')
      setRecomendaciones(null)
      setColorBase(data.apariencia.color_primario)
    } catch (error) {
      setErrorDetalle(error.message)
    } finally {
      setCargandoDetalle(false)
    }
  }, [seleccion.empresa, seleccion.pais])

  useEffect(() => {
    void cargarDetalle()
  }, [cargarDetalle])

  // La vista previa en toda la aplicación se apaga al salir de la página.
  useEffect(() => () => setVistaPrevia(null), [setVistaPrevia])
  useEffect(() => {
    setVistaPrevia(enVivo && valores && Object.values(errores).every((mensaje) => !mensaje) ? valores : null)
  }, [enVivo, valores, errores, setVistaPrevia])

  useFuenteDeMuestra(valores?.fuente)

  const logoActual = valores?.logo_base64 ?? null
  useEffect(() => {
    if (!logoActual) return undefined
    let vigente = true
    analizarLogo(logoActual)
      .then((info) => { if (vigente) setAnalisisLogo({ logo: logoActual, info, error: '' }) })
      .catch((error) => { if (vigente) setAnalisisLogo({ logo: logoActual, info: null, error: error.message }) })
    return () => { vigente = false }
  }, [logoActual])
  const analizandoLogo = Boolean(logoActual) && analisisLogo.logo !== logoActual
  const evaluacionLogo = useMemo(
    () => (logoActual && analisisLogo.logo === logoActual ? evaluarLogo(analisisLogo.info, valores?.color_menu_fondo) : null),
    [logoActual, analisisLogo, valores?.color_menu_fondo],
  )

  const destinoActual = destinos?.find((item) => String(item.empresa.id) === seleccion.empresa)
  const contrastes = useMemo(() => revisarContrastes(valores), [valores])
  const avisosContraste = Object.entries(contrastes).filter(([, info]) => !info.ok)
  const cambios = useMemo(() => {
    if (!detalle || !valores) return 0
    return Object.keys(valores).filter((campo) => (valores[campo] ?? null) !== (detalle.apariencia[campo] ?? null)).length
  }, [detalle, valores])

  function cambiarValor(campo, valor) {
    setAviso('')
    setValores((actual) => ({ ...actual, [campo]: valor }))
    setErrores((actual) => ({ ...actual, [campo]: campo.startsWith('color_') && !esHexValido(valor) ? 'Usa el formato #RRGGBB.' : undefined }))
  }

  // Se aceptan archivos de hasta 8 MB; si superan lo que se guarda (256 KB), se reducen en el navegador.
  async function elegirLogo(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    const maxGuardado = (catalogo?.logo_max_kb ?? 256) * 1024
    const errorLogo = (mensaje) => setErrores((actual) => ({ ...actual, logo_base64: mensaje }))
    if (!TIPOS_LOGO.includes(file.type)) {
      errorLogo('Usa una imagen PNG, JPG o WebP.')
      return
    }
    if (file.size > LOGO_ARCHIVO_MAX_BYTES) {
      errorLogo(`El archivo pesa ${pesoLegible(file.size)}; el máximo para subir es ${pesoLegible(LOGO_ARCHIVO_MAX_BYTES)}.`)
      return
    }
    setAjustandoLogo(true)
    try {
      const original = await leerArchivo(file)
      const reducir = file.size > maxGuardado
      const logo = reducir ? await ajustarLogo(original) : original
      // cambiarValor limpia los avisos: el de la reducción va después.
      cambiarValor('logo_base64', logo)
      setErrores((actual) => ({ ...actual, logo_base64: undefined }))
      if (reducir) {
        setAviso(`El logo pesaba ${pesoLegible(file.size)}; se redujo automáticamente a ${pesoLegible(pesoDeDataUrl(logo))} (recortado y a 132 px de alto) para que la aplicación cargue rápido. Guarda para conservarlo.`)
      }
    } catch (error) {
      errorLogo(error.message)
    } finally {
      setAjustandoLogo(false)
    }
  }

  async function ajustarLogoAutomaticamente() {
    setAjustandoLogo(true)
    try {
      cambiarValor('logo_base64', await ajustarLogo(logoActual))
      setAviso('Logo ajustado: se recortaron los márgenes y se dejó en un tamaño óptimo. Guarda para conservarlo.')
    } catch (error) {
      setErrores((actual) => ({ ...actual, logo_base64: error.message }))
    } finally {
      setAjustandoLogo(false)
    }
  }

  async function pedirRecomendaciones(event) {
    event.preventDefault()
    setErrorRecomendaciones('')
    if (!esHexValido(colorBase)) {
      setErrorRecomendaciones('Escribe un color base con el formato #RRGGBB.')
      return
    }
    try {
      const data = await getRecomendaciones(colorBase.toUpperCase())
      setRecomendaciones(data.results ?? [])
    } catch (error) {
      setErrorRecomendaciones(error.message)
    }
  }

  function aplicarPaleta(paleta) {
    setAviso(`Paleta “${paleta.nombre}” aplicada al formulario. Revisa la vista previa y guarda para conservarla.`)
    setValores((actual) => ({ ...actual, ...paleta.colores }))
    setErrores({})
  }

  async function guardar() {
    setErrorGeneral('')
    setAviso('')
    if (Object.values(errores).some(Boolean)) {
      setErrorGeneral('Corrige los campos marcados antes de guardar.')
      return
    }
    setGuardando(true)
    try {
      const data = await guardarApariencia(seleccion.empresa, seleccion.pais, valores)
      setDetalle(data)
      setValores(data.apariencia)
      setAviso(`Apariencia guardada para ${data.empresa.nombre} · ${data.pais.nombre}.`)
      marcarConfigurado(true)
      await actualizarAplicacion(data)
    } catch (error) {
      const porCampo = Object.fromEntries(
        Object.entries(error.fields ?? {})
          .filter(([campo]) => campo !== 'detail')
          .map(([campo, mensaje]) => [campo, Array.isArray(mensaje) ? mensaje.join(' ') : String(mensaje)]),
      )
      setErrores(porCampo)
      setErrorGeneral(Object.keys(porCampo).length ? 'Revisa los campos marcados.' : error.message)
    } finally {
      setGuardando(false)
    }
  }

  async function restablecer() {
    setAviso('')
    const ok = await confirmar({
      title: 'Volver a los colores del sistema',
      message: `Se borrará la apariencia de ${detalle.empresa.nombre} · ${detalle.pais.nombre}.`,
      detail: 'Los usuarios de esta empresa y país verán de nuevo los colores, la fuente y el icono originales.',
      confirmLabel: 'Restablecer',
      accion: async () => {
        const data = await restablecerApariencia(seleccion.empresa, seleccion.pais)
        setDetalle(data)
        setValores(data.apariencia)
        marcarConfigurado(false)
        await actualizarAplicacion(data)
      },
    })
    if (ok) setAviso('Se restablecieron los colores del sistema.')
  }

  function marcarConfigurado(configurada) {
    setDestinos((actual) => actual?.map((item) => (String(item.empresa.id) !== seleccion.empresa ? item : {
      ...item,
      paises: item.paises.map((pais) => (String(pais.id) === seleccion.pais ? { ...pais, configurada } : pais)),
    })))
  }

  // Si se editó la empresa y país propios (o sistemas está viendo esa combinación), se refresca la aplicación.
  async function actualizarAplicacion(data) {
    if (perfil?.es_cuenta_sistemas) {
      verComoSistemas(data.empresa.id, data.pais.id)
    } else if (data.empresa.id === contexto.empresa?.id && data.pais.id === contexto.pais?.id) {
      await recargar()
    }
  }

  const raiz = `tuvet-page apariencia-page ${tema === 'analiza' ? 'tema-analiza' : ''}`

  return (
    <div className={raiz}>
      <PageHeader
        title="Apariencia"
        description={`Colores, fuente y logo del calendario ${nombreCalendario} en cada país. Si no se configura, se usan los colores del sistema.`}
      />

      <EstadoCarga
        loading={destinos === null}
        error={errorDestinos}
        onRetry={cargarDestinos}
        empty={!destinos?.length}
        emptyText={perfil?.es_cuenta_sistemas
          ? `No hay países registrados en las empresas del calendario ${nombreCalendario}. Crea la región y el país en Organización y vuelve aquí.`
          : `No tienes una empresa y país del calendario ${nombreCalendario} cuya apariencia puedas editar.`}
      >
        <section className="tuvet-card ap-selector" aria-label="Empresa y país">
          <Field label="Empresa">
            <select
              value={seleccion.empresa}
              onChange={(event) => {
                const destino = destinos.find((item) => String(item.empresa.id) === event.target.value)
                setSeleccion({ empresa: event.target.value, pais: String(destino?.paises[0]?.id ?? '') })
              }}
            >
              {destinos?.map((item) => <option key={item.empresa.id} value={item.empresa.id}>{item.empresa.nombre}</option>)}
            </select>
          </Field>
          <Field label="País">
            <select value={seleccion.pais} onChange={(event) => setSeleccion((actual) => ({ ...actual, pais: event.target.value }))}>
              {destinoActual?.paises.map((pais) => (
                <option key={pais.id} value={pais.id}>{pais.nombre}{pais.configurada ? ' · personalizada' : ''}</option>
              ))}
            </select>
          </Field>
          {detalle && (
            <p className="ap-estado">
              {detalle.configurada ? (
                <><span className="tuvet-badge tuvet-badge-aprobada"><Icono nombre="check" className="tuvet-badge-icon" />Personalizada</span>
                  {detalle.actualizado_por && <span className="tuvet-hint">Última edición: {detalle.actualizado_por.nombre} · {formatoFecha(detalle.updated_at)}</span>}</>
              ) : (
                <span className="tuvet-badge tuvet-badge-cancelada">Usa los colores del sistema</span>
              )}
            </p>
          )}
          {/* Sistemas no tiene país propio: elige qué empresa y país ver en este calendario. */}
          {perfil?.es_cuenta_sistemas && detalle && (
            <div className="ap-vista-sistemas">
              <span className="tuvet-hint">
                En {nombreCalendario} estás viendo: <strong>{contexto.empresa && contexto.pais ? `${contexto.empresa.nombre} · ${contexto.pais.nombre}` : 'los colores del sistema'}</strong>
              </span>
              {String(contexto.vistaSistemas?.company_id ?? '') === seleccion.empresa && String(contexto.vistaSistemas?.country_id ?? '') === seleccion.pais ? (
                <button type="button" className="tuvet-btn tuvet-btn-ghost" onClick={() => verComoSistemas(null, null)}>Ver los colores del sistema</button>
              ) : (
                <button type="button" className="tuvet-btn tuvet-btn-secondary" onClick={() => verComoSistemas(Number(seleccion.empresa), Number(seleccion.pais))}>
                  Ver este país en {nombreCalendario}
                </button>
              )}
            </div>
          )}
        </section>

        {cargandoDetalle && !valores ? (
          <p className="tuvet-state" role="status">Cargando apariencia...</p>
        ) : errorDetalle ? (
          <Aviso tipo="error">{errorDetalle}</Aviso>
        ) : valores && (
          <div className="ap-layout">
            <div className="ap-editor">
              <Aviso tipo="success">{aviso}</Aviso>
              <Aviso tipo="error">{errorGeneral}</Aviso>

              <section className="tuvet-card ap-seccion" aria-labelledby="ap-marca">
                <h2 id="ap-marca">Logo y fuente</h2>
                {/* Réplica de la barra superior a tamaño real: 60 px de alto, logo de 44 px como máximo. */}
                <div className="ap-logo-barra" style={{ background: valores.color_menu_fondo }} aria-label="Así se verá en la barra superior">
                  {logoActual
                    ? <img className="ap-logo-real" src={logoActual} alt="Logo actual" />
                    : <span className="ap-logo-nombre" style={{ color: valores.color_menu_activo_texto }}>{tema === 'tuvet' ? 'Taskly · Tuvet' : 'CRONOS'}</span>}
                </div>
                <p className="tuvet-hint ap-logo-pie">
                  Así se verá en la barra superior
                  {evaluacionLogo?.tamano && <> · el dibujo ocupará unos {evaluacionLogo.tamano.ancho} × {evaluacionLogo.tamano.alto} px</>}
                </p>
                <div className="ap-logo-acciones">
                  <input ref={inputLogo} type="file" accept={TIPOS_LOGO.join(',')} className="tuvet-visually-hidden" onChange={elegirLogo} aria-label="Subir logo" tabIndex={-1} />
                  <button type="button" className="tuvet-btn tuvet-btn-secondary" onClick={() => inputLogo.current?.click()} disabled={ajustandoLogo}>
                    <Icono nombre="subir" />{logoActual ? 'Cambiar logo' : 'Subir logo'}
                  </button>
                  {evaluacionLogo?.ajustable && (
                    <button type="button" className="tuvet-btn" onClick={ajustarLogoAutomaticamente} disabled={ajustandoLogo} aria-busy={ajustandoLogo}>
                      {ajustandoLogo ? 'Ajustando...' : 'Ajustar logo automáticamente'}
                    </button>
                  )}
                  {logoActual && <button type="button" className="tuvet-btn tuvet-btn-ghost" onClick={() => cambiarValor('logo_base64', null)}>Quitar logo</button>}
                </div>
                {errores.logo_base64 && <span className="tuvet-field-error" role="alert"><Icono nombre="error" className="tuvet-field-error-icon" />{errores.logo_base64}</span>}

                {ajustandoLogo
                  ? <p className="tuvet-hint" role="status">Preparando el logo...</p>
                  : analizandoLogo && <p className="tuvet-hint" role="status">Revisando el logo...</p>}
                {evaluacionLogo && (
                  <ul className="ap-logo-checks" aria-label="Revisión del logo">
                    {evaluacionLogo.checks.map((check) => (
                      <li key={check.clave} className={check.ok ? 'is-ok' : 'is-aviso'}>
                        <Icono nombre={check.ok ? 'check' : 'alerta'} className="ap-logo-check-icono" />
                        <span>{check.texto}</span>
                      </li>
                    ))}
                  </ul>
                )}

                <details className="ap-logo-guia" open={!logoActual}>
                  <summary>Recomendaciones para que el logo se vea bien</summary>
                  <ul>
                    {RECOMENDACIONES_LOGO.map((texto) => <li key={texto}>{texto}</li>)}
                    <li>Puedes subir PNG, JPG o WebP de hasta {pesoLegible(LOGO_ARCHIVO_MAX_BYTES)}. Si pesa más de {catalogo?.logo_max_kb ?? 256} KB se reduce automáticamente, porque el logo se descarga cada vez que alguien abre la aplicación.</li>
                  </ul>
                </details>
                <Field label="Fuente" error={errores.fuente}>
                  <select value={valores.fuente} onChange={(event) => cambiarValor('fuente', event.target.value)}>
                    {(catalogo?.fuentes ?? [valores.fuente]).map((fuente) => <option key={fuente} value={fuente}>{fuente}</option>)}
                  </select>
                </Field>
                <p className="ap-muestra-fuente" style={{ fontFamily: pilaFuente(valores.fuente) }}>
                  Calendario de tareas · Revisión de guardia 0123456789
                </p>
              </section>

              <section className="tuvet-card ap-seccion" aria-labelledby="ap-recomendar">
                <h2 id="ap-recomendar">Recomendar colores</h2>
                <p className="tuvet-hint">Elige el color de tu marca y te proponemos paletas completas con texto legible (contraste mínimo {MIN_CONTRASTE}:1).</p>
                <form className="ap-recomendar" onSubmit={pedirRecomendaciones}>
                  <input type="color" value={esHexValido(colorBase) ? colorBase : '#000000'} onChange={(event) => setColorBase(event.target.value.toUpperCase())} aria-label="Color base (selector)" />
                  <input className="tuvet-input ap-hex" value={colorBase} onChange={(event) => setColorBase(event.target.value)} aria-label="Color base" maxLength={7} />
                  <button type="submit" className="tuvet-btn">Recomendar paletas</button>
                </form>
                {errorRecomendaciones && <span className="tuvet-field-error" role="alert"><Icono nombre="error" className="tuvet-field-error-icon" />{errorRecomendaciones}</span>}
                {recomendaciones && (
                  <ul className="ap-paletas">
                    {recomendaciones.map((paleta) => {
                      // Aplicada: todos sus colores coinciden con los del formulario.
                      const aplicada = Object.entries(paleta.colores).every(([campo, color]) => valores[campo] === color)
                      return (
                        <li key={paleta.clave} className={`ap-paleta ${aplicada ? 'is-aplicada' : ''}`}>
                          <div className="ap-paleta-muestras" aria-hidden="true">
                            {['color_menu_fondo', 'color_menu_activo', 'color_primario', 'color_acento', 'color_fondo'].map((campo) => (
                              <span key={campo} style={{ background: paleta.colores[campo] }} />
                            ))}
                          </div>
                          <strong>{paleta.nombre}</strong>
                          <span className="tuvet-hint">{paleta.descripcion}</span>
                          {aplicada ? (
                            <span className="tuvet-badge tuvet-badge-aprobada"><Icono nombre="check" className="tuvet-badge-icon" />Aplicada</span>
                          ) : (
                            <button type="button" className="tuvet-btn tuvet-btn-secondary" onClick={() => aplicarPaleta(paleta)} aria-label={`Aplicar paleta ${paleta.nombre}`}>Aplicar</button>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                )}
              </section>

              {(catalogo?.grupos ?? []).map((grupo) => (
                <section key={grupo.clave} className="tuvet-card ap-seccion" aria-labelledby={`ap-grupo-${grupo.clave}`}>
                  <h2 id={`ap-grupo-${grupo.clave}`}>{grupo.nombre}</h2>
                  <div className="ap-colores">
                    {catalogo.colores.filter((color) => color.grupo === grupo.clave).map(({ campo, etiqueta }) => {
                      const info = contrastes[campo]
                      return (
                        <div key={campo} className={`ap-color ${errores[campo] ? 'has-error' : ''}`}>
                          <input
                            type="color"
                            value={esHexValido(valores[campo]) ? valores[campo] : '#000000'}
                            onChange={(event) => cambiarValor(campo, event.target.value.toUpperCase())}
                            aria-label={`${etiqueta} (selector)`}
                          />
                          <label className="ap-color-texto">
                            <span>{etiqueta}</span>
                            <input className="tuvet-input ap-hex" value={valores[campo] ?? ''} onChange={(event) => cambiarValor(campo, event.target.value.toUpperCase())} maxLength={7} aria-invalid={errores[campo] ? true : undefined} />
                          </label>
                          {info && (
                            <span className={`tuvet-badge ${info.ok ? 'tuvet-badge-aprobada' : 'tuvet-badge-vencida'} ap-contraste`} title={`${info.etiqueta}: ${info.razon}:1`}>
                              <Icono nombre={info.ok ? 'check' : 'alerta'} className="tuvet-badge-icon" />{info.razon}:1
                            </span>
                          )}
                          {errores[campo] && <span className="tuvet-field-error ap-color-error" role="alert">{errores[campo]}</span>}
                        </div>
                      )
                    })}
                  </div>
                </section>
              ))}
            </div>

            <aside className="ap-lateral" aria-label="Vista previa">
              <div className="tuvet-card ap-seccion ap-preview-card">
                <h2>Vista previa</h2>
                <VistaPrevia valores={valores} nombreMarca={tema === 'tuvet' ? 'Taskly · Tuvet' : 'CRONOS'} />
                <label className="ap-en-vivo">
                  <input type="checkbox" checked={enVivo} onChange={(event) => setEnVivo(event.target.checked)} />
                  Ver los cambios en toda la aplicación antes de guardar
                </label>
                {avisosContraste.length > 0 && (
                  <div className="tuvet-aviso tuvet-aviso-warning ap-avisos" role="status">
                    <Icono nombre="alerta" className="tuvet-aviso-icon" />
                    <div>
                      <p><strong>Contraste bajo</strong>: puede costar leer estos textos.</p>
                      <ul>{avisosContraste.map(([campo, info]) => <li key={campo}>{info.etiqueta}: {info.razon}:1</li>)}</ul>
                    </div>
                  </div>
                )}
                <div className="ap-acciones">
                  <button type="button" className="tuvet-btn" onClick={guardar} disabled={guardando || cambios === 0} aria-busy={guardando}>
                    {guardando ? 'Guardando...' : cambios ? `Guardar ${cambios} cambio${cambios !== 1 ? 's' : ''}` : 'Sin cambios'}
                  </button>
                  {cambios > 0 && <button type="button" className="tuvet-btn tuvet-btn-secondary" onClick={() => { setValores(detalle.apariencia); setErrores({}); setAviso('') }}>Descartar</button>}
                  {detalle?.configurada && <button type="button" className="tuvet-btn tuvet-btn-danger" onClick={restablecer}>Volver a los colores del sistema</button>}
                </div>
              </div>
            </aside>
          </div>
        )}
      </EstadoCarga>
      {dialogo}
    </div>
  )
}

function VistaPrevia({ valores: v, nombreMarca }) {
  const fuente = pilaFuente(v.fuente)
  const ok = (color) => (esHexValido(color) ? color : undefined)
  return (
    <div className="ap-preview" style={{ fontFamily: fuente, background: ok(v.color_fondo) }} aria-hidden="true">
      <div className="ap-preview-menu" style={{ background: ok(v.color_menu_fondo), color: ok(v.color_menu_texto) }}>
        <div className="ap-preview-marca">
          {/* Igual que la barra superior: con logo solo el logo; sin logo, icono y nombre del calendario. */}
          {v.logo_base64 ? <img src={v.logo_base64} alt="" /> : (
            <>
              <span className="ap-preview-icono" style={{ background: ok(v.color_menu_activo) }} />
              <strong className="ap-preview-nombre">{nombreMarca}</strong>
            </>
          )}
        </div>
        <span className="ap-preview-item">Mis tareas</span>
        {/* Opción activa igual que en el menú real: fondo translúcido del color activo, barra y texto. */}
        <span
          className="ap-preview-item is-activo"
          style={esHexValido(v.color_menu_activo) ? {
            color: ok(v.color_menu_activo_texto),
            background: rgba(v.color_menu_activo, 0.18),
            boxShadow: `inset 3px 0 0 ${v.color_menu_activo}`,
          } : undefined}
        >
          Sucursales
        </span>
        <span className="ap-preview-item">Reportes</span>
      </div>
      <div className="ap-preview-contenido">
        <div className="ap-preview-tarjeta" style={{ background: ok(v.color_superficie), borderColor: ok(v.color_borde) }}>
          <span className="ap-preview-titulo">
            <strong style={{ color: ok(v.color_texto) }}>Sucursal Centro</strong>
            {esHexValido(v.color_acento) && (
              <span className="ap-preview-chip" style={{ background: mezclar(v.color_acento, '#FFFFFF', 0.85), color: mezclar(v.color_acento, '#000000', 0.35) }}>
                Nuevo
              </span>
            )}
          </span>
          <span style={{ color: ok(v.color_texto_secundario) }}>3 tareas pendientes hoy</span>
          <div className="ap-preview-estados">
            <span style={{ color: ok(v.color_exito) }}>● Realizada</span>
            <span style={{ color: ok(v.color_advertencia) }}>● Pendiente</span>
            <span style={{ color: ok(v.color_error) }}>● Vencida</span>
          </div>
          <span className="ap-preview-acento" style={{ color: ok(v.color_primario) }}>Ver detalle →</span>
        </div>
        <div className="ap-preview-botones">
          <span style={{ background: ok(v.color_boton_primario), color: ok(v.color_boton_primario_texto) }}>Guardar</span>
          <span style={{ background: ok(v.color_boton_secundario), color: ok(v.color_boton_secundario_texto), borderColor: ok(v.color_borde) }}>Cancelar</span>
          <span style={{ background: ok(v.color_boton_peligro), color: ok(v.color_boton_peligro_texto) }}>Eliminar</span>
        </div>
        <span className="ap-preview-nota" style={{ color: ok(v.color_texto_secundario) }}>
          Contraste del botón principal: {contraste(v.color_boton_primario_texto, v.color_boton_primario) ?? '—'}:1
        </span>
      </div>
    </div>
  )
}
