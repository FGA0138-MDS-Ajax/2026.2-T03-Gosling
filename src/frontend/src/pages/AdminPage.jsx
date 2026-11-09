import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import AdminContaForm from '../components/AdminContaForm'
import { useAuth } from '../hooks/useAuth'
import { consultarCadastro, criarCadastro, excluirCadastro, listarCadastros } from '../services/adminService'
import { PROFILE_NAMES } from '../utils/profileRoutes'
import styles from './Admin.module.css'

function nomePerfil(conta) {
  if (conta.perfil === 'ORGANIZACAO') return conta.tipo === 'PROJETO_SOCIAL' ? 'Projeto social' : 'ONG'
  return PROFILE_NAMES[conta.perfil]
}

function mensagemErro(failure, padrao) {
  const detalhe = failure.response?.data?.detail
  if (typeof detalhe === 'string') return detalhe
  if (Array.isArray(detalhe) && detalhe.some((item) => item.loc?.at(-1) === 'cnpj')) {
    return 'Confira o CNPJ informado.'
  }
  return padrao
}

const CAMPOS_DETALHE = [
  ['nome', 'Nome'], ['email', 'E-mail'], ['razao_social', 'Razão social'],
  ['cnpj', 'CNPJ'], ['area_atuacao', 'Área de atuação'], ['endereco', 'Endereço'],
  ['responsavel', 'Responsável'], ['telefone', 'Telefone'], ['descricao', 'Descrição'],
]

export default function AdminPage() {
  const { usuario, logout } = useAuth()
  const [filtros, setFiltros] = useState({ pagina: 1, busca: '', perfil: '', ativo: '' })
  const [revisao, setRevisao] = useState(0)
  const [resultado, setResultado] = useState({ itens: [], total: 0, por_pagina: 20, chave: null, erro: '' })
  const [mensagem, setMensagem] = useState('')
  const [erroAcao, setErroAcao] = useState('')
  const [modo, setModo] = useState('criar')
  const [selecionado, setSelecionado] = useState(null)
  const [salvando, setSalvando] = useState(false)
  const [carregandoCadastro, setCarregandoCadastro] = useState(null)
  const [versaoFormulario, setVersaoFormulario] = useState(0)
  const dialogo = useRef(null)
  const formulario = useRef(null)
  const disparador = useRef(null)
  const novoCadastro = useRef(null)
  const envioPendente = useRef(false)
  const chave = JSON.stringify([filtros, revisao])
  const carregando = resultado.chave !== chave

  useEffect(() => {
    let ativo = true
    const controller = new AbortController()
    const chaveDaConsulta = JSON.stringify([filtros, revisao])
    listarCadastros(filtros, controller.signal)
      .then((data) => {
        if (ativo) setResultado({ ...data, chave: chaveDaConsulta, erro: '' })
      })
      .catch(() => {
        if (ativo) setResultado({
          itens: [], total: 0, por_pagina: 20, chave: chaveDaConsulta,
          erro: 'Não foi possível carregar os cadastros. Tente novamente.',
        })
      })
    return () => { ativo = false; controller.abort() }
  }, [filtros, revisao])

  function atualizarLista() {
    setFiltros((atuais) => ({ ...atuais, pagina: 1 }))
    setRevisao((atual) => atual + 1)
  }

  function filtrar(event) {
    event.preventDefault()
    const dados = new FormData(event.currentTarget)
    setFiltros({
      pagina: 1, busca: String(dados.get('busca')).trim(),
      perfil: String(dados.get('perfil')), ativo: String(dados.get('ativo')),
    })
  }

  function abrirCriacao(event) {
    disparador.current = event.currentTarget
    setModo('criar')
    setSelecionado(null)
    setErroAcao('')
    setVersaoFormulario((atual) => atual + 1)
    dialogo.current.showModal()
  }

  async function abrirCadastro(event, cadastro, acao) {
    if (carregandoCadastro !== null) return
    disparador.current = event.currentTarget
    setCarregandoCadastro(cadastro.id)
    setErroAcao('')
    try {
      const detalhes = await consultarCadastro(cadastro.id)
      setSelecionado(detalhes)
      setModo(acao)
      dialogo.current.showModal()
    } catch (failure) {
      setMensagem(mensagemErro(failure, 'Não foi possível abrir o cadastro. Tente novamente.'))
    } finally {
      setCarregandoCadastro(null)
    }
  }

  async function salvar(payload) {
    if (envioPendente.current) return
    envioPendente.current = true
    setSalvando(true)
    setErroAcao('')
    try {
      await criarCadastro(payload)
      formulario.current?.reset()
      dialogo.current.close()
      setMensagem('Cadastro criado. A conta pode usar o e-mail e a senha informados.')
      atualizarLista()
    } catch (failure) {
      setErroAcao(mensagemErro(failure, 'Não foi possível criar o cadastro. Confira os campos e tente novamente.'))
    } finally {
      envioPendente.current = false
      setSalvando(false)
    }
  }

  async function confirmarExclusao() {
    if (!selecionado || envioPendente.current) return
    envioPendente.current = true
    setSalvando(true)
    setErroAcao('')
    try {
      await excluirCadastro(selecionado.id, selecionado.quantidade_vagas > 0)
      dialogo.current.close()
      setMensagem(`Cadastro de ${selecionado.nome} excluído.`)
      setSelecionado(null)
      atualizarLista()
    } catch (failure) {
      setErroAcao(mensagemErro(failure, 'Não foi possível excluir o cadastro. Tente novamente.'))
    } finally {
      envioPendente.current = false
      setSalvando(false)
    }
  }

  function devolverFoco() {
    const destino = disparador.current?.isConnected ? disparador.current : novoCadastro.current
    destino?.focus()
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link className={styles.brand} to="/">VolunJá</Link>
        <nav className={styles.navigation} aria-label="Navegação administrativa">
          <Link to="/vagas">Ver vagas</Link>
          <button className={styles.secondaryButton} type="button" onClick={() => logout()}>Sair</button>
        </nav>
      </header>

      <main>
        <section className={styles.intro}>
          <div><h1>Área de Administrador</h1><p>Consulte e gerencie os cadastros da plataforma.</p></div>
          <button ref={novoCadastro} className={styles.primaryButton} type="button" onClick={abrirCriacao}>Novo cadastro</button>
        </section>

        <p className={styles.feedback} role="status">{mensagem}</p>

        <section aria-labelledby="titulo-cadastros">
          <div className={styles.sectionHeading}>
            <h2 id="titulo-cadastros">Cadastros</h2>
            {!carregando && <span>{resultado.total} {resultado.total === 1 ? 'cadastro' : 'cadastros'}</span>}
          </div>
          <form className={styles.filters} aria-label="Filtrar cadastros" onSubmit={filtrar}>
            <label htmlFor="busca-admin">Nome ou e-mail<input id="busca-admin" name="busca" type="search" maxLength={150} /></label>
            <label htmlFor="filtro-perfil">Perfil<select id="filtro-perfil" name="perfil" defaultValue="">
              <option value="">Todos</option><option value="VOLUNTARIO">Voluntário</option>
              <option value="ORGANIZACAO">Organização</option><option value="ADMINISTRADOR">Administrador</option>
            </select></label>
            <label htmlFor="filtro-ativo">Situação<select id="filtro-ativo" name="ativo" defaultValue="">
              <option value="">Todas</option><option value="true">Ativa</option><option value="false">Inativa</option>
            </select></label>
            <button className={styles.secondaryButton} type="submit">Buscar</button>
          </form>

          {carregando ? <p role="status">Carregando cadastros…</p> : resultado.erro ? (
            <div className={styles.empty}><p role="alert">{resultado.erro}</p><button type="button" className={styles.secondaryButton} onClick={atualizarLista}>Tentar novamente</button></div>
          ) : resultado.itens.length === 0 ? <p className={styles.empty}>Nenhum cadastro encontrado.</p> : (
            <div className={styles.tableWrapper} role="region" aria-label="Lista de cadastros" tabIndex={0}>
              <table>
                <thead><tr><th scope="col">Nome</th><th scope="col">E-mail</th><th scope="col">Perfil</th><th scope="col">Situação</th><th scope="col">Vagas</th><th scope="col">Ações</th></tr></thead>
                <tbody>{resultado.itens.map((conta) => (
                  <tr key={conta.id}>
                    <th scope="row">{conta.nome}{conta.id === usuario.id && <small className={styles.currentAccount}>Conta em uso</small>}</th>
                    <td>{conta.email}</td><td>{nomePerfil(conta)}</td>
                    <td><span className={conta.ativo ? styles.active : styles.inactive}>{conta.ativo ? 'Ativa' : 'Inativa'}</span></td>
                    <td>{conta.quantidade_vagas}</td>
                    <td><div className={styles.rowActions}>
                      <button type="button" disabled={carregandoCadastro !== null} onClick={(event) => abrirCadastro(event, conta, 'detalhes')} aria-label={`Ver cadastro de ${conta.nome}`}>Ver cadastro</button>
                      <button type="button" className={styles.deleteLink} disabled={conta.id === usuario.id || carregandoCadastro !== null} onClick={(event) => abrirCadastro(event, conta, 'excluir')} aria-label={`Excluir cadastro de ${conta.nome}`}>Excluir</button>
                    </div></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}

          {!carregando && resultado.total > resultado.por_pagina && (
            <nav className={styles.pagination} aria-label="Páginas de cadastros">
              <button className={styles.secondaryButton} type="button" disabled={filtros.pagina === 1} onClick={() => setFiltros((atual) => ({ ...atual, pagina: atual.pagina - 1 }))}>Anterior</button>
              <span>Página {filtros.pagina} de {Math.ceil(resultado.total / resultado.por_pagina)}</span>
              <button className={styles.secondaryButton} type="button" disabled={filtros.pagina * resultado.por_pagina >= resultado.total} onClick={() => setFiltros((atual) => ({ ...atual, pagina: atual.pagina + 1 }))}>Próxima</button>
            </nav>
          )}
        </section>
      </main>
      <footer className={styles.footer}>VolunJá · Administração</footer>

      <dialog ref={dialogo} className={styles.dialog} aria-labelledby="titulo-admin-dialogo" onClose={devolverFoco} onCancel={(event) => { if (salvando) event.preventDefault() }}>
        <div className={styles.dialogHeader}>
          <h2 id="titulo-admin-dialogo">{modo === 'criar' ? 'Novo cadastro' : modo === 'excluir' ? 'Excluir cadastro' : 'Dados do cadastro'}</h2>
          <button className={styles.textButton} type="button" disabled={salvando} onClick={() => dialogo.current.close()}>Fechar</button>
        </div>
        {modo === 'criar' ? (
          <AdminContaForm key={versaoFormulario} formRef={formulario} onSalvar={salvar} onCancelar={() => dialogo.current.close()} salvando={salvando} erro={erroAcao} />
        ) : modo === 'detalhes' && selecionado ? (
          <dl className={styles.details}>
            {CAMPOS_DETALHE.filter(([campo]) => selecionado[campo]).map(([campo, texto]) => (
              <div key={campo}><dt>{texto}</dt><dd>{selecionado[campo]}</dd></div>
            ))}
            <div><dt>Perfil</dt><dd>{nomePerfil(selecionado)}</dd></div>
            <div><dt>Situação</dt><dd>{selecionado.ativo ? 'Ativa' : 'Inativa'}</dd></div>
            <div><dt>Vagas vinculadas</dt><dd>{selecionado.quantidade_vagas}</dd></div>
            {selecionado.homologada !== null && <div><dt>Publicação de vagas</dt><dd>{selecionado.homologada ? 'Liberada' : 'Aguardando homologação'}</dd></div>}
            {selecionado.consentimento_termos !== null && <div><dt>Aceite de termos registrado</dt><dd>{selecionado.consentimento_termos ? 'Sim' : 'Não'}</dd></div>}
          </dl>
        ) : selecionado && (
          <div>
            <p>Excluir o cadastro de <strong>{selecionado.nome}</strong> ({selecionado.email})?</p>
            <p>Essa exclusão é permanente.</p>
            {selecionado.quantidade_vagas > 0 && <p className={styles.deleteNotice}>Também serão excluídas {selecionado.quantidade_vagas} vaga(s) desta ONG e seus encontros.</p>}
            {erroAcao && <p className={styles.error} role="alert">{erroAcao}</p>}
            <div className={styles.dialogActions}>
              <button className={styles.secondaryButton} type="button" disabled={salvando} onClick={() => dialogo.current.close()}>Cancelar</button>
              <button className={styles.dangerButton} type="button" disabled={salvando} onClick={confirmarExclusao}>{salvando ? 'Excluindo…' : selecionado.quantidade_vagas > 0 ? 'Excluir cadastro e vagas' : 'Excluir cadastro'}</button>
            </div>
          </div>
        )}
      </dialog>
    </div>
  )
}
