import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AparienciaProvider, useApariencia } from './AparienciaContext'

const { useAuth, getAparienciaActual } = vi.hoisted(() => ({ useAuth: vi.fn(), getAparienciaActual: vi.fn() }))
vi.mock('../auth/context/AuthContext', () => ({ useAuth }))
vi.mock('./services/aparienciaService', () => ({ getAparienciaActual }))

const COLORES = {
  color_primario: '#4F46E5', color_primario_hover: '#4338CA', color_acento: '#EA580C', color_fondo: '#EEF1F6', color_superficie: '#FFFFFF',
  color_texto: '#0F172A', color_texto_secundario: '#475569', color_borde: '#E2E8F0', color_menu_fondo: '#0F172A', color_menu_texto: '#CBD5E1',
  color_menu_activo: '#6366F1', color_menu_activo_texto: '#C7D2FE', color_boton_primario: '#4F46E5', color_boton_primario_texto: '#FFFFFF',
  color_boton_secundario: '#FFFFFF', color_boton_secundario_texto: '#334155', color_boton_peligro: '#DC2626', color_boton_peligro_texto: '#FFFFFF',
  color_exito: '#166534', color_advertencia: '#854D0E', color_error: '#B91C1C', fuente: 'Plus Jakarta Sans', logo_base64: null,
}

// Empresas y países de ejemplo: cada combinación con su color principal.
const APARIENCIAS = {
  '1:10': { empresa: { id: 1, nombre: 'Analiza', modulo_calendario: 'tareas' }, pais: { id: 10, nombre: 'Honduras' }, primario: '#1D4ED8' },
  '1:11': { empresa: { id: 1, nombre: 'Analiza', modulo_calendario: 'tareas' }, pais: { id: 11, nombre: 'Guatemala' }, primario: '#047857' },
  '2:20': { empresa: { id: 2, nombre: 'Tuvet', modulo_calendario: 'tuvet' }, pais: { id: 20, nombre: 'Honduras' }, primario: '#7C3AED' },
  '2:21': { empresa: { id: 2, nombre: 'Tuvet', modulo_calendario: 'tuvet' }, pais: { id: 21, nombre: 'El Salvador' }, primario: '#B45309' },
}

function respuesta(clave) {
  const { empresa, pais, primario } = APARIENCIAS[clave]
  return { configurada: true, empresa, pais, apariencia: { ...COLORES, color_primario: primario } }
}

function Calendario({ modulo }) {
  const { empresa, pais, verComoSistemas } = useApariencia(modulo)
  return (
    <div>
      <span data-testid={`viendo-${modulo}`}>{empresa ? `${empresa.nombre} · ${pais.nombre}` : 'sistema'}</span>
      <button type="button" onClick={() => verComoSistemas(modulo === 'tuvet' ? 2 : 1, modulo === 'tuvet' ? 21 : 11)}>Cambiar {modulo}</button>
    </div>
  )
}

const estilo = (modulo) => document.getElementById(`apariencia-empresa-${modulo}`)?.textContent ?? ''

describe('AparienciaProvider', () => {
  beforeEach(() => {
    localStorage.clear()
    getAparienciaActual.mockReset().mockImplementation(async (params) => (
      params ? respuesta(`${params.company_id}:${params.country_id}`) : respuesta('2:20')
    ))
  })
  afterEach(() => localStorage.clear())

  it('sistemas ve en cada calendario su propia empresa y país sin mezclarlos', async () => {
    localStorage.setItem('apariencia-vista-sistemas', JSON.stringify({ tareas: { company_id: 1, country_id: 10 }, tuvet: { company_id: 2, country_id: 20 } }))
    useAuth.mockReturnValue({ perfil: { es_cuenta_sistemas: true } })

    render(<AparienciaProvider><Calendario modulo="tareas" /><Calendario modulo="tuvet" /></AparienciaProvider>)

    await waitFor(() => expect(screen.getByTestId('viendo-tareas')).toHaveTextContent('Analiza · Honduras'))
    expect(screen.getByTestId('viendo-tuvet')).toHaveTextContent('Tuvet · Honduras')
    await waitFor(() => expect(estilo('tareas')).toContain('--tv-primary: #1D4ED8;'))
    expect(estilo('tareas')).not.toContain('#7C3AED')
    expect(estilo('tuvet')).toContain('--tv-primary: #7C3AED;')
    expect(estilo('tuvet')).not.toContain('#1D4ED8')

    // Cambiar el país de Tuvet no toca el de Analiza, y se recuerda por calendario.
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Cambiar tuvet' })))
    await waitFor(() => expect(screen.getByTestId('viendo-tuvet')).toHaveTextContent('Tuvet · El Salvador'))
    expect(screen.getByTestId('viendo-tareas')).toHaveTextContent('Analiza · Honduras')
    await waitFor(() => expect(estilo('tuvet')).toContain('--tv-primary: #B45309;'))
    expect(estilo('tareas')).toContain('--tv-primary: #1D4ED8;')
    expect(JSON.parse(localStorage.getItem('apariencia-vista-sistemas'))).toEqual({
      tareas: { company_id: 1, country_id: 10 },
      tuvet: { company_id: 2, country_id: 21 },
    })
  })

  it('un usuario normal recibe solo la apariencia de su calendario', async () => {
    useAuth.mockReturnValue({ perfil: { es_cuenta_sistemas: false, modulo_calendario: 'tuvet' } })

    render(<AparienciaProvider><Calendario modulo="tareas" /><Calendario modulo="tuvet" /></AparienciaProvider>)

    await waitFor(() => expect(screen.getByTestId('viendo-tuvet')).toHaveTextContent('Tuvet · Honduras'))
    expect(screen.getByTestId('viendo-tareas')).toHaveTextContent('sistema')
    expect(getAparienciaActual).toHaveBeenCalledWith()
    await waitFor(() => expect(estilo('tuvet')).toContain('--tv-primary: #7C3AED;'))
    expect(document.getElementById('apariencia-empresa-tareas')).toBeNull()
  })
})
