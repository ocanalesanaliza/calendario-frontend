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
import Layout from "./components/Layout/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import { getProfileCapabilities } from './features/auth/profilePolicies'

export function RendimientoRoute({ children }) {
  const { perfil } = useAuth()
  const { canAccessPerformance: puedeConsultar } = getProfileCapabilities(perfil)
  if (perfil && !puedeConsultar) return <Navigate to="/" replace />
  return children
}

function PendientesRoute({ children }) {
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

export function CapabilityRoute({ capability, children }) {
  const { perfil } = useAuth()
  if (perfil && !getProfileCapabilities(perfil)[capability]) return <Navigate to="/" replace />
  return children
}

export function AreaManagerAssignmentRoute({ children }) {
  const { perfil } = useAuth()
  const { canManageAreaManagers: canManage } = getProfileCapabilities(perfil)
  if (!canManage) return <Navigate to="/" replace />
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

export function AlmuerzosRoute({ children }) {
  const { perfil } = useAuth()
  if (!getProfileCapabilities(perfil).canAccessLunch) return <Navigate to="/" replace />
  return children
}

function HomeRoute() {
  const { perfil } = useAuth()
  const { isBranchManager, canAccessMyTasks } = getProfileCapabilities(perfil)
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
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route path="/" element={<HomeRoute />} />
          <Route path="/tareas" element={<TareasPage />} />
          <Route path="/inventario-demo" element={<CapabilityRoute capability="canManageBranches"><InventarioDemoPage /></CapabilityRoute>} />
          <Route path="/sucursales" element={<CapabilityRoute capability="canManageBranches"><SucursalesPage /></CapabilityRoute>} />
          <Route path="/usuarios" element={<CapabilityRoute capability="canManageUsers"><UsuariosPage /></CapabilityRoute>} />
          <Route path="/plantillas" element={<CapabilityRoute capability="canManageTemplates"><PlantillasPage /></CapabilityRoute>} />
          <Route path="/plantillas/:id" element={<CapabilityRoute capability="canManageTemplates"><PlantillaDetallePage /></CapabilityRoute>} />
          <Route path="/gerentes" element={<AreaManagerAssignmentRoute><GerentesPage /></AreaManagerAssignmentRoute>} />
          <Route path="/gerentes-operaciones" element={<GerentesOperacionesRoute><GerentesOperacionesPage /></GerentesOperacionesRoute>} />
          <Route path="/areas" element={<AreaManagerAssignmentRoute><AreasPage /></AreaManagerAssignmentRoute>} />
          <Route path="/mis-tareas" element={<MisTareasRoute><MisTareasPage /></MisTareasRoute>} />
          <Route path="/depositospendientes" element={<DepositosPendientesRoute><DepositosPendientesPage /></DepositosPendientesRoute>} />
          <Route path="/calendario-area" element={<CalendarioAreaRoute><CalendarioAreaPage /></CalendarioAreaRoute>} />
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
