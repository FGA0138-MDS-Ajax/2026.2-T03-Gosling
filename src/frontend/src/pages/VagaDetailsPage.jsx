import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { Footer, Header, Icon } from '../components/ui/Layout'
import { designAssets } from '../utils/designAssets'
import { initials } from '../utils/initials'
import Modal from '../components/ui/Modal'
import { useAuth } from '../hooks/useAuth'
import { detalharVaga, listarVagas } from '../services/vagasService'
import { useSavedVagas } from '../hooks/useSavedVagas'
import { formatarOcorrencia, horarioDoEncontro } from '../utils/ocorrencias'
import { destinoMapa, textoEndereco } from '../utils/localizacao'
import { posicaoDaFoto, tamanhoDoArquivo } from '../utils/midia'
import s from './VagaDetails.module.css'

const modalities = { PRESENCIAL: 'Presencial', REMOTO: 'Remoto', HIBRIDO: 'Híbrido' }
const periods = { MANHA: 'Manhã', TARDE: 'Tarde', NOITE: 'Noite', MADRUGADA: 'Madrugada' }
const dateFormat = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  weekday: 'long',
  day: '2-digit',
  month: 'long',
})
const monthFormat = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  month: 'short',
})
const dayFormat = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  day: '2-digit',
})
const hoursFormat = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 })
const duration = ({ inicio, fim }) => {
  const h = (new Date(fim) - new Date(inicio)) / 36e5
  return `${hoursFormat.format(h)} ${h === 1 ? 'hora' : 'horas'}`
}
const longDate = instant => {
  const text = dateFormat.format(new Date(instant))
  return text.charAt(0).toUpperCase() + text.slice(1)
}

export default function VagaDetailsPage() {
  const { id } = useParams()
  return <VagaDetails key={id} id={id} />
}

function VagaDetails({ id }) {
  const location = useLocation()
  const { usuario, loading: sessionLoading, restoreError } = useAuth()
  const [vaga, setVaga] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [related, setRelated] = useState([])
  const [message, setMessage] = useState('')
  const saved = useSavedVagas()
  const isSaved = saved.ids.includes(Number(id))
  const [saveFeedback, setSaveFeedback] = useState(null)
  const [now] = useState(() => Date.now())
  const [gallery, setGallery] = useState(false)
  const [photo, setPhoto] = useState(0)
  const [report, setReport] = useState(false)
  const sharePending = useRef(false)

  useEffect(() => {
    const controller = new AbortController()
    detalharVaga(id, controller.signal)
      .then(data => {
        if (!controller.signal.aborted) {
          setVaga(data)
          setLoading(false)
        }
      })
      .catch(failure => {
        if (controller.signal.aborted) return
        setError(
          failure.response?.status === 404
            ? 'Vaga não encontrada ou indisponível.'
            : 'Não foi possível carregar esta vaga.',
        )
        setLoading(false)
      })
    listarVagas({ signal: controller.signal })
      .then(data => {
        if (!controller.signal.aborted)
          setRelated(data.itens.filter(v => String(v.id) !== id).slice(0, 3))
      })
      .catch(() => {})
    return () => controller.abort()
  }, [id, attempt])

  async function share() {
    if (sharePending.current) return
    sharePending.current = true
    try {
      if (navigator.share) await navigator.share({ title: vaga.titulo, url: window.location.href })
      else {
        await navigator.clipboard.writeText(window.location.href)
        setMessage('Link da vaga copiado.')
      }
    } catch (failure) {
      if (failure.name !== 'AbortError')
        setMessage('Não foi possível copiar o link. Copie o endereço na barra do navegador.')
    } finally {
      sharePending.current = false
    }
  }
  async function save() {
    try {
      const result = await saved.toggle(Number(id))
      setSaveFeedback({
        key: saved.key,
        message: result
          ? saved.visitor
            ? 'Vaga salva neste navegador.'
            : 'Vaga salva na sua conta.'
          : 'Vaga removida das salvas.',
        error: false,
      })
    } catch (failure) {
      setSaveFeedback({ key: saved.key, message: failure.message, error: true })
    }
  }
  const fotos = vaga?.fotos || []
  const capa = vaga?.foto_capa ?? fotos[0]
  const fotosLaterais = fotos.slice(1, 3)
  const rotuloGaleria = fotos.length === 1 ? 'Ver foto' : `Ver as ${fotos.length} fotos`
  const ocorrencias = [...(vaga?.ocorrencias || [])].sort(
    (a, b) => new Date(a.inicio) - new Date(b.inicio),
  )
  const upcoming = ocorrencias.filter(o => new Date(o.fim).getTime() > now)
  const next = upcoming[0]
  const remaining = upcoming.length - 1
  const application = (mobile = false) => {
    if (!next)
      return (
        <button className={s.apply} type="button" disabled>
          Encontros encerrados
        </button>
      )
    if (sessionLoading || restoreError)
      return (
        <p role="status">
          {sessionLoading ? 'Validando sessão…' : 'Valide sua sessão para continuar.'}
        </p>
      )
    if (!usuario)
      return (
        <Link className={s.apply} to="/login" state={{ from: location.pathname }}>
          Quero me candidatar
        </Link>
      )
    return (
      <>
        <button
          className={s.apply}
          type="button"
          disabled
          aria-describedby={mobile ? 'application-status-mobile' : 'application-status'}
        >
          {usuario.perfil === 'VOLUNTARIO' ? 'Candidaturas em breve' : 'Exclusivo para voluntários'}
        </button>
        <p
          id={mobile ? 'application-status-mobile' : 'application-status'}
          className={s.applicationStatus}
        >
          {usuario.perfil === 'VOLUNTARIO'
            ? 'O envio de candidaturas ainda não está disponível.'
            : 'Entre com uma conta de voluntário para se candidatar.'}
        </p>
      </>
    )
  }
  const saveButton = (compact = false) => (
    <button
      type="button"
      aria-pressed={saved.ready ? isSaved : undefined}
      aria-busy={saved.pending.includes(Number(id)) || saved.loading}
      disabled={
        !saved.allowed || saved.pending.includes(Number(id)) || (saved.loading && !saved.ready)
      }
      aria-label={compact ? (isSaved ? 'Remover dos salvos' : 'Salvar vaga') : undefined}
      title={
        !saved.ready
          ? 'Clique para consultar ou tentar novamente.'
          : saved.visitor
            ? 'Salvo somente neste navegador. Entre para vincular à sua conta.'
            : undefined
      }
      onClick={save}
      className={compact ? s.round : s.secondary}
    >
      <Icon group="detalhe" name="imgIcon2" />
      {!compact && (isSaved ? 'Vaga salva' : 'Salvar vaga')}
    </button>
  )
  return (
    <div className={s.page}>
      <Header />
      {loading ? (
        <main className={s.state}>
          <p role="status">Carregando vaga…</p>
        </main>
      ) : error ? (
        <main className={s.state}>
          <h1>{error}</h1>
          {!error.startsWith('Vaga não') && (
            <button
              type="button"
              onClick={() => {
                setLoading(true)
                setError('')
                setAttempt(v => v + 1)
              }}
            >
              Tentar novamente
            </button>
          )}
          <Link to="/vagas">Explorar outras vagas</Link>
        </main>
      ) : (
        vaga && (
          <>
            <main className={s.main}>
              <div className={s.topline}>
                <nav aria-label="Caminho da página">
                  <Link to="/vagas">Explorar vagas</Link>
                  <Icon group="detalhe" />
                  <span>{vaga.causa.nome}</span>
                  <Icon group="detalhe" />
                  <span>{vaga.titulo}</span>
                </nav>
                <div>
                  <button className={s.secondary} type="button" onClick={share}>
                    <Icon group="detalhe" name="imgIcon1" />
                    Compartilhar
                  </button>
                  {saveButton()}
                </div>
              </div>
              <div
                className={[
                  s.gallery,
                  fotos.length === 0 && s.galleryEmpty,
                  fotos.length === 1 && s.gallerySingle,
                ].filter(Boolean).join(' ')}
              >
                {fotos.length ? (
                  <>
                    <img
                      className={s.heroPhoto}
                      src={capa}
                      alt={`Atividade de voluntariado: ${vaga.titulo}`}
                      style={posicaoDaFoto(vaga.enquadramento_fotos?.[capa])}
                    />
                    {fotosLaterais.length > 0 && (
                      <div className={s.gallerySide}>
                        {fotosLaterais.map((src, indice) => (
                          <img
                            key={`${src}-${indice}`}
                            src={src}
                            alt=""
                            style={posicaoDaFoto(vaga.enquadramento_fotos?.[src])}
                          />
                        ))}
                      </div>
                    )}
                    <button
                      className={s.allPhotos}
                      type="button"
                      aria-label={rotuloGaleria}
                      onClick={() => {
                        setPhoto(0)
                        setGallery(true)
                      }}
                    >
                      <Icon group="detalhe" name="imgIcon3" />
                      <span className={s.desktopPhotoLabel}>{rotuloGaleria}</span>
                      <span className={s.mobilePhotoLabel}>1 / {fotos.length}</span>
                    </button>
                  </>
                ) : (
                  <div className={s.noPhoto}>
                    <img src={designAssets.login.imgImageVolunJa} alt="" width="48" height="38" />
                    <span>Esta organização ainda não adicionou fotos da atividade.</span>
                  </div>
                )}
                <div className={s.mobileActions}>
                  <Link to="/vagas" aria-label="Voltar para as vagas">
                    <Icon group="mobile_detalhe" name="imgIcon4" />
                  </Link>
                  <span />
                  <button type="button" onClick={share} aria-label="Compartilhar vaga">
                    <Icon group="mobile_detalhe" name="imgIcon5" />
                  </button>
                  {saveButton(true)}
                </div>
              </div>
              <div className={s.body}>
                <article className={s.article}>
                  <div className={s.tags}>
                    <span>{vaga.causa.nome}</span>
                    <span>● Inscrições abertas</span>
                  </div>
                  <h1>{vaga.titulo}</h1>
                  <div className={s.organization}>
                    <span className={s.orgAvatar}>{initials(vaga.organizacao.nome)}</span>
                    <div>
                      <strong>
                        {vaga.organizacao.nome}
                        {vaga.organizacao.homologada && <Icon group="detalhe" name="imgIcon4" />}
                      </strong>
                      <small>
                        {vaga.organizacao.homologada
                          ? 'Organização verificada'
                          : 'Organização responsável'}
                      </small>
                    </div>
                  </div>
                  <dl className={s.facts}>
                    {[
                      ['imgIcon5', 'Modalidade', modalities[vaga.modalidade]],
                      ['imgIcon6', 'Período', periods[vaga.periodo]],
                      [
                        'imgIcon7',
                        'Carga horária',
                        Number(vaga.carga_horaria).toLocaleString('pt-BR') + ' h por encontro',
                      ],
                      ['imgIcon8', 'Vagas', vaga.numero_vagas + ' vagas ofertadas'],
                    ].map(([icon, label, value]) => (
                      <div key={label}>
                        <span className={s.factIcon}>
                          <Icon group="detalhe" name={icon} />
                        </span>
                        <dt>{label}</dt>
                        <dd>{value}</dd>
                      </div>
                    ))}
                  </dl>
                  <section>
                    <h2>Sobre a vaga</h2>
                    <p className={s.description}>{vaga.descricao}</p>
                  </section>
                  <section>
                    <h2>O que você vai fazer</h2>
                    <ul className={s.activities}>
                      {vaga.atividades
                        .split(/\n+/)
                        .filter(Boolean)
                        .map((text, i) => (
                          <li key={i}>
                            <Icon group="detalhe" name="imgIcon9" />
                            {text}
                          </li>
                        ))}
                    </ul>
                  </section>
                  <section>
                    <div className={s.sectionHead}>
                      <h2>Datas e horários</h2>
                      <span>
                        {ocorrencias.length} {ocorrencias.length === 1 ? 'encontro' : 'encontros'}
                      </span>
                    </div>
                    <ul className={s.schedule} aria-label="Encontros da vaga">
                      {ocorrencias.map(item => (
                        <li key={item.id}>
                          <div className={s.dateTile}>
                            <span>
                              {monthFormat.format(new Date(item.inicio)).replace('.', '')}
                            </span>
                            {dayFormat.format(new Date(item.inicio))}
                          </div>
                          <div>
                            <strong>{longDate(item.inicio)}</strong>
                            <time dateTime={item.inicio}>
                              {horarioDoEncontro(item)} · {duration(item)}
                            </time>
                          </div>
                          {next?.id === item.id && <span className={s.next}>● Próximo</span>}
                        </li>
                      ))}
                    </ul>
                    <p className={s.hint}>Todas as datas e horários no horário de Brasília.</p>
                  </section>
                  <section>
                    <h2>Documentos exigidos</h2>
                    <p className={s.hint}>Você envia no momento da candidatura.</p>
                    {vaga.documentos_exigidos?.length ? (
                      <ul className={s.documents}>
                        {vaga.documentos_exigidos.map((doc, indice) => (
                          <li key={doc.id ?? indice}>
                            <span className={s.docIcon}>
                              <Icon
                                group="detalhe"
                                name={doc.modelo_url ? 'imgIcon11' : 'imgIcon10'}
                              />
                            </span>
                            <div className={s.docContent}>
                              <strong>{doc.nome}</strong>
                              <small>{doc.obrigatorio === false ? 'Opcional' : 'Obrigatório'}</small>
                              {doc.orientacao && <p>{doc.orientacao}</p>}
                              {doc.modelo && (
                                <small>
                                  {doc.modelo.nome} · PDF · {tamanhoDoArquivo(doc.modelo.tamanho_bytes)}
                                </small>
                              )}
                            </div>
                            {doc.modelo_url && (
                              <a
                                href={doc.modelo_url}
                                download={doc.modelo?.nome}
                                target={doc.modelo ? undefined : '_blank'}
                                rel="noopener noreferrer"
                              >
                                <Icon group="detalhe" name="imgIcon12" />
                                Baixar modelo
                              </a>
                            )}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className={s.empty}>A organização não informou documentos obrigatórios.</p>
                    )}
                  </section>
                  <section>
                    <h2>Local</h2>
                    <div className={s.map}>
                      <div className={s.mapDecoration} aria-hidden="true">
                        <span />
                      </div>
                      <div className={s.address}>
                        <span>
                          <strong>{vaga.local}</strong>
                          {vaga.localizacao && <small>{textoEndereco(vaga.localizacao)}</small>}
                          <small>{modalities[vaga.modalidade]}</small>
                        </span>
                        {vaga.modalidade !== 'REMOTO' && (
                          <a href={destinoMapa(vaga)} target="_blank" rel="noopener noreferrer">
                            <Icon group="detalhe" name="imgIcon13" />
                            Como chegar
                          </a>
                        )}
                      </div>
                    </div>
                  </section>
                </article>
                <aside className={s.aside} aria-label="Participar desta vaga">
                  <div className={s.applyCard}>
                    <small>Próximo encontro</small>
                    <strong className={s.nextTitle}>
                      {next ? longDate(next.inicio) : 'Encontros encerrados'}
                    </strong>
                    <p className={s.hint}>
                      {next
                        ? horarioDoEncontro(next) +
                          (remaining > 0
                            ? ` · mais ${remaining} ${remaining === 1 ? 'encontro' : 'encontros'}`
                            : '')
                        : 'Confira a programação com a organização.'}
                    </p>
                    <div className={s.capacity}>{vaga.numero_vagas} vagas ofertadas</div>
                    <div className={s.application}>{application()}</div>
                    {saveButton()}
                    <div className={s.privacy}>
                      <p>
                        <Icon group="detalhe" name="imgIcon15" />
                        Antes de enviar, sua agenda será conferida para evitar conflito de horários.
                      </p>
                      <p>
                        <Icon group="detalhe" name="imgIcon16" />O contato do responsável é liberado
                        depois do aceite.
                      </p>
                    </div>
                  </div>
                  <button type="button" className={s.report} onClick={() => setReport(true)}>
                    <Icon group="detalhe" name="imgIcon17" />
                    Denunciar esta vaga
                  </button>
                </aside>
              </div>
              {message && (
                <p className={s.message} role="status">
                  {message}
                </p>
              )}
              {saveFeedback?.key === saved.key && (
                <p className={s.message} role={saveFeedback.error ? 'alert' : 'status'}>
                  {saveFeedback.message}
                </p>
              )}
            </main>
            {related.length > 0 && (
              <section className={s.related}>
                <h2>Você também pode gostar</h2>
                <div>
                  {related.map(v => (
                    <article key={v.id} className={s.relatedCard}>
                      {v.fotos?.[0] && (
                        <img
                          src={v.fotos[0]}
                          alt=""
                          style={posicaoDaFoto(v.enquadramento_fotos?.[v.fotos[0]])}
                        />
                      )}
                      <div>
                        <small>{v.organizacao.nome}</small>
                        <h3>
                          <Link to={`/vagas/${v.id}`}>{v.titulo}</Link>
                        </h3>
                        {v.ocorrencias[0] && (
                          <p>
                            <Icon group="detalhe" name="imgIcon19" />
                            {formatarOcorrencia(v.ocorrencias[0])}
                          </p>
                        )}
                        <p>
                          <Icon group="detalhe" name="imgIcon20" />
                          {v.local}
                        </p>
                        <span className={s.relatedCause}>{v.causa.nome}</span>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            )}
            <Footer />
            <div className={s.mobileCta}>
              <span>
                <strong>{vaga.numero_vagas} vagas ofertadas</strong>
                <small>
                  {modalities[vaga.modalidade]} ·{' '}
                  {Number(vaga.carga_horaria).toLocaleString('pt-BR')} h
                </small>
              </span>
              {application(true)}
            </div>
            {gallery && (
              <Modal title="Fotos da atividade" onClose={() => setGallery(false)}>
                <div className={s.photoViewer}>
                  <img src={fotos[photo]} alt={`Foto ${photo + 1} da atividade ${vaga.titulo}`} />
                  <p>
                    {photo + 1} / {fotos.length}
                  </p>
                  <div>
                    <button disabled={photo === 0} onClick={() => setPhoto(photo - 1)}>
                      Anterior
                    </button>
                    <button
                      disabled={photo === fotos.length - 1}
                      onClick={() => setPhoto(photo + 1)}
                    >
                      Próxima
                    </button>
                  </div>
                </div>
              </Modal>
            )}
            {report && (
              <Modal title="Denunciar esta vaga" onClose={() => setReport(false)}>
                <p>
                  O envio de denúncias pela plataforma ainda não está disponível. Procure a
                  administração e informe o endereço desta vaga.
                </p>
                <button type="button" onClick={share}>
                  Copiar link da vaga
                </button>
              </Modal>
            )}
          </>
        )
      )}
    </div>
  )
}
