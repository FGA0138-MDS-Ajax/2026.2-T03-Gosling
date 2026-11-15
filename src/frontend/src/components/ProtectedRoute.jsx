import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { profileRoute } from '../utils/profileRoutes'
import SessionStatus from './SessionStatus'

export default function ProtectedRoute({ perfil, loginPath = '/login' }) {
  const { usuario, loading, restoreError } = useAuth()
  if (loading || restoreError) return <SessionStatus />
  if (!usuario) return <Navigate to={loginPath} replace />
  if (usuario.perfil !== perfil) {
    return <Navigate to={loginPath === '/login' ? profileRoute(usuario.perfil) : loginPath} replace />
  }
  return <Outlet />
}
