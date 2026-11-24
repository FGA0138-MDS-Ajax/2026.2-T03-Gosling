import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { readSavedVagas, toggleSavedVaga } from '../services/savedVagas'
import { designAssets } from '../utils/designAssets'
import { initials } from '../utils/initials'
import { proximoEncontro, resumoEncontro } from '../utils/ocorrencias'
import { MODALIDADES, tomDaCausa } from '../utils/vagaLabels'
import { Icon } from './ui/Layout'
import s from './VagaCard.module.css'

export default function VagaCard({ vaga, heading: Heading = 'h3', agora }) {
  const { usuario } = useAuth()
  const [montagem] = useState(() => Date.now())
  const [salva, setSalva] = useState(() => readSavedVagas(usuario?.id).includes(vaga.id))
  const foto = vaga.fotos?.[0]
  const proximo = proximoEncontro(vaga.ocorrencias, agora ?? montagem)
  const titleId = `vaga-${vaga.id}`
  function alternar() {
    try { setSalva(toggleSavedVaga(vaga.id, usuario?.id)) } catch { setSalva((atual) => atual) }
  }
  return <article className={s.card} aria-labelledby={titleId}>
    <div className={s.media}>
      {foto ? <img src={foto} alt="" loading="lazy" /> : <div className={s.placeholder}><img src={designAssets.login.imgImageVolunJa} alt="" width="48" height="38" /></div>}
      <span className={s.chip}>{MODALIDADES[vaga.modalidade] || vaga.modalidade}</span>
      <button type="button" className={s.save} aria-pressed={salva} aria-label={`${salva ? 'Remover dos salvos' : 'Salvar'}: ${vaga.titulo}`} onClick={alternar}>
        <img src={salva ? designAssets.home['heart-on'] : designAssets.home.heart} alt="" width="17" height="17" />
      </button>
    </div>
    <div className={s.body}>
      <p className={s.org}><span className={s.orgAvatar} aria-hidden="true">{initials(vaga.organizacao.nome)}</span>
        <span className={s.orgName}>{vaga.organizacao.nome}</span>
        {vaga.organizacao.homologada && <Icon group="detalhe" name="imgIcon4" width="14" height="14" alt="Organização verificada" aria-hidden={false} />}</p>
      <Heading id={titleId} className={s.title}><Link to={`/vagas/${vaga.id}`}>{vaga.titulo}</Link></Heading>
      <p className={s.meta}><Icon group="detalhe" name="imgIcon19" />{proximo ? <time dateTime={proximo.inicio}>{resumoEncontro(proximo)}</time> : 'Encontros encerrados'}</p>
      <p className={s.meta}><Icon group="detalhe" name="imgIcon20" /><span className={s.ellipsis}>{vaga.local}</span></p>
      <div className={s.foot}><span className={`${s.tag} ${s[tomDaCausa(vaga.causa.nome)]}`}>{vaga.causa.nome}</span><span className={s.count}>{vaga.numero_vagas} {vaga.numero_vagas === 1 ? 'vaga' : 'vagas'}</span></div>
    </div>
  </article>
}
