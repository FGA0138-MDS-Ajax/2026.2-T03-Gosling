import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import PasswordChecklist from '../components/PasswordChecklist'
import PhoneInput from '../components/PhoneInput'
import { Availability, Interests } from '../components/VolunteerPreferences'
import { Header, Icon } from '../components/ui/Layout'
import { useAuth } from '../hooks/useAuth'
import { useCausas } from '../hooks/useCausas'
import { ESTADOS, NOMES_ESTADOS, maskCpf, validCpf } from '../utils/volunteerProfile'
import { PASSWORD_ERROR, PHONE_ERROR, PHONE_HINT, phoneDigits, validPassword, validPhone } from '../utils/accountFields'
import { designAssets } from '../utils/designAssets'
import s from './VolunteerSignup.module.css'

const empty = { nome_completo: '', email: '', identificacao: '', telefone: '', cidade: '', estado: '', senha: '', consentimento_termos: false, causa_ids: [], disponibilidade_semanal: [], carga_horaria_semanal: null }

export default function VolunteerSignupPage() {
  const { usuario, cadastrarVoluntario } = useAuth()
  const catalogo = useCausas()
  const location = useLocation()
  const [values, setValues] = useState(empty)
  const [step, setStep] = useState(1)
  const [errors, setErrors] = useState({})
  const [message, setMessage] = useState('')
  const [pending, setPending] = useState(false)
  const [show, setShow] = useState(false)
  const [policy, setPolicy] = useState(false)
  const submitting = useRef(false)
  const form = useRef(null)
  const title = useRef(null)
  useEffect(() => { if (Object.keys(errors).length) form.current?.querySelector('[aria-invalid="true"]')?.focus() }, [errors])
  useEffect(() => { if (step > 1) title.current?.focus() }, [step])
  if (usuario) return <Navigate to={/^\/vagas\/\d+$/.test(location.state?.from || '') ? location.state.from : '/voluntario'} replace />

  function change(name, value) {
    setValues(v => ({ ...v, [name]: value }))
    setErrors(v => { const next = { ...v }; delete next[name]; return next })
  }
  function validate() {
    const invalid = {}
    if (values.nome_completo.trim().length < 3) invalid.nome_completo = 'Informe seu nome completo.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) invalid.email = 'Informe um e-mail válido.'
    if (!validCpf(values.identificacao.replace(/\D/g, ''))) invalid.identificacao = 'Informe um CPF válido.'
    if (!validPhone(values.telefone)) invalid.telefone = PHONE_ERROR
    if (values.cidade.trim().length < 2) invalid.cidade = 'Informe sua cidade.'
    if (!values.estado) invalid.estado = 'Selecione o estado.'
    if (!validPassword(values.senha)) invalid.senha = PASSWORD_ERROR
    if (!values.consentimento_termos) invalid.consentimento_termos = 'Confirme o consentimento para continuar.'
    return invalid
  }
  async function submit(e) {
    e.preventDefault()
    if (submitting.current) return
    setMessage('')
    const invalid = validate()
    if (Object.keys(invalid).length) { setStep(1); setErrors(invalid); return }
    if (step < 3) { setStep(step + 1); return }
    submitting.current = true
    setPending(true)
    try {
      const { senha, ...fields } = values
      await cadastrarVoluntario({ ...fields, nome_completo: values.nome_completo.trim(), email: values.email.trim().toLowerCase(),
        identificacao: values.identificacao.replace(/\D/g, ''), telefone: phoneDigits(values.telefone), cidade: values.cidade.trim(), password: senha })
    } catch (failure) {
      const detail = failure.response?.data?.detail
      if (Array.isArray(detail)) {
        const invalid = {}
        for (const issue of detail) { const name = issue.loc?.[1]; if (name) invalid[name === 'password' ? 'senha' : name] = issue.msg }
        setStep(invalid.causa_ids || invalid.causas ? 2 : Object.keys(invalid).some(k => k in empty && !['causa_ids', 'disponibilidade_semanal', 'carga_horaria_semanal'].includes(k)) ? 1 : 3)
        setErrors(invalid)
        setMessage('Confira os campos indicados e tente novamente.')
      } else {
        if (failure.response?.status === 409) setStep(1)
        setMessage(typeof detail === 'string' ? detail : 'Não foi possível concluir o cadastro. Tente novamente.')
      }
    } finally { submitting.current = false; setPending(false) }
  }
  function attrs(name) {
    return { id: name, name, value: values[name], onChange: e => change(name, e.target.value),
      'aria-invalid': Boolean(errors[name]), 'aria-describedby': errors[name] ? name + '-error' : undefined }
  }
  const error = name => errors[name] && <span className={s.error} id={name + '-error'}>{errors[name]}</span>
  return <div className={s.page}>
    <Header><ol className={s.steps} aria-label="Etapas do cadastro">{['Seus dados', 'Interesses', 'Disponibilidade'].map((label, i) =>
      <li aria-current={step === i + 1 ? 'step' : undefined} key={label}><span>{i + 1}</span>{label}</li>)}</ol>
      <span className={s.login}>Já tem conta? <Link to="/login" state={location.state}>Entrar</Link></span></Header>
    <main className={s.main}>
      <section className={s.card}>
        <p className={s.eyebrow}>Etapa {step} de 3</p>
        <h1 ref={title} tabIndex={-1}>{step === 1 ? 'Crie sua conta de voluntário' : step === 2 ? 'O que move você?' : 'Quando você pode ajudar?'}</h1>
        <p className={s.subtitle}>{step === 1 ? 'Leva menos de dois minutos. Interesses e horários vêm nas próximas etapas.' : step === 2 ? 'Escolha as causas com que você se identifica. Você pode mudar depois.' : 'Selecione dias e turnos. Estas preferências não reservam compromissos na sua agenda.'}</p>
        <form ref={form} noValidate aria-label="Cadastrar voluntário" aria-busy={pending} onSubmit={submit}>
          <fieldset disabled={pending}>
            {step === 1 && <div className={s.fields}>
              <div className={s.field}><label htmlFor="nome_completo">Nome completo</label><input {...attrs('nome_completo')} autoComplete="name" maxLength={150} required placeholder="Seu nome completo" />{error('nome_completo')}</div>
              <div className={s.field}><label htmlFor="email">E-mail</label><input {...attrs('email')} type="email" autoComplete="email" maxLength={254} required placeholder="voce@email.com" />{error('email')}</div>
              <div className={s.two}>
                <div className={s.field}><label htmlFor="identificacao">CPF</label><input {...attrs('identificacao')} onChange={e => change('identificacao', maskCpf(e.target.value))} inputMode="numeric" autoComplete="off" maxLength={14} required placeholder="000.000.000-00" />{error('identificacao')}</div>
                <div className={s.field}><label htmlFor="telefone">Telefone</label><div className={s.phone}><span>BR +55</span><PhoneInput id="telefone" name="telefone" required value={values.telefone} onValueChange={v => change('telefone', v)} aria-invalid={Boolean(errors.telefone)} aria-describedby={errors.telefone ? 'telefone-error' : 'telefone-hint'} /></div><small id="telefone-hint">{PHONE_HINT}</small>{error('telefone')}</div>
              </div>
              <div className={s.field}><label htmlFor="cidade">Onde você mora</label><div className={s.location}>
                <input {...attrs('cidade')} aria-label="Cidade" autoComplete="address-level2" maxLength={100} placeholder="Sua cidade" required />
                <select {...attrs('estado')} aria-label="Estado" autoComplete="address-level1" required><option value="">UF</option>{ESTADOS.map(uf => <option value={uf} key={uf}>{NOMES_ESTADOS[uf]} ({uf})</option>)}</select>
              </div>{error('cidade')}{error('estado')}<small>Usamos para mostrar vagas perto de você. Não aparece no seu perfil público.</small></div>
              <div className={s.field}><label htmlFor="senha">Senha</label><div className={s.password}><input {...attrs('senha')} type={show ? 'text' : 'password'} autoComplete="new-password" maxLength={1024} required aria-describedby={errors.senha ? 'senha-requisitos senha-error' : 'senha-requisitos'} />
                <button type="button" aria-pressed={show} aria-label={show ? 'Ocultar senha' : 'Mostrar senha'} onClick={() => setShow(!show)}><Icon group="cadastro" name="imgIcon1" />{show ? 'Ocultar' : 'Mostrar'}</button>
              </div><PasswordChecklist value={values.senha} id="senha-requisitos" />{error('senha')}</div>
              <div><label className={s.consent}><input type="checkbox" name="consentimento_termos" required checked={values.consentimento_termos} onChange={e => change('consentimento_termos', e.target.checked)} aria-invalid={Boolean(errors.consentimento_termos)} aria-describedby={errors.consentimento_termos ? 'consentimento_termos-error' : undefined} /><span>Li e aceito os <button type="button" onClick={() => setPolicy(!policy)}>Termos de uso</button> e a <button type="button" onClick={() => setPolicy(!policy)}>Política de privacidade</button>.</span></label>{error('consentimento_termos')}
                {policy && <p className={s.policy} role="status">Os dados informados serão usados para criar e manter sua conta, apresentar oportunidades e registrar suas preferências. Seus contatos e seu CPF ficam reservados à sua conta; contatos são compartilhados com a organização somente após o aceite de uma candidatura. Você pode atualizar seu perfil ou solicitar a exclusão à administração.</p>}</div>
            </div>}
            {step === 2 && <><Interests catalogo={catalogo} value={values.causa_ids} error={errors.causa_ids || errors.causas} onChange={v => change('causa_ids', v)} />
              {(errors.causa_ids || errors.causas) && <p className={s.error} id="causas-error">{errors.causa_ids || errors.causas}</p>}</>}
            {step === 3 && <Availability value={values.disponibilidade_semanal} onChange={v => change('disponibilidade_semanal', v)} hours={values.carga_horaria_semanal} onHoursChange={v => change('carga_horaria_semanal', v)} />}
            {message && <p role="alert" className={s.error}>{message}</p>}
            <div className={s.formFooter}>{step === 1 ? <Link to="/cadastro" state={location.state}><Icon group="cadastro" name="imgIcon5" />Voltar</Link> : <button type="button" className={s.back} onClick={() => setStep(step - 1)}><Icon group="cadastro" name="imgIcon5" />Voltar</button>}
              <button className={s.submit} type="submit">{pending ? 'Cadastrando…' : step === 3 ? 'Criar conta de voluntário' : 'Continuar'}</button></div>
            {pending && <p role="status">Enviando cadastro…</p>}
          </fieldset>
        </form>
      </section>
      <aside className={s.aside}><div className={s.testimonial}><img src={designAssets.cadastro.imgContainer} alt="Voluntária acompanhando a leitura de crianças" />
        <blockquote>“Comecei com duas horas por semana. Hoje é a melhor parte dela.”<cite>Júlia, voluntária no Reforço de leitura · Taguatinga</cite></blockquote></div>
        <div className={s.benefits}>{[['imgIcon6', 'Seus dados protegidos'], ['imgIcon7', 'Agenda sem conflitos'], ['imgIcon8', 'Comprovante de horas']].map(([icon, text]) => <div key={icon}><span><Icon group="cadastro" name={icon} /></span>{text}</div>)}</div>
      </aside>
    </main>
  </div>
}
