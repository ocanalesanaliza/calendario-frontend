import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AnalizaModuleRoute, TuvetCapabilityRoute, TuvetHome, TuvetModuleRoute } from './TuvetRoutes'

const { useAuth } = vi.hoisted(() => ({ useAuth: vi.fn() }))
vi.mock('../auth/context/AuthContext', () => ({ useAuth }))

function renderRutas(inicial) {
  render(
    <MemoryRouter initialEntries={[inicial]}>
      <Routes>
        <Route path="/" element={<AnalizaModuleRoute><p>Calendario Analiza</p></AnalizaModuleRoute>} />
        <Route path="/tuvet" element={<TuvetModuleRoute><TuvetHome /></TuvetModuleRoute>} />
        <Route path="/tuvet/mis-tareas" element={<TuvetModuleRoute><TuvetCapabilityRoute capability="canAccessMyTasks"><p>Mis tareas Tuvet</p></TuvetCapabilityRoute></TuvetModuleRoute>} />
        <Route path="/tuvet/revisiones" element={<TuvetModuleRoute><TuvetCapabilityRoute capability="canReview"><p>Revisiones Tuvet</p></TuvetCapabilityRoute></TuvetModuleRoute>} />
        <Route path="/tuvet/seguimiento" element={<TuvetModuleRoute><TuvetCapabilityRoute capability="canManageTasks"><p>Seguimiento Tuvet</p></TuvetCapabilityRoute></TuvetModuleRoute>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('rutas por módulo', () => {
  beforeEach(() => useAuth.mockReset())

  it('envía a un GS de Tuvet desde el inicio de Analiza a sus tareas', async () => {
    useAuth.mockReturnValue({ perfil: { modulo_calendario: 'tuvet', rol_organizacional: 'gs' } })
    renderRutas('/')
    expect(await screen.findByText('Mis tareas Tuvet')).toBeInTheDocument()
  })

  it('mantiene a un perfil de Analiza fuera de Tuvet', async () => {
    useAuth.mockReturnValue({ perfil: { modulo_calendario: 'tareas', type: 'gerente_sucursal' } })
    renderRutas('/tuvet/mis-tareas')
    expect(await screen.findByText('Calendario Analiza')).toBeInTheDocument()
  })

  it('impide a un GS entrar a revisiones', async () => {
    useAuth.mockReturnValue({ perfil: { modulo_calendario: 'tuvet', rol_organizacional: 'gs' } })
    renderRutas('/tuvet/revisiones')
    expect(await screen.findByText('Mis tareas Tuvet')).toBeInTheDocument()
  })

  it('lleva al encargado a su panel de seguimiento', async () => {
    useAuth.mockReturnValue({ perfil: { modulo_calendario: 'tuvet', rol_organizacional: 'encargado' } })
    renderRutas('/tuvet')
    expect(await screen.findByText('Seguimiento Tuvet')).toBeInTheDocument()
  })
})
