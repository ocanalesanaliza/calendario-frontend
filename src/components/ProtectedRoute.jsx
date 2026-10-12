import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../features/auth/context/AuthContext'
import { getAccessToken } from '../services/tokenStorage'

function ProtectedRoute({ children }) {
  const { perfil, perfilLoading } = useAuth()
  const location = useLocation()
  const access = getAccessToken()

  if (!access) return <Navigate to="/Login" replace />

  if (perfilLoading === true) return null

  if (perfil?.debe_cambiar_password && location.pathname !== '/cambiar-password') {
    return <Navigate to="/cambiar-password" replace />
  }

  return children
}

export default ProtectedRoute
