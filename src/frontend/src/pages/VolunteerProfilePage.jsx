import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import PhoneInput from '../components/PhoneInput'
import { useAuth } from '../hooks/useAuth'
import { getVolunteerProfile, updateVolunteerProfile } from '../services/voluntarioService'
import { PHONE_ERROR, PHONE_HINT, phoneDigits, validPhone } from '../utils/accountFields'
import {
  CAUSAS, DIAS, ESTADOS, NOMES_ESTADOS, PERIODOS, formatDisponibilidades, parseDisponibilidades,
} from '../utils/volunteerProfile'
import base from './OrganizationSignup.module.css'
import styles from './VolunteerProfile.module.css'

const CAMPOS_TEXTO = [
  { name: 'nome_completo', label: 'Nome completo', autoComplete: 'name', minLength: 2, maxLength: 150, required: true },
  { name: 'telefone', label: 'Telefone (opcional)', type: 'tel', autoComplete: 'tel', maxLength: 15, hint: PHONE_HINT },
  { name: 'cidade', label: 'Cidade (opcional)', autoComplete: 'address-level2', maxLength: 100 },
]

function valoresIniciais(perfil) {
  return {
    nome_completo: perfil.nome ?? '',
    telefone: perfil.telefone ?? '',
    cidade: perfil.cidade ?? '',
    estado: perfil.estado ?? '',
    biografia: perfil.biografia ?? '',
    causas: perfil.causas ?? [],
    ...parseDisponibilidades(perfil.disponibilidades),
  }
}

function alternar(lista, valor) {
  return lista.includes(valor) ? lista.filter((item) => item !== valor) : [...lista, valor]
}

export default function VolunteerProfilePage() {
  const { updateAccount } = useAuth()
  const aviso = useLocation().state?.aviso
  const [perfil, setPerfil] = useState(null)
  const [values, setValues] = useState(null)
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

  useEffect(() => {
    mounted.current = true
    const controller = new AbortController()
    getVolunteerProfile(controller.signal).then((data) => {
      if (controller.signal.aborted) return
      setPerfil(data)
      setValues(valoresIniciais(data))
      setLoading(false)
    }).catch(() => {
      if (controller.signal.aborted) return
      setLoadError(true)
      setLoading(false)
    })
    return () => { mounted.current = false; controller.abort() }
  }, [attempt])

  useEffect(() => {
    if (!pending && Object.keys(errors).length) {
      formRef.current?.querySelector('[aria-invalid="true"]')?.focus()
    }
  }, [errors, pending])

  function change(name, value) {
    setValues((current) => ({ ...current, [name]: value }))
    setSaved(false)
    setMessage('')
  }

  function validar(payload) {
    const invalid = {}
    if (payload.nome_completo.length < 2) invalid.nome_completo = 'Informe seu nome completo.'
    else if (payload.nome_completo.length > 150) invalid.nome_completo = 'Use até 150 caracteres.'
    if (payload.telefone && !validPhone(payload.telefone)) {
      invalid.telefone = PHONE_ERROR
    }
    if (payload.cidade && payload.cidade.length > 100) invalid.cidade = 'Use até 100 caracteres.'
    if (payload.biografia && payload.biografia.length > 500) invalid.biografia = 'Use até 500 caracteres.'
    const carga = values.cargaHoraria
    if (carga !== '' && (!/^\d+$/.test(String(carga)) || Number(carga) < 1 || Number(carga) > 60)) {
      invalid.cargaHoraria = 'Informe um número de horas entre 1 e 60.'
    }
    return invalid
  }

  async function submit(event) {
    event.preventDefault()
    if (submitting.current) return
    const payload = {
      nome_completo: values.nome_completo.trim(),
      telefone: phoneDigits(values.telefone) || null,
      cidade: values.cidade.trim() || null,
      estado: values.estado || null,
      biografia: values.biografia.trim() || null,
      causas: values.causas,
      disponibilidades: formatDisponibilidades(values),
    }
    const invalid = validar(payload)
    setErrors(invalid)
    setMessage('')
    setSaved(false)
    if (Object.keys(invalid).length) return
    submitting.current = true
    setPending(true)
    try {
      const result = await updateVolunteerProfile(payload)
      if (!mounted.current) return
      setPerfil(result)
      setValues(valoresIniciais(result))
      setSaved(true)
      updateAccount(result)
    } catch (failure) {
      if (!mounted.current) return
      const detail = failure.response?.data?.detail
      if (Array.isArray(detail)) {
        const invalidFields = {}
        for (const issue of detail) {
          const name = issue.loc?.[1]
          if (name) invalidFields[name] = issue.msg
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

  function erro(name) {
    return errors[name] && <span className={base.error} id={`${name}-error`}>{errors[name]}</span>
  }

  return (
    <main className={base.page}>
      <header className={base.header}>
        <Link to="/voluntario">VolunJá</Link>
        <Link to="/voluntario">Voltar para minha área</Link>
      </header>
      <section className={base.card}>
        <h1>Meu perfil de voluntário</h1>
        {aviso && <p role="status" className={styles.note}>{aviso}</p>}
        {loading && <p role="status">Carregando perfil…</p>}
        {loadError && <>
          <p role="alert">Não foi possível carregar o perfil.</p>
          <button type="button" className={base.submit}
            onClick={() => { setLoading(true); setLoadError(false); setAttempt(attempt + 1) }}>
            Tentar novamente
          </button>
        </>}
        {!loading && !loadError && perfil && values && (
          <form ref={formRef} noValidate aria-label="Editar perfil de voluntário" aria-busy={pending} onSubmit={submit}>
            <fieldset disabled={pending}>
              <div className={styles.section}>
                <h2>Dados pessoais</h2>
                <dl className={styles.readonly}>
                  <dt>E-mail</dt><dd>{perfil.email}</dd>
                  <dt>CPF</dt><dd>{perfil.identificacao}</dd>
                </dl>
                <p>E-mail e CPF identificam sua conta e não podem ser alterados aqui.</p>
                <div className={base.grid}>
                  {CAMPOS_TEXTO.map(({ name, label, hint, required, ...props }) => (
                    <div className={base.field} key={name}>
                      <label htmlFor={name}>{label}</label>
                      {name === 'telefone' ? <PhoneInput {...props} id={name} name={name} required={required} value={values[name]}
                        onValueChange={(value) => change(name, value)}
                        aria-invalid={Boolean(errors[name])}
                        aria-describedby={[`${name}-hint`, errors[name] ? `${name}-error` : ''].filter(Boolean).join(' ')} /> :
                      <input {...props} id={name} name={name} required={required} value={values[name]}
                        onChange={(event) => change(name, event.target.value)}
                        aria-invalid={Boolean(errors[name])}
                        aria-describedby={[hint ? `${name}-hint` : '', errors[name] ? `${name}-error` : ''].filter(Boolean).join(' ') || undefined} />}
                      {hint && <small id={`${name}-hint`}>{hint}</small>}
                      {erro(name)}
                    </div>
                  ))}
                  <div className={`${base.field} ${styles.field}`}>
                    <label htmlFor="estado">Estado (opcional)</label>
                    <select id="estado" name="estado" value={values.estado} autoComplete="address-level1"
                      onChange={(event) => change('estado', event.target.value)}
                      aria-invalid={Boolean(errors.estado)}
                      aria-describedby={errors.estado ? 'estado-error' : undefined}>
                      <option value="">Selecione</option>
                      {ESTADOS.map((uf) => <option key={uf} value={uf}>{NOMES_ESTADOS[uf]} ({uf})</option>)}
                    </select>
                    {erro('estado')}
                  </div>
                </div>
                <div className={base.field}>
                  <label htmlFor="biografia">Sobre você (opcional)</label>
                  <textarea id="biografia" name="biografia" rows={4} maxLength={500} value={values.biografia}
                    onChange={(event) => change('biografia', event.target.value)}
                    aria-invalid={Boolean(errors.biografia)}
                    aria-describedby={errors.biografia ? 'biografia-error' : undefined} />
                  {erro('biografia')}
                </div>
              </div>

              <div className={styles.section}>
                <h2>Causas de interesse</h2>
                <fieldset className={styles.options} tabIndex={-1}
                  aria-invalid={Boolean(errors.causas)}
                  aria-describedby={errors.causas ? 'causas-error' : undefined}>
                  <legend>Escolha as causas que você quer apoiar</legend>
                  {CAUSAS.map((causa) => (
                    <label className={styles.option} key={causa}>
                      <input type="checkbox" name="causas" value={causa} checked={values.causas.includes(causa)}
                        onChange={() => change('causas', alternar(values.causas, causa))} />
                      {causa}
                    </label>
                  ))}
                </fieldset>
                {erro('causas')}
              </div>

              <div className={styles.section} aria-labelledby="disponibilidade-titulo" tabIndex={-1}
                aria-invalid={Boolean(errors.disponibilidades)}
                aria-describedby={errors.disponibilidades ? 'disponibilidades-error' : undefined}>
                <h2 id="disponibilidade-titulo">Preferências de disponibilidade</h2>
                <p className={styles.note}>
                  Estas são as suas preferências para receber oportunidades. Elas não são compromissos:
                  os horários das vagas que você aceitar aparecem separadamente no seu calendário.
                </p>
                <fieldset className={styles.options}>
                  <legend>Dias da semana</legend>
                  {DIAS.map(({ value, label }) => (
                    <label className={styles.option} key={value}>
                      <input type="checkbox" name="dias" value={value} checked={values.dias.includes(value)}
                        onChange={() => change('dias', alternar(values.dias, value))} />
                      {label}
                    </label>
                  ))}
                </fieldset>
                <fieldset className={styles.options}>
                  <legend>Períodos</legend>
                  {PERIODOS.map(({ value, label }) => (
                    <label className={styles.option} key={value}>
                      <input type="checkbox" name="periodos" value={value} checked={values.periodos.includes(value)}
                        onChange={() => change('periodos', alternar(values.periodos, value))} />
                      {label}
                    </label>
                  ))}
                </fieldset>
                <div className={base.field}>
                  <label htmlFor="cargaHoraria">Carga horária semanal, em horas (opcional)</label>
                  <input id="cargaHoraria" name="cargaHoraria" type="number" inputMode="numeric" min={1} max={60}
                    value={values.cargaHoraria} onChange={(event) => change('cargaHoraria', event.target.value)}
                    aria-invalid={Boolean(errors.cargaHoraria)}
                    aria-describedby={errors.cargaHoraria ? 'cargaHoraria-error' : undefined} />
                  {erro('cargaHoraria')}
                </div>
                {erro('disponibilidades')}
              </div>

              {message && <p role="alert" className={base.error}>{message}</p>}
              <button type="submit" className={base.submit}>{pending ? 'Salvando…' : 'Salvar alterações'}</button>
            </fieldset>
          </form>
        )}
        {saved && <p role="status">Perfil atualizado com sucesso.</p>}
      </section>
    </main>
  )
}
