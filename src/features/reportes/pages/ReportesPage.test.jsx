import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ReportesPage from './ReportesPage'

const { useAuth, getGerentes, getUsuarios, generarReporteJson, generarReportePdf } = vi.hoisted(() => ({
  useAuth: vi.fn(),
  getGerentes: vi.fn(),
  getUsuarios: vi.fn(),
  generarReporteJson: vi.fn(),
  generarReportePdf: vi.fn(),
}))

vi.mock('../../auth/context/AuthContext', () => ({ useAuth }))
vi.mock('../../gerentes/services/gerentesService', () => ({ getGerentes }))
vi.mock('../../usuarios/services/usuariosService', () => ({ getUsuarios }))
vi.mock('../services/reportesService', () => ({
  generarReporteJson,
  generarReportePdf,
}))

describe('ReportesPage', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('groups report generation controls by period, scope, and delivery', async () => {
    useAuth.mockReturnValue({ perfil: { type: 'admin_master' } })
    getGerentes.mockResolvedValue([])
    getUsuarios.mockResolvedValue([])

    render(<ReportesPage />)

    expect(document.querySelector('.reportes-page')).toHaveClass('tema-analiza', 'tuvet-page')
    expect(document.querySelector('.rp-filtros-card')).toHaveClass('rp-filtros-card--scope')
    expect(screen.getByRole('heading', { name: 'Generar reporte' })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Período' })).toContainElement(screen.getByLabelText('Tipo'))
    expect(screen.getByRole('group', { name: 'Alcance' })).toContainElement(screen.getByLabelText('Gerente de área'))
    expect(screen.getByRole('group', { name: 'Entrega' })).toContainElement(screen.getByLabelText('Enviar una copia por correo'))
    expect(screen.getByText(/Reporte semanal para todas las áreas/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Generar reporte' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Descargar PDF' })).toHaveClass('rp-btn-secondary')
  })

  it('uses neutral Spanish labels for the highest and lowest performance rankings', async () => {
    useAuth.mockReturnValue({ perfil: { type: 'gerente_area' } })
    getUsuarios.mockResolvedValue([])
    generarReporteJson.mockResolvedValue({
      resultado: {
        tipo: 'mensual', fecha_inicio: '2026-10-01', fecha_fin: '2026-10-31',
        reportes: [{
          promedio_general: 90, usuarios_count: 6, dias_periodo: 31,
          usuarios: [96, 95, 94, 93, 92, 74].map((porcentaje_periodo, index) => ({
            porcentaje_periodo, dias: [], dias_laborales: 20, dias_no_laborales: 0,
            sucursal_principal: 'Centro', usuario: { nombre: `Gerente ${index + 1}` },
          })),
        }],
      },
    })

    render(<ReportesPage />)
    fireEvent.change(screen.getByLabelText('Tipo'), { target: { value: 'mensual' } })
    fireEvent.click(screen.getByRole('button', { name: 'Generar reporte' }))

    const rankingTitle = (label) => (_, element) => (
      element?.classList.contains('rp-mini-ranking-title') && element.textContent.includes(label)
    )

    expect(await screen.findByText(rankingTitle('5 con mayor rendimiento'))).toBeInTheDocument()
    expect(screen.getByText(rankingTitle('5 con menor rendimiento'))).toBeInTheDocument()
  })

  it('clears the PDF download confirmation after 20 seconds', async () => {
    vi.useFakeTimers()
    useAuth.mockReturnValue({ perfil: { type: 'gerente_area' } })
    getUsuarios.mockResolvedValue([])
    generarReportePdf.mockResolvedValue({ blob: new Blob(['pdf']), filename: 'reporte.pdf', correos: 0 })
    vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:reporte'), revokeObjectURL: vi.fn() })
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    render(<ReportesPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Descargar PDF' }))

    await act(async () => {})
    expect(screen.getByText('PDF descargado.')).toBeInTheDocument()
    act(() => vi.advanceTimersByTime(20_000))
    expect(screen.queryByText('PDF descargado.')).not.toBeInTheDocument()
  })
})
