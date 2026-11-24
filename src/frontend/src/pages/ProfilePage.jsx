import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import VagaCard from '../components/VagaCard'
import SavedVagasImport from '../components/SavedVagasImport'
import { BottomNav, Footer, Header } from '../components/ui/Layout'
import { useAuth } from '../hooks/useAuth'
import { useVagas } from '../hooks/useVagas'
import { getProfile } from '../services/authService'
import { designAssets } from '../utils/designAssets'
import { initials } from '../utils/initials'
import { proximoEncontro } from '../utils/ocorrencias'
import { PROFILE_NAMES } from '../utils/profileRoutes'
import { causaCombina, profileCompletion, weeklyAvailability } from '../utils/volunteerProfile'
import s from './Area.module.css'

const hoje = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'long', day: 'numeric', month: 'long' })
const capitalizar = (texto) => texto.charAt(0).toUpperCase() + texto.slice(1)

function useConta(usuario) {
  const [profile, setProfile] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    getProfile(usuario.perfil)
      .then((data) => { if (active) setProfile(data) })
      .catch(() => { if (active) setError('Não foi possível carregar sua conta. Tente novamente.') })
    return () => { active = false }
  }, [usuario.id, usuario.perfil])
  return { profile, error }
}

function Saudacao({ usuario, children }) {
  const [data] = useState(() => capitalizar(hoje.format(new Date())))
  return <div className={s.top}>
    <div>
      <h1 className={s.eyebrow}>Área de {PROFILE_NAMES[usuario.perfil]}</h1>
      <p className={s.greeting}>Olá, {usuario.nome}.</p>
      <p className={s.date}>{data}</p>
    </div>
    <div className={s.topActions}>{children}</div>
  </div>
}

function AreaVoluntario({ usuario, logout }) {
  const { profile, error } = useConta(usuario)
  const { itens, carregando, erro: erroVagas, recarregar } = useVagas(1)
  const [agora] = useState(() => Date.now())
  const validated = profile?.id === usuario.id
  const abertas = itens.filter((vaga) => proximoEncontro(vaga.ocorrencias, agora))
  const combinam = validated ? abertas.filter((vaga) => causaCombina(profile.causa_ids, vaga.causa.id)) : []
  const sugestoes = (combinam.length ? combinam : abertas).slice(0, 3)
  const turnos = validated ? weeklyAvailability(profile).length : 0
  const completo = validated ? profileCompletion({ ...profile, disponibilidade_semanal: weeklyAvailability(profile) }) : 0

  return <>
    <Saudacao usuario={usuario}><Link className={s.secondary} to="/vagas">Explorar vagas</Link></Saudacao>
    <div className={s.bento}>
      <section className={s.next} aria-labelledby="proxima-atividade">
        <img src={designAssets.home.imgHero} alt="" />
        <span className={s.glass}>Próxima atividade</span>
        <div className={s.nextBody}>
          <h2 id="proxima-atividade">Sua próxima atividade aparece aqui</h2>
          <p>Quando uma organização aceitar sua candidatura, a data, o horário e o local ficam neste espaço.</p>
          <div className={s.nextActions}><Link className={s.white} to="/vagas">Encontrar uma vaga</Link><Link className={s.glassButton} to="/voluntario/agenda">Abrir agenda</Link></div>
        </div>
      </section>
      <section className={s.card} aria-labelledby="seu-perfil" aria-busy={!validated && !error}>
        <div className={s.profileHead}>
          <span className={s.avatar}>{validated && profile.foto_url ? <img src={profile.foto_url} alt="" /> : initials(usuario.nome)}</span>
          <div><h2 id="seu-perfil">Seu perfil</h2><p>{usuario.nome}</p></div>
        </div>
        {error ? <p role="alert" className={s.error}>{error}</p> : !validated ? <p role="status" className={s.muted}>Carregando sua conta…</p> : <>
          <p className={s.muted}>Localização: {[profile.cidade, profile.estado].filter(Boolean).join(' / ') || 'Não informada'}</p>
          <div className={s.progress}>
            <div><span>{completo}% completo</span><span>{completo < 100 ? 'Complete para receber sugestões melhores' : 'Tudo certo'}</span></div>
            <div className={s.bar} role="progressbar" aria-label="Preenchimento do perfil" aria-valuenow={completo} aria-valuemin="0" aria-valuemax="100"><i style={{ width: `${completo}%` }} /></div>
          </div>
          <div className={s.badges}><span>{profile.causas?.length || 0} interesses</span><span>{turnos} {turnos === 1 ? 'turno' : 'turnos'} disponíveis</span></div>
        </>}
        <div className={s.cardActions}><Link className={s.primary} to="/voluntario/perfil">Editar meu perfil</Link><button type="button" className={s.ghost} onClick={() => logout()}>Sair</button></div>
      </section>
    </div>
    <SavedVagasImport />
    <section className={s.section} aria-labelledby="sugestoes">
      <div className={s.sectionHead}>
        <div><h2 id="sugestoes">{combinam.length ? 'Recomendadas para você' : 'Vagas abertas agora'}</h2>
          <p>{combinam.length ? 'Combinam com as causas que você marcou no perfil.' : 'Marque seus interesses no perfil para receber recomendações.'}</p></div>
        <Link className={s.link} to="/vagas">Ver todas</Link>
      </div>
      {carregando ? <p className={s.state} role="status">Carregando vagas…</p>
        : erroVagas ? <div className={s.state}><p role="alert">{erroVagas}</p><button type="button" className={s.secondary} onClick={recarregar}>Tentar novamente</button></div>
        : sugestoes.length === 0 ? <p className={s.state}>Nenhuma vaga aberta no momento. Volte em breve.</p>
        : <div className={s.grid}>{sugestoes.map((vaga) => <VagaCard key={vaga.id} vaga={vaga} agora={agora} />)}</div>}
    </section>
  </>
}

function AreaOrganizacao({ usuario, logout }) {
  const { profile, error } = useConta(usuario)
  const validated = profile !== null
  const ong = usuario.tipo === 'ONG'
  return <>
    <Saudacao usuario={usuario}><Link className={s.secondary} to="/vagas">Explorar vagas</Link></Saudacao>
    <div className={s.bento}>
      <section className={s.card} aria-labelledby="sua-organizacao" aria-busy={!validated && !error}>
        <div className={s.profileHead}>
          <span className={s.avatar} style={{ background: 'linear-gradient(135deg,#9be15d,#3ba55c)' }}>{initials(usuario.nome)}</span>
          <div><h2 id="sua-organizacao">Sua organização</h2><p>{usuario.nome}</p></div>
        </div>
        {usuario.tipo && <p className={s.muted}>Tipo de organização: {ong ? 'ONG' : 'Projeto social'}</p>}
        {error ? <p role="alert" className={s.error}>{error}</p> : !validated && <p role="status" className={s.muted}>Carregando sua conta…</p>}
        <div className={s.cardActions}>
          {ong && <Link className={s.primary} to="/vagas" state={{ abrirPublicacao: true }}>Publicar vaga</Link>}
          <Link className={ong ? s.secondary : s.primary} to="/organizacao/perfil">Editar perfil institucional</Link>
          <button type="button" className={s.ghost} onClick={() => logout()}>Sair</button>
        </div>
      </section>
      <section className={s.card} aria-labelledby="painel-organizacao">
        <h2 id="painel-organizacao">Painel da organização</h2>
        <p className={s.muted}>Acompanhe as vagas publicadas e o número de candidaturas.</p>
        <div className={s.cardActions}>
          <Link className={s.secondary} to="/organizacao/vagas">Minhas vagas</Link>
        </div>
      </section>
    </div>
  </>
}

export default function ProfilePage() {
  const { usuario, logout } = useAuth()
  return <div className={s.page}>
    <Header />
    <main className={s.main}>
      {usuario.perfil === 'VOLUNTARIO' ? <AreaVoluntario usuario={usuario} logout={logout} /> : <AreaOrganizacao usuario={usuario} logout={logout} />}
    </main>
    <Footer />
    {usuario.perfil === 'VOLUNTARIO' && <BottomNav />}
  </div>
}
