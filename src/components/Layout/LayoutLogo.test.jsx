import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Layout from './Layout'
import TuvetLayout from '../../features/tuvet/components/TuvetLayout'

const { useAuth, useApariencia } = vi.hoisted(() => ({ useAuth: vi.fn(), useApariencia: vi.fn() }))

vi.mock('../../features/auth/context/AuthContext', () => ({ useAuth }))
vi.mock('../../features/apariencia/AparienciaContext', () => ({ useApariencia }))
vi.mock('../../features/trabajosCampo/services/trabajosCampoService', () => ({ getTrabajosCampo: vi.fn().mockResolvedValue({ results: [] }) }))
vi.mock('../../features/coberturas/services/coberturasService', () => ({ getCoberturas: vi.fn().mockResolvedValue({ results: [] }) }))
vi.mock('../../features/vacacionesProgramadas/services/vacacionesProgramadasService', () => ({ getSolicitudesVacacion: vi.fn().mockResolvedValue({ results: [] }) }))

const LOGO = 'data:image/png;base64,iVBORw0KGgo='

function renderCon(Componente) {
  return render(<MemoryRouter><Routes><Route element={<Componente />}><Route path="/" element={<p>Inicio</p>} /></Route></Routes></MemoryRouter>)
}

describe('Marca en la barra superior', () => {
  beforeEach(() => {
    useAuth.mockReturnValue({ perfil: { type: 'gerente_area', nombre: 'Gerente', modulo_calendario: 'tuvet', activo: true, habilitado: true }, logout: vi.fn() })
  })

  it.each([
    ['Analiza', Layout, 'CRONOS'],
    ['Tuvet', TuvetLayout, 'Taskly · Tuvet'],
  ])('%s muestra el nombre por defecto y solo el logo cuando hay uno cargado', (_, Componente, nombre) => {
    useApariencia.mockReturnValue({ logo: null, empresa: null })
    const { unmount } = renderCon(Componente)
    expect(screen.getByText(nombre)).toBeInTheDocument()
    expect(document.querySelector('.topbar-logo')).toBeNull()
    unmount()

    useApariencia.mockReturnValue({ logo: LOGO, empresa: { id: 1, nombre: 'Tuvet' } })
    renderCon(Componente)
    expect(screen.queryByText(nombre)).not.toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Logo de Tuvet' })).toHaveAttribute('src', LOGO)
  })
})
