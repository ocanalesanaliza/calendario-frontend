import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./features/auth/context/AuthContext";
import LoginPage from "./features/auth/pages/LoginPage";
import ForgotPasswordPage from "./features/auth/pages/ForgotPasswordPage";
import ChangePasswordPage from "./features/auth/pages/ChangePasswordPage";
import CalendarPage from "./features/calendar/pages/CalendarPage";
import TareasPage from "./features/tareas/pages/TareasPage";
import SucursalesPage from "./features/sucursales/pages/SucursalesPage";
import UsuariosPage from "./features/usuarios/pages/UsuariosPage";
import PlantillasPage from "./features/plantillas/pages/PlantillasPage";
import PlantillaDetallePage from "./features/plantillas/pages/PlantillaDetallePage";
import PlantillasAreaPage from "./features/plantillasArea/pages/PlantillasAreaPage";
import PlantillaAreaDetallePage from './features/plantillasArea/pages/PlantillaAreaDetallePage'
import GerentesPage from "./features/gerentes/pages/GerentesPage";
import GerentesOperacionesPage from "./features/gerentes_operaciones/pages/GerentesOperacionesPage";
import AreasPage from "./features/areas/pages/AreasPage";
import MisTareasPage from "./features/operacion/pages/MisTareasPage";
import DepositosPendientesPage from "./features/operacion/pages/DepositosPendientesPage";
import SolicitudesPendientesPage from "./features/trabajosCampo/pages/SolicitudesPendientesPage";
import AlmuerzosPage from "./features/almuerzos/pages/AlmuerzosPage";
import CoberturasPage from "./features/coberturas/pages/CoberturasPage";
import DashboardPage from "./features/dashboard/pages/DashboardPage";
import RendimientoPage from "./features/rendimiento/pages/RendimientoPage";
import SituacionesPage from "./features/situaciones/pages/SituacionesPage";
import ReportesPage from "./features/reportes/pages/ReportesPage";
import ConfiguracionPage from "./features/configuracion/pages/ConfiguracionPage";
import CalendarioAreaPage from "./features/calendarioArea/pages/CalendarioAreaPage";
import InventarioDemoPage from './features/inventario/pages/InventarioDemoPage'
import RevisionesGuardiaPage from "./features/revisionesGuardia/pages/RevisionesGuardiaPage";
import AusenciasAreaPage from './features/ausenciasArea/pages/AusenciasAreaPage'
import OrganizacionPage from './features/organizacion/pages/OrganizacionPage'
import AdminMasterAssignmentsPage from './features/adminMasterAssignments/pages/AdminMasterAssignmentsPage'
import Layout from "./components/Layout/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import { getProfileCapabilities } from './features/auth/profilePolicies'
import SelectorEmpresaPage from './features/empresas/pages/SelectorEmpresaPage'
import TuvetLayout from './features/tuvet/components/TuvetLayout'
import { AnalizaModuleRoute, TuvetCapabilityRoute, TuvetHome, TuvetModuleRoute } from './features/tuvet/TuvetRoutes'
import TuvetMisTareasPage from './features/tuvet/pages/TuvetMisTareasPage'
import TuvetRevisionesPage from './features/tuvet/pages/TuvetRevisionesPage'
import TuvetTareasPage from './features/tuvet/pages/TuvetTareasPage'
import TuvetPlantillasPage from './features/tuvet/pages/TuvetPlantillasPage'
import TuvetEquipoPage from './features/tuvet/pages/TuvetEquipoPage'
import TuvetRendimientoPage from './features/tuvet/pages/TuvetRendimientoPage'
import TuvetSeguimientoPage from './features/tuvet/pages/TuvetSeguimientoPage'
import TuvetAsignarPage from './features/tuvet/pages/TuvetAsignarPage'

export function RendimientoRoute({ children }) {
  const { perfil } = useAuth()
  const { canAccessPerformance: puedeConsultar } = getProfileCapabilities(perfil)
  if (perfil && !puedeConsultar) return <Navigate to="/" replace />
  return children
}

export function PendientesRoute({ children }) {
  const { perfil } = useAuth()
  const { canAccessPendingRequests } = getProfileCapabilities(perfil)
  if (perfil && !canAccessPendingRequests) {
    return <Navigate to="/" replace />
  }
  return children
}

export function AdminMaestroRoute({ children }) {
  const { perfil } = useAuth()
  if (perfil && !getProfileCapabilities(perfil).isMasterAdmin) return <Navigate to="/" replace />
  return children
}

export function GerentesOperacionesRoute({ children }) {
  const { perfil } = useAuth()
  const { canManageOperationsManagers: puedeGestionarGO } = getProfileCapabilities(perfil)
  if (!puedeGestionarGO) return <Navigate to="/" replace />
  return children
}

export function SystemsOnlyRoute({ children }) {
  const { perfil } = useAuth()
  if (!getProfileCapabilities(perfil).isSystemsAccount) return <Navigate to="/" replace />
  return children
}

export function CapabilityRoute({ capability, children }) {
  const { perfil } = useAuth()
  if (perfil && !getProfileCapabilities(perfil)[capability]) return <Navigate to="/" replace />
  return children
}

export function AreaManagerAssignmentRoute({ children }) {
  const { perfil } = useAuth()
  const { canManageAreaManagers: canManage } = getProfileCapabilities(perfil)
  if (!canManage && !getProfileCapabilities(perfil).isMasterAdmin) return <Navigate to="/" replace />
  return children
}

export function OrganizacionRoute({ children }) {
  const { perfil } = useAuth()
  if (!getProfileCapabilities(perfil).canManageOrganization) return <Navigate to="/" replace />
  return children
}

export function PlantillasAreaRoute({ children }) {
  const { perfil } = useAuth()
  const { isMasterAdmin, isSystemsAccount } = getProfileCapabilities(perfil)
  if (!isMasterAdmin && !isSystemsAccount) return <Navigate to="/" replace />
  return children
}

export function MisTareasRoute({ children }) {
  const { perfil } = useAuth()
  if (!getProfileCapabilities(perfil).canAccessMyTasks) return <Navigate to="/" replace />
  return children
}

export function DepositosPendientesRoute({ children }) {
  const { perfil } = useAuth()
  if (!getProfileCapabilities(perfil).canAccessPendingDeposits) return <Navigate to="/" replace />
  return children
}

export function CalendarioAreaRoute({ children }) {
  const { perfil } = useAuth()
  if (!getProfileCapabilities(perfil).canAccessAreaCalendar) return <Navigate to="/" replace />
  return children
}

export function AusenciasAreaRoute({ children }) {
  const { perfil } = useAuth()
  if (!getProfileCapabilities(perfil).canAccessAreaAbsences) return <Navigate to="/" replace />
  return children
}

export function AlmuerzosRoute({ children }) {
  const { perfil } = useAuth()
  if (!getProfileCapabilities(perfil).canAccessLunch) return <Navigate to="/" replace />
  return children
}

export function HomeRoute() {
  const { perfil } = useAuth()
  const { isBranchManager, canAccessMyTasks, isSystemsAccount } = getProfileCapabilities(perfil)
  // Sistemas administra varias empresas: primero elige a cuál entrar.
  if (isSystemsAccount) return <Navigate to="/empresas" replace />
  if (isBranchManager && canAccessMyTasks) return <Navigate to="/mis-tareas" replace />
  return <CalendarPage />
}

function App() {
  return (
    <AuthProvider>
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/olvide-password" element={<ForgotPasswordPage />} />
        <Route
          path="/cambiar-password"
          element={
            <ProtectedRoute>
              <ChangePasswordPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/empresas"
          element={
            <ProtectedRoute>
              <SystemsOnlyRoute>
                <SelectorEmpresaPage />
              </SystemsOnlyRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/tuvet"
          element={
            <ProtectedRoute>
              <TuvetModuleRoute>
                <TuvetLayout />
              </TuvetModuleRoute>
            </ProtectedRoute>
          }
        >
          <Route index element={<TuvetHome />} />
          <Route path="seguimiento" element={<TuvetCapabilityRoute capability="canManageTasks"><TuvetSeguimientoPage /></TuvetCapabilityRoute>} />
          <Route path="asignar" element={<TuvetCapabilityRoute capability="canManageTasks"><TuvetAsignarPage /></TuvetCapabilityRoute>} />
          <Route path="mis-tareas" element={<TuvetCapabilityRoute capability="canAccessMyTasks"><TuvetMisTareasPage /></TuvetCapabilityRoute>} />
          <Route path="revisiones" element={<TuvetCapabilityRoute capability="canReview"><TuvetRevisionesPage /></TuvetCapabilityRoute>} />
          <Route path="tareas" element={<TuvetCapabilityRoute capability="canManageTasks"><TuvetTareasPage /></TuvetCapabilityRoute>} />
          <Route path="plantillas" element={<TuvetCapabilityRoute capability="canManageTasks"><TuvetPlantillasPage /></TuvetCapabilityRoute>} />
          <Route path="equipo" element={<TuvetCapabilityRoute capability="canAccessTeam"><TuvetEquipoPage /></TuvetCapabilityRoute>} />
          <Route path="rendimiento" element={<TuvetCapabilityRoute capability="canAccessPerformance"><TuvetRendimientoPage /></TuvetCapabilityRoute>} />
          <Route path="*" element={<TuvetHome />} />
        </Route>
        <Route
          element={
            <ProtectedRoute>
              <AnalizaModuleRoute>
                <Layout />
              </AnalizaModuleRoute>
            </ProtectedRoute>
          }
        >
          <Route path="/" element={<HomeRoute />} />
          <Route path="/calendario" element={<CalendarPage />} />
          <Route path="/tareas" element={<TareasPage />} />
          <Route path="/inventario-demo" element={<CapabilityRoute capability="canManageBranches"><InventarioDemoPage /></CapabilityRoute>} />
          <Route path="/sucursales" element={<CapabilityRoute capability="canManageBranches"><SucursalesPage /></CapabilityRoute>} />
          <Route path="/usuarios" element={<CapabilityRoute capability="canManageUsers"><UsuariosPage /></CapabilityRoute>} />
          <Route path="/plantillas" element={<CapabilityRoute capability="canManageTemplates"><PlantillasPage /></CapabilityRoute>} />
          <Route path="/plantillas/:id" element={<CapabilityRoute capability="canManageTemplates"><PlantillaDetallePage /></CapabilityRoute>} />
          <Route path="/plantillas-area" element={<PlantillasAreaRoute><PlantillasAreaPage /></PlantillasAreaRoute>} />
          <Route path="/plantillas-area/:id" element={<PlantillasAreaRoute><PlantillaAreaDetallePage /></PlantillasAreaRoute>} />
          <Route path="/gerentes" element={<AreaManagerAssignmentRoute><GerentesPage /></AreaManagerAssignmentRoute>} />
          <Route path="/gerentes-operaciones" element={<GerentesOperacionesRoute><GerentesOperacionesPage /></GerentesOperacionesRoute>} />
          <Route path="/admin-master-asignaciones" element={<SystemsOnlyRoute><AdminMasterAssignmentsPage /></SystemsOnlyRoute>} />
          <Route path="/areas" element={<AreaManagerAssignmentRoute><AreasPage /></AreaManagerAssignmentRoute>} />
          <Route path="/organizacion" element={<OrganizacionRoute><OrganizacionPage /></OrganizacionRoute>} />
          <Route path="/mis-tareas" element={<MisTareasRoute><MisTareasPage /></MisTareasRoute>} />
          <Route path="/mis-tareas-v2" element={<MisTareasRoute><MisTareasPage className="mis-tareas-page mis-tareas-v2-page" groupByStartTime selectionUxVariant scanabilityVariant availableFilterVariant priorityVariant /></MisTareasRoute>} />
          <Route path="/depositospendientes" element={<DepositosPendientesRoute><DepositosPendientesPage /></DepositosPendientesRoute>} />
          <Route path="/calendario-area" element={<CalendarioAreaRoute><CalendarioAreaPage /></CalendarioAreaRoute>} />
          <Route path="/ausencias-area" element={<AusenciasAreaRoute><AusenciasAreaPage /></AusenciasAreaRoute>} />
          <Route path="/solicitudes-pendientes" element={<PendientesRoute><SolicitudesPendientesPage /></PendientesRoute>} />
          <Route path="/almuerzos" element={<AlmuerzosRoute><AlmuerzosPage /></AlmuerzosRoute>} />
          <Route path="/coberturas" element={<CoberturasPage />} />
          <Route path="/dashboard" element={<CapabilityRoute capability="canAccessOperationalDashboard"><DashboardPage /></CapabilityRoute>} />
          <Route path="/rendimiento" element={<RendimientoRoute><RendimientoPage /></RendimientoRoute>} />
          <Route path="/situaciones" element={<CapabilityRoute capability="canManageSpecialSituations"><SituacionesPage /></CapabilityRoute>} />
          <Route path="/reportes" element={<CapabilityRoute capability="canAccessPerformanceReports"><ReportesPage /></CapabilityRoute>} />
          <Route path="/analitica/revisiones-guardia" element={<AdminMaestroRoute><RevisionesGuardiaPage /></AdminMaestroRoute>} />
          <Route path="/configuracion" element={<AdminMaestroRoute><ConfiguracionPage /></AdminMaestroRoute>} />
        </Route>
      </Routes>
    </BrowserRouter>
    </AuthProvider>
  )
}

export default App
