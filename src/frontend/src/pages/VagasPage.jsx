import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import EncontrosEditor from '../components/EncontrosEditor'
import VagaCard from '../components/VagaCard'
import VagaMediaFields from '../components/VagaMediaFields'
import { Footer, Header } from '../components/ui/Layout'
import { useAuth } from '../hooks/useAuth'
import { useVagas } from '../hooks/useVagas'
import { causaPorNome, useCausas } from '../hooks/useCausas'
import { enviarFotoVaga, publicarVaga } from '../services/vagasService'
import { criarEncontro, prepararOcorrencias } from '../utils/ocorrencias'
import { errosPublicacao, validarPublicacao } from '../utils/vagaForm'
import { MODALIDADES } from '../utils/vagaLabels'
import explorar from './Explore.module.css'
import styles from './Vagas.module.css'

const PERIODOS = {
  MANHA: 'Manhã',
  TARDE: 'Tarde',
  NOITE: 'Noite',
  MADRUGADA: 'Madrugada',
}

export default function VagasPage() {
  const { usuario, loading, restoreError } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const catalogo = useCausas()
  const idNaUrl = Number(params.get('causa_id'))
  const causaLegada = (params.get('causa') || '').trim().slice(0, 100)
  const causaSelecionada = idNaUrl > 0 && Number.isInteger(idNaUrl)
    ? catalogo.itens.find(causa => causa.id === idNaUrl) : causaPorNome(catalogo.itens, causaLegada)
  const causaId = idNaUrl > 0 && Number.isInteger(idNaUrl) ? String(idNaUrl) : String(causaSelecionada?.id || '')
  const filtros = {
    causa: causaId ? '' : causaLegada,
    causaId,
    modalidade: MODALIDADES[params.get('modalidade')] ? params.get('modalidade') : '',
    periodo: PERIODOS[params.get('periodo')] ? params.get('periodo') : '',
  }
  const filtrando = Boolean(filtros.causa || filtros.causaId || filtros.modalidade || filtros.periodo)
  const [pagina, setPagina] = useState(1)
  const { itens: vagas, total, por_pagina: porPagina, carregando, erro: erroCarregamento, recarregar } = useVagas(pagina, filtros)
  const [erro, setErro] = useState('')
  const [errosCampos, setErrosCampos] = useState({})
  const [erroEncontros, setErroEncontros] = useState('')
  const [encontros, setEncontros] = useState(() => [criarEncontro()])
  const [publicando, setPublicando] = useState(false)
  const [mensagem, setMensagem] = useState('')
  const dialogo = useRef(null)
  const botaoPublicar = useRef(null)
  const envioPendente = useRef(false)
  const [fotos, setFotos] = useState([])
  const [documentos, setDocumentos] = useState([])
  const [erroMidia, setErroMidia] = useState('')
  const fotosEnviadas = useRef(new Map())

  const sessaoValidada = !loading && !restoreError
  const podePublicar = sessaoValidada
    && usuario?.perfil === 'ORGANIZACAO'
    && usuario?.tipo === 'ONG'

  useEffect(() => {
    if (!podePublicar || !location.state?.abrirPublicacao) return
    if (!dialogo.current.open) dialogo.current.showModal()
    navigate('/vagas', { replace: true, state: null })
  }, [podePublicar, location.state, navigate])

  useEffect(() => {
    if (publicando) return
    const campo = Object.keys(errosCampos)[0]
    if (campo) dialogo.current?.querySelector(`[name="${campo}"]`)?.focus()
  }, [errosCampos, publicando])

  function filtrar(nome, valor) {
    const proximos = new URLSearchParams(params)
    if (nome === 'causa_id') proximos.delete('causa')
    if (!valor || (nome === 'causa_id' ? filtros.causaId === valor : proximos.get(nome) === valor)) proximos.delete(nome)
    else proximos.set(nome, valor)
    setParams(proximos, { replace: true })
    setPagina(1)
  }

  function limparFiltros() {
    setParams(new URLSearchParams(), { replace: true })
    setPagina(1)
  }

  function abrirFormulario() {
    if (!podePublicar) return
    setErro('')
    setErrosCampos({})
    setErroEncontros('')
    setEncontros([criarEncontro()])
    setFotos([]); setDocumentos([]); setErroMidia(''); fotosEnviadas.current.clear()
    dialogo.current.querySelector('form').reset()
    dialogo.current.showModal()
  }

  function alterarEncontros(novos) {
    setEncontros(novos)
    setErroEncontros('')
    if (novos.every((item) => item.dataInicio && item.horaInicio && item.dataFim && item.horaFim)) {
      try { prepararOcorrencias(novos) }
      catch (failure) { setErroEncontros(failure.message) }
    }
  }

  async function enviarPublicacao(event) {
    event.preventDefault()
    if (!podePublicar || envioPendente.current) return
    setErro('')
    setErrosCampos({})
    setErroEncontros('')

    const dados = new FormData(event.currentTarget)
    const titulo = String(dados.get('titulo')).trim()
    const descricao = String(dados.get('descricao')).trim()
    const atividades = String(dados.get('atividades')).trim()
    const causaId = Number(dados.get('causa_id'))
    const local = String(dados.get('local')).trim()
    const cargaHoraria = Number(dados.get('carga_horaria'))
    const numeroVagas = Number(dados.get('numero_vagas'))

    const campos = {
      titulo, descricao, atividades, causa_id: causaId, local,
      carga_horaria: cargaHoraria, numero_vagas: numeroVagas,
    }
    const invalidos = validarPublicacao(campos)
    if (!catalogo.itens.some(causa => causa.id === causaId && causa.ativo)) invalidos.causa_id = 'Selecione uma causa disponível.'
    const fotosInvalidas = fotos.length > 10 || fotos.some(file => !['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 5*1024*1024)
    const documentosInvalidos = documentos.some(doc => doc.nome.trim().length < 2 || (doc.modelo_url && !/^https:\/\/[^\s]+$/.test(doc.modelo_url)))
    setErroMidia(fotosInvalidas ? 'Use até 10 imagens JPG, PNG ou WebP de até 5 MB cada.' : documentosInvalidos ? 'Informe o nome de cada documento e um link HTTPS válido, quando houver modelo.' : '')
    setErrosCampos(invalidos)

    let ocorrencias
    try { ocorrencias = prepararOcorrencias(encontros) }
    catch (failure) {
      setErroEncontros(failure.message)
    }
    if (Object.keys(invalidos).length) setErro('Confira os campos indicados e tente novamente.')
    if (Object.keys(invalidos).length || !ocorrencias || fotosInvalidas || documentosInvalidos) return

    const payload = {
      ...campos,
      modalidade: String(dados.get('modalidade')),
      periodo: String(dados.get('periodo')),
      ocorrencias,
    }
    envioPendente.current = true
    setPublicando(true)
    try {
      const urls = []
      for (const file of fotos) {
        if (!fotosEnviadas.current.has(file)) fotosEnviadas.current.set(file, await enviarFotoVaga(file))
        urls.push(fotosEnviadas.current.get(file))
      }
      if (urls.length) payload.fotos = urls
      if (documentos.length) payload.documentos_exigidos = documentos.map(doc => ({nome:doc.nome.trim(),modelo_url:doc.modelo_url.trim() || null}))
      await publicarVaga(payload)
      setPagina(1)
      recarregar()
      setMensagem('Vaga publicada. As datas e os horários foram salvos.')
      dialogo.current.close()
    } catch (failure) {
      const detalhe = failure.response?.data?.detail
      if (Array.isArray(detalhe)) {
        const invalidos = errosPublicacao(detalhe)
        setErrosCampos(invalidos.campos)
        setErroEncontros(invalidos.encontros)
        setErro(invalidos.mensagem)
      } else {
        setErro(typeof detalhe === 'string' ? detalhe : 'Não foi possível publicar a vaga. Tente novamente.')
      }
    } finally {
      envioPendente.current = false
      setPublicando(false)
    }
  }

  function atributosCampo(campo) {
    return {
      'aria-invalid': Boolean(errosCampos[campo]),
      'aria-describedby': errosCampos[campo] ? `vaga-${campo}-erro` : undefined,
    }
  }

  function erroCampo(campo) {
    return errosCampos[campo] && <span className={styles.fieldError} id={`vaga-${campo}-erro`}>{errosCampos[campo]}</span>
  }

  return (
    <div className={explorar.page}>
      <a className={styles.skipLink} href="#conteudo-vagas">Ir para as vagas</a>
      <Header />

      <main id="conteudo-vagas">
        <section className={explorar.intro} aria-labelledby="titulo-vagas">
          <div className={explorar.introInner}>
            <div>
              <h1 id="titulo-vagas">Explorar vagas</h1>
              <p>{carregando ? 'Carregando as vagas abertas…' : `${total} ${total === 1 ? 'vaga aberta' : 'vagas abertas'} para você conhecer`}</p>
            </div>
            {podePublicar && (
              <button
                ref={botaoPublicar}
                className={explorar.publish}
                type="button"
                onClick={abrirFormulario}
                disabled={publicando}
              >
                Publicar vaga
              </button>
            )}
          </div>
          {loading && <p className={explorar.session} role="status">Validando sessão…</p>}
          {restoreError && <p className={explorar.session} role="status">
            <Link to="/login" state={{ from: '/vagas' }}>Valide sua sessão</Link> para publicar ou se candidatar.
          </p>}
        </section>

        <p className={explorar.feedback} role="status">{mensagem}</p>

        <div className={explorar.layout}>
          <aside className={explorar.filters} aria-label="Filtros">
            <div className={explorar.filtersHead}><h2>Filtros</h2>{filtrando && <button type="button" onClick={limparFiltros}>Limpar</button>}</div>
            <fieldset><legend>Causa</legend>
              {catalogo.carregando && <p role="status">Carregando causas…</p>}
              {catalogo.erro && <div><p role="alert">{catalogo.erro}</p><button className={explorar.retry} type="button" onClick={catalogo.recarregar}>Tentar carregar causas novamente</button></div>}
              <div className={explorar.options}>{catalogo.itens.map(causa =>
                <button key={causa.id} type="button" aria-pressed={filtros.causaId === String(causa.id)} onClick={() => filtrar('causa_id', String(causa.id))}>{causa.nome}{!causa.ativo && ' (anterior)'}</button>)}</div>
            </fieldset>
            <fieldset><legend>Modalidade</legend>
              <div className={explorar.segmented}>{Object.entries(MODALIDADES).map(([valor, texto]) =>
                <button key={valor} type="button" aria-pressed={filtros.modalidade === valor} onClick={() => filtrar('modalidade', valor)}>{texto}</button>)}</div>
            </fieldset>
            <fieldset><legend>Período</legend>
              <div className={explorar.options}>{Object.entries(PERIODOS).map(([valor, texto]) =>
                <button key={valor} type="button" aria-pressed={filtros.periodo === valor} onClick={() => filtrar('periodo', valor)}>{texto}</button>)}</div>
            </fieldset>
          </aside>

          <section className={explorar.results} aria-labelledby="vagas-publicadas">
            <div className={explorar.sectionHeading}>
              <h2 id="vagas-publicadas">{filtrando ? 'Resultado da busca' : 'Vagas publicadas'}</h2>
              <span>{total} {total === 1 ? 'oportunidade' : 'oportunidades'}</span>
            </div>
            {filtrando && <ul className={explorar.active} aria-label="Filtros ativos">
              {(filtros.causa || filtros.causaId) && <li><button type="button" onClick={() => filtrar('causa_id', '')}>{causaSelecionada?.nome || filtros.causa || 'Causa selecionada'}<span aria-hidden="true">×</span><span className={explorar.srOnly}>remover filtro</span></button></li>}
              {filtros.modalidade && <li><button type="button" onClick={() => filtrar('modalidade', '')}>{MODALIDADES[filtros.modalidade]}<span aria-hidden="true">×</span><span className={explorar.srOnly}>remover filtro</span></button></li>}
              {filtros.periodo && <li><button type="button" onClick={() => filtrar('periodo', '')}>{PERIODOS[filtros.periodo]}<span aria-hidden="true">×</span><span className={explorar.srOnly}>remover filtro</span></button></li>}
            </ul>}

            {carregando ? (
              <p className={explorar.state} role="status">Carregando vagas…</p>
            ) : erroCarregamento ? (
              <div className={explorar.state}>
                <p role="alert">{erroCarregamento}</p>
                <button className={explorar.retry} type="button" onClick={recarregar}>Tentar novamente</button>
              </div>
            ) : vagas.length === 0 ? (
              <div className={explorar.state}>
                <p>{filtrando ? 'Nenhuma vaga aberta com esses filtros.' : 'Ainda não há vagas publicadas.'}</p>
                {filtrando && <button className={explorar.retry} type="button" onClick={limparFiltros}>Limpar filtros</button>}
              </div>
            ) : (
              <ul className={explorar.grid}>
                {vagas.map((vaga) => <li key={vaga.id}><VagaCard vaga={vaga} /></li>)}
              </ul>
            )}
            {!carregando && !erroCarregamento && total > porPagina && (
              <nav className={explorar.pagination} aria-label="Páginas de vagas">
                <button type="button" disabled={pagina === 1} onClick={() => setPagina((atual) => atual - 1)}>Anterior</button>
                <span>Página {pagina} de {Math.ceil(total / porPagina)}</span>
                <button type="button" disabled={pagina * porPagina >= total} onClick={() => setPagina((atual) => atual + 1)}>Próxima</button>
              </nav>
            )}
          </section>
        </div>
      </main>

      <Footer />

      {podePublicar && (
        <dialog
          ref={dialogo}
          className={styles.dialog}
          aria-labelledby="titulo-publicacao"
          aria-describedby="aviso-publicacao"
          onClose={() => botaoPublicar.current?.focus()}
          onCancel={(event) => { if (publicando) event.preventDefault() }}
        >
          <div className={styles.dialogHeader}>
            <h2 id="titulo-publicacao">Publicar vaga</h2>
            <button type="button" disabled={publicando} onClick={() => dialogo.current.close()}>Fechar</button>
          </div>
          <p id="aviso-publicacao" className={styles.demoNotice}>
            Descreva a atividade e adicione todos os encontros com suas datas e horários.
          </p>

          <form noValidate aria-label="Publicar vaga" onSubmit={enviarPublicacao} aria-busy={publicando}>
            <fieldset className={styles.publicationFields} disabled={publicando}>
            <div className={styles.formGrid}>
              <div className={`${styles.formField} ${styles.fullWidth}`}>
                <label htmlFor="vaga-titulo">Título da vaga</label>
                <input id="vaga-titulo" name="titulo" minLength={3} maxLength={150} required {...atributosCampo('titulo')} />
                {erroCampo('titulo')}
              </div>
              <div className={`${styles.formField} ${styles.fullWidth}`}>
                <label htmlFor="vaga-descricao">Descrição</label>
                <textarea id="vaga-descricao" name="descricao" minLength={10} maxLength={5000} rows={3} required {...atributosCampo('descricao')} />
                {erroCampo('descricao')}
              </div>
              <div className={`${styles.formField} ${styles.fullWidth}`}>
                <label htmlFor="vaga-atividades">Atividades do voluntário</label>
                <textarea id="vaga-atividades" name="atividades" minLength={10} maxLength={5000} rows={3} required {...atributosCampo('atividades')} />
                {erroCampo('atividades')}
              </div>
              <div className={styles.formField}>
                <label htmlFor="vaga-causa">Causa</label>
                <select id="vaga-causa" name="causa_id" required disabled={catalogo.carregando || Boolean(catalogo.erro)} {...atributosCampo('causa_id')}>
                  <option value="">Selecione uma causa</option>{catalogo.itens.filter(causa => causa.ativo).map(causa => <option key={causa.id} value={causa.id}>{causa.nome}</option>)}
                </select>
                {erroCampo('causa_id')}
                {catalogo.erro && <div><p role="alert">{catalogo.erro}</p><button className={explorar.retry} type="button" onClick={catalogo.recarregar}>Tentar carregar causas novamente</button></div>}
              </div>
              <div className={styles.formField}>
                <label htmlFor="vaga-modalidade">Modalidade</label>
                <select id="vaga-modalidade" name="modalidade" required {...atributosCampo('modalidade')}>
                  {Object.entries(MODALIDADES).map(([valor, texto]) => (
                    <option key={valor} value={valor}>{texto}</option>
                  ))}
                </select>
                {erroCampo('modalidade')}
              </div>
              <div className={`${styles.formField} ${styles.fullWidth}`}>
                <label htmlFor="vaga-local">Local ou atividade remota</label>
                <input id="vaga-local" name="local" minLength={3} maxLength={500} required {...atributosCampo('local')} />
                {erroCampo('local')}
              </div>
              <div className={styles.formField}>
                <label htmlFor="vaga-periodo">Período</label>
                <select id="vaga-periodo" name="periodo" required {...atributosCampo('periodo')}>
                  {Object.entries(PERIODOS).map(([valor, texto]) => (
                    <option key={valor} value={valor}>{texto}</option>
                  ))}
                </select>
                {erroCampo('periodo')}
              </div>
              <div className={styles.formField}>
                <label htmlFor="vaga-carga">Carga horária (horas)</label>
                <input id="vaga-carga" name="carga_horaria" type="number" min="0.01" max="99999.99" step="0.01" required {...atributosCampo('carga_horaria')} />
                {erroCampo('carga_horaria')}
              </div>
              <div className={styles.formField}>
                <label htmlFor="vaga-quantidade">Número de vagas</label>
                <input id="vaga-quantidade" name="numero_vagas" type="number" min="1" step="1" required {...atributosCampo('numero_vagas')} />
                {erroCampo('numero_vagas')}
              </div>
            </div>
            <EncontrosEditor encontros={encontros} onChange={alterarEncontros} erro={erroEncontros} />
            <VagaMediaFields fotos={fotos} setFotos={setFotos} documentos={documentos} setDocumentos={setDocumentos} error={erroMidia} />

            {erro && <p className={styles.error} role="alert">{erro}</p>}

            <div className={styles.formActions}>
              <button type="button" onClick={() => dialogo.current.close()}>Cancelar</button>
              <button className={styles.primaryButton} type="submit">
                {publicando ? 'Publicando…' : 'Publicar vaga'}
              </button>
            </div>
            </fieldset>
          </form>
        </dialog>
      )}
    </div>
  )
}
