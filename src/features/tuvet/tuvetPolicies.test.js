import { describe, expect, it } from 'vitest'
import { getTuvetCapabilities, isTuvetProfile, tuvetHomePath } from './tuvetPolicies'

const tuvet = (extra) => ({ modulo_calendario: 'tuvet', activo: true, habilitado: true, ...extra })

describe('tuvetPolicies', () => {
  it('decide el módulo solo con modulo_calendario', () => {
    expect(isTuvetProfile(tuvet())).toBe(true)
    expect(isTuvetProfile({ modulo_calendario: 'tareas', rol_organizacional: 'encargado' })).toBe(false)
  })

  it('usa rol_organizacional y no type para los permisos', () => {
    const capacidades = getTuvetCapabilities(tuvet({ type: 'gerente_sucursal', rol_organizacional: 'encargado' }))
    expect(capacidades.isDepartmentManager).toBe(true)
    expect(capacidades.isBranchManager).toBe(false)
    expect(capacidades.canManageTasks).toBe(true)
  })

  it.each([
    ['gs', '/tuvet/mis-tareas'],
    ['encargado', '/tuvet/seguimiento'],
    ['go', '/tuvet/equipo'],
    ['gp', '/tuvet/equipo'],
  ])('envía al rol %s a %s', (rol, ruta) => {
    expect(tuvetHomePath(tuvet({ rol_organizacional: rol }))).toBe(ruta)
  })

  it('permite a Sistemas administrar la estructura', () => {
    const capacidades = getTuvetCapabilities({ es_cuenta_sistemas: true, activo: true, habilitado: true, modulo_calendario: null })
    expect(capacidades.canAccessTuvet).toBe(true)
    expect(capacidades.canManageStructure).toBe(true)
  })

  it('niega el acceso a perfiles del calendario Analiza', () => {
    const capacidades = getTuvetCapabilities({ modulo_calendario: 'tareas', es_admin_maestro: true })
    expect(capacidades.canAccessTuvet).toBe(false)
    expect(capacidades.canManageStructure).toBe(false)
  })
})
