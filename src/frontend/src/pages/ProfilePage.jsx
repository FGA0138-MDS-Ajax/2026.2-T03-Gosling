import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { getProfile } from '../services/authService'
import { PROFILE_NAMES } from '../utils/profileRoutes'
import styles from './Auth.module.css'

export default function ProfilePage() {
  const { usuario, logout } = useAuth()
  const [error, setError] = useState('')
  const [validated, setValidated] = useState(false)

  useEffect(() => {
    let active = true
    getProfile(usuario.perfil)
      .then(() => { if (active) setValidated(true) })
      .catch(() => {
        if (active) setError('Não foi possível carregar sua conta. Tente novamente.')
      })
    return () => { active = false }
  }, [usuario.perfil])

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
      {usuario.tipo && (
        <p>Tipo de organização: {usuario.tipo === 'ONG' ? 'ONG' : 'Projeto social'}</p>
      )}
      {error ? <p role="alert">{error}</p> : (
        <p role="status">{validated ? 'Sua conta está autenticada.' : 'Carregando sua conta…'}</p>
      )}
    </main>
  )
}
