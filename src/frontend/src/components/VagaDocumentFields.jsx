import { documentoDaVaga, modeloTermoLocal, TIPOS_DOCUMENTO } from '../utils/documentosVaga'
import ModeloTermoFields from './ModeloTermoFields'
import s from '../pages/Vagas.module.css'

function DocumentoField({ documento, numero, onChange, onRemove, onError }) {
  const { id, nome, tipo, orientacao, obrigatorio } = documento
  const termo = tipo === 'TERMO'
  const temModeloLocal = documento.arquivoModelo || modeloTermoLocal(documento.modelo_url)

  function trocarTipo(novoTipo) {
    const alteracoes = { tipo: novoTipo }
    if (!nome.trim() || nome === TIPOS_DOCUMENTO[tipo]) {
      alteracoes.nome = novoTipo === 'PERSONALIZADO' ? '' : TIPOS_DOCUMENTO[novoTipo]
    }
    if (termo && novoTipo !== 'TERMO' && temModeloLocal) {
      alteracoes.arquivoModelo = null
      alteracoes.modelo_url = ''
      alteracoes.modelo = null
    }
    onChange(alteracoes)
  }

  return (
    <fieldset className={s.documentFields}>
      <legend>Documento {numero}</legend>
      <div className={s.formField}>
        <label htmlFor={`doc-tipo-${id}`}>Tipo do documento {numero}</label>
        <select
          id={`doc-tipo-${id}`}
          value={tipo}
          onChange={event => trocarTipo(event.target.value)}
        >
          {Object.entries(TIPOS_DOCUMENTO).map(([valor, rotulo]) => (
            <option key={valor} value={valor}>{rotulo}</option>
          ))}
        </select>
      </div>
      <div className={s.formField}>
        <label htmlFor={`doc-nome-${id}`}>Nome do documento {numero}</label>
        <input
          id={`doc-nome-${id}`}
          value={nome}
          maxLength={150}
          onChange={event => onChange({ nome: event.target.value })}
        />
      </div>
      <div className={s.formField}>
        <label htmlFor={`doc-orientacao-${id}`}>Orientação para o documento {numero}</label>
        <textarea
          id={`doc-orientacao-${id}`}
          value={orientacao}
          maxLength={1000}
          rows={2}
          onChange={event => onChange({ orientacao: event.target.value })}
        />
      </div>
      <label className={s.documentRequired}>
        <input
          type="checkbox"
          checked={obrigatorio}
          onChange={event => onChange({ obrigatorio: event.target.checked })}
        />
        Documento {numero} obrigatório
      </label>
      {termo && (
        <ModeloTermoFields
          documento={documento}
          numero={numero}
          onChange={onChange}
          onError={onError}
        />
      )}
      {!temModeloLocal && (
        <div className={s.formField}>
          <label htmlFor={`doc-url-${id}`}>Link do modelo {numero} (opcional)</label>
          <input
            id={`doc-url-${id}`}
            type="url"
            value={documento.modelo_url}
            maxLength={2000}
            placeholder="https://"
            onChange={event => onChange({ modelo_url: event.target.value })}
          />
        </div>
      )}
      <button type="button" onClick={onRemove}>
        Remover documento {numero}
      </button>
    </fieldset>
  )
}

export default function VagaDocumentFields({ documentos, setDocumentos, onError }) {
  function alterar(id, alteracoes) {
    setDocumentos(atuais =>
      atuais.map(documento => documento.id === id ? { ...documento, ...alteracoes } : documento),
    )
  }

  function adicionar() {
    const novo = documentoDaVaga()
    setDocumentos(atuais => [...atuais, novo])
  }

  function remover(id) {
    setDocumentos(atuais => atuais.filter(documento => documento.id !== id))
    onError('')
  }

  return (
    <div>
      {documentos.map((documento, indice) => (
        <DocumentoField
          key={documento.id}
          documento={documento}
          numero={indice + 1}
          onChange={alteracoes => alterar(documento.id, alteracoes)}
          onRemove={() => remover(documento.id)}
          onError={onError}
        />
      ))}
      <button type="button" disabled={documentos.length >= 20} onClick={adicionar}>
        Adicionar documento exigido
      </button>
    </div>
  )
}
