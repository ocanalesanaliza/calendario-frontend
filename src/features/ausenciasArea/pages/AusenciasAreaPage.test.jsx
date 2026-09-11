import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import AusenciasAreaPage from './AusenciasAreaPage'

const { useAuth } = vi.hoisted(() => ({ useAuth: vi.fn() }))
vi.mock('../../auth/context/AuthContext', () => ({ useAuth }))

describe('AusenciasAreaPage', () => {
  it('shows the absence-area entry point to an area manager', () => {
    useAuth.mockReturnValue({ perfil: { type: 'gerente_area', activo: true, habilitado: true } })
    render(<AusenciasAreaPage />)
    expect(screen.getByRole('heading', { name: 'Vacaciones y situaciones del área' })).toBeInTheDocument()
  })
})
