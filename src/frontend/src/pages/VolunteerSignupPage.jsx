import { useEffect, useRef, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import PasswordChecklist from '../components/PasswordChecklist'
import PhoneInput from '../components/PhoneInput'
import { useAuth } from '../hooks/useAuth'
import { ESTADOS, NOMES_ESTADOS, validCpf } from '../utils/volunteerProfile'
import { PASSWORD_ERROR, PHONE_ERROR, PHONE_HINT, phoneDigits, validPassword, validPhone } from '../utils/accountFields'
import base from './OrganizationSignup.module.css'
import styles from './VolunteerProfile.module.css'

const CAMPOS = [
  { name: 'nome_completo', label: 'Nome completo', autoComplete: 'name', minLength: 3, maxLength: 150 },
  { name: 'identificacao', label: 'CPF', inputMode: 'numeric', autoComplete: 'off', maxLength: 14, hint: 'Somente os 11 números, com ou sem pontuação.' },
  { name: 'email', label: 'E-mail', type: 'email', autoComplete: 'email', maxLength: 254 },
  { name: 'telefone', label: 'Telefone', type: 'tel', autoComplete: 'tel', maxLength: 15, hint: PHONE_HINT },
  { name: 'cidade', label: 'Cidade', autoComplete: 'address-level2', minLength: 2, maxLength: 100 },
  { name: 'senha', label: 'Senha', type: 'password', autoComplete: 'new-password', minLength: 8, maxLength: 1024 },
]

export default function VolunteerSignupPage() {
  const { usuario, cadastrarVoluntario } = useAuth()
  const [values, setValues] = useState({ consentimento_termos: false })
  const [errors, setErrors] = useState({})
  const [message, setMessage] = useState('')
  const [pending, setPending] = useState(false)
  const submitting = useRef(false)
  const formRef = useRef(null)
  const focusErrors = useRef(false)

  useEffect(() => {
    const first = Object.keys(errors)[0]
    if (!pending && focusErrors.current) {
      formRef.current?.elements.namedItem(first)?.focus()
      focusErrors.current = false
    }
  }, [errors, pending])

  if (usuario) return <Navigate to="/voluntario" replace />

  function change(name, value) {
    setValues((current) => ({ ...current, [name]: value }))
    setErrors((current) => {
      const next = { ...current }
      delete next[name]
      return next
    })
  }

  function validar(dados) {
    const invalid = {}
    for (const { name, minLength, maxLength } of CAMPOS) {
      const value = dados[name]
      if (!value) invalid[name] = 'Preencha este campo.'
      else if (minLength && value.length < minLength) invalid[name] = `Use pelo menos ${minLength} caracteres.`
      else if (maxLength && value.length > maxLength) invalid[name] = `Use até ${maxLength} caracteres.`
    }
    if (dados.identificacao && !validCpf(dados.identificacao)) invalid.identificacao = 'Informe um CPF válido.'
    if (dados.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(dados.email)) invalid.email = 'Informe um e-mail válido.'
    if (dados.telefone && !validPhone(dados.telefone)) invalid.telefone = PHONE_ERROR
    if (dados.senha && !validPassword(dados.senha)) invalid.senha = PASSWORD_ERROR
    if (!dados.estado) invalid.estado = 'Selecione o estado.'
    if (!dados.consentimento_termos) invalid.consentimento_termos = 'Confirme o consentimento para continuar.'
    return invalid
  }

  async function submit(event) {
    event.preventDefault()
    if (submitting.current) return
    const dados = {
      nome_completo: (values.nome_completo ?? '').trim(),
      identificacao: (values.identificacao ?? '').replace(/[.\- ]/g, ''),
      email: (values.email ?? '').trim().toLowerCase(),
      telefone: phoneDigits(values.telefone),
      cidade: (values.cidade ?? '').trim(),
      estado: values.estado ?? '',
      senha: values.senha ?? '',
      consentimento_termos: Boolean(values.consentimento_termos),
    }
    const invalid = validar(dados)
    focusErrors.current = Object.keys(invalid).length > 0
    setErrors(invalid)
    setMessage('')
    if (Object.keys(invalid).length) return

    submitting.current = true
    setPending(true)
    try {
      await cadastrarVoluntario({
        nome_completo: dados.nome_completo,
        email: dados.email,
        identificacao: dados.identificacao,
        password: dados.senha,
        telefone: dados.telefone,
        cidade: dados.cidade,
        estado: dados.estado,
        consentimento_termos: true,
      })
    } catch (failure) {
      submitting.current = false
      setPending(false)
      const status = failure.response?.status
      const detail = failure.response?.data?.detail
      if (status === 409) {
        setMessage(typeof detail === 'string' ? detail : 'Já existe uma conta com este e-mail ou CPF.')
      } else if (Array.isArray(detail)) {
        const nomes = { password: 'senha' }
        const serverErrors = {}
        for (const issue of detail) {
          const name = nomes[issue.loc?.[1]] ?? issue.loc?.[1]
          if (name) serverErrors[name] = issue.msg
        }
        focusErrors.current = true
        setErrors(serverErrors)
        setMessage('Confira os campos indicados e tente novamente.')
      } else {
        setMessage(typeof detail === 'string' ? detail : 'Não foi possível concluir o cadastro. Tente novamente.')
      }
    }
  }

  function descricao(name, hint) {
    return [hint ? `${name}-hint` : '', errors[name] ? `${name}-error` : ''].filter(Boolean).join(' ') || undefined
  }

  function campo({ name, label, hint, ...props }) {
    return (
      <div className={base.field} key={name}>
        <label htmlFor={name}>{label}</label>
        {name === 'telefone' ? <PhoneInput {...props} id={name} name={name} required value={values[name] ?? ''}
          onValueChange={(value) => change(name, value)}
          aria-invalid={Boolean(errors[name])} aria-describedby={descricao(name, hint)} /> :
        <input {...props} id={name} name={name} required value={values[name] ?? ''}
          onChange={(event) => change(name, event.target.value)}
          aria-invalid={Boolean(errors[name])} aria-describedby={[descricao(name, hint), name === 'senha' ? 'senha-requisitos' : ''].filter(Boolean).join(' ') || undefined} />}
        {hint && <small id={`${name}-hint`}>{hint}</small>}
        {name === 'senha' && <PasswordChecklist id="senha-requisitos" value={values.senha ?? ''} />}
        {errors[name] && <span className={base.error} id={`${name}-error`}>{errors[name]}</span>}
      </div>
    )
  }

  return (
    <main className={base.page}>
      <header className={base.header}>
        <Link to="/">VolunJá</Link>
        <Link to="/login">Entrar na minha conta</Link>
      </header>
      <section className={base.card}>
        <h1>Cadastro de voluntário</h1>
        <p>Crie sua conta para encontrar oportunidades de voluntariado perto de você.</p>
        <p>Todos os campos são obrigatórios.</p>
        <form ref={formRef} noValidate onSubmit={submit} aria-label="Cadastrar voluntário" aria-busy={pending}>
          <fieldset disabled={pending}>
            <legend>Dados pessoais, localização e acesso</legend>
            <div className={base.grid}>
              {CAMPOS.filter(({ name }) => name !== 'senha').map(campo)}
              <div className={`${base.field} ${styles.field}`}>
                <label htmlFor="estado">Estado</label>
                <select id="estado" name="estado" required value={values.estado ?? ''} autoComplete="address-level1"
                  onChange={(event) => change('estado', event.target.value)}
                  aria-invalid={Boolean(errors.estado)} aria-describedby={descricao('estado')}>
                  <option value="">Selecione</option>
                  {ESTADOS.map((uf) => <option key={uf} value={uf}>{NOMES_ESTADOS[uf]} ({uf})</option>)}
                </select>
                {errors.estado && <span className={base.error} id="estado-error">{errors.estado}</span>}
              </div>
              {CAMPOS.filter(({ name }) => name === 'senha').map(campo)}
            </div>
            <label className={base.consent}>
              <input type="checkbox" name="consentimento_termos" required checked={Boolean(values.consentimento_termos)}
                onChange={(event) => change('consentimento_termos', event.target.checked)}
                aria-invalid={Boolean(errors.consentimento_termos)}
                aria-describedby={errors.consentimento_termos ? 'consentimento_termos-error' : undefined} />
              Concordo com o uso dos meus dados para criar e manter minha conta de voluntário no VolunJá.
            </label>
            {errors.consentimento_termos && (
              <p className={base.error} id="consentimento_termos-error">{errors.consentimento_termos}</p>
            )}
            {message && <p role="alert" className={base.error}>{message}</p>}
            <button className={base.submit} type="submit">{pending ? 'Cadastrando…' : 'Criar conta de voluntário'}</button>
            {pending && <p role="status">Enviando cadastro…</p>}
          </fieldset>
        </form>
      </section>
    </main>
  )
}
