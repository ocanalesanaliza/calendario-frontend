import { contraste } from './color'

// Tamaño del logo en la barra superior (debe coincidir con .topbar-logo en Layout.css).
export const LOGO_ALTO = 44
export const LOGO_ANCHO_MAX = 220
// Alto mínimo recomendado (2× para pantallas de alta densidad) y alto al que se ajusta (3×).
export const LOGO_ALTO_MINIMO = LOGO_ALTO * 2
export const LOGO_ALTO_OPTIMO = LOGO_ALTO * 3
// Lo que se guarda (y viaja en cada carga de la aplicación) frente a lo que se acepta al subir:
// un archivo de hasta 8 MB se reduce en el navegador antes de guardarse.
export const LOGO_MAX_BYTES = 256 * 1024
export const LOGO_ARCHIVO_MAX_BYTES = 8 * 1024 * 1024
// Antes de analizar píxeles, las imágenes enormes se escalan a este lado máximo (memoria y rapidez).
const LADO_MAX_ANALISIS = 2000

export const RECOMENDACIONES_LOGO = [
  'Usa PNG o WebP con fondo transparente; un JPG siempre muestra un recuadro de color sobre el menú.',
  'Recórtalo sin márgenes alrededor: el espacio vacío también ocupa el alto y el dibujo se ve más pequeño.',
  'Prefiere una versión horizontal, entre 2:1 y 4:1 (por ejemplo 360 × 120 px). Muy alargado se verá bajo; cuadrado, pequeño.',
  `Que tenga al menos ${LOGO_ALTO_MINIMO} px de alto para que se vea nítido. En la barra se muestra a ${LOGO_ALTO} px de alto y hasta ${LOGO_ANCHO_MAX} px de ancho.`,
  'Debe contrastar con el color del menú: si el menú es oscuro, usa la versión clara del logo (o al revés).',
]

// Tamaño con el que se verá en la barra (misma regla que object-fit: contain).
export function tamanoEnBarra(ancho, alto) {
  if (!ancho || !alto) return null
  const escala = Math.min(LOGO_ALTO / alto, LOGO_ANCHO_MAX / ancho)
  return { ancho: Math.round(ancho * escala), alto: Math.round(alto * escala) }
}

function hex(r, g, b) {
  return `#${[r, g, b].map((valor) => Math.round(valor).toString(16).padStart(2, '0')).join('').toUpperCase()}`
}

/*
 * Analiza los píxeles (ImageData o { width, height, data }):
 *  - si tiene transparencia,
 *  - el recuadro donde está el dibujo (sin márgenes transparentes, o del color de las esquinas),
 *  - el color medio del dibujo (para el contraste con el menú).
 */
export function analizarPixeles({ width, height, data }) {
  const alfa = (x, y) => data[(y * width + x) * 4 + 3]
  let transparente = false
  for (let indice = 3; indice < data.length; indice += 4) {
    if (data[indice] < 250) {
      transparente = true
      break
    }
  }

  const esquinas = [[0, 0], [width - 1, 0], [0, height - 1], [width - 1, height - 1]].map(([x, y]) => {
    const i = (y * width + x) * 4
    return [data[i], data[i + 1], data[i + 2]]
  })
  const [ref] = esquinas
  const fondoUniforme = esquinas.every((color) => color.every((canal, i) => Math.abs(canal - ref[i]) <= 12))

  const esFondo = (x, y) => {
    if (transparente) return alfa(x, y) < 16
    if (!fondoUniforme) return false
    const i = (y * width + x) * 4
    return Math.abs(data[i] - ref[0]) <= 18 && Math.abs(data[i + 1] - ref[1]) <= 18 && Math.abs(data[i + 2] - ref[2]) <= 18
  }

  let minX = width
  let minY = height
  let maxX = -1
  let maxY = -1
  let suma = [0, 0, 0]
  let pixeles = 0
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (esFondo(x, y)) continue
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
      const i = (y * width + x) * 4
      suma = [suma[0] + data[i], suma[1] + data[i + 1], suma[2] + data[i + 2]]
      pixeles += 1
    }
  }

  const recorte = maxX >= 0 ? { x: minX, y: minY, ancho: maxX - minX + 1, alto: maxY - minY + 1 } : null
  return {
    ancho: width,
    alto: height,
    transparente,
    recorte,
    colorPromedio: pixeles ? hex(suma[0] / pixeles, suma[1] / pixeles, suma[2] / pixeles) : null,
  }
}

function formatoRazon(valor) {
  return `${(Math.round(valor * 10) / 10).toString().replace('.', ',')}:1`
}

/*
 * Convierte el análisis en una lista de comprobaciones legibles.
 * `ajustable` indica si "Ajustar logo automáticamente" mejoraría algo (márgenes o tamaño excesivo).
 */
export function evaluarLogo(info, colorMenu) {
  if (!info) return null
  const contenido = info.recorte ?? { ancho: info.ancho, alto: info.alto }
  const tamano = tamanoEnBarra(contenido.ancho, contenido.alto)
  const razon = contenido.ancho / contenido.alto
  const margenes = Boolean(info.recorte) && (info.recorte.ancho < info.ancho * 0.92 || info.recorte.alto < info.alto * 0.92)
  const margenPct = margenes ? Math.round((1 - (info.recorte.alto / info.alto)) * 100) : 0
  const checks = []

  checks.push(margenes
    ? { clave: 'margenes', ok: false, texto: `Tiene márgenes vacíos alrededor${margenPct > 0 ? ` (un ${margenPct} % del alto)` : ''}: el dibujo se ve más pequeño. Usa “Ajustar logo automáticamente” para recortarlos.` }
    : { clave: 'margenes', ok: true, texto: 'Sin márgenes sobrantes alrededor.' })

  if (razon > 5) {
    checks.push({ clave: 'proporcion', ok: false, texto: `Muy alargado (${formatoRazon(razon)}): en la barra se verá de solo ${tamano.alto} px de alto. Una versión más compacta (entre 2:1 y 4:1) se verá mejor.` })
  } else if (razon < 1.5) {
    checks.push({ clave: 'proporcion', ok: false, texto: `Casi cuadrado (${formatoRazon(razon)}): se verá de ${tamano.ancho} × ${tamano.alto} px. Si tienes una versión horizontal (símbolo + nombre), lucirá más.` })
  } else {
    checks.push({ clave: 'proporcion', ok: true, texto: `Proporción horizontal ${formatoRazon(razon)}: aprovecha bien la barra.` })
  }

  checks.push(info.transparente
    ? { clave: 'transparencia', ok: true, texto: 'Fondo transparente: se integra con el color del menú.' }
    : { clave: 'transparencia', ok: false, texto: 'No tiene fondo transparente: sobre el menú se verá un recuadro de color. Usa un PNG o WebP con fondo transparente.' })

  checks.push(contenido.alto < LOGO_ALTO_MINIMO
    ? { clave: 'resolucion', ok: false, texto: `Resolución baja (${contenido.alto} px de alto): puede verse borroso. Usa al menos ${LOGO_ALTO_MINIMO} px de alto.` }
    : { clave: 'resolucion', ok: true, texto: 'Resolución suficiente para verse nítido.' })

  const razonMenu = info.colorPromedio ? contraste(info.colorPromedio, colorMenu) : null
  if (razonMenu !== null) {
    checks.push(razonMenu < 3
      ? { clave: 'contraste', ok: false, texto: `Se confunde con el fondo del menú (contraste ${formatoRazon(razonMenu)}). Usa una versión ${colorMenu && contraste(colorMenu, '#000000') > 10 ? 'oscura' : 'clara'} del logo o cambia el color del menú.` }
      : { clave: 'contraste', ok: true, texto: `Contrasta con el fondo del menú (${formatoRazon(razonMenu)}).` })
  }

  return {
    checks,
    tamano,
    ajustable: margenes || contenido.alto > LOGO_ALTO_OPTIMO * 1.5,
  }
}

// ── Navegador (canvas): no disponibles en las pruebas con jsdom ──

function cargarImagen(dataUrl) {
  return new Promise((resolve, reject) => {
    const imagen = new Image()
    imagen.onload = () => resolve(imagen)
    imagen.onerror = () => reject(new Error('No se pudo leer la imagen.'))
    imagen.src = dataUrl
  })
}

function lienzo(ancho, alto) {
  const canvas = document.createElement('canvas')
  canvas.width = ancho
  canvas.height = alto
  const contexto = canvas.getContext('2d')
  if (!contexto) throw new Error('El navegador no permite analizar imágenes.')
  return { canvas, contexto }
}

export async function analizarLogo(dataUrl) {
  const imagen = await cargarImagen(dataUrl)
  const { contexto } = lienzo(imagen.naturalWidth, imagen.naturalHeight)
  contexto.drawImage(imagen, 0, 0)
  return analizarPixeles(contexto.getImageData(0, 0, imagen.naturalWidth, imagen.naturalHeight))
}

function bytesDe(dataUrl) {
  const base64 = dataUrl.split(',')[1] ?? ''
  return Math.floor((base64.length * 3) / 4)
}

// Recorta los márgenes y reduce a LOGO_ALTO_OPTIMO px de alto como máximo (PNG; WebP si pesa demasiado).
export async function ajustarLogo(dataUrl) {
  const imagen = await cargarImagen(dataUrl)
  // Una foto de 8 MB puede tener decenas de millones de píxeles: primero se reduce a un tamaño manejable.
  const previa = Math.min(1, LADO_MAX_ANALISIS / Math.max(imagen.naturalWidth, imagen.naturalHeight))
  const origen = lienzo(Math.max(1, Math.round(imagen.naturalWidth * previa)), Math.max(1, Math.round(imagen.naturalHeight * previa)))
  origen.contexto.imageSmoothingQuality = 'high'
  origen.contexto.drawImage(imagen, 0, 0, origen.canvas.width, origen.canvas.height)
  const info = analizarPixeles(origen.contexto.getImageData(0, 0, origen.canvas.width, origen.canvas.height))
  const recorte = info.recorte ?? { x: 0, y: 0, ancho: info.ancho, alto: info.alto }
  // Un pequeño respiro para que los bordes del dibujo no queden pegados.
  const aire = Math.round(recorte.alto * 0.04)
  const x = Math.max(0, recorte.x - aire)
  const y = Math.max(0, recorte.y - aire)
  const ancho = Math.min(info.ancho - x, recorte.ancho + aire * 2)
  const alto = Math.min(info.alto - y, recorte.alto + aire * 2)
  const escala = Math.min(1, LOGO_ALTO_OPTIMO / alto)
  const destino = lienzo(Math.round(ancho * escala), Math.round(alto * escala))
  destino.contexto.imageSmoothingQuality = 'high'
  destino.contexto.drawImage(origen.canvas, x, y, ancho, alto, 0, 0, destino.canvas.width, destino.canvas.height)
  let resultado = destino.canvas.toDataURL('image/png')
  if (bytesDe(resultado) > LOGO_MAX_BYTES) resultado = destino.canvas.toDataURL('image/webp', 0.9)
  if (bytesDe(resultado) > LOGO_MAX_BYTES) throw new Error('Incluso ajustado, el logo supera 256 KB. Usa una imagen más simple.')
  return resultado
}

export function pesoLegible(bytes) {
  return bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`
}

export function pesoDeDataUrl(dataUrl) {
  return bytesDe(dataUrl)
}
