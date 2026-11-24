import { useRef, useState } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import SessionStatus from '../components/SessionStatus'
import { useAuth } from '../hooks/useAuth'
import { profileRoute } from '../utils/profileRoutes'
import styles from './Auth.module.css'
import { Header, Icon } from '../components/ui/Layout'
import { designAssets } from '../utils/designAssets'
import layout from './Login.module.css'

export default function LoginPage({
  titulo = 'Entrar no VolunJá',
  subtitulo = 'Use seu e-mail e senha. Você entra direto na área do seu perfil.',
  cadastros,
  autenticar,
}) {
  const { usuario, loading, restoreError, sessionExpired, login } = useAuth()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState({})
  const [error, setError] = useState('')
  const [remember, setRemember] = useState(false)
  const [recovery, setRecovery] = useState(false)
  const pending = useRef(false)
  const emailInput = useRef(null)
  const passwordInput = useRef(null)

  if (loading || restoreError) return <SessionStatus />
  if (usuario) {
    const destino = /^\/vagas(?:\/\d+)?$/.test(location.state?.from ?? '')
      ? location.state.from
      : profileRoute(usuario.perfil)
    return <Navigate to={destino} replace />
  }

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
      await (autenticar ?? login)(email, senha, remember)
    } catch (failure) {
      const status = failure.response?.status
      const messages = {
        401: 'E-mail ou senha inválidos. Confira os dados e tente novamente.',
        403: 'Esta entrada é exclusiva para administradores.',
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
    <div className={layout.page}>
      <Header minimal />
      <Link className={layout.mobileBack} to="/"><Icon group="mobile_login" name="imgIcon3" />Voltar</Link>
      <main className={layout.main}>
        <section className={layout.card}>
          <img className={layout.logo} src={designAssets.login.imgImageVolunJa} width="71" height="56" alt="" />
          <h1>{titulo}</h1>
          <p className={layout.subtitle}>{subtitulo}</p>
          {sessionExpired && (
            <p role="status" className={styles.notice}>
              Sua sessão expirou. Entre novamente.
            </p>
          )}
          <form aria-label="Entrar na conta" noValidate onSubmit={handleSubmit} aria-busy={submitting}>
            <fieldset disabled={submitting}>
              <div className={layout.credentials}>
              <div className={layout.field}>
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
              <div className={layout.field}>
                <label htmlFor="senha">Senha</label>
                <div className={layout.password}>
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
              <button
                className={layout.passwordToggle}
                type="button"
                aria-controls="senha"
                aria-pressed={showPassword}
                aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                onClick={() => setShowPassword(!showPassword)}
              >
                <Icon group="login" name="imgIcon1" />{showPassword ? 'Ocultar' : 'Mostrar'}
              </button>
                </div>
                {errors.senha && <span id="senha-error" className={styles.error}>{errors.senha}</span>}
              </div>
              </div>
              <div className={layout.options}>
                <label><input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} />Manter conectado</label>
                <button type="button" onClick={() => setRecovery(!recovery)}>Esqueceu a senha?</button>
              </div>
              {recovery && <p className={layout.recovery} role="status">A recuperação de senha ainda não está disponível. Procure a administração da plataforma para recuperar seu acesso.</p>}
              {error && <p className={styles.error} role="alert">{error}</p>}
              <button className={layout.submit} type="submit">
                {submitting ? 'Entrando…' : 'Entrar'}
              </button>
            </fieldset>
          </form>
          <div className={layout.separator}>ou</div>
          {cadastros ? cadastros.map(({ pergunta, texto, to }) => (
            <p key={to} className={layout.signup}>
              {pergunta}{' '}
              <Link className={styles.signupLink} to={to}>{texto}</Link>
            </p>
          )) : <p className={layout.signup}>Ainda não tem conta? <Link to="/cadastro" state={location.state}>Criar conta</Link></p>}
          <Link className={layout.explore} to="/vagas">Explorar vagas sem entrar<Icon group="login" name="imgIcon3" /></Link>
        </section>
        {!autenticar && <p className={layout.admin}>Área administrativa? <Link to="/admin/login">Acesse pelo login do administrador</Link></p>}
      </main>
    </div>
  )
}
