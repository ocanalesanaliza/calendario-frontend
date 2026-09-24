import { describe, expect, it } from 'vitest'
import { GUARDIA_EXPORT_HEADERS, REVISION_EXPORT_HEADERS, toGuardiaExportSheetData, toRevisionExportSheetData } from './revisionesGuardiaExport'

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

  it('builds explicit guard detail rows with authorized PII and repeated revision traceability', () => {
    const revisiones = [{
      fecha: '2026-09-09',
      sucursal: { nombre: 'Sucursal Centro', codigo: 'CENTRO-01' },
      usuario: { nombre: 'GS Ana' },
      guardias: [
        {
          numero_guardia: 1,
          primer_nombre: 'María',
          segundo_nombre: 'José',
          primer_apellido: 'López',
          segundo_apellido: 'Díaz',
          telefono: '9999-0000',
          identidad: '0801-2000-12345',
          uniforme: { botas: false, zapatillas: true, pantalon_jean: false, desconocido: false },
          equipamiento: { porta_carnet: false, revolver: true, escopeta: false },
        },
        {
          numero_guardia: 2,
          nombre_completo: 'Juan Pérez',
          telefono: '9999-0001',
          identidad: '0801-2000-54321',
          uniforme: {},
          equipamiento: {},
        },
      ],
      notas: 'Nota de revisión.',
    }]

    const sheetData = toGuardiaExportSheetData(revisiones)

    expect(sheetData).toEqual([
      ['Fecha', 'Sucursal', 'Código', 'Gerente de sucursal', 'Resultado', 'Número de guardia', 'Nombre completo', 'Teléfono', 'Uniforme no portado', 'Equipamiento no portado', 'Nota'],
      ['2026-09-09', 'Sucursal Centro', 'CENTRO-01', 'GS Ana', 'Revisión realizada', 1, 'María José López Díaz', '9999-0000', 'Botas, Pantalón jean', 'Porta carnet, Escopeta', 'Nota de revisión.'],
      ['2026-09-09', 'Sucursal Centro', 'CENTRO-01', 'GS Ana', 'Revisión realizada', 2, 'Juan Pérez', '9999-0001', 'Sin faltantes de uniforme.', 'Sin faltantes de equipamiento.', 'Nota de revisión.'],
    ])
    expect(GUARDIA_EXPORT_HEADERS).toEqual(sheetData[0])
    expect(JSON.stringify(sheetData)).not.toMatch(/identidad|0801-2000-12345|0801-2000-54321/i)
  })

  it('does not invent guard rows for revisions without guards', () => {
    expect(toGuardiaExportSheetData([{ fecha: '2026-09-09', guardias: [] }])).toEqual([GUARDIA_EXPORT_HEADERS])
  })
})
