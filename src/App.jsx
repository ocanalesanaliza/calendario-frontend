import { BrowserRouter, Routes, Route } from "react-router-dom";
import LoginPage from "./features/auth/pages/LoginPage";
import ChangePasswordPage from "./features/auth/pages/ChangePasswordPage";
import CalendarPage from "./features/calendar/pages/CalendarPage";
import TareasPage from "./features/tareas/pages/TareasPage";
import SucursalesPage from "./features/sucursales/pages/SucursalesPage";
import UsuariosPage from "./features/usuarios/pages/UsuariosPage";
import PlantillasPage from "./features/plantillas/pages/PlantillasPage";
import PlantillaDetallePage from "./features/plantillas/pages/PlantillaDetallePage";
import GerentesPage from "./features/gerentes/pages/GerentesPage";
import Layout from "./components/Layout/Layout";
import ProtectedRoute from "./components/ProtectedRoute";

function App() {
  return (
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
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
