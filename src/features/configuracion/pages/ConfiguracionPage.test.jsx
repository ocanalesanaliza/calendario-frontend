import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ConfiguracionPage from './ConfiguracionPage'

const { getConfiguracion, updateConfiguracion } = vi.hoisted(() => ({
  getConfiguracion: vi.fn(),
  updateConfiguracion: vi.fn(),
}))

vi.mock('../services/configuracionService', () => ({ getConfiguracion, updateConfiguracion }))

const configuracion = {
  trabajo_campo_dias_futuro: 7,
  vacacion_programada_dias_futuro: 30,
  situacion_especial_dias_atras: 15,
  situacion_especial_dias_futuro: 5,
  solicitud_dias_limite_aceptar: 3,
  actualizado_por: { nombre: 'Admin' },
  updated_at: '2026-10-01T10:00:00Z',
}

describe('ConfiguracionPage', () => {
  beforeEach(() => {
    getConfiguracion.mockReset().mockResolvedValue(configuracion)
    updateConfiguracion.mockReset()
  })

  it('muestra una fila por ajuste con su explicación en la (i)', async () => {
    render(<ConfiguracionPage />)

    expect(await screen.findByLabelText('Trabajo de campo a futuro')).toHaveValue(7)
    expect(screen.getByLabelText('Vencen sin respuesta en')).toHaveValue(3)
    expect(screen.getByRole('button', { name: 'Qué significa Vacaciones a futuro' }))
      .toHaveAccessibleDescription('Máximo de días a futuro para solicitar una vacación programada. Valor de fábrica: 30 días.')
  })

  it('muestra quién actualizó por última vez y las fechas que resultan desde hoy', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-04T10:00:00Z'))
    try {
      render(<ConfiguracionPage />)

      const ultima = await screen.findByRole('region', { name: 'Última actualización' })
      expect(ultima).toHaveTextContent('Admin')
      expect(ultima).toHaveTextContent('hace 3 días')

      const hoy = screen.getByRole('region', { name: 'Así queda hoy' })
      expect(hoy).toHaveTextContent('Vacaciones se pueden pedir hasta el mar, 3 nov')
      fireEvent.change(screen.getByLabelText('Vacaciones a futuro'), { target: { value: '1' } })
      expect(hoy).toHaveTextContent('Vacaciones se pueden pedir hasta el lun, 5 oct')
    } finally {
      vi.useRealTimers()
    }
  })

  it('muestra el valor anterior al editar y permite restaurar los de fábrica sin guardar', async () => {
    render(<ConfiguracionPage />)
    const vacaciones = await screen.findByLabelText('Vacaciones a futuro')

    fireEvent.change(vacaciones, { target: { value: '45' } })
    expect(screen.getByText('antes: 30')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Restaurar valores de fábrica' }))
    expect(screen.getByLabelText('Trabajo de campo a futuro')).toHaveValue(5)
    expect(screen.getByLabelText('Permisos hacia atrás')).toHaveValue(1)
    expect(screen.getByLabelText('Permisos a futuro')).toHaveValue(15)
    expect(screen.getByLabelText('Vencen sin respuesta en')).toHaveValue(1)
    expect(vacaciones).toHaveValue(30)
    expect(screen.queryByRole('button', { name: 'Restaurar valores de fábrica' })).not.toBeInTheDocument()
    expect(updateConfiguracion).not.toHaveBeenCalled()
  })

  it('usa "hoy" cuando un valor es cero e indica quién puede modificarlo', async () => {
    getConfiguracion.mockResolvedValue({ ...configuracion, situacion_especial_dias_atras: 0 })
    render(<ConfiguracionPage />)

    expect(await screen.findByRole('region', { name: 'Así queda hoy' })).toHaveTextContent('Permisos se registran desde hoy hasta el')
    expect(screen.getByRole('region', { name: 'Última actualización' })).toHaveTextContent('Solo el admin maestro puede modificar estos valores')
  })

  it('indica cuando nadie ha modificado los valores', async () => {
    getConfiguracion.mockResolvedValue({ ...configuracion, actualizado_por: null, updated_at: null })
    render(<ConfiguracionPage />)

    expect(await screen.findByRole('region', { name: 'Última actualización' })).toHaveTextContent('Nadie ha modificado estos valores todavía')
  })

  it('marca el error en la fila y no llama a la API', async () => {
    render(<ConfiguracionPage />)
    const campo = await screen.findByLabelText('Vacaciones a futuro')

    fireEvent.change(campo, { target: { value: '2.5' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Usa un número entero de 0 o más')
    expect(campo).toHaveAttribute('aria-invalid', 'true')
    expect(campo).toHaveFocus()
    expect(updateConfiguracion).not.toHaveBeenCalled()
  })

  it('envía todos los valores como números y confirma el guardado', async () => {
    updateConfiguracion.mockResolvedValue({ configuracion: { ...configuracion, trabajo_campo_dias_futuro: 10 } })
    render(<ConfiguracionPage />)

    fireEvent.change(await screen.findByLabelText('Trabajo de campo a futuro'), { target: { value: '10' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Configuración guardada correctamente.')
    expect(updateConfiguracion).toHaveBeenCalledWith({
      trabajo_campo_dias_futuro: 10,
      vacacion_programada_dias_futuro: 30,
      situacion_especial_dias_atras: 15,
      situacion_especial_dias_futuro: 5,
      solicitud_dias_limite_aceptar: 3,
    })
  })

  it('permite reintentar si falla la carga', async () => {
    getConfiguracion.mockRejectedValueOnce(new Error('Error al cargar la configuracion'))
    render(<ConfiguracionPage />)

    expect(await screen.findByRole('alert')).toHaveTextContent('Error al cargar la configuracion')
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByLabelText('Trabajo de campo a futuro')).toBeInTheDocument()
  })
})
