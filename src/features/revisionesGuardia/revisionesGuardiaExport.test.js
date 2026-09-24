import { describe, expect, it } from 'vitest'
import { REVISION_EXPORT_HEADERS, toRevisionExportSheetData } from './revisionesGuardiaExport'

describe('revisionesGuardiaExport', () => {
  it('maps public rows to the required headers and column order', () => {
    const filas = [{
      fecha: '2026-09-09',
      sucursal: 'Sucursal Centro',
      codigo: 'CENTRO-01',
      gerente: 'GA Centro',
      gs: 'GS Ana',
      resultado: 'Revisión realizada',
      cantidadGuardias: 2,
      notaResumida: 'Revisión completada.',
    }]

    expect(toRevisionExportSheetData(filas)).toEqual([
      ['Fecha', 'Sucursal', 'Código', 'Gerente de área', 'GS', 'Resultado', 'Cantidad de guardias', 'Nota'],
      ['2026-09-09', 'Sucursal Centro', 'CENTRO-01', 'GA Centro', 'GS Ana', 'Revisión realizada', 2, 'Revisión completada.'],
    ])
    expect(REVISION_EXPORT_HEADERS).toEqual(toRevisionExportSheetData([])[0])
  })

  it('exports only the approved public fields without PII or nested objects', () => {
    const sheetData = toRevisionExportSheetData([{
      fecha: '2026-09-09',
      sucursal: 'Sucursal Centro',
      codigo: 'CENTRO-01',
      gerente: 'GA Centro',
      gs: 'GS Ana',
      resultado: 'Revisión realizada',
      cantidadGuardias: 1,
      notaResumida: 'Nota pública.',
      id: 9,
      guardias: [{ identidad: '0801-2000-12345', telefono: '9999-0000', primer_nombre: 'María' }],
      internalMetadata: { token: 'private' },
    }])

    expect(JSON.stringify(sheetData)).not.toMatch(/identidad|tel[eé]fono|María|0801-2000-12345|9999-0000|internalMetadata|private/i)
    expect(sheetData[1]).toHaveLength(8)
  })
})
