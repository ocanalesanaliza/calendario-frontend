import { Navigate } from 'react-router-dom'

function ProtectedRoute({ children }) {
  const access = localStorage.getItem('access')
  if (!access) return <Navigate to="/Login" replace />
  return children
}

export default ProtectedRoute
