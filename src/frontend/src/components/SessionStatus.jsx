import { useAuth } from '../hooks/useAuth'
import styles from '../pages/Auth.module.css'

export default function SessionStatus() {
  const { loading, restoreError, refreshSession, logout } = useAuth()
  return (
    <main className={styles.status} aria-busy={loading}>
      <h1>{loading ? 'Validando sua sessão…' : 'Não foi possível acessar sua conta'}</h1>
      {loading ? (
        <p role="status">Aguarde um instante.</p>
      ) : (
        <>
          <p role="alert">{restoreError}</p>
          <button onClick={refreshSession}>Tentar novamente</button>
          <button className={styles.textButton} onClick={() => logout()}>
            Voltar ao login
          </button>
        </>
      )}
    </main>
  )
}
