import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { getProfile } from '../services/authService'
import { PROFILE_NAMES } from '../utils/profileRoutes'
import styles from './Auth.module.css'

export default function ProfilePage() {
  const { usuario, logout } = useAuth()
  const [error, setError] = useState('')
  const [profile, setProfile] = useState(null)
  const validated = profile !== null

  useEffect(() => {
    let active = true
    getProfile(usuario.perfil)
      .then((data) => { if (active) setProfile(data) })
      .catch(() => {
        if (active) setError('Não foi possível carregar sua conta. Tente novamente.')
      })
    return () => { active = false }
  }, [usuario.id, usuario.perfil])

  return (
    <main className={styles.profile} aria-busy={!validated && !error}>
      <header className={styles.header}>
        <span className={styles.brand}>VolunJá</span>
        <button onClick={() => logout()}>Sair</button>
      </header>
      {usuario.perfil === 'ORGANIZACAO' && (
        <Link to="/organizacao/perfil">Editar perfil institucional</Link>
      )}
      <h1>Área de {PROFILE_NAMES[usuario.perfil]}</h1>
      <p>Olá, {usuario.nome}.</p>
      {usuario.perfil === 'VOLUNTARIO' && profile?.id === usuario.id && (
        <p>Localização: {[profile.cidade, profile.estado].filter(Boolean).join(' / ') || 'Não informada'}</p>
      )}
      {usuario.tipo && (
        <p>Tipo de organização: {usuario.tipo === 'ONG' ? 'ONG' : 'Projeto social'}</p>
      )}
      <nav className={styles.profileNavigation} aria-label="Navegação da conta">
        <Link to="/vagas">Explorar vagas</Link>
        {usuario.perfil === 'ORGANIZACAO' && usuario.tipo === 'ONG' && (
          <Link
            className={styles.primaryLink}
            to="/vagas"
            state={{ abrirPublicacao: true }}
          >
            Publicar vaga
          </Link>
        )}
      </nav>
      {error ? <p role="alert">{error}</p> : (
        <p role="status">{validated ? 'Sua conta está autenticada.' : 'Carregando sua conta…'}</p>
      )}
    </main>
  )
}
