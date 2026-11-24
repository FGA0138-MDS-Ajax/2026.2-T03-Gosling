import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import PhoneInput from '../components/PhoneInput'
import { Availability, Interests } from '../components/VolunteerPreferences'
import { BottomNav, Header, Icon } from '../components/ui/Layout'
import { initials } from '../utils/initials'
import Modal from '../components/ui/Modal'
import { useAuth } from '../hooks/useAuth'
import { getVolunteerProfile, updateVolunteerProfile, uploadVolunteerPhoto, removeVolunteerPhoto } from '../services/voluntarioService'
import { PHONE_ERROR, formatPhone, phoneDigits, validPhone } from '../utils/accountFields'
import { ESTADOS, NOMES_ESTADOS, parseDisponibilidades, privateCpf, profileCompletion, weeklyAvailability } from '../utils/volunteerProfile'
import s from './VolunteerAccount.module.css'

const TONES = { 'Dados pessoais': '#0f766e', Interesses: '#ff2d55', Disponibilidade: '#ff9500', 'Senha e segurança': '#8e8e93',
  'Histórico e horas': '#5856d6', Notificações: '#ff3b30', Comprovantes: '#0f766e', 'Privacidade e dados': '#34c759' }
const tile = (label, icon, group = 'perfil') => <span className={s.menuIcon} style={{ background: TONES[label] }}><Icon group={group} name={icon} /></span>

function initialValues(p) {
  return { nome_completo: p.nome || '', telefone: p.telefone || '', cidade: p.cidade || '', estado: p.estado || '', biografia: p.biografia || '',
    causas: p.causas || [], disponibilidade_semanal: weeklyAvailability(p), carga_horaria_semanal: p.carga_horaria_semanal ?? (Number(parseDisponibilidades(p.disponibilidades).cargaHoraria) || null) }
}
export default function VolunteerProfilePage() {
  const { updateAccount, logout } = useAuth()
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
  const [editing, setEditing] = useState(null)
  const [mobileSection, setMobileSection] = useState(null)
  const [notice, setNotice] = useState('')
  const submitting = useRef(false)
  const mounted = useRef(false)
  const photoInput = useRef(null)
  const editor = useRef(null)

  useEffect(() => {
    mounted.current = true
    const controller = new AbortController()
    getVolunteerProfile(controller.signal).then(data => {
      if (controller.signal.aborted) return
      setPerfil(data); setValues(initialValues(data)); setLoading(false)
    }).catch(() => {
      if (!controller.signal.aborted) { setLoadError(true); setLoading(false) }
    })
    return () => { mounted.current = false; controller.abort() }
  }, [attempt])

  useEffect(() => {
    if (!pending && (errors.causas || errors.disponibilidade_semanal)) {
      editor.current?.querySelector('[tabindex="-1"]')?.focus()
    }
  }, [errors, pending])

  const dirty = Boolean(perfil && values && JSON.stringify(values) !== JSON.stringify(initialValues(perfil)))
  function change(name, value) { setValues(v => ({ ...v, [name]: value })); setSaved(false); setMessage(''); setErrors({}) }
  function discard() { setValues(initialValues(perfil)); setErrors({}); setMessage(''); setSaved(false) }
  function validate() {
    const invalid = {}
    if (values.nome_completo.trim().length < 2) invalid.nome_completo = 'Informe seu nome completo.'
    if (values.telefone && !validPhone(values.telefone)) invalid.telefone = PHONE_ERROR
    if (values.cidade.length > 100) invalid.cidade = 'Use até 100 caracteres.'
    if (values.biografia.length > 500) invalid.biografia = 'Use até 500 caracteres.'
    return invalid
  }
  async function save(e) {
    e?.preventDefault()
    if (submitting.current) return
    const invalid = validate()
    setErrors(invalid)
    if (Object.keys(invalid).length) { setEditing(Object.keys(invalid)[0]); return }
    submitting.current = true; setPending(true); setSaved(false); setMessage('')
    const payload = { ...values, nome_completo: values.nome_completo.trim(), telefone: phoneDigits(values.telefone) || null,
      cidade: values.cidade.trim() || null, estado: values.estado || null, biografia: values.biografia.trim() || null }
    try {
      const result = await updateVolunteerProfile(payload)
      if (!mounted.current) return
      setPerfil(result); setValues(initialValues(result)); updateAccount(result); setSaved(true); setEditing(null)
    } catch (failure) {
      if (!mounted.current) return
      const detail = failure.response?.data?.detail
      if (Array.isArray(detail)) {
        const invalid = Object.fromEntries(detail.filter(i => i.loc?.[1]).map(i => [i.loc[1], i.msg]))
        setErrors(invalid)
        const field = Object.keys(invalid).find(name => ['nome_completo','telefone','cidade','estado','biografia'].includes(name))
        if (field) setEditing(field)
        setMessage('Confira os campos indicados e tente novamente.')
      } else setMessage(typeof detail === 'string' ? detail : 'Não foi possível salvar o perfil. Tente novamente.')
    } finally { submitting.current = false; if (mounted.current) setPending(false) }
  }
  async function photo(file, remove = false) {
    if (submitting.current) return
    if (!remove && (!file || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024)) {
      setMessage('Use uma imagem JPG, PNG ou WebP de até 5 MB.'); return
    }
    submitting.current = true; setPending(true); setMessage('')
    try {
      const result = await (remove ? removeVolunteerPhoto() : uploadVolunteerPhoto(file))
      if (mounted.current) { setPerfil(p => ({ ...p, foto_url: result.foto_url })); setSaved(true) }
    } catch { if (mounted.current) setMessage('Não foi possível atualizar a foto. Tente novamente.') }
    finally { submitting.current = false; if (mounted.current) setPending(false) }
  }
  const personName = values?.nome_completo || perfil?.nome || ''
  const avatar = (big = false) => <span className={big ? s.avatar : s.avatarSmall}>{perfil?.foto_url ? <img src={perfil.foto_url} alt="" /> : initials(personName)}</span>
  const sectionTitle = (label, extra) => <div className={s.sectionTitle}><h2>{label}</h2>{extra && <span>{extra}</span>}</div>
  const editLabel = { nome_completo: 'Nome completo', telefone: 'Telefone (opcional)', local: 'Onde mora', cidade: 'Cidade (opcional)', estado: 'Estado (opcional)', biografia: 'Biografia (opcional)' }
  const editTitle = { nome_completo: 'Alterar nome', telefone: 'Alterar telefone', local: 'Onde você mora', cidade: 'Onde você mora', estado: 'Onde você mora', biografia: 'Sobre você' }
  const input = (name, label, type = 'text') => <div className={s.field}><label htmlFor={name}>{label}</label>
    {name === 'telefone' ? <PhoneInput id={name} name={name} value={values[name]} onValueChange={v => change(name,v)} aria-invalid={Boolean(errors[name])} aria-describedby={errors[name] ? name + '-error' : undefined} /> :
    name === 'biografia' ? <textarea id={name} value={values[name]} maxLength={500} onChange={e => change(name,e.target.value)} /> :
    <input autoFocus id={name} type={type} name={name} value={values[name]} maxLength={name === 'nome_completo' ? 150 : 100} onChange={e => change(name,e.target.value)} aria-invalid={Boolean(errors[name])} aria-describedby={errors[name] ? name + '-error' : undefined} />}
    {errors[name] && <span id={name + '-error'} className={s.error}>{errors[name]}</span>}</div>

  return <div className={s.page}><Header />
    <main className={s.main}>
      <aside className={s.sidebar}><div className={s.identity}>{avatar()}<div><strong>{personName || 'Meu perfil'}</strong><small>Voluntário</small></div></div>
        <nav aria-label="Seções do perfil">
          <a href="#dados" className={s.current}>{tile('Dados pessoais', 'imgIcon2')}Dados pessoais</a>
          <a href="#interesses">{tile('Interesses', 'imgIcon3')}Interesses</a><a href="#disponibilidade">{tile('Disponibilidade', 'imgIcon4')}Disponibilidade</a>
          {[['imgIcon5', 'Senha e segurança'], ['imgIcon6', 'Histórico e horas'], ['imgIcon7', 'Notificações']].map(([icon,label]) => <button type="button" key={label} onClick={() => setNotice(label)}>{tile(label, icon)}{label}</button>)}
          <button className={s.logout} type="button" onClick={() => logout()}><Icon name="imgIcon8" />Sair</button>
        </nav>
      </aside>
      <div className={s.content}>
        <h1 className={s.mobileTitle}>Meu perfil</h1>
        {aviso && <p role="status">{aviso}</p>}
        {loading && <p role="status">Carregando perfil…</p>}
        {loadError && <div className={s.empty}><p role="alert">Não foi possível carregar o perfil.</p><button onClick={() => { setLoading(true); setLoadError(false); setAttempt(v => v+1) }}>Tentar novamente</button></div>}
        {perfil && values && <>
          <section className={s.summary} aria-label="Resumo do perfil"><div className={s.photoWrap}>{avatar(true)}<button type="button" onClick={() => photoInput.current.click()} disabled={pending} aria-label="Alterar foto do perfil"><Icon name="imgIcon9" /></button>
            <input ref={photoInput} type="file" accept="image/jpeg,image/png,image/webp" hidden aria-label="Arquivo da foto" onChange={e => { photo(e.target.files[0]); e.target.value = '' }} /></div>
            <div className={s.summaryText}><h1>{personName}</h1><p>{[values.cidade, values.estado].filter(Boolean).join(', ') || 'Localização não informada'}<span> · Voluntário no VolunJá</span></p>
              <div className={s.badges}><span>{values.causas.length} interesses</span><span>{values.disponibilidade_semanal.length} turnos disponíveis</span><span>Perfil {profileCompletion({ ...values, nome: values.nome_completo, identificacao: perfil.identificacao })}% completo</span></div>
            </div><button className={s.publicProfile} type="button" onClick={() => setNotice('Prévia do perfil')}>Ver perfil público</button>
          </section>

          <div className={s.mobileMenu} hidden={Boolean(mobileSection)}>
            <button className={s.mobileIdentity} type="button" onClick={() => setMobileSection('dados')}>Dados pessoais e contato<Icon name="imgIcon10" /></button>
            <div className={s.menuGroup}>{[['interesses','imgIcon4','Interesses',values.causas.length + ' selecionados'], ['disponibilidade','imgIcon5','Disponibilidade',values.disponibilidade_semanal.length + ' turnos'], ['Notificações','imgIcon6','Notificações','']].map(([id,icon,label,extra]) => <button key={id} type="button" onClick={() => ['interesses','disponibilidade'].includes(id) ? setMobileSection(id) : setNotice(label)}>{tile(label, icon, 'mobile_perfil')}<span>{label}</span><small>{extra}</small><Icon group="mobile_perfil" name="imgIcon3" /></button>)}</div>
            <div className={s.menuGroup}>{[['imgIcon7','Histórico e horas'],['imgIcon8','Comprovantes'],['imgIcon9','Senha e segurança'],['imgIcon10','Privacidade e dados']].map(([icon,label]) => <button key={label} type="button" onClick={() => setNotice(label)}>{tile(label, icon, 'mobile_perfil')}{label}<Icon group="mobile_perfil" name="imgIcon3" /></button>)}</div>
            <button className={s.mobileLogout} type="button" onClick={() => logout()}>Sair da conta</button>
          </div>

          {mobileSection && <button className={s.backMobile} type="button" onClick={() => setMobileSection(null)}>‹ Meu perfil</button>}
          <form ref={editor} className={s.editor + ' ' + (mobileSection ? s.mobileOpen : '')} aria-label="Editar perfil de voluntário" onSubmit={save}>
            <fieldset disabled={pending}>
              <section id="dados" className={mobileSection && mobileSection !== 'dados' ? s.hideMobile : ''}>
                {sectionTitle('Dados pessoais')}
                <div className={s.personalRows}>
                  {[['Nome', personName, 'nome_completo'], ['E-mail', perfil.email, 'email'], ['Telefone', formatPhone(values.telefone) || 'Adicionar telefone', 'telefone'], ['CPF', privateCpf(perfil.identificacao), 'cpf'], ['Onde mora', [values.cidade, values.estado].filter(Boolean).join(', ') || 'Adicionar localização', 'local']].map(([label,value,key]) =>
                    <button key={key} type="button" aria-label={`${['email','cpf'].includes(key) ? 'Consultar' : 'Editar'} ${label}: ${value}`} onClick={() => ['email','cpf'].includes(key) ? setNotice(key === 'cpf' ? 'Seu CPF' : 'Seu e-mail') : setEditing(key)}><span>{label}</span><span>{value}</span><Icon name={key === 'cpf' ? 'imgIcon11' : 'imgIcon10'} /></button>)}
                </div>
                <p className={s.hint}>O CPF não pode ser alterado. Fale com o suporte se houver erro.</p>
                <button type="button" className={s.biography} onClick={() => setEditing('biografia')}>{values.biografia ? 'Editar biografia' : 'Adicionar biografia'}</button>
              </section>
              <section id="interesses" className={mobileSection && mobileSection !== 'interesses' ? s.hideMobile : ''}>
                {sectionTitle('Interesses', values.causas.length + ' selecionados')}
                <Interests value={values.causas} error={errors.causas} onChange={v => change('causas',v)} />
                {errors.causas && <p id="causas-error" className={s.error}>{errors.causas}</p>}
              </section>
              <section id="disponibilidade" className={mobileSection && mobileSection !== 'disponibilidade' ? s.hideMobile : ''}>
                {sectionTitle('Disponibilidade', 'Usada para recomendar vagas e filtrar conflitos')}
                <Availability value={values.disponibilidade_semanal} error={errors.disponibilidade_semanal} onChange={v => change('disponibilidade_semanal',v)} hours={values.carga_horaria_semanal} onHoursChange={v => change('carga_horaria_semanal',v)} />
                {errors.disponibilidade_semanal && <p id="disponibilidade_semanal-error" className={s.error}>{errors.disponibilidade_semanal}</p>}
                {errors.carga_horaria_semanal && <p className={s.error}>{errors.carga_horaria_semanal}</p>}
                <p className={s.hint}>Estas preferências não são compromissos. As atividades aceitas aparecem separadamente no seu calendário.</p>
              </section>
              {dirty && <div className={s.saveBar}><Icon name="imgIcon14" /><span>Você alterou seu perfil</span><button type="button" onClick={discard}>Descartar</button><button className={s.save} type="submit">{pending ? 'Salvando…' : 'Salvar alterações'}</button></div>}
            </fieldset>
          </form>
          {perfil.foto_url && <button type="button" className={s.biography} disabled={pending} onClick={() => photo(null,true)}>Remover foto do perfil</button>}
          {saved && <p role="status" className={s.success}>Perfil atualizado com sucesso.</p>}
          {message && <p role="alert" className={s.error}>{message}</p>}
          <Link className={s.area} to="/voluntario">Voltar para minha área</Link>
          {editing && <Modal title={editTitle[editing] || 'Editar dados pessoais'} onClose={() => setEditing(null)}>
            <form noValidate onSubmit={e => { e.preventDefault(); const invalid = validate(); setErrors(invalid); if (!Object.keys(invalid).length) setEditing(null) }}>
              {['local','cidade','estado'].includes(editing) ? <>{input('cidade','Cidade (opcional)')}<div className={s.field}><label htmlFor="estado">Estado (opcional)</label><select id="estado" value={values.estado} onChange={e => change('estado',e.target.value)}><option value="">Não informado</option>{ESTADOS.map(uf => <option key={uf} value={uf}>{NOMES_ESTADOS[uf]} ({uf})</option>)}</select></div></> : input(editing,editLabel[editing] || editing)}
              <p className={s.hint}>Confirme e depois salve as alterações no perfil.</p><button className={s.confirm} type="submit">Confirmar</button>
            </form>
          </Modal>}
          {notice && <Modal title={notice} onClose={() => setNotice('')}>
            {notice === 'Prévia do perfil' ? <div className={s.preview}>{avatar(true)}<h3>{personName}</h3><p>{values.biografia || 'Sem biografia.'}</p><p>{values.causas.join(' · ') || 'Sem interesses informados.'}</p><p className={s.hint}>A prévia não inclui CPF, e-mail, telefone ou localização.</p></div> :
              <p>{notice === 'Seu CPF' ? 'O CPF identifica sua conta e não pode ser editado por aqui. Procure a administração se houver um erro.' : notice === 'Seu e-mail' ? 'O e-mail identifica seu acesso. A alteração com confirmação de endereço ainda não está disponível.' : notice === 'Privacidade e dados' ? 'Seus dados pessoais ficam reservados. Você pode editar suas preferências aqui ou solicitar a exclusão da conta à administração.' : 'Este recurso ainda está em desenvolvimento. Seus dados e preferências continuam disponíveis neste perfil.'}</p>}
          </Modal>}
        </>}
      </div>
    </main><BottomNav />
  </div>
}
