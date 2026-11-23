import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import VagaCard from '../components/VagaCard'
import { Footer, Header, Icon } from '../components/ui/Layout'
import { useVagas } from '../hooks/useVagas'
import { useCausas } from '../hooks/useCausas'
import { designAssets } from '../utils/designAssets'
import { initials } from '../utils/initials'
import { posicaoDaFoto } from '../utils/midia'
import { proximoEncontro, resumoEncontro } from '../utils/ocorrencias'
import { APRESENTACAO_CAUSAS, MODALIDADES, PERIODOS } from '../utils/vagaLabels'
import s from './Home.module.css'

const numero = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 })
const POPULARES = [['Manhã', '?periodo=MANHA'], ['Remoto', '?modalidade=REMOTO']]
const PASSOS = [
  ['Encontre', 'Filtre por causa, modalidade e período. Veja local, carga horária e todas as datas antes de decidir.'],
  ['Candidate-se sem conflitos', 'Antes de enviar, sua agenda é conferida. Se um horário se sobrepõe, avisamos qual vaga e quando.'],
  ['Conecte-se', 'Após o aceite, o contato do responsável é liberado e você recebe um comprovante da atividade.'],
]

function Busca({ causas, carregando, erro }) {
  const navigate = useNavigate()
  function buscar(event) {
    event.preventDefault()
    const dados = new FormData(event.currentTarget)
    const params = new URLSearchParams([...dados].filter(([, valor]) => valor))
    navigate(`/vagas${params.size ? `?${params}` : ''}`)
  }
  const campo = (name, label, vazio, opcoes) => <label className={s.searchField}>
    <span>{label}</span>
    <select name={name} defaultValue="" disabled={name === 'causa_id' && (carregando || Boolean(erro))}>{[['', vazio], ...opcoes].map(([valor, texto]) => <option key={valor} value={valor}>{texto}</option>)}</select>
  </label>
  return <form className={s.search} role="search" aria-label="Buscar vagas" onSubmit={buscar}>
    {campo('causa_id', 'Causa', 'Todas as causas', causas.map(causa => [causa.id, causa.nome]))}
    <span className={s.searchDivider} aria-hidden="true" />
    {campo('modalidade', 'Modalidade', 'Qualquer formato', Object.entries(MODALIDADES))}
    <span className={s.searchDivider} aria-hidden="true" />
    {campo('periodo', 'Quando', 'Qualquer período', Object.entries(PERIODOS).filter(([valor]) => valor !== 'MADRUGADA'))}
    <button type="submit" className={s.searchButton} aria-label="Buscar"><img src={designAssets.home.search} alt="" width="22" height="22" /></button>
  </form>
}

function Destaque({ vaga, agora }) {
  const proximo = proximoEncontro(vaga.ocorrencias, agora)
  const dia = proximo ? resumoEncontro(proximo).split(' · ')[0] : ''
  const capa = vaga.foto_capa ?? vaga.fotos[0]
  return <article className={s.feature} aria-labelledby={`destaque-${vaga.id}`}>
    <img src={capa} alt="" style={posicaoDaFoto(vaga.enquadramento_fotos?.[capa])} />
    <div className={s.featureTags}><span>{vaga.causa.nome}</span>{dia && <span><Icon group="detalhe" name="imgIcon19" width="13" height="13" />{dia}</span>}</div>
    <div className={s.featureBody}>
      <p className={s.featureOrg}><span aria-hidden="true">{initials(vaga.organizacao.nome)}</span>{vaga.organizacao.nome}</p>
      <h3 id={`destaque-${vaga.id}`}>{vaga.titulo}</h3>
      <div className={s.featureActions}>
        <Link className={s.white} to={`/vagas/${vaga.id}`} aria-label={`Quero participar: ${vaga.titulo}`}>Quero participar</Link>
        <Link className={s.glass} to={`/vagas/${vaga.id}`} aria-label={`Saiba mais: ${vaga.titulo}`}>Saiba mais</Link>
        <span>{vaga.numero_vagas} vagas · {MODALIDADES[vaga.modalidade]}</span>
      </div>
    </div>
  </article>
}

function Carrossel({ vagas, agora }) {
  const trilho = useRef(null)
  const [atual, setAtual] = useState(0)
  const passo = () => (trilho.current?.firstElementChild?.offsetWidth || 0) + 20
  function mover(direcao) {
    const suave = !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    trilho.current?.scrollBy({ left: direcao * passo(), behavior: suave ? 'smooth' : 'auto' })
  }
  return <section className={s.section} aria-labelledby="destaques">
    <div className={s.sectionHead}>
      <div><h2 id="destaques">Em destaque esta semana.</h2><p>Vagas com fotos e encontros nos próximos dias.</p></div>
      {vagas.length > 1 && <div className={s.arrows}>
        <button type="button" aria-label="Destaque anterior" disabled={atual === 0} onClick={() => mover(-1)}><img src={designAssets.home['chev-l']} alt="" width="20" height="20" /></button>
        <button type="button" aria-label="Próximo destaque" disabled={atual >= vagas.length - 1} onClick={() => mover(1)}><img src={designAssets.home['chev-r']} alt="" width="20" height="20" /></button>
      </div>}
    </div>
    <div ref={trilho} className={s.track} onScroll={(e) => setAtual(Math.round(e.currentTarget.scrollLeft / (passo() || 1)))}>
      {vagas.map((vaga) => <Destaque key={vaga.id} vaga={vaga} agora={agora} />)}
    </div>
    {vagas.length > 1 && <div className={s.dots} aria-hidden="true">{vagas.map((vaga, indice) => <span key={vaga.id} className={indice === atual ? s.dotOn : ''} />)}</div>}
  </section>
}

function Ilustracao({ tipo }) {
  if (tipo === 0) return <div className={s.illo} aria-hidden="true">
    <div className={s.illoChips}><span className={s.chipOn}>Meio ambiente</span><span>Manhã</span><span>Presencial</span></div>
    <div className={s.illoRow}><img src={designAssets.detalhe.imgContainer} alt="" /><div><strong>Mutirão de plantio</strong><small>Sáb · 08:00–12:00 · Ceilândia</small></div><img src={designAssets.home['chev-r']} alt="" width="14" height="14" /></div>
  </div>
  if (tipo === 1) return <div className={s.illo} aria-hidden="true">
    <div className={s.week}>{['S', 'T', 'Q', 'Q', 'S', 'S', 'D'].map((dia, i) => <span key={i}><small>{dia}</small><b className={i === 5 ? s.today : ''}>{16 + i}</b></span>)}</div>
    <div className={s.illoOk}><img src={designAssets.home['check-green']} alt="" width="15" height="15" />Sem conflito com sua agenda</div>
    <div className={s.illoEvent}><strong>Mutirão de plantio</strong><small>Sáb, 21 nov · 08:00–12:00</small></div>
  </div>
  return <div className={`${s.illo} ${s.pass}`} aria-hidden="true">
    <div className={s.passHead}><span><img src={designAssets.login.imgImageVolunJa} alt="" width="22" height="17" />VolunJá</span><small>COMPROVANTE</small></div>
    <div className={s.passBody}><div><small>Voluntária</small><strong>Ana Martins</strong><small>Contato liberado</small><strong>(61) 98877-1020</strong></div><span className={s.qr}><img src={designAssets.home.qr} alt="" width="40" height="40" /></span></div>
  </div>
}

export default function HomePage() {
  const catalogo = useCausas()
  const [agora] = useState(() => Date.now())
  const { itens, total, carregando, erro, recarregar } = useVagas(1, { porPagina: 100 })
  const abertas = itens.filter((vaga) => proximoEncontro(vaga.ocorrencias, agora))
  const destaques = abertas.filter((vaga) => vaga.fotos?.length)
    .sort((a, b) => new Date(proximoEncontro(a.ocorrencias, agora).inicio) - new Date(proximoEncontro(b.ocorrencias, agora).inicio)).slice(0, 5)
  const presenciais = abertas.filter((vaga) => vaga.modalidade !== 'REMOTO')
  const perto = (presenciais.length ? presenciais : abertas).slice(0, 3)
  const futuros = itens.flatMap((vaga) => vaga.ocorrencias.filter((o) => new Date(o.fim).getTime() > agora))
  const horas = futuros.reduce((soma, o) => soma + (new Date(o.fim) - new Date(o.inicio)) / 36e5, 0)
  const organizacoes = new Set(itens.filter((vaga) => vaga.organizacao.homologada).map((vaga) => vaga.organizacao.id)).size
  const contagem = id => itens.filter(vaga => vaga.causa.id === id).length
  const causas = catalogo.itens.filter(causa => causa.ativo)
  const causasDestaque = causas.filter(causa => Number.isInteger(APRESENTACAO_CAUSAS[causa.codigo]?.destaque))
    .map(causa => ({ ...causa, ...APRESENTACAO_CAUSAS[causa.codigo] })).sort((a,b) => a.destaque - b.destaque)
  const populares = [...POPULARES, ...causas.filter(causa => ['educacao','protecao-animal'].includes(causa.codigo)).map(causa => [causa.nome, `?causa_id=${causa.id}`])]
  const pronto = !carregando && !erro
  const painel = itens.filter((vaga) => vaga.fotos?.length).slice(0, 3)

  return <div className={s.page}>
    <Header />
    <main>
      <section className={s.hero} aria-labelledby="home-title">
        <p className={s.eyebrow}>Voluntariado no Distrito Federal</p>
        <h1 id="home-title">Seu tempo<br />muda histórias.</h1>
        <p className={s.lead}>Encontre vagas de voluntariado perto de você, nos horários que cabem na sua semana — e candidate-se em poucos toques.</p>
        <Busca causas={causas} carregando={catalogo.carregando} erro={catalogo.erro} />
        {catalogo.erro && <div><p role="alert">{catalogo.erro}</p><button className={s.secondary} type="button" onClick={catalogo.recarregar}>Tentar carregar causas novamente</button></div>}
        <p className={s.popular}><span>Populares:</span>{populares.map(([texto, busca]) => <Link key={texto} to={`/vagas${busca}`}>{texto}</Link>)}</p>
        <div className={s.heroImage}>
          <img src={designAssets.home.imgHero} alt="Voluntários carregando caixas de doações em frente a um centro comunitário" />
          <div className={s.notification} aria-hidden="true">
            <span className={s.appIcon}><img src={designAssets.login.imgImageVolunJa} alt="" width="22" height="17" /></span>
            <div><p><b>VolunJá</b><small>agora</small></p><p>Sua candidatura em <b>Mutirão de plantio</b> foi aceita. O contato da organização já está disponível.</p></div>
          </div>
          {pronto && total > 0 && <Link className={s.heroBadge} to="/vagas"><img src={designAssets.home.sparkles} alt="" width="16" height="16" />{total} {total === 1 ? 'vaga aberta' : 'vagas abertas'} agora</Link>}
        </div>
      </section>

      {pronto && total > 0 && <dl className={s.stats} aria-label="O VolunJá em números">
        {[[numero.format(total), 'vagas abertas agora'], [numero.format(organizacoes), organizacoes === 1 ? 'organização verificada' : 'organizações verificadas'],
          [numero.format(futuros.length), 'encontros agendados'], [`${numero.format(horas)} h`, 'de atividades programadas']].map(([valor, rotulo]) =>
          <div key={rotulo}><dt>{rotulo}</dt><dd>{valor}</dd></div>)}
      </dl>}

      {pronto && destaques.length > 0 && <Carrossel vagas={destaques} agora={agora} />}

      <section className={s.section} aria-labelledby="causas">
        <div className={s.sectionHead}><h2 id="causas">Explore por causa.</h2><Link className={s.textLink} to="/vagas">Ver todas as causas<img src={designAssets.home['chev-r-teal']} alt="" width="16" height="16" /></Link></div>
        {catalogo.carregando && <p role="status">Carregando causas…</p>}
        <ul className={s.causes}>{causasDestaque.map(({ id, nome, icone, tom }) => {
          const n = contagem(id)
          return <li key={id}><Link to={`/vagas?causa_id=${id}`} className={s.cause}>
            <span className={`${s.causeIcon} ${s[tom]}`}><img src={designAssets.home[icone]} alt="" width="24" height="24" /></span>
            <strong>{nome}</strong><small>{pronto ? (n ? `${n} ${n === 1 ? 'vaga aberta' : 'vagas abertas'}` : 'Nenhuma vaga ainda') : ' '}</small>
          </Link></li>
        })}</ul>
      </section>

      <section className={s.section} aria-labelledby="perto">
        <div className={s.sectionHead}>
          <div><h2 id="perto">Perto de você.</h2><p>Vagas presenciais e híbridas no Distrito Federal.</p></div>
          {total > 0 && <Link className={s.pill} to="/vagas">Ver todas as {total} vagas<img src={designAssets.home['arrow-r']} alt="" width="16" height="16" /></Link>}
        </div>
        {carregando ? <p className={s.state} role="status">Carregando vagas…</p>
          : erro ? <div className={s.state}><p role="alert">{erro}</p><button type="button" className={s.secondary} onClick={recarregar}>Tentar novamente</button></div>
          : perto.length === 0 ? <p className={s.state}>Ainda não há vagas abertas. Volte em breve ou cadastre sua organização.</p>
          : <div className={s.grid}>{perto.map((vaga) => <VagaCard key={vaga.id} vaga={vaga} agora={agora} />)}</div>}
      </section>

      <section id="como-funciona" className={s.how} aria-labelledby="como-funciona-titulo">
        <p className={s.eyebrow}>Como funciona</p>
        <h2 id="como-funciona-titulo">Do interesse ao primeiro dia,<br />sem atrito.</h2>
        <ol className={s.steps}>{PASSOS.map(([titulo, texto], indice) => <li key={titulo}>
          <span className={s.stepNumber} aria-hidden="true">{indice + 1}</span><h3>{titulo}</h3><p>{texto}</p><Ilustracao tipo={indice} />
        </li>)}</ol>
      </section>

      <section className={s.orgs} aria-labelledby="organizacoes">
        <div className={s.orgsText}>
          <p className={s.eyebrowDark}>Para ONGs e projetos sociais</p>
          <h2 id="organizacoes">Publique uma vaga.<br />Receba as pessoas certas.</h2>
          <p>Vagas com fotos chamam mais atenção. Candidaturas chegam organizadas, com documentos e disponibilidade de cada voluntário.</p>
          <ul>{['Fotos e galeria em cada vaga', 'Datas e horários padronizados, sem conflito para o voluntário', 'Contato liberado só depois do aceite', 'Perfil verificado pela equipe VolunJá'].map((item) =>
            <li key={item}><Icon group="detalhe" name="imgIcon9" />{item}</li>)}</ul>
          <div className={s.orgActions}><Link className={s.mint} to="/cadastro/organizacao">Cadastrar organização</Link><Link className={s.mintLink} to="/cadastro">Saiba mais<img src={designAssets.home['chev-r-mint']} alt="" width="18" height="18" /></Link></div>
        </div>
        {painel.length > 0 ? <div className={s.panel} aria-hidden="true">
          <div className={s.panelHead}><strong>Suas vagas</strong><span>● {total} abertas</span></div>
          {painel.map(vaga => {
            const capa = vaga.foto_capa ?? vaga.fotos[0]
            const encontros = vaga.ocorrencias.length
            return (
              <div key={vaga.id} className={s.panelRow}>
                <img src={capa} alt="" style={posicaoDaFoto(vaga.enquadramento_fotos?.[capa])} />
                <div>
                  <strong>{vaga.titulo}</strong>
                  <small>
                    {encontros} {encontros === 1 ? 'encontro' : 'encontros'} · {vaga.numero_vagas} vagas
                  </small>
                </div>
                <span>{vaga.causa.nome}</span>
              </div>
            )
          })}
        </div> : <img className={s.orgsImage} src={designAssets.escolha.imgContainer1} alt="" />}
      </section>
    </main>
    <Footer />
  </div>
}
