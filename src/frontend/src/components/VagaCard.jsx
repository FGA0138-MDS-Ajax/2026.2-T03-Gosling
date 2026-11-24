import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useSavedVagas } from '../hooks/useSavedVagas'
import { designAssets } from '../utils/designAssets'
import { initials } from '../utils/initials'
import { posicaoDaFoto } from '../utils/midia'
import { proximoEncontro, resumoEncontro } from '../utils/ocorrencias'
import { MODALIDADES, tomDaCausa } from '../utils/vagaLabels'
import { Icon } from './ui/Layout'
import s from './VagaCard.module.css'

export default function VagaCard({ vaga, heading: Heading = 'h3', agora }) {
  const saved = useSavedVagas()
  const [montagem] = useState(() => Date.now())
  const salva = saved.ids.includes(vaga.id)
  const [feedback, setFeedback] = useState(null)
  const foto = vaga.foto_capa ?? vaga.fotos?.[0]
  const proximo = proximoEncontro(vaga.ocorrencias, agora ?? montagem)
  const titleId = `vaga-${vaga.id}`
  async function alternar() {
    try {
      const result = await saved.toggle(vaga.id)
      setFeedback({ key: saved.key, message: result ? (saved.visitor ? 'Vaga salva neste navegador.' : 'Vaga salva na sua conta.') : 'Vaga removida das salvas.', error: false })
    } catch (failure) { setFeedback({ key: saved.key, message: failure.message, error: true }) }
  }
  return <article className={s.card} aria-labelledby={titleId}>
    <div className={s.media}>
      {foto ? (
        <img
          src={foto}
          alt=""
          loading="lazy"
          style={posicaoDaFoto(vaga.enquadramento_fotos?.[foto])}
        />
      ) : (
        <div className={s.placeholder}>
          <img src={designAssets.login.imgImageVolunJa} alt="" width="48" height="38" />
        </div>
      )}
      <span className={s.chip}>{MODALIDADES[vaga.modalidade] || vaga.modalidade}</span>
      <button type="button" className={s.save} aria-pressed={saved.ready ? salva : undefined} aria-busy={saved.pending.includes(vaga.id) || saved.loading}
        disabled={!saved.allowed || saved.pending.includes(vaga.id) || (saved.loading && !saved.ready)}
        title={!saved.allowed ? 'Vagas salvas são exclusivas de voluntários e visitantes.' : !saved.ready ? 'Clique para consultar ou tentar novamente.' : saved.visitor ? 'Salvo somente neste navegador. Entre para vincular à sua conta.' : 'Vagas salvas na sua conta'}
        aria-label={`${salva ? 'Remover dos salvos' : 'Salvar'}: ${vaga.titulo}`} onClick={alternar}>
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
      <div className={s.foot}><span className={`${s.tag} ${s[tomDaCausa(vaga.causa.nome, vaga.causa.codigo)]}`}>{vaga.causa.nome}</span><span className={s.count}>{vaga.numero_vagas} {vaga.numero_vagas === 1 ? 'vaga' : 'vagas'}</span></div>
      {feedback?.key === saved.key && <p className={s.feedback} role={feedback.error ? 'alert' : 'status'}>{feedback.message}</p>}
    </div>
  </article>
}
