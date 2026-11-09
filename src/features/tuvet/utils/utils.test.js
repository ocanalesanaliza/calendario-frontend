import { describe, expect, it } from 'vitest'
import { construirDocumento, fileToBase64, validarArchivoEvidencia } from './archivos'
import { describirProgramacion, formatFechaHora, formatRetraso, isoAInputLocal, moverMes } from './formato'

const archivo = (contenido, nombre, type) => new File([contenido], nombre, { type })

describe('archivos de evidencia', () => {
  it('genera base64 puro, sin prefijo data URI', async () => {
    expect(await fileToBase64(archivo('hola', 'a.pdf', 'application/pdf'))).toBe('aG9sYQ==')
  })

  it('usa el content_type exacto según la extensión', async () => {
    const documento = await construirDocumento(archivo('x', 'informe.docx', ''))
    expect(documento).toEqual({
      nombre: 'informe.docx',
      content_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      base64: 'eA==',
    })
  })

  it('rechaza formatos no permitidos, MIME distinto y archivos grandes', () => {
    expect(validarArchivoEvidencia(archivo('x', 'nota.txt', 'text/plain')).error).toMatch(/Formato/)
    expect(validarArchivoEvidencia(archivo('x', 'foto.png', 'image/jpeg')).error).toMatch(/no coincide/)
    const grande = archivo('x', 'grande.pdf', 'application/pdf')
    Object.defineProperty(grande, 'size', { value: 6 * 1024 * 1024 })
    expect(validarArchivoEvidencia(grande).error).toMatch(/5 MB/)
  })
})

describe('formato', () => {
  it('conserva la zona horaria recibida', () => {
    expect(formatFechaHora('2026-10-20T23:59:59.999999-06:00')).toBe('20/10/2026 23:59 (UTC-06:00)')
    expect(isoAInputLocal('2026-12-15T17:00:00-06:00')).toBe('2026-12-15T17:00')
  })

  it('formatea retraso y meses', () => {
    expect(formatRetraso(0)).toBe('')
    expect(formatRetraso(1575)).toBe('1 d 2 h 15 min')
    expect(moverMes({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 })
    expect(moverMes({ year: 2026, month: 12 }, 1)).toEqual({ year: 2027, month: 1 })
  })

  it('describe la recurrencia semanal con 0 = lunes', () => {
    expect(describirProgramacion({ tipo_programacion: 'recurrente', tipo_recurrencia: 'semanal', valor_recurrencia: { dias_semana: [0, 2, 4] } }))
      .toBe('Semanal: Lunes, Miércoles, Viernes')
  })
})
