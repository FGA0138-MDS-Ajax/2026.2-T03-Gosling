import { Link, Navigate } from 'react-router-dom'
import SessionStatus from '../components/SessionStatus'
import { useAuth } from '../hooks/useAuth'
import { profileRoute } from '../utils/profileRoutes'
import LoginPage from './LoginPage'
import styles from './Auth.module.css'

export default function AdminLoginPage() {
  const { usuario, loading, restoreError, logout, loginAdmin } = useAuth()
  if (loading || restoreError) return <SessionStatus />
  if (usuario?.perfil === 'ADMINISTRADOR') return <Navigate to="/admin" replace />
  if (usuario) {
    return (
      <main className={styles.status}>
        <span className={styles.brand}>VolunJá</span>
        <h1>Acesso administrativo</h1>
        <p>A conta atual não é administradora. Entre com uma conta de administrador.</p>
        <button type="button" onClick={() => logout()}>Trocar conta</button>
        <p><Link to={profileRoute(usuario.perfil)}>Voltar à minha área</Link></p>
      </main>
    )
  }
  return (
    <LoginPage
      titulo="Acesso administrativo"
      subtitulo="Entre com sua conta de administrador."
      introducaoTitulo="Administração do VolunJá"
      introducaoTexto="Consulte e gerencie os cadastros da plataforma."
      cadastros={[]}
      autenticar={loginAdmin}
    />
  )
}
