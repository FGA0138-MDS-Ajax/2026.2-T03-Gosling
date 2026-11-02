import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { profileRoute } from '../utils/profileRoutes'
import SessionStatus from './SessionStatus'

export default function ProtectedRoute({ perfil }) {
  const { usuario, loading, restoreError } = useAuth()
  if (loading || restoreError) return <SessionStatus />
  if (!usuario) return <Navigate to="/login" replace />
  if (usuario.perfil !== perfil) {
    return <Navigate to={profileRoute(usuario.perfil)} replace />
  }
  return <Outlet />
}
