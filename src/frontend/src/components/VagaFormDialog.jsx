import { useEffect, useRef, useState } from 'react'
import EncontrosEditor from './EncontrosEditor'
import VagaMediaFields from './VagaMediaFields'
import { enviarFotoVaga, publicarVaga, atualizarVaga } from '../services/vagasService'
import { criarEncontro, encontroDaOcorrencia, prepararOcorrencias } from '../utils/ocorrencias'
import { errosPublicacao, validarPublicacao } from '../utils/vagaForm'
import { MODALIDADES, PERIODOS } from '../utils/vagaLabels'
import styles from '../pages/Vagas.module.css'

export default function VagaFormDialog({ vaga, fechar, concluido }) {
  const editando = Boolean(vaga)
  const tituloDialogo = editando ? 'Editar vaga' : 'Publicar vaga'
  const horariosBloqueados = vaga?.horarios_bloqueados
  const [erro, setErro] = useState('')
  const [errosCampos, setErrosCampos] = useState({})
  const [erroEncontros, setErroEncontros] = useState('')
  const [encontros, setEncontros] = useState(() => vaga
    ? vaga.ocorrencias.map(encontroDaOcorrencia)
    : [criarEncontro()])
  const [encontrosAlterados, setEncontrosAlterados] = useState(false)
  const [publicando, setPublicando] = useState(false)
  const dialogo = useRef(null)
  const envioPendente = useRef(false)
  const [fotos, setFotos] = useState([])
  const [fotosAtuais, setFotosAtuais] = useState(() => vaga?.fotos ?? [])
  const [documentos, setDocumentos] = useState(() => (
    (vaga?.documentos_exigidos ?? []).map(doc => ({ ...doc, id: crypto.randomUUID(), modelo_url: doc.modelo_url ?? '' }))
  ))
  const [erroMidia, setErroMidia] = useState('')
  const fotosEnviadas = useRef(new Map())

  useEffect(() => {
    const dialog = dialogo.current
    const foco = document.activeElement
    dialog.showModal()
    return () => {
      dialog.close()
      if (foco?.isConnected) foco.focus()
    }
  }, [])

  useEffect(() => {
    if (publicando) return
    const campo = Object.keys(errosCampos)[0]
    if (campo) dialogo.current?.querySelector(`[name="${campo}"]`)?.focus()
  }, [errosCampos, publicando])

  function alterarEncontros(novos) {
    setEncontros(novos)
    setEncontrosAlterados(true)
    setErroEncontros('')
    if (novos.every((item) => item.dataInicio && item.horaInicio && item.dataFim && item.horaFim)) {
      try { prepararOcorrencias(novos) }
      catch (failure) { setErroEncontros(failure.message) }
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
    const causa = String(dados.get('causa')).trim()
    const local = String(dados.get('local')).trim()
    const cargaHoraria = Number(dados.get('carga_horaria'))
    const numeroVagas = Number(dados.get('numero_vagas'))

    const campos = {
      titulo, descricao, atividades, causa, local,
      carga_horaria: cargaHoraria, numero_vagas: numeroVagas,
    }
    const invalidos = validarPublicacao(campos)
    const fotosInvalidas = fotos.length + fotosAtuais.length > 10 || fotos.some(file => (
      !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024
    ))
    const documentosInvalidos = documentos.some(doc => {
      const url = doc.modelo_url.trim()
      const linkAceito = !url || /^https:\/\/[^\s]+$/.test(url) || /^\/api\/v1\/midia\/[a-f0-9]{32}\.webp$/.test(url)
      return doc.nome.trim().length < 2 || !linkAceito
    })
    setErroMidia(fotosInvalidas ? 'Use até 10 imagens JPG, PNG ou WebP de até 5 MB cada.' : documentosInvalidos ? 'Informe o nome de cada documento e um link HTTPS válido, quando houver modelo.' : '')
    setErrosCampos(invalidos)

    const enviarHorarios = !editando || (encontrosAlterados && !horariosBloqueados)
    let ocorrencias
    if (enviarHorarios) {
      try { ocorrencias = prepararOcorrencias(encontros) }
      catch (failure) { setErroEncontros(failure.message) }
    }
    if (Object.keys(invalidos).length) setErro('Confira os campos indicados e tente novamente.')
    if (Object.keys(invalidos).length || (enviarHorarios && !ocorrencias) || fotosInvalidas || documentosInvalidos) return

    const payload = {
      ...campos,
      modalidade: String(dados.get('modalidade')),
      periodo: String(dados.get('periodo')),
      ...(enviarHorarios ? { ocorrencias } : {}),
    }
    envioPendente.current = true
    setPublicando(true)
    try {
      const urls = [...fotosAtuais]
      for (const file of fotos) {
        if (!fotosEnviadas.current.has(file)) fotosEnviadas.current.set(file, await enviarFotoVaga(file))
        urls.push(fotosEnviadas.current.get(file))
      }
      if (editando || urls.length) payload.fotos = urls
      if (editando || documentos.length) payload.documentos_exigidos = documentos.map(doc => ({nome:doc.nome.trim(),modelo_url:doc.modelo_url.trim() || null}))
      const resultado = editando
        ? await atualizarVaga(vaga.id, payload)
        : await publicarVaga(payload)
      concluido(resultado)
    } catch (failure) {
      const detalhe = failure.response?.data?.detail
      if (Array.isArray(detalhe)) {
        const invalidos = errosPublicacao(detalhe)
        setErrosCampos(invalidos.campos)
        setErroEncontros(invalidos.encontros)
        setErro(invalidos.mensagem)
      } else {
        setErro(typeof detalhe === 'string' ? detalhe : editando ? 'Não foi possível salvar a vaga. Tente novamente.' : 'Não foi possível publicar a vaga. Tente novamente.')
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
    <dialog
      ref={dialogo}
      className={styles.dialog}
      aria-labelledby="titulo-publicacao"
      aria-describedby="aviso-publicacao"
      onCancel={event => {
        event.preventDefault()
        if (!envioPendente.current) fechar()
      }}
    >
      <div className={styles.dialogHeader}>
        <h2 id="titulo-publicacao">{tituloDialogo}</h2>
        <button type="button" disabled={publicando} onClick={fechar}>Fechar</button>
      </div>
      <p id="aviso-publicacao" className={styles.demoNotice}>
        Descreva a atividade e adicione todos os encontros com suas datas e horários.
      </p>

      <form noValidate aria-label={tituloDialogo} onSubmit={enviarPublicacao} aria-busy={publicando}>
        <fieldset className={styles.publicationFields} disabled={publicando}>
        <div className={styles.formGrid}>
          <div className={`${styles.formField} ${styles.fullWidth}`}>
            <label htmlFor="vaga-titulo">Título da vaga</label>
            <input id="vaga-titulo" name="titulo" defaultValue={vaga?.titulo} minLength={3} maxLength={150} required {...atributosCampo('titulo')} />
            {erroCampo('titulo')}
          </div>
          <div className={`${styles.formField} ${styles.fullWidth}`}>
            <label htmlFor="vaga-descricao">Descrição</label>
            <textarea id="vaga-descricao" name="descricao" defaultValue={vaga?.descricao} minLength={10} maxLength={5000} rows={3} required {...atributosCampo('descricao')} />
            {erroCampo('descricao')}
          </div>
          <div className={`${styles.formField} ${styles.fullWidth}`}>
            <label htmlFor="vaga-atividades">Atividades do voluntário</label>
            <textarea id="vaga-atividades" name="atividades" defaultValue={vaga?.atividades} minLength={10} maxLength={5000} rows={3} required {...atributosCampo('atividades')} />
            {erroCampo('atividades')}
          </div>
          <div className={styles.formField}>
            <label htmlFor="vaga-causa">Causa</label>
            <input id="vaga-causa" name="causa" defaultValue={vaga?.causa?.nome} minLength={3} maxLength={100} required {...atributosCampo('causa')} />
            {erroCampo('causa')}
          </div>
          <div className={styles.formField}>
            <label htmlFor="vaga-modalidade">Modalidade</label>
            <select id="vaga-modalidade" name="modalidade" defaultValue={vaga?.modalidade} required {...atributosCampo('modalidade')}>
              {Object.entries(MODALIDADES).map(([valor, texto]) => (
                <option key={valor} value={valor}>{texto}</option>
              ))}
            </select>
            {erroCampo('modalidade')}
          </div>
          <div className={`${styles.formField} ${styles.fullWidth}`}>
            <label htmlFor="vaga-local">Local ou atividade remota</label>
            <input id="vaga-local" name="local" defaultValue={vaga?.local} minLength={3} maxLength={500} required {...atributosCampo('local')} />
            {erroCampo('local')}
          </div>
          <div className={styles.formField}>
            <label htmlFor="vaga-periodo">Período</label>
            <select id="vaga-periodo" name="periodo" defaultValue={vaga?.periodo} required {...atributosCampo('periodo')}>
              {Object.entries(PERIODOS).map(([valor, texto]) => (
                <option key={valor} value={valor}>{texto}</option>
              ))}
            </select>
            {erroCampo('periodo')}
          </div>
          <div className={styles.formField}>
            <label htmlFor="vaga-carga">Carga horária (horas)</label>
            <input id="vaga-carga" name="carga_horaria" defaultValue={vaga?.carga_horaria} type="number" min="0.01" max="99999.99" step="0.01" required {...atributosCampo('carga_horaria')} />
            {erroCampo('carga_horaria')}
          </div>
          <div className={styles.formField}>
            <label htmlFor="vaga-quantidade">Número de vagas</label>
            <input id="vaga-quantidade" name="numero_vagas" defaultValue={vaga?.numero_vagas} type="number" min="1" step="1" required {...atributosCampo('numero_vagas')} />
            {erroCampo('numero_vagas')}
          </div>
        </div>
        {horariosBloqueados && <p role="status">Os horários estão bloqueados porque há candidaturas pendentes ou aceitas.</p>}
        <fieldset disabled={horariosBloqueados} className={styles.publicationFields}>
          <EncontrosEditor encontros={encontros} onChange={alterarEncontros} erro={erroEncontros} />
        </fieldset>
        <VagaMediaFields fotos={fotos} setFotos={setFotos} fotosAtuais={fotosAtuais} removerFoto={indice => setFotosAtuais(atuais => atuais.filter((_, i) => i !== indice))} documentos={documentos} setDocumentos={setDocumentos} error={erroMidia} />

        {erro && <p className={styles.error} role="alert">{erro}</p>}

        <div className={styles.formActions}>
          <button type="button" onClick={fechar}>Cancelar</button>
          <button className={styles.primaryButton} type="submit">
            {publicando ? 'Salvando…' : editando ? 'Salvar alterações' : 'Publicar vaga'}
          </button>
        </div>
        </fieldset>
      </form>
    </dialog>
  )
}
