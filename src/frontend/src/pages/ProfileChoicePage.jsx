import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Header, Icon } from '../components/ui/Layout'
import { designAssets } from '../utils/designAssets'
import s from './ProfileChoice.module.css'

const choices = [
  { id: 'voluntario', title: 'Quero ser voluntário', description: 'Para pessoas que querem doar tempo e talento.', image: 'imgContainer', features: ['Vagas de acordo com seus interesses', 'Agenda sem conflitos', 'Comprovantes de horas'] },
  { id: 'organizacao', title: 'Represento uma ONG', description: 'Para organizações com CNPJ.', image: 'imgContainer1', features: ['Publicação de vagas', 'Candidaturas organizadas', 'Controle de presença e horas'] },
  { id: 'projeto-social', title: 'Lidero um projeto social', description: 'Para iniciativas comunitárias sem CNPJ.', image: 'imgContainer2', features: ['Cadastro com CPF do responsável', 'As mesmas ferramentas da ONG', 'Homologação pela administração'] },
]
export default function ProfileChoicePage() {
  const [selected, setSelected] = useState('voluntario')
  const navigate = useNavigate()
  const location = useLocation()
  return <div className={s.page}><Header><span>Já tem conta? <Link to="/login" state={location.state}>Entrar</Link></span></Header>
    <main className={s.main}><p className={s.eyebrow}>Criar conta</p><h1>Como você quer participar?</h1><p className={s.subtitle}>Cada perfil tem telas e ferramentas próprias. Você pode criar outra conta depois, se precisar.</p>
      <div className={s.choices} role="radiogroup" aria-label="Escolha seu perfil">{choices.map(choice =>
        <label className={`${s.choice} ${selected === choice.id ? s.selected : ''}`} key={choice.id}>
          <input type="radio" name="perfil" value={choice.id} checked={selected === choice.id} onChange={() => setSelected(choice.id)} />
          <img className={s.photo} src={designAssets.escolha[choice.image]} alt="" />
          <div className={s.content}><h2>{choice.title}</h2><p>{choice.description}</p><ul>{choice.features.map(text => <li key={text}><Icon group="escolha" />{text}</li>)}</ul></div>
        </label>)}</div>
      <button className={s.continue} onClick={() => navigate(`/cadastro/${selected}`, { state: location.state })}>Continuar como {selected === 'voluntario' ? 'voluntário' : selected === 'organizacao' ? 'ONG' : 'projeto social'}</button>
      <p className={s.note}>Ao continuar, você concorda com os Termos de uso e a Política de privacidade.</p>
    </main></div>
}
