import { isActiveProfile } from '../auth/profilePolicies'

export function isTuvetProfile(profile) {
  return profile?.modulo_calendario === 'tuvet'
}

export function getTuvetCapabilities(profile) {
  const rol = profile?.rol_organizacional ?? null
  const isSystemsAccount = profile?.es_cuenta_sistemas === true && isActiveProfile(profile)
  const isMasterAdmin = !isSystemsAccount && (
    profile?.es_admin_maestro === true || profile?.capabilities?.has_global_scope === true
  )
  const canAccessTuvet = isSystemsAccount || isTuvetProfile(profile)
  const canManageStructure = canAccessTuvet && (isSystemsAccount || isMasterAdmin)
  const isCountryManager = canAccessTuvet && rol === 'gp'
  const isOperationsManager = canAccessTuvet && rol === 'go'
  const isDepartmentManager = canAccessTuvet && rol === 'encargado'
  const isBranchManager = canAccessTuvet && rol === 'gs'

  return {
    rol,
    isSystemsAccount,
    isMasterAdmin,
    canAccessTuvet,
    canManageStructure,
    isCountryManager,
    isOperationsManager,
    isDepartmentManager,
    isBranchManager,
    canAccessMyTasks: isBranchManager,
    canManageTasks: isDepartmentManager,
    canReview: isDepartmentManager,
    canAccessTeam: canManageStructure || isCountryManager || isOperationsManager || isDepartmentManager,
    canAccessPerformance: canAccessTuvet,
  }
}

export function tuvetHomePath(profile) {
  const capabilities = getTuvetCapabilities(profile)
  if (capabilities.isBranchManager) return '/tuvet/mis-tareas'
  if (capabilities.isDepartmentManager) return '/tuvet/seguimiento'
  if (capabilities.canAccessTeam) return '/tuvet/equipo'
  return '/tuvet/rendimiento'
}

export function tuvetRoleLabel(profile) {
  const capabilities = getTuvetCapabilities(profile)
  if (capabilities.isSystemsAccount) return 'Sistemas'
  if (capabilities.isMasterAdmin) return 'Admin maestro'
  if (capabilities.isCountryManager) return 'Gerente de país'
  if (capabilities.isOperationsManager) return 'Gerente de operaciones'
  if (capabilities.isDepartmentManager) return 'Encargado de departamento'
  if (capabilities.isBranchManager) return 'Gerente de sucursal'
  return 'Usuario Tuvet'
}
