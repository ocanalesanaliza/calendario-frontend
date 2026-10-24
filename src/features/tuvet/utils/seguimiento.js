import { nombrePersona } from './formato'

// Meta de cumplimiento mensual mostrada en el panel. El backend no define una meta:
// es un valor de presentación acordado (ver design/configuracion_diseño).
export const META_CUMPLIMIENTO = 90
export const UMBRAL_CERCA = 75
export const DIAS_PROXIMOS = 3

export const NIVELES = {
  meta: { clave: 'meta', etiqueta: 'En meta', etiquetaLarga: 'En meta' },
  cerca: { clave: 'cerca', etiqueta: 'Cerca', etiquetaLarga: 'Cerca de la meta' },
  bajo: { clave: 'bajo', etiqueta: 'Bajo', etiquetaLarga: 'Bajo la meta' },
  sin: { clave: 'sin', etiqueta: 'Sin datos', etiquetaLarga: 'Sin tareas este mes' },
}

export const URGENCIAS = {
  vencida: { clave: 'vencida', titulo: 'Vencidas', ayuda: 'Superaron su fecha límite sin marcarse.' },
  hoy: { clave: 'hoy', titulo: 'Vencen hoy', ayuda: 'Su límite es hoy.' },
  pronto: { clave: 'pronto', titulo: `Próximos ${DIAS_PROXIMOS} días`, ayuda: 'Aún en plazo; conviene darles seguimiento.' },
  normal: { clave: 'normal', titulo: 'Más adelante', ayuda: 'Con plazo holgado.' },
  revision: { clave: 'revision', titulo: 'Por revisar', ayuda: 'Marcadas por el gerente; esperan tu visto bueno.' },
}

export function nivelDe(porcentaje) {
  if (porcentaje === null) return NIVELES.sin
  if (porcentaje >= META_CUMPLIMIENTO) return NIVELES.meta
  if (porcentaje >= UMBRAL_CERCA) return NIVELES.cerca
  return NIVELES.bajo
}

function inicioDelDia(fecha) {
  return new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate())
}

function diasEntre(desde, hasta) {
  return Math.round((inicioDelDia(hasta) - inicioDelDia(desde)) / 86400000)
}

function horaDe(iso) {
  const match = /T(\d{2}:\d{2})/.exec(iso ?? '')
  return match ? match[1] : ''
}

export function clasificarUrgencia(ocurrencia, ahora = new Date()) {
  if (ocurrencia.estado === 'en_revision') return 'revision'
  if (ocurrencia.estado !== 'pendiente') return null
  if (ocurrencia.vencida) return 'vencida'
  const limite = new Date(ocurrencia.fecha_limite)
  if (Number.isNaN(limite.getTime())) return 'normal'
  const dias = diasEntre(ahora, limite)
  if (dias <= 0) return 'hoy'
  if (dias <= DIAS_PROXIMOS) return 'pronto'
  return 'normal'
}

// Fechas relativas ("Vence hoy 18:00", "Venció hace 2 días"), como recomienda la guía de UX.
export function etiquetaRelativa(ocurrencia, ahora = new Date()) {
  if (ocurrencia.estado === 'en_revision') {
    if (!ocurrencia.marcada_en) return 'Marcada'
    const horas = Math.max(0, Math.round((ahora - new Date(ocurrencia.marcada_en)) / 3600000))
    if (horas < 1) return 'Marcada hace un momento'
    if (horas < 24) return `Marcada hace ${horas} h`
    const dias = Math.round(horas / 24)
    return `Marcada hace ${dias} ${dias === 1 ? 'día' : 'días'}`
  }
  const limite = new Date(ocurrencia.fecha_limite)
  if (Number.isNaN(limite.getTime())) return ''
  const dias = diasEntre(ahora, limite)
  const hora = horaDe(ocurrencia.fecha_limite)
  if (ocurrencia.vencida || limite < ahora) {
    if (dias === 0) return `Venció hoy ${hora}`
    if (dias === -1) return 'Venció ayer'
    return `Venció hace ${Math.abs(dias)} días`
  }
  if (dias === 0) return `Vence hoy ${hora}`
  if (dias === 1) return `Mañana ${hora}`
  return `En ${dias} días`
}

function porcentaje(aprobadas, total) {
  return total ? Math.round((aprobadas / total) * 10000) / 100 : null
}

function ordenUrgencia(a, b) {
  const peso = { vencida: 0, hoy: 1, pronto: 2, normal: 3 }
  const diferencia = (peso[a.urgencia] ?? 9) - (peso[b.urgencia] ?? 9)
  if (diferencia) return diferencia
  return new Date(a.fecha_limite) - new Date(b.fecha_limite)
}

// Agrupa las ocurrencias del mes por gerente de sucursal y calcula su cumplimiento.
// El porcentaje sigue la regla del backend: aprobadas / total, sin contar canceladas.
export function resumenPorGerente(ocurrencias, ahora = new Date()) {
  const porGerente = new Map()
  for (const ocurrencia of ocurrencias) {
    if (ocurrencia.estado === 'cancelada') continue
    const gerente = ocurrencia.gerente_sucursal ?? {}
    const clave = gerente.id
    if (!porGerente.has(clave)) {
      porGerente.set(clave, {
        gerente,
        nombre: nombrePersona(gerente),
        aprobadas: 0,
        revision: 0,
        pendientes: 0,
        vencidas: 0,
        total: 0,
        porVencer: [],
      })
    }
    const fila = porGerente.get(clave)
    fila.total += 1
    if (ocurrencia.estado === 'aprobada') fila.aprobadas += 1
    else if (ocurrencia.estado === 'en_revision') fila.revision += 1
    else if (ocurrencia.estado === 'pendiente') {
      const urgencia = clasificarUrgencia(ocurrencia, ahora)
      if (urgencia === 'vencida') fila.vencidas += 1
      else fila.pendientes += 1
      fila.porVencer.push({ ...ocurrencia, urgencia, cuando: etiquetaRelativa(ocurrencia, ahora) })
    }
  }

  return [...porGerente.values()]
    .map((fila) => {
      const pct = porcentaje(fila.aprobadas, fila.total)
      const porVencer = fila.porVencer.sort(ordenUrgencia)
      return { ...fila, porcentaje: pct, nivel: nivelDe(pct), porVencer, proxima: porVencer[0] ?? null }
    })
    .sort((a, b) => (a.porcentaje ?? 101) - (b.porcentaje ?? 101) || a.nombre.localeCompare(b.nombre))
}

export function resumenGeneral(filas) {
  const total = filas.reduce((suma, fila) => suma + fila.total, 0)
  const aprobadas = filas.reduce((suma, fila) => suma + fila.aprobadas, 0)
  const pct = porcentaje(aprobadas, total)
  const urgentes = filas.flatMap((fila) => fila.porVencer)
  return {
    total,
    aprobadas,
    porcentaje: pct,
    nivel: nivelDe(pct),
    faltaParaMeta: pct === null ? null : Math.max(0, Math.round((META_CUMPLIMIENTO - pct) * 10) / 10),
    pendientes: filas.reduce((suma, fila) => suma + fila.pendientes, 0),
    vencidas: filas.reduce((suma, fila) => suma + fila.vencidas, 0),
    revision: filas.reduce((suma, fila) => suma + fila.revision, 0),
    vencenPronto: urgentes.filter((item) => item.urgencia === 'hoy' || item.urgencia === 'pronto').length,
    vencenHoy: urgentes.filter((item) => item.urgencia === 'hoy').length,
  }
}

// Columnas del tablero por urgencia. "Más adelante" no se muestra: el tablero es para lo que requiere atención.
export function columnasTablero(ocurrencias, ahora = new Date()) {
  const columnas = { vencida: [], hoy: [], pronto: [], revision: [] }
  for (const ocurrencia of ocurrencias) {
    const urgencia = clasificarUrgencia(ocurrencia, ahora)
    if (!columnas[urgencia]) continue
    columnas[urgencia].push({ ...ocurrencia, urgencia, cuando: etiquetaRelativa(ocurrencia, ahora) })
  }
  for (const clave of ['vencida', 'hoy', 'pronto']) columnas[clave].sort(ordenUrgencia)
  columnas.revision.sort((a, b) => new Date(a.marcada_en ?? 0) - new Date(b.marcada_en ?? 0))
  return ['vencida', 'hoy', 'pronto', 'revision'].map((clave) => ({ ...URGENCIAS[clave], tareas: columnas[clave] }))
}

export const FILTROS_GERENTES = {
  todos: { etiqueta: 'Todos', aplica: () => true },
  bajo: { etiqueta: 'Bajo la meta', aplica: (fila) => fila.porcentaje !== null && fila.porcentaje < META_CUMPLIMIENTO },
  vencidas: { etiqueta: 'Con vencidas', aplica: (fila) => fila.vencidas > 0 },
  revision: { etiqueta: 'Por revisar', aplica: (fila) => fila.revision > 0 },
}
