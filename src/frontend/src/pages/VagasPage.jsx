import { useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import PublicacaoVagaDialog from '../components/PublicacaoVagaDialog'
import VagaCard from '../components/VagaCard'
import { Footer, Header } from '../components/ui/Layout'
import { useAuth } from '../hooks/useAuth'
import { useVagas } from '../hooks/useVagas'
import { causaPorNome, useCausas } from '../hooks/useCausas'
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
  const idRascunho = params.get('rascunho')
  const rascunho = /^[1-9][0-9]*$/.test(idRascunho ?? '') ? idRascunho : null
  const catalogo = useCausas()
  const idNaUrl = Number(params.get('causa_id'))
  const causaLegada = (params.get('causa') || '').trim().slice(0, 100)
  const causaSelecionada =
    idNaUrl > 0 && Number.isInteger(idNaUrl)
      ? catalogo.itens.find(causa => causa.id === idNaUrl)
      : causaPorNome(catalogo.itens, causaLegada)
  const causaId =
    idNaUrl > 0 && Number.isInteger(idNaUrl) ? String(idNaUrl) : String(causaSelecionada?.id || '')
  const filtros = {
    causa: causaId ? '' : causaLegada,
    causaId,
    modalidade: MODALIDADES[params.get('modalidade')] ? params.get('modalidade') : '',
    periodo: PERIODOS[params.get('periodo')] ? params.get('periodo') : '',
  }
  const filtrando = Boolean(
    filtros.causa || filtros.causaId || filtros.modalidade || filtros.periodo,
  )
  const [pagina, setPagina] = useState(1)
  const {
    itens: vagas,
    total,
    por_pagina: porPagina,
    carregando,
    erro: erroCarregamento,
    recarregar,
  } = useVagas(pagina, filtros)
  const [formularioAberto, setFormularioAberto] = useState(false)
  const [mensagem, setMensagem] = useState('')
  const botaoPublicar = useRef(null)

  const sessaoValidada = !loading && !restoreError
  const podePublicar =
    sessaoValidada && usuario?.perfil === 'ORGANIZACAO' && usuario?.tipo === 'ONG'

  function filtrar(nome, valor) {
    const proximos = new URLSearchParams(params)
    if (nome === 'causa_id') proximos.delete('causa')
    if (!valor || (nome === 'causa_id' ? filtros.causaId === valor : proximos.get(nome) === valor))
      proximos.delete(nome)
    else proximos.set(nome, valor)
    setParams(proximos, { replace: true })
    setPagina(1)
  }

  function limparFiltros() {
    setParams(new URLSearchParams(), { replace: true })
    setPagina(1)
  }

  function fecharFormulario() {
    setFormularioAberto(false)
    if (rascunho || location.state?.abrirPublicacao) {
      const busca = new URLSearchParams(params)
      busca.delete('rascunho')
      navigate(
        { pathname: location.pathname, search: busca.toString() },
        { replace: true, state: null },
      )
    }
    botaoPublicar.current?.focus()
  }

  function abrirRascunho(id) {
    const busca = new URLSearchParams(params)
    busca.set('rascunho', String(id))
    setFormularioAberto(false)
    navigate(
      { pathname: location.pathname, search: busca.toString() },
      { replace: true, state: null },
    )
  }

  function vagaPublicada() {
    setPagina(1)
    recarregar()
    setMensagem('Vaga publicada. As datas e os hor?rios foram salvos.')
  }

  return (
    <div className={explorar.page}>
      <a className={styles.skipLink} href="#conteudo-vagas">
        Ir para as vagas
      </a>
      <Header />

      <main id="conteudo-vagas">
        <section className={explorar.intro} aria-labelledby="titulo-vagas">
          <div className={explorar.introInner}>
            <div>
              <h1 id="titulo-vagas">Explorar vagas</h1>
              <p>
                {carregando
                  ? 'Carregando as vagas abertas…'
                  : `${total} ${total === 1 ? 'vaga aberta' : 'vagas abertas'} para você conhecer`}
              </p>
            </div>
            {podePublicar && (
              <button
                ref={botaoPublicar}
                className={explorar.publish}
                type="button"
                onClick={() => setFormularioAberto(true)}
              >
                Publicar vaga
              </button>
            )}
          </div>
          {loading && (
            <p className={explorar.session} role="status">
              Validando sessão…
            </p>
          )}
          {restoreError && (
            <p className={explorar.session} role="status">
              <Link to="/login" state={{ from: '/vagas' }}>
                Valide sua sessão
              </Link>{' '}
              para publicar ou se candidatar.
            </p>
          )}
        </section>

        <p className={explorar.feedback} role="status">
          {mensagem}
        </p>

        <div className={explorar.layout}>
          <aside className={explorar.filters} aria-label="Filtros">
            <div className={explorar.filtersHead}>
              <h2>Filtros</h2>
              {filtrando && (
                <button type="button" onClick={limparFiltros}>
                  Limpar
                </button>
              )}
            </div>
            <fieldset>
              <legend>Causa</legend>
              {catalogo.carregando && <p role="status">Carregando causas…</p>}
              {catalogo.erro && (
                <div>
                  <p role="alert">{catalogo.erro}</p>
                  <button className={explorar.retry} type="button" onClick={catalogo.recarregar}>
                    Tentar carregar causas novamente
                  </button>
                </div>
              )}
              <div className={explorar.options}>
                {catalogo.itens.map(causa => (
                  <button
                    key={causa.id}
                    type="button"
                    aria-pressed={filtros.causaId === String(causa.id)}
                    onClick={() => filtrar('causa_id', String(causa.id))}
                  >
                    {causa.nome}
                    {!causa.ativo && ' (anterior)'}
                  </button>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend>Modalidade</legend>
              <div className={explorar.segmented}>
                {Object.entries(MODALIDADES).map(([valor, texto]) => (
                  <button
                    key={valor}
                    type="button"
                    aria-pressed={filtros.modalidade === valor}
                    onClick={() => filtrar('modalidade', valor)}
                  >
                    {texto}
                  </button>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend>Período</legend>
              <div className={explorar.options}>
                {Object.entries(PERIODOS).map(([valor, texto]) => (
                  <button
                    key={valor}
                    type="button"
                    aria-pressed={filtros.periodo === valor}
                    onClick={() => filtrar('periodo', valor)}
                  >
                    {texto}
                  </button>
                ))}
              </div>
            </fieldset>
          </aside>

          <section className={explorar.results} aria-labelledby="vagas-publicadas">
            <div className={explorar.sectionHeading}>
              <h2 id="vagas-publicadas">{filtrando ? 'Resultado da busca' : 'Vagas publicadas'}</h2>
              <span>
                {total} {total === 1 ? 'oportunidade' : 'oportunidades'}
              </span>
            </div>
            {filtrando && (
              <ul className={explorar.active} aria-label="Filtros ativos">
                {(filtros.causa || filtros.causaId) && (
                  <li>
                    <button type="button" onClick={() => filtrar('causa_id', '')}>
                      {causaSelecionada?.nome || filtros.causa || 'Causa selecionada'}
                      <span aria-hidden="true">×</span>
                      <span className={explorar.srOnly}>remover filtro</span>
                    </button>
                  </li>
                )}
                {filtros.modalidade && (
                  <li>
                    <button type="button" onClick={() => filtrar('modalidade', '')}>
                      {MODALIDADES[filtros.modalidade]}
                      <span aria-hidden="true">×</span>
                      <span className={explorar.srOnly}>remover filtro</span>
                    </button>
                  </li>
                )}
                {filtros.periodo && (
                  <li>
                    <button type="button" onClick={() => filtrar('periodo', '')}>
                      {PERIODOS[filtros.periodo]}
                      <span aria-hidden="true">×</span>
                      <span className={explorar.srOnly}>remover filtro</span>
                    </button>
                  </li>
                )}
              </ul>
            )}

            {carregando ? (
              <p className={explorar.state} role="status">
                Carregando vagas…
              </p>
            ) : erroCarregamento ? (
              <div className={explorar.state}>
                <p role="alert">{erroCarregamento}</p>
                <button className={explorar.retry} type="button" onClick={recarregar}>
                  Tentar novamente
                </button>
              </div>
            ) : vagas.length === 0 ? (
              <div className={explorar.state}>
                <p>
                  {filtrando
                    ? 'Nenhuma vaga aberta com esses filtros.'
                    : 'Ainda não há vagas publicadas.'}
                </p>
                {filtrando && (
                  <button className={explorar.retry} type="button" onClick={limparFiltros}>
                    Limpar filtros
                  </button>
                )}
              </div>
            ) : (
              <ul className={explorar.grid}>
                {vagas.map(vaga => (
                  <li key={vaga.id}>
                    <VagaCard vaga={vaga} />
                  </li>
                ))}
              </ul>
            )}
            {!carregando && !erroCarregamento && total > porPagina && (
              <nav className={explorar.pagination} aria-label="Páginas de vagas">
                <button
                  type="button"
                  disabled={pagina === 1}
                  onClick={() => setPagina(atual => atual - 1)}
                >
                  Anterior
                </button>
                <span>
                  Página {pagina} de {Math.ceil(total / porPagina)}
                </span>
                <button
                  type="button"
                  disabled={pagina * porPagina >= total}
                  onClick={() => setPagina(atual => atual + 1)}
                >
                  Próxima
                </button>
              </nav>
            )}
          </section>
        </div>
      </main>

      <Footer />

      {podePublicar && (rascunho || formularioAberto || location.state?.abrirPublicacao) && (
        <PublicacaoVagaDialog
          key={rascunho ?? 'novo'}
          catalogo={catalogo}
          id={rascunho}
          onClose={fecharFormulario}
          onPublicada={vagaPublicada}
          onSalvo={abrirRascunho}
        />
      )}
    </div>
  )
}
