import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import EncontrosEditor from '../components/EncontrosEditor'
import { useAuth } from '../hooks/useAuth'
import { useVagas } from '../hooks/useVagas'
import { publicarVaga } from '../services/vagasService'
import { criarEncontro, formatarOcorrencia, prepararOcorrencias } from '../utils/ocorrencias'
import { profileRoute } from '../utils/profileRoutes'
import styles from './Vagas.module.css'

const MODALIDADES = {
  PRESENCIAL: 'Presencial',
  REMOTO: 'Remoto',
  HIBRIDO: 'Híbrido',
}

const PERIODOS = {
  MANHA: 'Manhã',
  TARDE: 'Tarde',
  NOITE: 'Noite',
  MADRUGADA: 'Madrugada',
}

export default function VagasPage() {
  const { usuario, loading, restoreError, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [pagina, setPagina] = useState(1)
  const { itens: vagas, total, por_pagina: porPagina, carregando, erro: erroCarregamento, recarregar } = useVagas(pagina)
  const [erro, setErro] = useState('')
  const [erroEncontros, setErroEncontros] = useState('')
  const [encontros, setEncontros] = useState(() => [criarEncontro()])
  const [publicando, setPublicando] = useState(false)
  const [mensagem, setMensagem] = useState('')
  const dialogo = useRef(null)
  const botaoPublicar = useRef(null)
  const envioPendente = useRef(false)

  const sessaoValidada = !loading && !restoreError
  const podePublicar = sessaoValidada
    && usuario?.perfil === 'ORGANIZACAO'
    && usuario?.tipo === 'ONG'

  useEffect(() => {
    if (!podePublicar || !location.state?.abrirPublicacao) return
    if (!dialogo.current.open) dialogo.current.showModal()
    navigate('/vagas', { replace: true, state: null })
  }, [podePublicar, location.state, navigate])

  function abrirFormulario() {
    if (!podePublicar) return
    setErro('')
    setErroEncontros('')
    setEncontros([criarEncontro()])
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
    setErroEncontros('')

    const dados = new FormData(event.currentTarget)
    const titulo = String(dados.get('titulo')).trim()
    const descricao = String(dados.get('descricao')).trim()
    const atividades = String(dados.get('atividades')).trim()
    const causa = String(dados.get('causa')).trim()
    const local = String(dados.get('local')).trim()
    const cargaHoraria = Number(dados.get('carga_horaria'))
    const numeroVagas = Number(dados.get('numero_vagas'))

    if (titulo.length < 3 || descricao.length < 10 || atividades.length < 10 || causa.length < 3 || local.length < 3) {
      setErro('Confira o título, a descrição, as atividades, a causa e o local da vaga.')
      return
    }
    if (!Number.isFinite(cargaHoraria) || cargaHoraria <= 0
      || !Number.isInteger(numeroVagas) || numeroVagas < 1) {
      setErro('Informe uma carga horária positiva e pelo menos uma vaga.')
      return
    }

    let ocorrencias
    try { ocorrencias = prepararOcorrencias(encontros) }
    catch (failure) {
      setErroEncontros(failure.message)
      return
    }

    const payload = {
      titulo,
      descricao,
      atividades,
      causa,
      local,
      carga_horaria: cargaHoraria,
      numero_vagas: numeroVagas,
      modalidade: String(dados.get('modalidade')),
      periodo: String(dados.get('periodo')),
      ocorrencias,
    }
    envioPendente.current = true
    setPublicando(true)
    try {
      await publicarVaga(payload)
      setPagina(1)
      recarregar()
      setMensagem('Vaga publicada. As datas e os horários foram salvos.')
      dialogo.current.close()
    } catch (failure) {
      const detalhe = failure.response?.data?.detail
      setErro(typeof detalhe === 'string' ? detalhe : 'Não foi possível publicar a vaga. Tente novamente.')
    } finally {
      envioPendente.current = false
      setPublicando(false)
    }
  }

  return (
    <div className={styles.page}>
      <a className={styles.skipLink} href="#conteudo-vagas">Ir para as vagas</a>

      <header className={styles.header}>
        <Link className={styles.brand} to="/">VolunJá</Link>
        <nav className={styles.navigation} aria-label="Navegação principal">
          <Link to="/">Início</Link>
          <Link to="/vagas" aria-current="page">Vagas</Link>
          {loading ? (
            <span role="status">Validando sessão…</span>
          ) : restoreError ? (
            <Link to="/login" state={{ from: '/vagas' }}>Validar sessão</Link>
          ) : usuario ? (
            <>
              <Link to={profileRoute(usuario.perfil)}>Minha área</Link>
              <button type="button" onClick={() => logout()}>Sair</button>
            </>
          ) : (
            <Link to="/login" state={{ from: '/vagas' }}>Entrar</Link>
          )}
        </nav>
      </header>

      <main id="conteudo-vagas">
        <section className={styles.intro} aria-labelledby="titulo-vagas">
          <div>
            <h1 id="titulo-vagas">Vagas de voluntariado</h1>
            <p>Encontre uma oportunidade para dedicar seu tempo a uma causa.</p>
          </div>
          {podePublicar && (
            <button
              ref={botaoPublicar}
              className={styles.primaryButton}
              type="button"
              onClick={abrirFormulario}
              disabled={publicando}
            >
              Publicar vaga
            </button>
          )}
        </section>

        <p className={styles.feedback} role="status">{mensagem}</p>

        <section aria-labelledby="vagas-publicadas">
          <div className={styles.sectionHeading}>
            <h2 id="vagas-publicadas">Vagas publicadas</h2>
            <span>{total} {total === 1 ? 'oportunidade' : 'oportunidades'}</span>
          </div>

          {carregando ? (
            <p role="status">Carregando vagas…</p>
          ) : erroCarregamento ? (
            <div className={styles.empty}>
              <p role="alert">{erroCarregamento}</p>
              <button className={styles.secondaryButton} type="button" onClick={recarregar}>Tentar novamente</button>
            </div>
          ) : vagas.length === 0 ? (
            <p className={styles.empty}>Ainda não há vagas publicadas.</p>
          ) : (
            <ul className={styles.grid}>
              {vagas.map((vaga) => (
                <li key={vaga.id}>
                  <article className={styles.vacancy} aria-labelledby={`vaga-${vaga.id}`}>
                    <span className={styles.cause}>{vaga.causa.nome}</span>
                    <h3 id={`vaga-${vaga.id}`}>{vaga.titulo}</h3>
                    <p className={styles.organization}>{vaga.organizacao.nome}</p>
                    <p className={styles.description}>{vaga.descricao}</p>
                    <dl className={styles.metadata}>
                      <div><dt>Modalidade</dt><dd>{MODALIDADES[vaga.modalidade]}</dd></div>
                      <div><dt>Local</dt><dd>{vaga.local}</dd></div>
                      <div><dt>Período</dt><dd>{PERIODOS[vaga.periodo]}</dd></div>
                      <div><dt>Carga horária</dt><dd>{vaga.carga_horaria} h</dd></div>
                      <div><dt>Vagas disponíveis</dt><dd>{vaga.numero_vagas}</dd></div>
                    </dl>
                    <div className={styles.meetingSummary}>
                      <h4>Datas e horários</h4>
                      <ul>
                        {vaga.ocorrencias.map((item) => (
                          <li key={item.id}>{formatarOcorrencia(item)}</li>
                        ))}
                      </ul>
                      <small>Horário de Brasília</small>
                    </div>
                  </article>
                </li>
              ))}
            </ul>
          )}
          {!carregando && !erroCarregamento && total > porPagina && (
            <nav className={styles.pagination} aria-label="Páginas de vagas">
              <button type="button" disabled={pagina === 1} onClick={() => setPagina((atual) => atual - 1)}>Anterior</button>
              <span>Página {pagina} de {Math.ceil(total / porPagina)}</span>
              <button type="button" disabled={pagina * porPagina >= total} onClick={() => setPagina((atual) => atual + 1)}>Próxima</button>
            </nav>
          )}
        </section>
      </main>

      <footer className={styles.footer}>VolunJá · Conectando pessoas e causas</footer>

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

          <form aria-label="Publicar vaga" onSubmit={enviarPublicacao} aria-busy={publicando}>
            <fieldset className={styles.publicationFields} disabled={publicando}>
            <div className={styles.formGrid}>
              <label className={styles.fullWidth} htmlFor="vaga-titulo">
                Título da vaga
                <input id="vaga-titulo" name="titulo" minLength={3} maxLength={150} required />
              </label>
              <label className={styles.fullWidth} htmlFor="vaga-descricao">
                Descrição
                <textarea id="vaga-descricao" name="descricao" minLength={10} maxLength={5000} rows={3} required />
              </label>
              <label className={styles.fullWidth} htmlFor="vaga-atividades">
                Atividades do voluntário
                <textarea id="vaga-atividades" name="atividades" minLength={10} maxLength={5000} rows={3} required />
              </label>
              <label htmlFor="vaga-causa">
                Causa
                <input id="vaga-causa" name="causa" minLength={3} maxLength={100} required />
              </label>
              <label htmlFor="vaga-modalidade">
                Modalidade
                <select id="vaga-modalidade" name="modalidade" required>
                  {Object.entries(MODALIDADES).map(([valor, texto]) => (
                    <option key={valor} value={valor}>{texto}</option>
                  ))}
                </select>
              </label>
              <label className={styles.fullWidth} htmlFor="vaga-local">
                Local ou atividade remota
                <input id="vaga-local" name="local" minLength={3} maxLength={200} required />
              </label>
              <label htmlFor="vaga-periodo">
                Período
                <select id="vaga-periodo" name="periodo" required>
                  {Object.entries(PERIODOS).map(([valor, texto]) => (
                    <option key={valor} value={valor}>{texto}</option>
                  ))}
                </select>
              </label>
              <label htmlFor="vaga-carga">
                Carga horária (horas)
                <input id="vaga-carga" name="carga_horaria" type="number" min="0.5" step="0.5" required />
              </label>
              <label htmlFor="vaga-quantidade">
                Número de vagas
                <input id="vaga-quantidade" name="numero_vagas" type="number" min="1" step="1" required />
              </label>
            </div>
            <EncontrosEditor encontros={encontros} onChange={alterarEncontros} erro={erroEncontros} />

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
