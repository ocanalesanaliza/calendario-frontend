import { describe, expect, it } from 'vitest'
import { clasificarUrgencia, columnasTablero, etiquetaRelativa, resumenGeneral, resumenPorGerente } from './seguimiento'

const AHORA = new Date(2026, 9, 20, 10, 0)
const gs = (id, nombre) => ({ id, nombre_completo: nombre })
const oc = (extra) => ({ estado: 'pendiente', vencida: false, fecha_limite: '2026-10-25T23:59:00-06:00', gerente_sucursal: gs(1, 'Ana'), ...extra })

describe('seguimiento', () => {
  it('clasifica la urgencia de cada ocurrencia', () => {
    expect(clasificarUrgencia(oc({ vencida: true }), AHORA)).toBe('vencida')
    expect(clasificarUrgencia(oc({ fecha_limite: '2026-10-20T18:00:00' }), AHORA)).toBe('hoy')
    expect(clasificarUrgencia(oc({ fecha_limite: '2026-10-22T18:00:00' }), AHORA)).toBe('pronto')
    expect(clasificarUrgencia(oc({ fecha_limite: '2026-10-30T18:00:00' }), AHORA)).toBe('normal')
    expect(clasificarUrgencia(oc({ estado: 'en_revision' }), AHORA)).toBe('revision')
    expect(clasificarUrgencia(oc({ estado: 'aprobada' }), AHORA)).toBeNull()
  })

  it('usa fechas relativas', () => {
    expect(etiquetaRelativa(oc({ fecha_limite: '2026-10-20T18:00:00' }), AHORA)).toBe('Vence hoy 18:00')
    expect(etiquetaRelativa(oc({ fecha_limite: '2026-10-21T09:30:00' }), AHORA)).toBe('Mañana 09:30')
    expect(etiquetaRelativa(oc({ fecha_limite: '2026-10-18T18:00:00', vencida: true }), AHORA)).toBe('Venció hace 2 días')
  })

  it('calcula el cumplimiento como el backend: aprobadas / total sin canceladas', () => {
    const filas = resumenPorGerente([
      oc({ estado: 'aprobada' }),
      oc({ estado: 'aprobada' }),
      oc({ estado: 'en_revision' }),
      oc({ vencida: true }),
      oc({ estado: 'cancelada' }),
      oc({ estado: 'aprobada', gerente_sucursal: gs(2, 'Beto') }),
    ], AHORA)

    expect(filas).toHaveLength(2)
    const ana = filas.find((fila) => fila.gerente.id === 1)
    expect(ana).toMatchObject({ total: 4, aprobadas: 2, revision: 1, vencidas: 1, porcentaje: 50 })
    expect(ana.nivel.clave).toBe('bajo')
    expect(filas[0].gerente.id).toBe(1)

    const general = resumenGeneral(filas)
    expect(general).toMatchObject({ total: 5, aprobadas: 3, porcentaje: 60, vencidas: 1, revision: 1 })
  })

  it('agrupa el tablero en vencidas, hoy, próximos días y por revisar', () => {
    const columnas = columnasTablero([
      oc({ id: 1, vencida: true }),
      oc({ id: 2, fecha_limite: '2026-10-20T18:00:00' }),
      oc({ id: 3, fecha_limite: '2026-10-30T18:00:00' }),
      oc({ id: 4, estado: 'en_revision' }),
    ], AHORA)
    expect(columnas.map((columna) => [columna.clave, columna.tareas.map((tarea) => tarea.id)])).toEqual([
      ['vencida', [1]], ['hoy', [2]], ['pronto', []], ['revision', [4]],
    ])
  })
})
