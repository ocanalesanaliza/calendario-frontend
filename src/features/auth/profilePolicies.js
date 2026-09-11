export function isActiveProfile(profile) {
  return profile?.activo === true && profile?.habilitado === true
}

export function getProfileCapabilities(profile) {
  const capabilities = profile?.capabilities
  const isSystemsRole = profile?.type === 'sistemas'
  const isSystemsAccount = profile?.es_cuenta_sistemas === true
    && isActiveProfile(profile)
  const isAreaManager = profile?.type === 'gerente_area'
  const isBranchManager = profile?.type === 'gerente_sucursal'
  const isOperationsManager = profile?.type === 'gerente_operaciones'
  const isMasterAdmin = profile?.es_admin_maestro === true || capabilities?.has_global_scope === true

  return {
    isAreaManager,
    isBranchManager,
    isMasterAdmin,
    isOperationsManager,
    isSystemsAccount,
    hasGlobalScope: isMasterAdmin,
    canManageBranches: capabilities?.manage_branches === true,
    canManageTemplates: capabilities?.manage_templates === true,
    canManageUsers: capabilities?.manage_users === true,
    canManageSpecialSituations: capabilities?.manage_special_situations === true,
    canManageSpecialSituationTypes: capabilities?.manage_special_situation_types === true,
    canAccessOperationalDashboard: capabilities?.access_operational_dashboard === true,
    canAccessPerformanceReports: capabilities?.access_performance_reports === true,
    canAccessLunch: profile !== null && profile !== undefined && !isSystemsRole,
    canAccessMyTasks: !isSystemsRole && profile?.can_access_my_tasks === true,
    canAccessPendingRequests: isBranchManager || isAreaManager,
    canAccessPerformance: isBranchManager || isAreaManager || isMasterAdmin,
    canAccessAreaCalendar: isAreaManager,
    canAccessAreaAbsences: isAreaManager || isOperationsManager || isMasterAdmin || isSystemsAccount,
    canManageAreaAbsences: isOperationsManager || isMasterAdmin || isSystemsAccount,
    canAccessPendingDeposits: isAreaManager,
    canManageAreaManagers: isSystemsAccount || (isOperationsManager && isActiveProfile(profile)),
    canManageOperationsManagers: isSystemsAccount,
    canManageAreaTemplateAssignments: isSystemsAccount || isMasterAdmin || (isOperationsManager && isActiveProfile(profile)),
  }
}
