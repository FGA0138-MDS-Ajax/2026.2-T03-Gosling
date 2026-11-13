import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import EncontrosEditor from '../components/EncontrosEditor'
import { useAuth } from '../hooks/useAuth'
import { useVagas } from '../hooks/useVagas'
import { publicarVaga } from '../services/vagasService'
import { criarEncontro, formatarOcorrencia, prepararOcorrencias } from '../utils/ocorrencias'
import { profileRoute } from '../utils/profileRoutes'
import { errosPublicacao, validarPublicacao } from '../utils/vagaForm'
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
  const [errosCampos, setErrosCampos] = useState({})
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

  useEffect(() => {
    if (publicando) return
    const campo = Object.keys(errosCampos)[0]
    if (campo) dialogo.current?.querySelector(`[name="${campo}"]`)?.focus()
  }, [errosCampos, publicando])

  function abrirFormulario() {
    if (!podePublicar) return
    setErro('')
    setErrosCampos({})
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
    setErrosCampos({})
    setErroEncontros('')

    const dados = new FormData(event.currentTarget)
    const titulo = String(dados.get('titulo')).trim()
    const descricao = String(dados.get('descricao')).trim()
    const atividades = String(dados.get('atividades')).trim()
    const causa = String(dados.get('causa')).trim()
    const local = String(dados.get('local')).trim()
    const cargaHoraria = Number(dados.get('carga_horaria'))
    const numeroVagas = Number(dados.get('numero_vagas'))

    const campos = {
      titulo, descricao, atividades, causa, local,
      carga_horaria: cargaHoraria, numero_vagas: numeroVagas,
    }
    const invalidos = validarPublicacao(campos)
    setErrosCampos(invalidos)

    let ocorrencias
    try { ocorrencias = prepararOcorrencias(encontros) }
    catch (failure) {
      setErroEncontros(failure.message)
    }
    if (Object.keys(invalidos).length) setErro('Confira os campos indicados e tente novamente.')
    if (Object.keys(invalidos).length || !ocorrencias) return

    const payload = {
      ...campos,
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
                <input id="vaga-causa" name="causa" minLength={3} maxLength={100} required {...atributosCampo('causa')} />
                {erroCampo('causa')}
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
