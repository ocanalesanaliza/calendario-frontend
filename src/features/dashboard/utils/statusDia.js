/**
 * Reglas puras de la pantalla "Status del día" (docs/configuracion_diseño/06_status_del_dia.md).
 * Ningún chip, orden ni texto de tarjeta se decide fuera de este módulo.
 */

/** Jornadas sin ventana abierta: el chip es "No aplica" aunque no haya marcas. */
export const ESTADOS_SIN_VENTANA = [
  'antes_apertura',
  'sucursal_cerrada',
  'sin_sucursal',
  'cerrado',
]

/** Únicos estados en los que el número grande es un guion. */
const ESTADOS_SIN_NUMERO = ['antes_apertura', 'sucursal_cerrada', 'sin_sucursal']

/** Los únicos tres chips que existen en esta pantalla. */
export const CHIP = {
  SIN_MARCAS: 'sin_marcas',
  NO_APLICA: 'no_aplica',
  DIA_ESPECIAL: 'dia_especial',
}

/** Grupo de orden por riesgo (06_status_del_dia.md → "Orden de las tarjetas"). */
const GRUPO = {
  [CHIP.SIN_MARCAS]: 1,
  [CHIP.NO_APLICA]: 2,
  normal: 3,
  [CHIP.DIA_ESPECIAL]: 4,
}

const ETIQUETAS_TIPO_DIA = {
  incapacidad: 'Incapacidad',
  vacaciones: 'Permiso extraordinario',
  vacaciones_programadas: 'Vacaciones programadas',
  permiso_aprobado: 'Permiso aprobado',
  otro_aprobado: 'Otro aprobado',
  no_aprobada_ga: 'No aprobada por GA',
}

const TITULO_CHIP = {
  [CHIP.SIN_MARCAS]: 'Sin marcas: la jornada está abierta y hoy no hay ningún registro.',
  [CHIP.DIA_ESPECIAL]: 'Día especial: el día se puntúa por regla, no por trabajo registrado.',
  antes_apertura: 'No aplica: la sucursal todavía no abrió.',
  sucursal_cerrada: 'No aplica: la sucursal está cerrada.',
  cerrado: 'No aplica: la jornada ya cerró.',
  sin_sucursal: 'No aplica: no tiene sucursal asignada.',
  sin_tareas: 'No aplica: no hay tareas programadas.',
  domingo: 'No aplica: la operación dominical no está habilitada.',
}

const ETIQUETA_CHIP = {
  [CHIP.SIN_MARCAS]: 'Sin marcas',
  [CHIP.NO_APLICA]: 'No aplica',
  [CHIP.DIA_ESPECIAL]: 'Día especial',
}

/** `tipo_dia` con valor informativo pero sin situación especial. */
const TIPOS_DIA_NEUTROS = new Set(['normal', 'sin_rendimiento'])

function aEntero(valor) {
  const numero = Number(valor)
  return Number.isFinite(numero) ? Math.max(0, Math.trunc(numero)) : 0
}

/** Acepta "HH:MM" y devuelve null para cualquier otra cosa. */
function normalizarHora(valor) {
  return typeof valor === 'string' && /^\d{1,2}:\d{2}$/.test(valor) ? valor : null
}

function minutosDeHora(hora) {
  const normalizada = normalizarHora(hora)
  if (!normalizada) return null
  const [horas, minutos] = normalizada.split(':')
  return Number(horas) * 60 + Number(minutos)
}

function esDiaEspecial(tipoDia) {
  return Boolean(tipoDia) && !TIPOS_DIA_NEUTROS.has(tipoDia)
}

function etiquetaTipoDia(tipoDia) {
  return ETIQUETAS_TIPO_DIA[tipoDia] ?? tipoDia
}

function porcentajeDe(user) {
  const crudo = Number.parseFloat(user?.resultado_dia?.porcentaje_dia ?? 0)
  if (!Number.isFinite(crudo)) return 0
  return Math.min(100, Math.max(0, Math.round(crudo)))
}

function construirAriaBarra({ motivo, porcentaje, numeroVisible, cumplidas, programadas, horaApertura, tipoDia }) {
  const conteo = `${cumplidas} de ${programadas} tareas registradas`
  if (!numeroVisible) {
    let razon = 'sin sucursal asignada'
    if (motivo === 'antes_apertura') {
      razon = horaApertura ? `la sucursal abre a las ${horaApertura}` : 'la sucursal todavía no abrió'
    } else if (motivo === 'sucursal_cerrada') {
      razon = 'la sucursal está cerrada'
    }
    return `Sin jornada abierta: ${razon}. ${conteo}.`
  }
  if (motivo === CHIP.DIA_ESPECIAL) {
    const detalle = etiquetaTipoDia(tipoDia)
    return `${porcentaje} por ciento por situación especial: ${detalle}. ${conteo}.`
  }
  return `${porcentaje} por ciento ponderado. ${conteo}.`
}

/**
 * Aplica la tabla de la regla del chip en orden, gana la primera.
 * Devuelve todo lo que la tarjeta necesita para dibujarse sin volver a decidir reglas.
 */
export function clasificarEstado(user = {}) {
  const resultado = user.resultado_dia ?? {}
  const tipoDia = resultado.tipo_dia
  const programadas = aEntero(resultado.tareas_programadas)
  const cumplidas = aEntero(resultado.tareas_cumplidas)
  const ultimaMarca = normalizarHora(resultado.ultima_marca)
  const horaApertura = normalizarHora(user.hora_apertura)
  const estadoOperativo = user.estado_operativo ?? null
  const domingoNoHabilitado = user.operacion_habilitada === false
    && user.motivo_no_disponible === 'operacion_dominical_no_habilitada'

  let chip = null
  let motivo = 'normal'

  if (esDiaEspecial(tipoDia)) {
    chip = CHIP.DIA_ESPECIAL
    motivo = CHIP.DIA_ESPECIAL
  } else if (domingoNoHabilitado) {
    chip = CHIP.NO_APLICA
    motivo = 'domingo'
  } else if (programadas === 0) {
    chip = CHIP.NO_APLICA
    motivo = 'sin_tareas'
  } else if (ESTADOS_SIN_VENTANA.includes(estadoOperativo)) {
    chip = CHIP.NO_APLICA
    motivo = estadoOperativo
  } else if (ultimaMarca === null) {
    chip = CHIP.SIN_MARCAS
    motivo = CHIP.SIN_MARCAS
  }

  const numeroVisible = !ESTADOS_SIN_NUMERO.includes(estadoOperativo)
  const porcentaje = porcentajeDe(user)

  return {
    chip,
    motivo,
    grupo: GRUPO[chip ?? 'normal'],
    etiquetaChip: chip ? ETIQUETA_CHIP[chip] : null,
    tonoChip: chip === CHIP.SIN_MARCAS ? 'peligro' : chip ? 'neutro' : null,
    tituloChip: chip ? TITULO_CHIP[motivo] : null,
    numeroVisible,
    porcentaje,
    anchoBarra: numeroVisible ? porcentaje : 0,
    rayada: chip === CHIP.DIA_ESPECIAL,
    ariaBarra: construirAriaBarra({
      motivo,
      porcentaje,
      numeroVisible,
      cumplidas,
      programadas,
      horaApertura,
      tipoDia,
    }),
  }
}

function programadasDe(user) {
  return aEntero(user?.resultado_dia?.tareas_programadas)
}

function nombreDe(user) {
  return user?.nombre_usuario ?? ''
}

function compararNombres(a, b) {
  return nombreDe(a).localeCompare(nombreDe(b), 'es', { sensitivity: 'base' })
}

/** De más a menos urgente; el empate se resuelve por nombre ascendente. */
export function ordenarTarjetas(tarjetas = []) {
  return [...tarjetas].sort((a, b) => {
    const estadoA = clasificarEstado(a)
    const estadoB = clasificarEstado(b)

    if (estadoA.grupo !== estadoB.grupo) return estadoA.grupo - estadoB.grupo

    if (estadoA.grupo === GRUPO[CHIP.SIN_MARCAS]) {
      const diferencia = programadasDe(b) - programadasDe(a)
      if (diferencia !== 0) return diferencia
    }

    if (estadoA.grupo === GRUPO.normal) {
      const marcaA = minutosDeHora(a?.resultado_dia?.ultima_marca)
      const marcaB = minutosDeHora(b?.resultado_dia?.ultima_marca)
      if (marcaA !== marcaB) {
        if (marcaA === null) return 1
        if (marcaB === null) return -1
        return marcaA - marcaB
      }
    }

    return compararNombres(a, b)
  })
}

/** Una sola línea de excepción, con la prioridad de la tabla de la spec. */
export function textoExcepcion(user = {}) {
  const campo = user.trabajo_campo
  if (campo?.estado === 'pendiente') {
    return { texto: 'Trabajo de campo pendiente', tono: 'accent', icono: 'campo' }
  }
  if (campo?.estado === 'aceptado') {
    return { texto: 'Trabajo de campo autorizado', tono: 'muted', icono: 'campo' }
  }
  if (user.estado === 'en_almuerzo') {
    return { texto: 'En almuerzo', tono: 'warning', icono: 'almuerzo' }
  }

  const resultado = user.resultado_dia ?? {}
  if (esDiaEspecial(resultado.tipo_dia)) {
    const texto = resultado.motivo_dia_especial || etiquetaTipoDia(resultado.tipo_dia)
    return { texto, tono: 'muted', icono: 'bandera' }
  }

  return null
}

const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
]

/**
 * "YYYY-MM-DD" de hoy en hora local.
 * Nunca usar toISOString(): en Honduras (UTC-6) después de las 18:00 devuelve el día siguiente.
 */
export function hoyLocal(ahora = new Date()) {
  const anio = ahora.getFullYear()
  const mes = String(ahora.getMonth() + 1).padStart(2, '0')
  const dia = String(ahora.getDate()).padStart(2, '0')
  return `${anio}-${mes}-${dia}`
}

/** Descompone "YYYY-MM-DD" sin pasar por UTC; null si la fecha no existe. */
function partesDeFecha(iso) {
  const coincidencia = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso ?? ''))
  if (!coincidencia) return null

  const anio = Number(coincidencia[1])
  const mes = Number(coincidencia[2])
  const dia = Number(coincidencia[3])
  const fecha = new Date(anio, mes - 1, dia, 12)
  if (fecha.getFullYear() !== anio || fecha.getMonth() !== mes - 1 || fecha.getDate() !== dia) {
    return null
  }

  return { anio, mes, dia }
}

/** "Viernes 13 de noviembre" desde "YYYY-MM-DD". */
export function formatearFecha(iso) {
  const partes = partesDeFecha(iso)
  if (!partes) return ''

  const fecha = new Date(partes.anio, partes.mes - 1, partes.dia, 12)
  const formateado = new Intl.DateTimeFormat('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).formatToParts(fecha)
  const valor = (tipo) => formateado.find((parte) => parte.type === tipo)?.value ?? ''
  const semana = valor('weekday')
  if (!semana) return ''

  return `${semana.charAt(0).toUpperCase()}${semana.slice(1)} ${valor('day')} de ${valor('month')}`
}

/** "del 1 al 13 de noviembre"; omite el mes/año repetido cuando coincide. */
export function formatearRango(inicio, fin) {
  const desde = partesDeFecha(inicio)
  const hasta = partesDeFecha(fin)
  if (!desde || !hasta) return ''

  const mesDesde = MESES[desde.mes - 1]
  const mesHasta = MESES[hasta.mes - 1]

  if (desde.anio === hasta.anio && desde.mes === hasta.mes) {
    return `del ${desde.dia} al ${hasta.dia} de ${mesHasta}`
  }
  if (desde.anio === hasta.anio) {
    return `del ${desde.dia} de ${mesDesde} al ${hasta.dia} de ${mesHasta}`
  }
  return `del ${desde.dia} de ${mesDesde} de ${desde.anio} al ${hasta.dia} de ${mesHasta} de ${hasta.anio}`
}

/** Un decimal con coma decimal y sin redondear a entero: "41,2 %". */
export function formatearPorcentaje(valor) {
  const numero = Number.parseFloat(valor)
  if (!Number.isFinite(numero)) return '—'
  return `${numero.toFixed(1).replace('.', ',')} %`
}

/** Pie de la tarjeta: hora absoluta a la izquierda, conteo a la derecha. */
export function textoPie(user = {}) {
  const estado = clasificarEstado(user)
  const resultado = user.resultado_dia ?? {}
  const cumplidas = aEntero(resultado.tareas_cumplidas)
  const programadas = aEntero(resultado.tareas_programadas)
  const conteoTareas = `${cumplidas} de ${programadas} tareas`
  const horaApertura = normalizarHora(user.hora_apertura)

  switch (estado.motivo) {
    case CHIP.SIN_MARCAS:
      return {
        izquierda: horaApertura ? `Sin marcas desde apertura (${horaApertura})` : 'Sin marcas desde la apertura',
        derecha: conteoTareas,
        tono: 'alerta',
      }
    case 'antes_apertura':
      return {
        izquierda: horaApertura ? `Abre a las ${horaApertura} · sin marcas todavía` : 'Sin marcas desde la apertura',
        derecha: conteoTareas,
        tono: null,
      }
    case 'sucursal_cerrada':
      return { izquierda: 'Sucursal cerrada hoy', derecha: '—', tono: null }
    case 'cerrado':
      return { izquierda: 'Jornada cerrada', derecha: conteoTareas, tono: null }
    case 'sin_sucursal':
      return { izquierda: 'Sin sucursal asignada', derecha: '—', tono: null }
    case 'sin_tareas':
      return { izquierda: 'Sin tareas programadas hoy', derecha: '—', tono: null }
    case 'domingo':
      return { izquierda: 'Operación dominical no habilitada', derecha: '—', tono: null }
    case CHIP.DIA_ESPECIAL:
      return { izquierda: 'Sin tareas programadas', derecha: '0 tareas', tono: null }
    default:
      return {
        izquierda: `Última marca ${normalizarHora(resultado.ultima_marca)}`,
        derecha: conteoTareas,
        tono: null,
      }
  }
}
