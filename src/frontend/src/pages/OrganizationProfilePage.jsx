import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { getOrganization, updateOrganization } from '../services/organizationService'
import { organizationFields, validCnpj } from '../utils/organizationFields'
import styles from './OrganizationSignup.module.css'

const fields = organizationFields.filter((field) => field.name !== 'senha')

export default function OrganizationProfilePage() {
  const [organization, setOrganization] = useState(null)
  const [values, setValues] = useState({})
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [pending, setPending] = useState(false)
  const [errors, setErrors] = useState({})
  const [message, setMessage] = useState('')
  const [saved, setSaved] = useState(false)
  const formRef = useRef(null)
  const submitting = useRef(false)
  const mounted = useRef(false)
  const { updateAccount } = useAuth()

  useEffect(() => {
    mounted.current = true
    const controller = new AbortController()
    getOrganization(controller.signal).then((data) => {
      if (controller.signal.aborted) return
      setOrganization(data)
      setValues(data)
      setLoading(false)
    }).catch(() => {
      if (controller.signal.aborted) return
      setLoadError(true)
      setLoading(false)
    })
    return () => { mounted.current = false; controller.abort() }
  }, [attempt])

  useEffect(() => {
    const first = Object.keys(errors)[0]
    if (!pending && first) formRef.current?.elements.namedItem(first)?.focus()
  }, [errors, pending])

  function change(name, value) {
    setValues((current) => ({ ...current, [name]: value }))
    setSaved(false)
    setMessage('')
  }

  async function submit(event) {
    event.preventDefault()
    if (submitting.current) return
    const payload = Object.fromEntries(fields.map(({ name }) => [name, (values[name] ?? '').trim()]))
    payload.cnpj = payload.cnpj.toUpperCase().replace(/[./-]/g, '')
    payload.telefone = payload.telefone.replace(/[()+\- ]/g, '')
    payload.email = payload.email.toLowerCase()
    payload.descricao = (values.descricao ?? '').trim()
    const invalid = {}
    for (const field of fields) {
      const value = payload[field.name]
      const optional = organization.tipo !== 'ONG' && ['cnpj', 'razao_social'].includes(field.name)
      if (!value && optional) continue
      if (!value) invalid[field.name] = 'Preencha este campo.'
      else if (field.minLength && value.length < field.minLength) invalid[field.name] = `Use pelo menos ${field.minLength} caracteres.`
      else if (field.maxLength && value.length > field.maxLength) invalid[field.name] = `Use até ${field.maxLength} caracteres.`
    }
    if (payload.cnpj && !validCnpj(payload.cnpj)) invalid.cnpj = 'Informe um CNPJ válido.'
    if (payload.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) invalid.email = 'Informe um e-mail válido.'
    if (payload.telefone && !/^[0-9]{10,15}$/.test(payload.telefone)) invalid.telefone = 'Informe de 10 a 15 dígitos, incluindo DDD.'
    if (payload.descricao.length > 5000) invalid.descricao = 'Use até 5000 caracteres.'
    setErrors(invalid)
    setMessage('')
    setSaved(false)
    if (Object.keys(invalid).length) return
    payload.cnpj = payload.cnpj || null
    payload.razao_social = payload.razao_social || null
    submitting.current = true
    setPending(true)
    try {
      const result = await updateOrganization(payload)
      if (!mounted.current) return
      setOrganization(result)
      setValues(result)
      setSaved(true)
      updateAccount(result)
    } catch (failure) {
      if (!mounted.current) return
      const detail = failure.response?.data?.detail
      if (Array.isArray(detail)) {
        const invalidFields = {}
        for (const issue of detail) {
          const name = issue.loc?.[1]
          if (fields.some((field) => field.name === name) || name === 'descricao') invalidFields[name] = issue.msg
        }
        setErrors(invalidFields)
        setMessage('Confira os campos indicados e tente novamente.')
      } else {
        setMessage(typeof detail === 'string' ? detail : 'Não foi possível salvar o perfil. Tente novamente.')
      }
    } finally {
      submitting.current = false
      if (mounted.current) setPending(false)
    }
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link to="/organizacao">VolunJá</Link>
        <Link to="/organizacao">Voltar para minha área</Link>
      </header>
      <section className={styles.card}>
        <h1>Perfil institucional</h1>
        {loading && <p role="status">Carregando perfil…</p>}
        {loadError && <>
          <p role="alert">Não foi possível carregar o perfil.</p>
          <button type="button" className={styles.submit} onClick={() => { setLoading(true); setLoadError(false); setAttempt(attempt + 1) }}>Tentar novamente</button>
        </>}
        {!loading && !loadError && organization && <>
          <dl>
            <dt>Tipo de organização</dt>
            <dd>{organization.tipo === 'ONG' ? 'ONG' : 'Projeto social'}</dd>
            <dt>Homologação</dt>
            <dd>{organization.homologada ? 'Homologada' : 'Pendente'}</dd>
          </dl>
          <p>Tipo de organização e homologação são definidos pelo sistema.</p>
          <form ref={formRef} noValidate aria-label="Editar perfil institucional" aria-busy={pending} onSubmit={submit}>
            <fieldset disabled={pending}>
              <legend>Dados institucionais e contatos</legend>
              <div className={styles.grid}>
                {fields.map(({ name, label, hint, ...props }) => {
                  const required = organization.tipo === 'ONG' || !['cnpj', 'razao_social'].includes(name)
                  return <div className={styles.field} key={name}>
                    <label htmlFor={name}>{label}{!required && ' (opcional)'}</label>
                    <input {...props} id={name} name={name} required={required} value={values[name] ?? ''}
                      onChange={(event) => change(name, event.target.value)} aria-invalid={Boolean(errors[name])}
                      aria-describedby={[hint ? `${name}-hint` : '', errors[name] ? `${name}-error` : ''].filter(Boolean).join(' ') || undefined} />
                    {hint && <small id={`${name}-hint`}>{hint}</small>}
                    {errors[name] && <span className={styles.error} id={`${name}-error`}>{errors[name]}</span>}
                  </div>
                })}
              </div>
              <div className={styles.field}>
                <label htmlFor="descricao">Descrição (opcional)</label>
                <textarea id="descricao" name="descricao" rows={4} maxLength={5000} value={values.descricao ?? ''}
                  onChange={(event) => change('descricao', event.target.value)} aria-invalid={Boolean(errors.descricao)}
                  aria-describedby={errors.descricao ? 'descricao-error' : undefined} />
                {errors.descricao && <span className={styles.error} id="descricao-error">{errors.descricao}</span>}
              </div>
              {message && <p role="alert" className={styles.error}>{message}</p>}
              <button type="submit" className={styles.submit}>{pending ? 'Salvando…' : 'Salvar alterações'}</button>
            </fieldset>
          </form>
          {saved && <p role="status">Perfil atualizado com sucesso.</p>}
          {pending && <p role="status">Salvando perfil…</p>}
        </>}
      </section>
    </main>
  )
}
