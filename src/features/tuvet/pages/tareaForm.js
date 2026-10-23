import { inputLocalAIso, isoAInputLocal } from '../utils/formato'

export const FORM_TAREA_VACIO = {
  nombre: '',
  descripcion: '',
  tipo_programacion: 'recurrente',
  tipo_recurrencia: 'diario',
  dias_semana: [],
  dias_mes: '',
  fecha_limite: '',
  requiere_aprobacion: true,
  requiere_documento: false,
}

export function formDesdeTarea(tarea) {
  const valor = tarea.valor_recurrencia ?? {}
  return {
    nombre: tarea.nombre ?? '',
    descripcion: tarea.descripcion ?? '',
    tipo_programacion: tarea.tipo_programacion,
    tipo_recurrencia: tarea.tipo_recurrencia || 'diario',
    dias_semana: Array.isArray(valor.dias_semana) ? valor.dias_semana : [],
    dias_mes: Array.isArray(valor.dias_mes) ? valor.dias_mes.join(', ') : '',
    fecha_limite: isoAInputLocal(tarea.fecha_limite),
    requiere_aprobacion: tarea.requiere_aprobacion,
    requiere_documento: tarea.requiere_documento,
  }
}

function parseDiasMes(texto) {
  const tokens = texto.split(/[,;\s]+/).filter(Boolean)
  const dias = tokens.map(Number)
  if (dias.some((dia) => !Number.isInteger(dia) || dia < 1 || dia > 31)) return null
  return [...new Set(dias)].sort((a, b) => a - b)
}

function valorRecurrencia(form) {
  if (form.tipo_recurrencia === 'semanal') {
    if (!form.dias_semana.length) return { error: 'Selecciona al menos un día de la semana en que se repetirá.', campo: 'dias_semana' }
    return { valor: { dias_semana: [...form.dias_semana].sort((a, b) => a - b) } }
  }
  if (form.tipo_recurrencia === 'quincenal' || form.tipo_recurrencia === 'mensual-dias') {
    const dias = parseDiasMes(form.dias_mes)
    if (!dias || !dias.length) return { error: 'Indica días del mes válidos entre 1 y 31, separados por comas (ej. 5, 20).', campo: 'dias_mes' }
    if (form.tipo_recurrencia === 'quincenal' && dias.length !== 2) return { error: 'La recurrencia quincenal necesita exactamente dos días distintos (ej. 1, 15).', campo: 'dias_mes' }
    return { valor: { dias_mes: dias } }
  }
  return { valor: {} }
}

// Devuelve { error, campo } o { payload } con el cuerpo completo de creación.
export function payloadDesdeForm(form) {
  const nombre = form.nombre.trim()
  if (!nombre) return { error: 'Escribe el nombre de la tarea; es lo que verá el gerente de sucursal.', campo: 'nombre' }

  const payload = {
    nombre,
    descripcion: form.descripcion.trim(),
    tipo_programacion: form.tipo_programacion,
    requiere_aprobacion: form.requiere_aprobacion,
    requiere_documento: form.requiere_documento,
  }

  if (form.tipo_programacion === 'puntual') {
    const fecha = inputLocalAIso(form.fecha_limite)
    if (!fecha) return { error: 'Indica la fecha y la hora límite para realizar la tarea.', campo: 'fecha_limite' }
    payload.fecha_limite = fecha
    return { payload }
  }

  const { error, campo, valor } = valorRecurrencia(form)
  if (error) return { error, campo }
  payload.tipo_recurrencia = form.tipo_recurrencia
  payload.valor_recurrencia = valor
  return { payload }
}

const igual = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)

// PATCH: solo los campos modificados respecto a la tarea original.
export function cambiosDesdeForm(tarea, form) {
  const { error, campo, payload } = payloadDesdeForm(form)
  if (error) return { error, campo }

  const cambios = {}
  for (const campo of ['nombre', 'descripcion', 'tipo_programacion', 'requiere_aprobacion', 'requiere_documento']) {
    if (!igual(payload[campo], tarea[campo] ?? (campo === 'descripcion' ? '' : undefined))) cambios[campo] = payload[campo]
  }

  if (payload.tipo_programacion === 'puntual') {
    if (form.fecha_limite !== isoAInputLocal(tarea.fecha_limite)) cambios.fecha_limite = payload.fecha_limite
    if (tarea.tipo_programacion !== 'puntual') {
      cambios.tipo_recurrencia = null
      cambios.valor_recurrencia = null
    }
  } else {
    if (payload.tipo_recurrencia !== tarea.tipo_recurrencia) cambios.tipo_recurrencia = payload.tipo_recurrencia
    if (!igual(payload.valor_recurrencia, tarea.valor_recurrencia) || cambios.tipo_recurrencia) {
      cambios.valor_recurrencia = payload.valor_recurrencia
    }
    if (tarea.fecha_limite) cambios.fecha_limite = null
  }

  if (!Object.keys(cambios).length) return { error: 'No hay cambios para guardar.' }
  return { cambios }
}
