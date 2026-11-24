import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import Modal from './ui/Modal'
import { baixarComprovante, enviarCandidatura } from '../services/candidaturasService'
import { ACCEPT_DOCUMENTOS, interpretarErroCandidatura, validarArquivo } from '../utils/candidatura'
import { horarioDoEncontro } from '../utils/ocorrencias'
import { avisarCandidaturasAlteradas } from '../utils/calendario'
import s from './CandidaturaModal.module.css'

const dataLonga = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo', weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
})
const capitalizar = (texto) => texto.charAt(0).toUpperCase() + texto.slice(1)

// Fluxo de candidatura (RF16, issue #45). Só mostra a confirmação depois do HTTP 201;
// um conflito de agenda (409) é repassado à página por onConflito.
export default function CandidaturaModal({ vaga, ocorrencias, arquivosIniciais, onClose, onEnviada, onConflito }) {
  const documentosExigidos = vaga.documentos_exigidos ?? []
  const [arquivos, setArquivos] = useState(() => arquivosIniciais ?? {})
  const [erros, setErros] = useState({})
  const [mensagem, setMensagem] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [candidatura, setCandidatura] = useState(null)
  const [baixando, setBaixando] = useState(false)
  const [avisoComprovante, setAvisoComprovante] = useState('')
  const enviandoAgora = useRef(false)

  function escolherArquivo(indice, arquivo) {
    setArquivos((atual) => ({ ...atual, [indice]: arquivo }))
    setErros((atual) => ({ ...atual, [indice]: arquivo ? validarArquivo(arquivo) : '' }))
    setMensagem('')
  }

  async function enviar(evento) {
    evento.preventDefault()
    if (enviandoAgora.current) return
    const encontrados = {}
    documentosExigidos.forEach((_, indice) => {
      const erro = validarArquivo(arquivos[indice])
      if (erro) encontrados[indice] = erro
    })
    setErros(encontrados)
    if (Object.keys(encontrados).length) {
      setMensagem('Confira os documentos indicados.')
      return
    }

    const documentos = documentosExigidos.map((_, indice) => ({ indice, arquivo: arquivos[indice] }))
    enviandoAgora.current = true
    setEnviando(true)
    setMensagem('')
    try {
      const resultado = await enviarCandidatura(vaga.id, documentos)
      setCandidatura(resultado)
      avisarCandidaturasAlteradas()
      onEnviada?.(resultado)
    } catch (falha) {
      const erro = interpretarErroCandidatura(falha)
      if (erro.tipo === 'conflito') {
        onConflito(erro, arquivos)
        return
      }
      if (erro.tipo === 'campos') {
        const porDocumento = {}
        erro.indices.forEach((posicao, i) => {
          const indice = documentos[posicao]?.indice
          if (indice !== undefined) porDocumento[indice] = erro.detalhes[i] || 'Arquivo recusado.'
        })
        setErros(porDocumento)
      }
      setMensagem(erro.mensagem)
    } finally {
      enviandoAgora.current = false
      setEnviando(false)
    }
  }

  async function baixar() {
    setBaixando(true)
    setAvisoComprovante('')
    try {
      const pdf = await baixarComprovante(candidatura.id)
      const url = URL.createObjectURL(pdf)
      const link = document.createElement('a')
      link.href = url
      link.download = `comprovante-candidatura-${candidatura.id}.pdf`
      document.body.append(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch {
      setAvisoComprovante('Não foi possível baixar o comprovante agora. Ele também fica disponível em Minhas candidaturas.')
    } finally {
      setBaixando(false)
    }
  }

  if (candidatura) {
    return (
      <Modal title="Candidatura enviada" onClose={onClose}>
        <div className={s.corpo}>
          <p role="status" className={s.sucesso}>
            Sua candidatura para <strong>{vaga.titulo}</strong> foi registrada.
          </p>
          <dl className={s.resumo}>
            <div><dt>Situação</dt><dd>Pendente: aguardando a análise da organização</dd></div>
            {candidatura.comprovante?.codigo && (
              <div><dt>Código do comprovante</dt><dd>{candidatura.comprovante.codigo}</dd></div>
            )}
          </dl>
          <p className={s.dica}>O contato do responsável é liberado depois do aceite.</p>
          {avisoComprovante && <p role="alert" className={s.erro}>{avisoComprovante}</p>}
          <div className={s.acoes}>
            <button type="button" className={s.principal} onClick={baixar} disabled={baixando}>
              {baixando ? 'Baixando comprovante…' : 'Baixar comprovante (PDF)'}
            </button>
            <Link className={s.secundario} to="/voluntario/candidaturas">Ver minhas candidaturas</Link>
          </div>
        </div>
      </Modal>
    )
  }

  return (
    <Modal title="Confirmar candidatura" onClose={onClose}>
      <form className={s.corpo} noValidate onSubmit={enviar} aria-label="Confirmar candidatura" aria-busy={enviando}>
        <fieldset disabled={enviando} className={s.grupo}>
          <section aria-labelledby="candidatura-vaga">
            <h3 id="candidatura-vaga" className={s.titulo}>{vaga.titulo}</h3>
            <p className={s.dica}>{vaga.organizacao.nome} · {vaga.local}</p>
            <ul className={s.encontros} aria-label="Encontros desta candidatura">
              {ocorrencias.map((item) => (
                <li key={item.id ?? item.inicio}>
                  <strong>{capitalizar(dataLonga.format(new Date(item.inicio)))}</strong>
                  <span>{horarioDoEncontro(item)}</span>
                </li>
              ))}
            </ul>
            <p className={s.dica}>Horários de Brasília. Ao confirmar, você se compromete com todos os encontros.</p>
          </section>

          <section aria-labelledby="candidatura-documentos">
            <h3 id="candidatura-documentos" className={s.titulo}>Documentos</h3>
            {documentosExigidos.length === 0 ? (
              <p className={s.dica}>Esta vaga não exige documentos.</p>
            ) : (
              <>
                <p className={s.dica}>Arquivos PDF, JPG ou PNG de até 5 MB.</p>
                <ul className={s.documentos}>
                  {documentosExigidos.map((documento, indice) => {
                    const id = `documento-${indice}`
                    return (
                      <li key={indice}>
                        <label htmlFor={id}>{documento.nome}</label>
                        {documento.modelo_url && (
                          <a href={documento.modelo_url} target="_blank" rel="noopener noreferrer">
                            Baixar modelo de {documento.nome}
                          </a>
                        )}
                        <input
                          id={id}
                          name={id}
                          type="file"
                          accept={ACCEPT_DOCUMENTOS}
                          onChange={(evento) => escolherArquivo(indice, evento.target.files?.[0] ?? null)}
                          aria-invalid={Boolean(erros[indice])}
                          aria-describedby={erros[indice] ? `${id}-erro` : undefined}
                        />
                        {arquivos[indice] && <small className={s.dica}>Selecionado: {arquivos[indice].name}</small>}
                        {erros[indice] && <span id={`${id}-erro`} className={s.erro}>{erros[indice]}</span>}
                      </li>
                    )
                  })}
                </ul>
              </>
            )}
          </section>

          {mensagem && <p role="alert" className={s.erro}>{mensagem}</p>}
          <div className={s.acoes}>
            <button type="submit" className={s.principal}>
              {enviando ? 'Enviando candidatura…' : 'Confirmar candidatura'}
            </button>
            <button type="button" className={s.secundario} onClick={onClose}>Cancelar</button>
          </div>
          {enviando && <p role="status" className={s.dica}>Enviando seus dados e conferindo sua agenda…</p>}
        </fieldset>
      </form>
    </Modal>
  )
}
