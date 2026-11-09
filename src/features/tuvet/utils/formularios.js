import { formatError } from '../services/tuvetService'

// Separa los errores del backend en errores por campo (los que el formulario muestra en línea)
// y un mensaje general con el resto.
export function erroresDelServidor(error, campos) {
  const porCampo = {}
  const fields = error?.fields
  if (fields && typeof fields === 'object' && !Array.isArray(fields)) {
    for (const campo of campos) {
      if (fields[campo] !== undefined) porCampo[campo] = formatError(fields[campo])
    }
  }
  const general = Object.keys(porCampo).length ? '' : error?.message ?? ''
  return { porCampo, general }
}

// Tras un envío fallido, lleva el foco al primer campo inválido del formulario.
export function enfocarPrimerError(formulario) {
  requestAnimationFrame(() => {
    formulario?.querySelector('[aria-invalid="true"]')?.focus()
  })
}
