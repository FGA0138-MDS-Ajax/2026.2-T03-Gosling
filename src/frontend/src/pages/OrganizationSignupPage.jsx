import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { registerOrganization } from '../services/organizationService'
import styles from './OrganizationSignup.module.css'

const fields = [
  { name: 'nome', label: 'Nome da organização', minLength: 3, maxLength: 150 },
  { name: 'razao_social', label: 'Razão social', minLength: 3, maxLength: 200 },
  { name: 'cnpj', label: 'CNPJ', maxLength: 18, hint: 'Informe os 14 caracteres, com ou sem pontuação.' },
  { name: 'area_atuacao', label: 'Área de atuação', minLength: 3, maxLength: 150 },
  { name: 'endereco', label: 'Endereço', minLength: 5, maxLength: 500 },
  { name: 'responsavel', label: 'Responsável', minLength: 3, maxLength: 150 },
  { name: 'email', label: 'E-mail', type: 'email', autoComplete: 'email', maxLength: 254 },
  { name: 'telefone', label: 'Telefone', type: 'tel', autoComplete: 'tel', hint: 'Inclua DDD e, se necessário, código do país.' },
  { name: 'senha', label: 'Senha', type: 'password', autoComplete: 'new-password', minLength: 8, maxLength: 1024 },
]

function validCnpj(value) {
  if (!/^[A-Z0-9]{12}[0-9]{2}$/.test(value) || /^(.)\1+$/.test(value)) return false
  let base = value.slice(0, 12)
  for (const weights of [[5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2], [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]]) {
    const sum = weights.reduce((total, weight, index) => total + (base.charCodeAt(index) - 48) * weight, 0)
    const remainder = sum % 11
    base += remainder < 2 ? '0' : String(11 - remainder)
  }
  return base === value
}

export default function OrganizationSignupPage() {
  const [values, setValues] = useState({})
  const [errors, setErrors] = useState({})
  const [message, setMessage] = useState('')
  const [pending, setPending] = useState(false)
  const [created, setCreated] = useState(null)
  const submitting = useRef(false)
  const formRef = useRef(null)

  useEffect(() => {
    const firstError = Object.keys(errors)[0]
    if (!pending && firstError) formRef.current?.elements.namedItem(firstError)?.focus()
  }, [errors, pending])

  async function submit(event) {
    event.preventDefault()
    if (submitting.current) return
    const payload = Object.fromEntries(fields.map(({ name }) => [name, name === 'senha' ? values[name] ?? '' : (values[name] ?? '').trim()]))
    payload.cnpj = payload.cnpj.toUpperCase().replace(/[./-]/g, '')
    payload.telefone = payload.telefone.replace(/[()+\- ]/g, '')
    payload.email = payload.email.toLowerCase()
    payload.descricao = (values.descricao ?? '').trim()
    payload.consentimento_termos = Boolean(values.consentimento_termos)
    const invalid = {}
    for (const field of fields) {
      const value = payload[field.name]
      if (!value) invalid[field.name] = 'Preencha este campo.'
      else if (field.minLength && value.length < field.minLength) invalid[field.name] = `Use pelo menos ${field.minLength} caracteres.`
      else if (field.maxLength && value.length > field.maxLength) invalid[field.name] = `Use até ${field.maxLength} caracteres.`
    }
    if (payload.cnpj && !validCnpj(payload.cnpj)) invalid.cnpj = 'Informe um CNPJ válido.'
    if (payload.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) invalid.email = 'Informe um e-mail válido.'
    if (payload.telefone && !/^[0-9]{10,15}$/.test(payload.telefone)) invalid.telefone = 'Informe de 10 a 15 dígitos, incluindo DDD.'
    if (!payload.consentimento_termos) invalid.consentimento_termos = 'Confirme o consentimento para continuar.'
    if (payload.descricao.length > 5000) invalid.descricao = 'Use até 5000 caracteres.'
    setErrors(invalid)
    setMessage('')
    if (Object.keys(invalid).length) {
      return
    }
    submitting.current = true
    setPending(true)
    try {
      const result = await registerOrganization(payload)
      setValues({})
      setCreated(result)
    } catch (failure) {
      const detail = failure.response?.data?.detail
      if (Array.isArray(detail)) {
        const serverErrors = {}
        for (const issue of detail) {
          const name = issue.loc?.[1]
          if (fields.some((field) => field.name === name) || ['descricao', 'consentimento_termos'].includes(name)) serverErrors[name] = issue.msg
        }
        setErrors(serverErrors)
        setMessage('Confira os campos indicados e tente novamente.')
      } else {
        setMessage(typeof detail === 'string' ? detail : 'Não foi possível concluir o cadastro. Tente novamente.')
      }
    } finally {
      submitting.current = false
      setPending(false)
    }
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link to="/">VolunJá</Link>
        <Link to="/login">Entrar na minha conta</Link>
      </header>
      {created ? (
        <section className={styles.card}>
          <h1>Cadastro concluído</h1>
          <p role="status">{created.homologada ? 'Sua organização foi aprovada automaticamente. Você já pode entrar na sua conta.' : 'Seu cadastro foi recebido e aguarda homologação.'}</p>
          <Link to="/login">Ir para o login</Link>
        </section>
      ) : (
        <section className={styles.card}>
          <h1>Cadastro de organização</h1>
          <p>Cadastre sua ONG para conectar sua causa a pessoas dispostas a ajudar.</p>
          <p>Todos os campos são obrigatórios, exceto a descrição.</p>
          <form ref={formRef} noValidate onSubmit={submit} aria-label="Cadastrar organização" aria-busy={pending}>
            <fieldset disabled={pending}>
              <legend>Dados institucionais e acesso</legend>
              <div className={styles.grid}>
                {fields.map(({ name, label, hint, ...inputProps }) => (
                  <div className={styles.field} key={name}>
                    <label htmlFor={name}>{label}</label>
                    <input {...inputProps} id={name} name={name} required value={values[name] ?? ''}
                      onChange={(event) => setValues({ ...values, [name]: event.target.value })}
                      aria-invalid={Boolean(errors[name])}
                      aria-describedby={[hint ? `${name}-hint` : '', errors[name] ? `${name}-error` : ''].filter(Boolean).join(' ') || undefined} />
                    {hint && <small id={`${name}-hint`}>{hint}</small>}
                    {errors[name] && <span className={styles.error} id={`${name}-error`}>{errors[name]}</span>}
                  </div>
                ))}
              </div>
              <div className={styles.field}>
                <label htmlFor="descricao">Descrição (opcional)</label>
                <textarea id="descricao" name="descricao" maxLength={5000} rows={4} value={values.descricao ?? ''}
                  onChange={(event) => setValues({ ...values, descricao: event.target.value })}
                  aria-invalid={Boolean(errors.descricao)} aria-describedby={errors.descricao ? 'descricao-error' : undefined} />
                {errors.descricao && <span className={styles.error} id="descricao-error">{errors.descricao}</span>}
              </div>
              <label className={styles.consent}>
                <input type="checkbox" name="consentimento_termos" required checked={Boolean(values.consentimento_termos)}
                  onChange={(event) => setValues({ ...values, consentimento_termos: event.target.checked })}
                  aria-invalid={Boolean(errors.consentimento_termos)} aria-describedby={errors.consentimento_termos ? 'consentimento-error' : undefined} />
                Concordo com o uso dos dados informados para criar e manter a conta da organização no VolunJá.
              </label>
              {errors.consentimento_termos && <p className={styles.error} id="consentimento-error">{errors.consentimento_termos}</p>}
              {message && <p role="alert" className={styles.error}>{message}</p>}
              <button className={styles.submit} type="submit">{pending ? 'Cadastrando…' : 'Cadastrar organização'}</button>
              {pending && <p role="status">Enviando cadastro…</p>}
            </fieldset>
          </form>
        </section>
      )}
    </main>
  )
}
