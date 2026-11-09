import { describe, expect, it } from 'vitest'
import { FORM_TAREA_VACIO, cambiosDesdeForm, formDesdeTarea, payloadDesdeForm } from './tareaForm'

const tarea = {
  id: 81,
  nombre: 'Verificar inventario',
  descripcion: 'Validar reactivos',
  tipo_programacion: 'recurrente',
  tipo_recurrencia: 'semanal',
  valor_recurrencia: { dias_semana: [0, 2, 4] },
  fecha_limite: null,
  requiere_aprobacion: true,
  requiere_documento: true,
  activa: true,
}

describe('tareaForm', () => {
  it('construye una tarea recurrente semanal', () => {
    const { payload } = payloadDesdeForm({ ...FORM_TAREA_VACIO, nombre: ' Revisar ', tipo_recurrencia: 'semanal', dias_semana: [4, 0] })
    expect(payload).toEqual({
      nombre: 'Revisar',
      descripcion: '',
      tipo_programacion: 'recurrente',
      requiere_aprobacion: true,
      requiere_documento: false,
      tipo_recurrencia: 'semanal',
      valor_recurrencia: { dias_semana: [0, 4] },
    })
  })

  it('exige exactamente dos días en la recurrencia quincenal', () => {
    expect(payloadDesdeForm({ ...FORM_TAREA_VACIO, nombre: 'X', tipo_recurrencia: 'quincenal', dias_mes: '1' })).toMatchObject({ error: expect.stringMatching(/dos días/), campo: 'dias_mes' })
    expect(payloadDesdeForm({ ...FORM_TAREA_VACIO, nombre: 'X', tipo_recurrencia: 'quincenal', dias_mes: '15, 1' }).payload.valor_recurrencia)
      .toEqual({ dias_mes: [1, 15] })
  })

  it('una tarea puntual lleva fecha límite con offset y no lleva recurrencia', () => {
    const { payload } = payloadDesdeForm({ ...FORM_TAREA_VACIO, nombre: 'Informe', tipo_programacion: 'puntual', fecha_limite: '2026-12-15T17:00' })
    expect(payload.fecha_limite).toMatch(/^2026-12-15T17:00:00[+-]\d{2}:\d{2}$/)
    expect(payload).not.toHaveProperty('tipo_recurrencia')
    expect(payload).not.toHaveProperty('valor_recurrencia')
  })

  it('en edición solo envía los campos modificados', () => {
    const form = { ...formDesdeTarea(tarea), nombre: 'Verificar inventario semanal' }
    expect(cambiosDesdeForm(tarea, form)).toEqual({ cambios: { nombre: 'Verificar inventario semanal' } })
  })

  it('avisa cuando no hay cambios', () => {
    expect(cambiosDesdeForm(tarea, formDesdeTarea(tarea)).error).toBe('No hay cambios para guardar.')
  })
})
