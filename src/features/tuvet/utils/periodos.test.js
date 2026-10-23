import { describe, expect, it } from 'vitest'
import { agruparPorDia, etiquetaDia, moverPeriodo, puedeMarcarse, rangoPeriodo } from './periodos'

const AHORA = new Date(2026, 9, 22, 9, 0) // jueves 22 de octubre de 2026

describe('periodos de Mis tareas', () => {
  it('el día es el rango de una sola fecha y se titula de forma relativa', () => {
    const rango = rangoPeriodo('dia', AHORA, AHORA)
    expect(rango).toMatchObject({ desde: '2026-10-22', hasta: '2026-10-22', meses: [{ year: 2026, month: 10 }], incluyeHoy: true })
    expect(rango.titulo).toBe('Hoy · jueves 22 de octubre')
  })

  it('la semana va de lunes a domingo y consulta los dos meses si cruza de mes', () => {
    expect(rangoPeriodo('semana', AHORA, AHORA)).toMatchObject({ desde: '2026-10-19', hasta: '2026-10-25', titulo: '19 – 25 oct 2026' })
    const cruce = rangoPeriodo('semana', new Date(2026, 9, 30), AHORA)
    expect(cruce).toMatchObject({ desde: '2026-10-26', hasta: '2026-11-01' })
    expect(cruce.meses).toEqual([{ year: 2026, month: 10 }, { year: 2026, month: 11 }])
  })

  it('el mes cubre del primer al último día', () => {
    expect(rangoPeriodo('mes', AHORA, AHORA)).toMatchObject({ desde: '2026-10-01', hasta: '2026-10-31', titulo: 'Octubre 2026' })
  })

  it('avanza y retrocede según el periodo', () => {
    expect(moverPeriodo('dia', AHORA, 1).getDate()).toBe(23)
    expect(moverPeriodo('semana', AHORA, -1).getDate()).toBe(15)
    expect(moverPeriodo('mes', AHORA, 1).getMonth()).toBe(10)
  })

  it('solo permite marcar pendientes cuya fecha programada ya llegó', () => {
    expect(puedeMarcarse({ estado: 'pendiente', fecha_programada: '2026-10-22' }, AHORA)).toBe(true)
    expect(puedeMarcarse({ estado: 'pendiente', fecha_programada: '2026-10-21' }, AHORA)).toBe(true)
    expect(puedeMarcarse({ estado: 'pendiente', fecha_programada: '2026-10-29' }, AHORA)).toBe(false)
    expect(puedeMarcarse({ estado: 'en_revision', fecha_programada: '2026-10-22' }, AHORA)).toBe(false)
  })

  it('agrupa por día en orden y marca el de hoy', () => {
    const grupos = agruparPorDia([
      { id: 2, fecha_programada: '2026-10-23' },
      { id: 1, fecha_programada: '2026-10-22' },
      { id: 3, fecha_programada: '2026-10-23' },
    ], AHORA)
    expect(grupos.map((grupo) => [grupo.fecha, grupo.items.length, grupo.esHoy])).toEqual([
      ['2026-10-22', 1, true],
      ['2026-10-23', 2, false],
    ])
    expect(etiquetaDia('2026-10-23', AHORA)).toBe('Mañana · viernes 23 de octubre')
  })
})
