export const FORMATOS_EVIDENCIA = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
}

export const ACCEPT_EVIDENCIA = Object.keys(FORMATOS_EVIDENCIA).map((ext) => `.${ext}`).join(',')

export const MAX_BYTES_EVIDENCIA = 5 * 1024 * 1024

// eslint-disable-next-line no-control-regex
const CARACTERES_INVALIDOS = /[/\\\u0000-\u001f\u007f]/

function extension(nombre) {
  const punto = nombre.lastIndexOf('.')
  return punto > 0 ? nombre.slice(punto + 1).toLowerCase() : ''
}

// Devuelve { error } o { contentType } con el MIME exacto que espera el backend.
export function validarArchivoEvidencia(file) {
  if (!file) return { error: 'Selecciona un archivo.' }
  if (CARACTERES_INVALIDOS.test(file.name) || file.name.includes('..')) {
    return { error: 'El nombre del archivo contiene caracteres no permitidos.' }
  }
  const contentType = FORMATOS_EVIDENCIA[extension(file.name)]
  if (!contentType) return { error: 'Formato no permitido. Usa PDF, PNG, JPG o DOCX.' }
  if (file.type && file.type !== contentType) {
    return { error: 'El tipo del archivo no coincide con su extensión.' }
  }
  if (file.size === 0) return { error: 'El archivo está vacío.' }
  if (file.size > MAX_BYTES_EVIDENCIA) return { error: 'El archivo supera el límite de 5 MB.' }
  return { contentType }
}

export async function fileToBase64(file) {
  const bytes = new Uint8Array(await file.arrayBuffer())
  const chunkSize = 0x8000
  let binary = ''

  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize))
  }

  return btoa(binary)
}

export async function construirDocumento(file) {
  const { error, contentType } = validarArchivoEvidencia(file)
  if (error) throw new Error(error)
  return { nombre: file.name, content_type: contentType, base64: await fileToBase64(file) }
}

export function formatTamano(bytes) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
