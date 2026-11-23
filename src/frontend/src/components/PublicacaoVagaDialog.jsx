import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import EncontrosEditor from './EncontrosEditor'
import LocationFields from './LocationFields'
import VagaMediaFields from './VagaMediaFields'
import { consultarRascunho, publicarRascunho, salvarRascunho } from '../services/rascunhosService'
import { enviarFotoVaga, publicarVaga } from '../services/vagasService'
import { localizacaoInicial, validarLocalizacao } from '../utils/localizacao'
import { prepararOcorrencias } from '../utils/ocorrencias'
import {
  encontrosDoRascunho,
  encontrosParaRascunho,
  horarioSalvamento,
  lerFormularioVaga,
} from '../utils/rascunhoVaga'
import { errosPublicacao, validarPublicacao } from '../utils/vagaForm'
import { MODALIDADES } from '../utils/vagaLabels'
import explorar from '../pages/Explore.module.css'
import styles from '../pages/Vagas.module.css'

const PERIODOS = {
  MANHA: 'Manhã',
  TARDE: 'Tarde',
  NOITE: 'Noite',
  MADRUGADA: 'Madrugada',
}

export default function PublicacaoVagaDialog({ catalogo, id, onClose, onPublicada, onSalvo }) {
  const dialogo = useRef(null)
  const [acao, setAcao] = useState(null)
  const [tentativa, setTentativa] = useState(0)
  const [consulta, setConsulta] = useState(null)
  const carregando = Boolean(id && consulta?.tentativa !== tentativa)
  const erro = !carregando && consulta?.erro
  const fechar = () => dialogo.current.close()
  const recarregar = () => setTentativa(valor => valor + 1)

  useEffect(() => {
    if (!dialogo.current.open) dialogo.current.showModal()
  }, [])

  useEffect(() => {
    if (!id) return
    const controller = new AbortController()

    consultarRascunho(id, controller.signal)
      .then(rascunho => {
        if (!controller.signal.aborted) setConsulta({ tentativa, rascunho })
      })
      .catch(failure => {
        if (controller.signal.aborted) return
        const erro =
          failure.response?.status === 404
            ? 'Rascunho não encontrado.'
            : 'Não foi possível carregar o rascunho.'
        setConsulta({ tentativa, erro })
      })

    return () => controller.abort()
  }, [id, tentativa])

  return (
    <dialog
      ref={dialogo}
      className={styles.dialog}
      aria-labelledby="titulo-publicacao"
      aria-describedby="aviso-publicacao"
      onClose={onClose}
      onCancel={event => {
        if (acao) event.preventDefault()
      }}
    >
      <div className={styles.dialogHeader}>
        <h2 id="titulo-publicacao">{id ? 'Editar rascunho' : 'Publicar vaga'}</h2>
        <button type="button" disabled={Boolean(acao)} onClick={fechar}>
          Fechar
        </button>
      </div>
      <p id="aviso-publicacao" className={styles.demoNotice}>
        Salve para continuar depois ou preencha todos os dados para publicar.
      </p>

      {carregando && <p role="status">Carregando rascunho…</p>}
      {erro && (
        <div>
          <p className={styles.error} role="alert">
            {erro}
          </p>
          <button type="button" onClick={recarregar}>
            Tentar carregar novamente
          </button>
        </div>
      )}
      {!carregando && !erro && (
        <FormularioVaga
          catalogo={catalogo}
          inicial={consulta?.rascunho ?? null}
          acao={acao}
          setAcao={setAcao}
          onClose={fechar}
          onPublicada={onPublicada}
          onSalvo={onSalvo}
          onRecarregar={recarregar}
        />
      )}
    </dialog>
  )
}

function FormularioVaga({
  catalogo,
  inicial,
  acao,
  setAcao,
  onClose,
  onPublicada,
  onSalvo,
  onRecarregar,
}) {
  const dadosIniciais = inicial?.dados ?? {}
  const [rascunho, setRascunho] = useState(inicial)
  const [erro, setErro] = useState('')
  const [errosCampos, setErrosCampos] = useState({})
  const [erroEncontros, setErroEncontros] = useState('')
  const [encontros, setEncontros] = useState(() => encontrosDoRascunho(dadosIniciais))
  const [conflito, setConflito] = useState(false)
  const formulario = useRef(null)
  const envioPendente = useRef(false)
  const [fotos, setFotos] = useState([])
  const [fotosSalvas, setFotosSalvas] = useState(dadosIniciais.fotos ?? [])
  const [documentos, setDocumentos] = useState(() =>
    (dadosIniciais.documentos_exigidos ?? []).map(documento => ({
      id: crypto.randomUUID(),
      nome: documento.nome,
      modelo_url: documento.modelo_url ?? '',
    })),
  )
  const [erroMidia, setErroMidia] = useState('')
  const fotosEnviadas = useRef(new Map())
  const [modalidadePublicacao, setModalidadePublicacao] = useState(
    dadosIniciais.modalidade ?? 'PRESENCIAL',
  )
  const [origemEndereco, setOrigemEndereco] = useState(
    dadosIniciais.origem_localizacao ?? 'PROPRIA',
  )
  const [enderecoVaga, setEnderecoVaga] = useState(() =>
    localizacaoInicial(dadosIniciais.localizacao),
  )
  const [causaId, setCausaId] = useState(String(dadosIniciais.causa_id ?? ''))
  const publicando = acao === 'publicar'
  const salvando = acao === 'salvar'
  const enviando = Boolean(acao)

  useEffect(() => {
    if (enviando) return
    const campo = Object.keys(errosCampos)[0]
    if (campo) formulario.current?.elements.namedItem(campo)?.focus()
  }, [errosCampos, enviando])

  function alterarEncontros(novos) {
    setEncontros(novos)
    setErroEncontros('')
    if (novos.every(item => item.dataInicio && item.horaInicio && item.dataFim && item.horaFim)) {
      try {
        prepararOcorrencias(novos)
      } catch (failure) {
        setErroEncontros(failure.message)
      }
    }
  }

  function limparErros() {
    setErro('')
    setErrosCampos({})
    setErroEncontros('')
    setErroMidia('')
  }

  function checarFotos() {
    const tiposAceitos = ['image/jpeg', 'image/png', 'image/webp']
    const arquivoInvalido = fotos.some(
      arquivo => !tiposAceitos.includes(arquivo.type) || arquivo.size > 5 * 1024 * 1024,
    )
    if (fotosSalvas.length + fotos.length > 10 || arquivoInvalido) {
      setErroMidia('Use até 10 imagens JPG, PNG ou WebP de até 5 MB cada.')
      return false
    }
    return true
  }

  async function incluirMidia(dados) {
    const urls = [...fotosSalvas]
    for (const arquivo of fotos) {
      let url = fotosEnviadas.current.get(arquivo)
      if (!url) {
        url = await enviarFotoVaga(arquivo)
        fotosEnviadas.current.set(arquivo, url)
      }
      urls.push(url)
    }
    const documentosExigidos = documentos.map(documento => ({
      nome: documento.nome.trim(),
      modelo_url: documento.modelo_url.trim() || null,
    }))
    return { ...dados, fotos: urls, documentos_exigidos: documentosExigidos }
  }

  function informarFalha(failure, fallback) {
    const resposta = failure.response
    const detalhe = resposta?.data?.detail
    if (resposta?.status === 409 && rascunho) setConflito(true)

    if (Array.isArray(detalhe)) {
      const erros = detalhe.map(item => ({
        ...item,
        loc: item.loc?.[1] === 'dados' ? ['body', ...item.loc.slice(2)] : item.loc,
      }))
      const invalidos = errosPublicacao(erros)
      setErrosCampos(invalidos.campos)
      setErroEncontros(invalidos.encontros)
      setErro(invalidos.mensagem)
    } else {
      setErro(typeof detalhe === 'string' ? detalhe : fallback)
    }
  }

  function dadosDoFormulario() {
    const dados = lerFormularioVaga(formulario.current, origemEndereco, enderecoVaga)
    return { ...dados, causa_id: causaId ? Number(causaId) : null }
  }

  function dadosDoRascunho(dados) {
    return {
      ...dados,
      localizacao: dados.localizacao ?? null,
      origem_localizacao: dados.origem_localizacao ?? null,
      ocorrencias: encontrosParaRascunho(encontros),
    }
  }

  async function salvar() {
    if (envioPendente.current || conflito) return
    limparErros()
    if (!checarFotos()) return

    const dados = dadosDoRascunho(dadosDoFormulario())
    envioPendente.current = true
    setAcao('salvar')
    try {
      const payload = await incluirMidia(dados)
      const salvo = await salvarRascunho(rascunho, payload)
      setRascunho(salvo)
      setFotosSalvas(salvo.dados.fotos)
      setFotos([])
      fotosEnviadas.current.clear()
      const inputFotos = formulario.current?.querySelector('input[type="file"]')
      if (inputFotos) inputFotos.value = ''
      if (!rascunho) onSalvo(salvo.id)
    } catch (failure) {
      informarFalha(failure, 'Não foi possível salvar o rascunho. Tente novamente.')
    } finally {
      envioPendente.current = false
      setAcao(null)
    }
  }

  async function enviarPublicacao(event) {
    event.preventDefault()
    if (envioPendente.current || conflito) return
    limparErros()

    const dados = dadosDoFormulario()
    const invalidos = validarPublicacao(dados)
    if (modalidadePublicacao !== 'REMOTO' && origemEndereco === 'PROPRIA') {
      Object.assign(invalidos, validarLocalizacao(enderecoVaga))
    }
    if (!catalogo.itens.some(causa => causa.id === dados.causa_id && causa.ativo)) {
      invalidos.causa_id = 'Selecione uma causa disponível.'
    }
    setErrosCampos(invalidos)

    const fotosValidas = checarFotos()
    const documentosInvalidos = documentos.some(
      doc =>
        doc.nome.trim().length < 2 ||
        (doc.modelo_url && !/^https:\/\/[^\s]+$/.test(doc.modelo_url.trim())),
    )
    if (fotosValidas && documentosInvalidos) {
      setErroMidia('Informe o nome de cada documento e um link HTTPS válido, quando houver modelo.')
    }

    let ocorrencias
    try {
      ocorrencias = prepararOcorrencias(encontros)
    } catch (failure) {
      setErroEncontros(failure.message)
    }
    if (Object.keys(invalidos).length) setErro('Confira os campos indicados e tente novamente.')
    if (Object.keys(invalidos).length || !ocorrencias || !fotosValidas || documentosInvalidos)
      return

    envioPendente.current = true
    setAcao('publicar')
    try {
      const payload = await incluirMidia(dados)
      if (rascunho) {
        await publicarRascunho(rascunho, dadosDoRascunho(payload))
      } else {
        await publicarVaga({ ...payload, ocorrencias })
      }
      onPublicada()
      onClose()
    } catch (failure) {
      informarFalha(failure, 'Não foi possível publicar a vaga. Tente novamente.')
    } finally {
      envioPendente.current = false
      setAcao(null)
    }
  }

  function atributosCampo(campo) {
    return {
      'aria-invalid': Boolean(errosCampos[campo]),
      'aria-describedby': errosCampos[campo] ? `vaga-${campo}-erro` : undefined,
    }
  }

  function erroCampo(campo) {
    return (
      errosCampos[campo] && (
        <span className={styles.fieldError} id={`vaga-${campo}-erro`}>
          {errosCampos[campo]}
        </span>
      )
    )
  }

  return (
    <form
      ref={formulario}
      noValidate
      aria-label="Publicar vaga"
      onSubmit={enviarPublicacao}
      aria-busy={enviando}
    >
      {rascunho?.atualizado_em && (
        <p role="status" className={styles.demoNotice}>
          Rascunho salvo em{' '}
          <time dateTime={rascunho.atualizado_em}>
            {horarioSalvamento.format(new Date(rascunho.atualizado_em))}
          </time>
          .
        </p>
      )}
      <fieldset className={styles.publicationFields} disabled={enviando}>
        <div className={styles.formGrid}>
          <div className={`${styles.formField} ${styles.fullWidth}`}>
            <label htmlFor="vaga-titulo">Título da vaga</label>
            <input
              id="vaga-titulo"
              name="titulo"
              defaultValue={dadosIniciais.titulo ?? ''}
              minLength={3}
              maxLength={150}
              required
              {...atributosCampo('titulo')}
            />
            {erroCampo('titulo')}
          </div>
          <div className={`${styles.formField} ${styles.fullWidth}`}>
            <label htmlFor="vaga-descricao">Descrição</label>
            <textarea
              id="vaga-descricao"
              name="descricao"
              defaultValue={dadosIniciais.descricao ?? ''}
              minLength={10}
              maxLength={5000}
              rows={3}
              required
              {...atributosCampo('descricao')}
            />
            {erroCampo('descricao')}
          </div>
          <div className={`${styles.formField} ${styles.fullWidth}`}>
            <label htmlFor="vaga-atividades">Atividades do voluntário</label>
            <textarea
              id="vaga-atividades"
              name="atividades"
              defaultValue={dadosIniciais.atividades ?? ''}
              minLength={10}
              maxLength={5000}
              rows={3}
              required
              {...atributosCampo('atividades')}
            />
            {erroCampo('atividades')}
          </div>
          <div className={styles.formField}>
            <label htmlFor="vaga-causa">Causa</label>
            <select
              id="vaga-causa"
              name="causa_id"
              value={causaId}
              onChange={event => setCausaId(event.target.value)}
              required
              disabled={catalogo.carregando || Boolean(catalogo.erro)}
              {...atributosCampo('causa_id')}
            >
              <option value="">Selecione uma causa</option>
              {catalogo.itens
                .filter(causa => causa.ativo || causa.id === dadosIniciais.causa_id)
                .map(causa => (
                  <option key={causa.id} value={causa.id}>
                    {causa.nome}
                  </option>
                ))}
            </select>
            {erroCampo('causa_id')}
            {catalogo.erro && (
              <div>
                <p role="alert">{catalogo.erro}</p>
                <button className={explorar.retry} type="button" onClick={catalogo.recarregar}>
                  Tentar carregar causas novamente
                </button>
              </div>
            )}
          </div>
          <div className={styles.formField}>
            <label htmlFor="vaga-modalidade">Modalidade</label>
            <select
              id="vaga-modalidade"
              name="modalidade"
              required
              value={modalidadePublicacao}
              onChange={event => setModalidadePublicacao(event.target.value)}
              {...atributosCampo('modalidade')}
            >
              {Object.entries(MODALIDADES).map(([valor, texto]) => (
                <option key={valor} value={valor}>
                  {texto}
                </option>
              ))}
            </select>
            {erroCampo('modalidade')}
          </div>
          <div className={`${styles.formField} ${styles.fullWidth}`}>
            <label htmlFor="vaga-local">Local ou atividade remota</label>
            <input
              id="vaga-local"
              name="local"
              defaultValue={dadosIniciais.local ?? ''}
              minLength={3}
              maxLength={500}
              required
              {...atributosCampo('local')}
            />
            {erroCampo('local')}
          </div>
          <div className={styles.formField}>
            <label htmlFor="vaga-periodo">Período</label>
            <select
              id="vaga-periodo"
              name="periodo"
              defaultValue={dadosIniciais.periodo ?? 'MANHA'}
              required
              {...atributosCampo('periodo')}
            >
              {Object.entries(PERIODOS).map(([valor, texto]) => (
                <option key={valor} value={valor}>
                  {texto}
                </option>
              ))}
            </select>
            {erroCampo('periodo')}
          </div>
          <div className={styles.formField}>
            <label htmlFor="vaga-carga">Carga horária (horas)</label>
            <input
              id="vaga-carga"
              name="carga_horaria"
              defaultValue={dadosIniciais.carga_horaria ?? ''}
              type="number"
              min="0.01"
              max="99999.99"
              step="0.01"
              required
              {...atributosCampo('carga_horaria')}
            />
            {erroCampo('carga_horaria')}
          </div>
          <div className={styles.formField}>
            <label htmlFor="vaga-quantidade">Número de vagas</label>
            <input
              id="vaga-quantidade"
              name="numero_vagas"
              defaultValue={dadosIniciais.numero_vagas ?? ''}
              type="number"
              min="1"
              step="1"
              required
              {...atributosCampo('numero_vagas')}
            />
            {erroCampo('numero_vagas')}
          </div>
        </div>
        {modalidadePublicacao !== 'REMOTO' ? (
          <>
            <div className={styles.formField}>
              <label htmlFor="vaga-origem-endereco">Endereço da atividade</label>
              <select
                id="vaga-origem-endereco"
                name="origem_localizacao"
                value={origemEndereco}
                onChange={event => setOrigemEndereco(event.target.value)}
                {...atributosCampo('origem_localizacao')}
              >
                <option value="PROPRIA">Endereço próprio desta vaga</option>
                <option value="ORGANIZACAO">Endereço cadastrado da organização</option>
              </select>
              {erroCampo('origem_localizacao')}
            </div>
            {origemEndereco === 'PROPRIA' ? (
              <LocationFields
                value={enderecoVaga}
                onChange={setEnderecoVaga}
                errors={errosCampos}
                disabled={enviando}
              />
            ) : (
              <p>
                Use o endereço cadastrado da organização quando o encontro ocorrer na sede.{' '}
                <Link to="/organizacao/perfil">Conferir endereço da organização</Link>
              </p>
            )}
          </>
        ) : (
          <p>
            Atividade remota: informe a plataforma ou orientação no campo de local. Endereço
            presencial e coordenadas não são enviados.
          </p>
        )}
        <EncontrosEditor encontros={encontros} onChange={alterarEncontros} erro={erroEncontros} />
        <VagaMediaFields
          fotos={fotos}
          setFotos={setFotos}
          fotosSalvas={fotosSalvas}
          onRemoverFoto={indice => setFotosSalvas(atuais => atuais.filter((_, i) => i !== indice))}
          documentos={documentos}
          setDocumentos={setDocumentos}
          error={erroMidia}
        />

        {erro && (
          <p className={styles.error} role="alert">
            {erro}
          </p>
        )}
        {conflito && (
          <p className={styles.demoNotice}>
            Carregar a versão salva descarta as alterações deste formulário.
          </p>
        )}

        <div className={styles.formActions}>
          <button type="button" onClick={onClose}>
            Cancelar
          </button>
          {conflito ? (
            <button type="button" onClick={onRecarregar}>
              Carregar versão salva
            </button>
          ) : (
            <button type="button" onClick={salvar}>
              {salvando ? 'Salvando…' : 'Salvar rascunho'}
            </button>
          )}
          <button className={styles.primaryButton} type="submit" disabled={conflito}>
            {publicando ? 'Publicando…' : 'Publicar vaga'}
          </button>
        </div>
      </fieldset>
    </form>
  )
}
