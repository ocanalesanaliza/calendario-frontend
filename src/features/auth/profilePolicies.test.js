import { describe, expect, it } from 'vitest'
import { getProfileCapabilities } from './profilePolicies'

describe('getProfileCapabilities', () => {
  it('grants all planned modules to Systems with Master Admin capabilities', () => {
    const capabilities = getProfileCapabilities({
      type: 'sistemas',
      es_cuenta_sistemas: true,
      activo: true,
      habilitado: true,
      capabilities: {
        manage_branches: true,
        manage_templates: true,
        manage_users: true,
        manage_special_situations: true,
        manage_special_situation_types: true,
        access_operational_dashboard: true,
        access_performance_reports: true,
        has_global_scope: true,
      },
    })

    expect(capabilities.canManageBranches).toBe(true)
    expect(capabilities.canManageTemplates).toBe(true)
    expect(capabilities.canManageUsers).toBe(true)
    expect(capabilities.canManageSpecialSituations).toBe(true)
    expect(capabilities.canAccessOperationalDashboard).toBe(true)
    expect(capabilities.canAccessPerformanceReports).toBe(true)
    expect(capabilities.canAccessMyTasks).toBe(false)
  })

  it('keeps an active operations manager limited to area-manager assignments', () => {
    const capabilities = getProfileCapabilities({ type: 'gerente_operaciones', activo: true, habilitado: true })

    expect(capabilities.canManageAreaManagers).toBe(true)
    expect(capabilities.canManageOperationsManagers).toBe(false)
  })

  it('denies module access when the server omits capabilities', () => {
    const capabilities = getProfileCapabilities({ type: 'sistemas', es_cuenta_sistemas: true, activo: true, habilitado: true })

    expect(capabilities.canManageBranches).toBe(false)
    expect(capabilities.canManageTemplates).toBe(false)
    expect(capabilities.canManageUsers).toBe(false)
    expect(capabilities.canAccessOperationalDashboard).toBe(false)
    expect(capabilities.canAccessMyTasks).toBe(false)
  })
})
