import { Link, NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { profileRoute } from '../../utils/profileRoutes'
import { designAssets } from '../../utils/designAssets'
import s from './Layout.module.css'
import { initials } from '../../utils/initials'

export function Icon({ name = 'imgIcon', group = 'perfil', ...props }) {
  return <img className={s.icon} src={designAssets[group][name]} alt="" aria-hidden="true" {...props} />
}

export function Brand() {
  return <Link className={s.brand} to="/" aria-label="VolunJá — início">
    <img src={designAssets.login.imgImageVolunJa} alt="" width="33" height="26" />VolunJá
  </Link>
}

export function Header({ children, minimal = false }) {
  const { usuario } = useAuth()
  const { pathname } = useLocation()
  return <header className={s.header}>
    <Brand />
    {children || (minimal ? <Link className={s.back} to="/"><Icon group="login" />Voltar para o início</Link> : <>
      <nav aria-label="Navegação principal" className={s.nav}>
        <NavLink to="/">Início</NavLink><NavLink to="/vagas">Explorar</NavLink>
        {usuario?.perfil === 'VOLUNTARIO' && <><NavLink to="/voluntario/candidaturas">Candidaturas</NavLink><NavLink to="/voluntario/agenda">Agenda</NavLink></>}
        {!usuario && <a href="/#como-funciona">Como funciona</a>}
      </nav>
      <div className={s.actions}>{usuario ? <>
        <Link to="/vagas" aria-label="Buscar vagas"><Icon /></Link>
        <Link to="/voluntario/notificacoes" aria-label="Notificações"><Icon name="imgIcon1" /></Link>
        <Link to={usuario.perfil === 'VOLUNTARIO' ? '/voluntario/perfil' : profileRoute(usuario.perfil)} className={s.smallAvatar} aria-label="Minha conta">{initials(usuario.nome)}</Link>
      </> : <><Link to="/login" state={{ from: pathname }}>Entrar</Link><Link className={s.primary} to="/cadastro">Criar conta</Link></>}</div>
    </>)}
  </header>
}

export function BottomNav() {
  const { pathname } = useLocation()
  const links = [['/vagas', 'Explorar', 'imgIcon11'], ['/voluntario/agenda', 'Agenda', 'imgIcon12'],
    ['/voluntario/candidaturas', 'Candidaturas', 'imgIcon13'], ['/voluntario/perfil', 'Perfil', 'imgIcon14']]
  return <nav className={s.bottomNav} aria-label="Navegação do voluntário">{links.map(([to, text, icon]) =>
    <Link key={to} to={to} aria-current={pathname === to ? 'page' : undefined}><Icon group="mobile_perfil" name={icon} /><span>{text}</span></Link>)}</nav>
}

const YEAR = new Date().getFullYear()
export function Footer() {
  const colunas = [
    ['Voluntários', [['/vagas', 'Explorar vagas'], ['/#como-funciona', 'Como funciona'], ['/voluntario/agenda', 'Minha agenda'], ['/cadastro', 'Criar conta']]],
    ['Organizações', [['/cadastro/organizacao', 'Cadastrar organização'], ['/cadastro/projeto-social', 'Projeto social'], ['/organizacao', 'Área da organização']]],
    ['VolunJá', [['https://fga0138-mds-ajax.github.io/2026.2-T03-Gosling/', 'Sobre o projeto'], ['https://github.com/FGA0138-MDS-Ajax/2026.2-T03-Gosling', 'Código no GitHub'], ['/login', 'Acessar minha conta']]],
  ]
  return <footer className={s.footer}>
    <div className={s.footerTop}>
      <div className={s.footerBrand}><Brand /><p>Conectando pessoas e causas no Distrito Federal. Projeto acadêmico do grupo Gosling — MDS 2026.2, UnB/FGA.</p></div>
      <nav className={s.footerLinks} aria-label="Rodapé">{colunas.map(([titulo, links]) => <div key={titulo}>
        <h2>{titulo}</h2>
        <ul>{links.map(([to, texto]) => <li key={texto}>{to.startsWith('http') ? <a href={to} target="_blank" rel="noopener noreferrer">{texto}</a> : <Link to={to}>{texto}</Link>}</li>)}</ul>
      </div>)}</nav>
    </div>
    <div className={s.footerBottom}><span>© {YEAR} VolunJá. Todos os direitos reservados.</span><span>Brasil · Português</span></div>
  </footer>
}

export function NoticePage({ title }) {
  return <div className={s.page}><Header /><main className={s.notice}><h1>{title}</h1>
    <p>Este recurso ainda está em desenvolvimento.</p><p>Você já pode explorar oportunidades e atualizar suas preferências no perfil.</p>
    <Link to="/vagas">Explorar vagas</Link> · <Link to="/voluntario/perfil">Meu perfil</Link></main><BottomNav /></div>
}
