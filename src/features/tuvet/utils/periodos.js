// Periodos de visualización de "Mis tareas": día (por defecto), semana (lunes a domingo) y mes.
export const PERIODOS = {
  dia: { clave: 'dia', etiqueta: 'Día' },
  semana: { clave: 'semana', etiqueta: 'Semana' },
  mes: { clave: 'mes', etiqueta: 'Mes' },
}

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

const pad = (n) => String(n).padStart(2, '0')

export function aIso(fecha) {
  return `${fecha.getFullYear()}-${pad(fecha.getMonth() + 1)}-${pad(fecha.getDate())}`
}

export function desdeIso(iso) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '')
  return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : null
}

export function hoyIso(ahora = new Date()) {
  return aIso(ahora)
}

function sumarDias(fecha, dias) {
  return new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate() + dias)
}

function inicioSemana(fecha) {
  const desplazamiento = (fecha.getDay() + 6) % 7 // lunes = 0
  return sumarDias(fecha, -desplazamiento)
}

function capitalizar(texto) {
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

// Rango [desde, hasta] (ISO, inclusivo), meses que hay que consultar y título legible.
export function rangoPeriodo(periodo, ancla, ahora = new Date()) {
  let desde
  let hasta
  let titulo
  if (periodo === 'semana') {
    desde = inicioSemana(ancla)
    hasta = sumarDias(desde, 6)
    const mismoMes = desde.getMonth() === hasta.getMonth()
    titulo = mismoMes
      ? `${desde.getDate()} – ${hasta.getDate()} ${MESES_CORTOS[hasta.getMonth()]} ${hasta.getFullYear()}`
      : `${desde.getDate()} ${MESES_CORTOS[desde.getMonth()]} – ${hasta.getDate()} ${MESES_CORTOS[hasta.getMonth()]} ${hasta.getFullYear()}`
  } else if (periodo === 'mes') {
    desde = new Date(ancla.getFullYear(), ancla.getMonth(), 1)
    hasta = new Date(ancla.getFullYear(), ancla.getMonth() + 1, 0)
    titulo = `${capitalizar(MESES[ancla.getMonth()])} ${ancla.getFullYear()}`
  } else {
    desde = new Date(ancla.getFullYear(), ancla.getMonth(), ancla.getDate())
    hasta = desde
    titulo = etiquetaDia(aIso(desde), ahora)
  }

  const meses = []
  for (let cursor = new Date(desde.getFullYear(), desde.getMonth(), 1); cursor <= hasta; cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1)) {
    meses.push({ year: cursor.getFullYear(), month: cursor.getMonth() + 1 })
  }

  const hoy = hoyIso(ahora)
  return { desde: aIso(desde), hasta: aIso(hasta), meses, titulo, incluyeHoy: aIso(desde) <= hoy && hoy <= aIso(hasta) }
}

export function moverPeriodo(periodo, ancla, pasos) {
  if (periodo === 'semana') return sumarDias(ancla, 7 * pasos)
  if (periodo === 'mes') return new Date(ancla.getFullYear(), ancla.getMonth() + pasos, 1)
  return sumarDias(ancla, pasos)
}

// "Hoy · miércoles 22 de octubre", "Mañana · …", "Ayer · …" o "lunes 20 de octubre de 2026".
export function etiquetaDia(iso, ahora = new Date()) {
  const fecha = desdeIso(iso)
  if (!fecha) return ''
  const base = `${DIAS[fecha.getDay()]} ${fecha.getDate()} de ${MESES[fecha.getMonth()]}`
  const hoy = desdeIso(hoyIso(ahora))
  const diferencia = Math.round((fecha - hoy) / 86400000)
  if (diferencia === 0) return `Hoy · ${base}`
  if (diferencia === 1) return `Mañana · ${base}`
  if (diferencia === -1) return `Ayer · ${base}`
  return capitalizar(fecha.getFullYear() === hoy.getFullYear() ? base : `${base} de ${fecha.getFullYear()}`)
}

export function enRango(ocurrencia, rango) {
  const fecha = ocurrencia.fecha_programada
  return Boolean(fecha) && rango.desde <= fecha && fecha <= rango.hasta
}

// El backend solo permite marcar una ocurrencia pendiente cuya fecha programada ya llegó.
export function puedeMarcarse(ocurrencia, ahora = new Date()) {
  return ocurrencia.estado === 'pendiente' && Boolean(ocurrencia.fecha_programada) && ocurrencia.fecha_programada <= hoyIso(ahora)
}

export function agruparPorDia(ocurrencias, ahora = new Date()) {
  const grupos = new Map()
  for (const ocurrencia of ocurrencias) {
    const clave = ocurrencia.fecha_programada
    if (!grupos.has(clave)) grupos.set(clave, [])
    grupos.get(clave).push(ocurrencia)
  }
  return [...grupos.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([fecha, items]) => ({ fecha, titulo: etiquetaDia(fecha, ahora), esHoy: fecha === hoyIso(ahora), items }))
}
