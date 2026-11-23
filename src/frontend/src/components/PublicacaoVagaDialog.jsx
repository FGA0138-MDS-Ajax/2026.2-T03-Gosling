import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import EncontrosEditor from './EncontrosEditor'
import LocationFields from './LocationFields'
import VagaMediaFields from './VagaMediaFields'
import { enviarFotoVaga, publicarVaga } from '../services/vagasService'
import { localizacaoInicial, localizacaoPayload, validarLocalizacao } from '../utils/localizacao'
import { criarEncontro, prepararOcorrencias } from '../utils/ocorrencias'
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

export default function PublicacaoVagaDialog({ catalogo, onClose, onPublicada }) {
  const [erro, setErro] = useState('')
  const [errosCampos, setErrosCampos] = useState({})
  const [erroEncontros, setErroEncontros] = useState('')
  const [encontros, setEncontros] = useState(() => [criarEncontro()])
  const [publicando, setPublicando] = useState(false)
  const dialogo = useRef(null)
  const envioPendente = useRef(false)
  const [fotos, setFotos] = useState([])
  const [documentos, setDocumentos] = useState([])
  const [erroMidia, setErroMidia] = useState('')
  const fotosEnviadas = useRef(new Map())
  const [modalidadePublicacao, setModalidadePublicacao] = useState('PRESENCIAL')
  const [origemEndereco, setOrigemEndereco] = useState('PROPRIA')
  const [enderecoVaga, setEnderecoVaga] = useState(() => localizacaoInicial(null))

  useEffect(() => {
    if (!dialogo.current.open) dialogo.current.showModal()
  }, [])

  useEffect(() => {
    if (publicando) return
    const campo = Object.keys(errosCampos)[0]
    if (campo) dialogo.current?.querySelector(`[name="${campo}"]`)?.focus()
  }, [errosCampos, publicando])

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

  async function enviarPublicacao(event) {
    event.preventDefault()
    if (envioPendente.current) return
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
      titulo,
      descricao,
      atividades,
      causa_id: causaId,
      local,
      carga_horaria: cargaHoraria,
      numero_vagas: numeroVagas,
    }
    const invalidos = validarPublicacao(campos)
    if (modalidadePublicacao !== 'REMOTO' && origemEndereco === 'PROPRIA')
      Object.assign(invalidos, validarLocalizacao(enderecoVaga))
    if (!catalogo.itens.some(causa => causa.id === causaId && causa.ativo))
      invalidos.causa_id = 'Selecione uma causa disponível.'
    const fotosInvalidas =
      fotos.length > 10 ||
      fotos.some(
        file =>
          !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
          file.size > 5 * 1024 * 1024,
      )
    const documentosInvalidos = documentos.some(
      doc =>
        doc.nome.trim().length < 2 ||
        (doc.modelo_url && !/^https:\/\/[^\s]+$/.test(doc.modelo_url)),
    )
    setErroMidia(
      fotosInvalidas
        ? 'Use até 10 imagens JPG, PNG ou WebP de até 5 MB cada.'
        : documentosInvalidos
          ? 'Informe o nome de cada documento e um link HTTPS válido, quando houver modelo.'
          : '',
    )
    setErrosCampos(invalidos)

    let ocorrencias
    try {
      ocorrencias = prepararOcorrencias(encontros)
    } catch (failure) {
      setErroEncontros(failure.message)
    }
    if (Object.keys(invalidos).length) setErro('Confira os campos indicados e tente novamente.')
    if (Object.keys(invalidos).length || !ocorrencias || fotosInvalidas || documentosInvalidos)
      return

    const payload = {
      ...campos,
      modalidade: String(dados.get('modalidade')),
      periodo: String(dados.get('periodo')),
      ocorrencias,
    }
    if (modalidadePublicacao !== 'REMOTO') {
      if (origemEndereco === 'ORGANIZACAO') payload.origem_localizacao = 'ORGANIZACAO'
      else {
        const endereco = localizacaoPayload(enderecoVaga)
        if (endereco) {
          payload.localizacao = endereco
          payload.origem_localizacao = 'PROPRIA'
        }
      }
    }
    envioPendente.current = true
    setPublicando(true)
    try {
      const urls = []
      for (const file of fotos) {
        if (!fotosEnviadas.current.has(file))
          fotosEnviadas.current.set(file, await enviarFotoVaga(file))
        urls.push(fotosEnviadas.current.get(file))
      }
      if (urls.length) payload.fotos = urls
      if (documentos.length)
        payload.documentos_exigidos = documentos.map(doc => ({
          nome: doc.nome.trim(),
          modelo_url: doc.modelo_url.trim() || null,
        }))
      await publicarVaga(payload)
      onPublicada()
      dialogo.current.close()
    } catch (failure) {
      const detalhe = failure.response?.data?.detail
      if (Array.isArray(detalhe)) {
        const invalidos = errosPublicacao(detalhe)
        setErrosCampos(invalidos.campos)
        setErroEncontros(invalidos.encontros)
        setErro(invalidos.mensagem)
      } else {
        setErro(
          typeof detalhe === 'string'
            ? detalhe
            : 'Não foi possível publicar a vaga. Tente novamente.',
        )
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
    return (
      errosCampos[campo] && (
        <span className={styles.fieldError} id={`vaga-${campo}-erro`}>
          {errosCampos[campo]}
        </span>
      )
    )
  }

  return (
    <dialog
      ref={dialogo}
      className={styles.dialog}
      aria-labelledby="titulo-publicacao"
      aria-describedby="aviso-publicacao"
      onClose={onClose}
      onCancel={event => {
        if (publicando) event.preventDefault()
      }}
    >
      <div className={styles.dialogHeader}>
        <h2 id="titulo-publicacao">Publicar vaga</h2>
        <button type="button" disabled={publicando} onClick={() => dialogo.current.close()}>
          Fechar
        </button>
      </div>
      <p id="aviso-publicacao" className={styles.demoNotice}>
        Descreva a atividade e adicione todos os encontros com suas datas e horários.
      </p>

      <form
        noValidate
        aria-label="Publicar vaga"
        onSubmit={enviarPublicacao}
        aria-busy={publicando}
      >
        <fieldset className={styles.publicationFields} disabled={publicando}>
          <div className={styles.formGrid}>
            <div className={`${styles.formField} ${styles.fullWidth}`}>
              <label htmlFor="vaga-titulo">Título da vaga</label>
              <input
                id="vaga-titulo"
                name="titulo"
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
                required
                disabled={catalogo.carregando || Boolean(catalogo.erro)}
                {...atributosCampo('causa_id')}
              >
                <option value="">Selecione uma causa</option>
                {catalogo.itens
                  .filter(causa => causa.ativo)
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
                minLength={3}
                maxLength={500}
                required
                {...atributosCampo('local')}
              />
              {erroCampo('local')}
            </div>
            <div className={styles.formField}>
              <label htmlFor="vaga-periodo">Período</label>
              <select id="vaga-periodo" name="periodo" required {...atributosCampo('periodo')}>
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
                  disabled={publicando}
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
            documentos={documentos}
            setDocumentos={setDocumentos}
            error={erroMidia}
          />

          {erro && (
            <p className={styles.error} role="alert">
              {erro}
            </p>
          )}

          <div className={styles.formActions}>
            <button type="button" onClick={() => dialogo.current.close()}>
              Cancelar
            </button>
            <button className={styles.primaryButton} type="submit">
              {publicando ? 'Publicando…' : 'Publicar vaga'}
            </button>
          </div>
        </fieldset>
      </form>
    </dialog>
  )
}
