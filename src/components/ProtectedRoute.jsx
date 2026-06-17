import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../features/auth/context/AuthContext'

function ProtectedRoute({ children }) {
  const { perfil } = useAuth()
  const location = useLocation()
  const access = localStorage.getItem('access')

  if (!access) return <Navigate to="/Login" replace />

  if (perfil?.debe_cambiar_password && location.pathname !== '/cambiar-password') {
    return <Navigate to="/cambiar-password" replace />
  }

  return children
}

export default ProtectedRoute
