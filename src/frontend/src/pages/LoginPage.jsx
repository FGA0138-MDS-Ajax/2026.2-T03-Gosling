import { useRef, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import SessionStatus from '../components/SessionStatus'
import { useAuth } from '../hooks/useAuth'
import { profileRoute } from '../utils/profileRoutes'
import styles from './Auth.module.css'

export default function LoginPage() {
  const { usuario, loading, restoreError, sessionExpired, login } = useAuth()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState({})
  const [error, setError] = useState('')
  const pending = useRef(false)
  const emailInput = useRef(null)
  const passwordInput = useRef(null)

  if (loading || restoreError) return <SessionStatus />
  if (usuario) return <Navigate to={profileRoute(usuario.perfil)} replace />

  async function handleSubmit(event) {
    event.preventDefault()
    if (pending.current) return
    const fields = {}
    if (!email.trim()) fields.email = 'Informe seu e-mail.'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      fields.email = 'Informe um e-mail válido.'
    }
    if (!senha) fields.senha = 'Informe sua senha.'
    setErrors(fields)
    setError('')
    if (Object.keys(fields).length) {
      if (fields.email) emailInput.current.focus()
      else passwordInput.current.focus()
      return
    }
    pending.current = true
    setSubmitting(true)
    try {
      await login(email, senha)
    } catch (failure) {
      const status = failure.response?.status
      const messages = {
        401: 'E-mail ou senha inválidos. Confira os dados e tente novamente.',
        429: 'Muitas tentativas de entrada. Aguarde um pouco e tente novamente.',
        422: 'Confira o e-mail e a senha informados.',
      }
      setError(messages[status] ?? 'Não foi possível entrar. Tente novamente.')
    } finally {
      pending.current = false
      setSubmitting(false)
    }
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link className={styles.brand} to="/">VolunJá</Link>
        <Link to="/">Voltar para o início</Link>
      </header>
      <main className={styles.card}>
        <section className={styles.intro} aria-label="Sobre o VolunJá">
          <h2>Seu tempo pode fazer a diferença.</h2>
          <p>Encontre uma causa para apoiar e as pessoas certas para ajudar sua organização.</p>
          <p className={styles.signature}>Pessoas e causas, mais próximas.</p>
        </section>
        <section className={styles.formPanel}>
          <h1>Entre no VolunJá</h1>
          <p className={styles.subtitle}>Acesse sua conta para continuar.</p>
          {sessionExpired && (
            <p role="status" className={styles.notice}>
              Sua sessão expirou. Entre novamente.
            </p>
          )}
          <form aria-label="Entrar na conta" noValidate onSubmit={handleSubmit} aria-busy={submitting}>
            <fieldset disabled={submitting}>
              <div className={styles.field}>
                <label htmlFor="email">E-mail</label>
                <input
                  ref={emailInput}
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  aria-invalid={Boolean(errors.email)}
                  aria-describedby={errors.email ? 'email-error' : undefined}
                  placeholder="Seu e-mail"
                />
                {errors.email && <span id="email-error" className={styles.error}>{errors.email}</span>}
              </div>
              <div className={styles.field}>
                <label htmlFor="senha">Senha</label>
                <input
                  ref={passwordInput}
                  id="senha"
                  name="senha"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={senha}
                  onChange={(event) => setSenha(event.target.value)}
                  aria-invalid={Boolean(errors.senha)}
                  aria-describedby={errors.senha ? 'senha-error' : undefined}
                  placeholder="Sua senha"
                />
                {errors.senha && <span id="senha-error" className={styles.error}>{errors.senha}</span>}
              </div>
              <button
                className={styles.passwordToggle}
                type="button"
                aria-controls="senha"
                aria-pressed={showPassword}
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? 'Ocultar senha' : 'Mostrar senha'}
              </button>
              {error && <p className={styles.error} role="alert">{error}</p>}
              <button className={styles.submit} type="submit">
                {submitting ? 'Entrando…' : 'Entrar'}
              </button>
            </fieldset>
          </form>
          <p className={styles.signup}>
            Ainda não tem conta?{' '}
            <Link className={styles.signupLink} to="/cadastro/voluntario">
              Cadastre-se como voluntário
            </Link>
          </p>
        </section>
      </main>
      <footer className={styles.footer}>VolunJá · Conectando pessoas e causas</footer>
    </div>
  )
}
