import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./features/auth/context/AuthContext";
import LoginPage from "./features/auth/pages/LoginPage";
import ChangePasswordPage from "./features/auth/pages/ChangePasswordPage";
import CalendarPage from "./features/calendar/pages/CalendarPage";
import TareasPage from "./features/tareas/pages/TareasPage";
import SucursalesPage from "./features/sucursales/pages/SucursalesPage";
import UsuariosPage from "./features/usuarios/pages/UsuariosPage";
import PlantillasPage from "./features/plantillas/pages/PlantillasPage";
import PlantillaDetallePage from "./features/plantillas/pages/PlantillaDetallePage";
import GerentesPage from "./features/gerentes/pages/GerentesPage";
import MisTareasPage from "./features/operacion/pages/MisTareasPage";
import AlmuerzosPage from "./features/almuerzos/pages/AlmuerzosPage";
import CoberturasPage from "./features/coberturas/pages/CoberturasPage";
import DashboardPage from "./features/dashboard/pages/DashboardPage";
import RendimientoPage from "./features/rendimiento/pages/RendimientoPage";
import Layout from "./components/Layout/Layout";
import ProtectedRoute from "./components/ProtectedRoute";

function App() {
  return (
    <AuthProvider>
    <BrowserRouter>
      <Routes>
        <Route path="/Login" element={<LoginPage />} />
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
          <Route path="/" element={<CalendarPage />} />
          <Route path="/tareas" element={<TareasPage />} />
          <Route path="/sucursales" element={<SucursalesPage />} />
          <Route path="/usuarios" element={<UsuariosPage />} />
          <Route path="/plantillas" element={<PlantillasPage />} />
          <Route path="/plantillas/:id" element={<PlantillaDetallePage />} />
          <Route path="/gerentes" element={<GerentesPage />} />
          <Route path="/mis-tareas" element={<MisTareasPage />} />
          <Route path="/almuerzos" element={<AlmuerzosPage />} />
          <Route path="/coberturas" element={<CoberturasPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/rendimiento" element={<RendimientoPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
    </AuthProvider>
  )
}

export default App
