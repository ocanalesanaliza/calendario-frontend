export const ESTADOS_OCURRENCIA = {
  pendiente: 'Pendiente',
  en_revision: 'En revisión',
  aprobada: 'Aprobada',
  cancelada: 'Cancelada',
}

export const EVENTOS_OCURRENCIA = {
  marcada: 'Marcada como realizada',
  aprobada: 'Aprobada',
  rechazada: 'Rechazada',
  cancelada: 'Cancelada',
}

export const TIPOS_RECURRENCIA = {
  diario: 'Diario (lunes a viernes)',
  'diario-todos-dias': 'Diario (todos los días)',
  semanal: 'Semanal',
  quincenal: 'Quincenal',
  'mensual-dias': 'Mensual por días',
}

// 0 = lunes … 6 = domingo, como lo define la API.
export const DIAS_SEMANA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

export const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

export const VIGENCIA_ABIERTA = '9999-12-31'

export function nombrePersona(persona) {
  if (!persona) return ''
  if (persona.nombre_completo) return persona.nombre_completo
  const completo = [persona.nombre, persona.apellido].filter(Boolean).join(' ')
  return completo || persona.email || ''
}

export function formatFecha(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value ?? '')
  if (!match) return ''
  return `${match[3]}/${match[2]}/${match[1]}`
}

// Muestra la hora tal como la envía el backend, conservando su zona.
export function formatFechaHora(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?(Z|[+-]\d{2}:\d{2})?$/.exec(value ?? '')
  if (!match) return ''
  const [, year, month, day, hour, minute, zona] = match
  const sufijo = zona ? ` (UTC${zona === 'Z' ? '+00:00' : zona})` : ''
  return `${day}/${month}/${year} ${hour}:${minute}${sufijo}`
}

export function formatRetraso(minutos) {
  if (!minutos || minutos <= 0) return ''
  const dias = Math.floor(minutos / 1440)
  const horas = Math.floor((minutos % 1440) / 60)
  const resto = minutos % 60
  return [dias && `${dias} d`, horas && `${horas} h`, resto && `${resto} min`].filter(Boolean).join(' ')
}

export function formatPorcentaje(value) {
  const numero = Number(value)
  if (!Number.isFinite(numero)) return '—'
  return `${numero.toLocaleString('es', { maximumFractionDigits: 2 })} %`
}

export function formatVigencia(vigencia) {
  if (!vigencia?.inicio) return ''
  if (!vigencia.fin || vigencia.fin === VIGENCIA_ABIERTA) return `Desde ${formatFecha(vigencia.inicio)}`
  return `${formatFecha(vigencia.inicio)} – ${formatFecha(vigencia.fin)}`
}

export function describirProgramacion(tarea) {
  if (tarea.tipo_programacion === 'puntual') {
    return `Puntual · vence ${formatFechaHora(tarea.fecha_limite)}`
  }
  const base = TIPOS_RECURRENCIA[tarea.tipo_recurrencia] ?? tarea.tipo_recurrencia
  const valor = tarea.valor_recurrencia ?? {}
  if (Array.isArray(valor.dias_semana) && valor.dias_semana.length) {
    return `${base}: ${valor.dias_semana.map((dia) => DIAS_SEMANA[dia]).join(', ')}`
  }
  if (Array.isArray(valor.dias_mes) && valor.dias_mes.length) {
    return `${base}: días ${valor.dias_mes.join(', ')}`
  }
  return base
}

export function mesActual(hoy = new Date()) {
  return { year: hoy.getFullYear(), month: hoy.getMonth() + 1 }
}

export function moverMes({ year, month }, delta) {
  const indice = year * 12 + (month - 1) + delta
  return { year: Math.floor(indice / 12), month: (indice % 12) + 1 }
}

// <input type="datetime-local"> → ISO-8601 con el offset del navegador.
export function inputLocalAIso(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value ?? '')
  if (!match) return null
  const [, year, month, day, hour, minute] = match.map(Number)
  const fecha = new Date(year, month - 1, day, hour, minute)
  const offset = -fecha.getTimezoneOffset()
  const signo = offset >= 0 ? '+' : '-'
  const abs = Math.abs(offset)
  const pad = (n) => String(n).padStart(2, '0')
  return `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:00${signo}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
}

// ISO del backend → valor de <input type="datetime-local"> con la hora de pared recibida.
export function isoAInputLocal(value) {
  const match = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})/.exec(value ?? '')
  return match ? match[1] : ''
}
