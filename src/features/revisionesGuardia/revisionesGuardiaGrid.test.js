import { describe, expect, it } from 'vitest'
import { REVISION_GRID_COLUMNS, toRevisionGridRow, toRevisionGridRows } from './revisionesGuardiaGrid'

const revision = {
  id_revision_guardia: 9,
  fecha: '2026-09-09',
  sucursal: { nombre: 'Sucursal Centro', codigo: 'CENTRO-01' },
  gerente_area: { nombre: 'GA Centro' },
  usuario: { nombre: 'GS Ana' },
  guardias: [
    { numero_guardia: 1, primer_nombre: 'María', primer_apellido: 'López', identidad: '0801-2000-12345', telefono: '9999-0000' },
    { numero_guardia: 2, primer_nombre: 'Juan', primer_apellido: 'Pérez', identidad: '0801-2000-54321', telefono: '9999-0001' },
  ],
  notas: 'La revisión fue completada sin incidencias.',
}

describe('revisionesGuardiaGrid', () => {
  it('convierte una revisión en una fila segura para el grid', () => {
    expect(toRevisionGridRow(revision)).toEqual({
      id: 9,
      fecha: '2026-09-09',
      sucursal: 'Sucursal Centro',
      codigo: 'CENTRO-01',
      gerente: 'GA Centro',
      gs: 'GS Ana',
      resultado: 'Revisión realizada',
      cantidadGuardias: 2,
      notaResumida: 'La revisión fue completada sin incidencias.',
    })
  })

  it('mantiene múltiples guardias dentro de una sola fila por revisión', () => {
    expect(toRevisionGridRows([revision])).toHaveLength(1)
    expect(toRevisionGridRows([revision])[0].cantidadGuardias).toBe(2)
  })

  it('excluye PII de las columnas y de las filas', () => {
    const serialized = JSON.stringify({ columns: REVISION_GRID_COLUMNS.map(({ field, headerName }) => ({ field, headerName })), row: toRevisionGridRow(revision) })

    expect(serialized).not.toMatch(/identidad|tel[eé]fono|María|López|Juan|Pérez/i)
  })
})
