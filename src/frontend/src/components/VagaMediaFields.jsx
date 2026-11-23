import VagaPhotoFields from './VagaPhotoFields'
import s from '../pages/Vagas.module.css'

export default function VagaMediaFields({
  fotos,
  setFotos,
  documentos,
  setDocumentos,
  error,
  onError,
}) {
  function alterarDocumento(id, campo, valor) {
    setDocumentos(lista =>
      lista.map(documento => (documento.id === id ? { ...documento, [campo]: valor } : documento)),
    )
  }

  function adicionarDocumento() {
    const novo = { id: crypto.randomUUID(), nome: '', modelo_url: '' }
    setDocumentos(lista => [...lista, novo])
  }

  function removerDocumento(id) {
    setDocumentos(lista => lista.filter(documento => documento.id !== id))
  }

  return (
    <section className={s.mediaFields} aria-labelledby="vaga-midia-title">
      <h3 id="vaga-midia-title">Fotos e documentos (opcional)</h3>
      <VagaPhotoFields fotos={fotos} setFotos={setFotos} onError={onError} />
      {documentos.map((documento, indice) => (
        <div key={documento.id} className={s.documentFields}>
          <div className={s.formField}>
            <label htmlFor={`doc-nome-${documento.id}`}>Nome do documento {indice + 1}</label>
            <input
              id={`doc-nome-${documento.id}`}
              value={documento.nome}
              maxLength={150}
              onChange={event => alterarDocumento(documento.id, 'nome', event.target.value)}
            />
          </div>
          <div className={s.formField}>
            <label htmlFor={`doc-url-${documento.id}`}>
              Link do modelo {indice + 1} (opcional)
            </label>
            <input
              id={`doc-url-${documento.id}`}
              type="url"
              value={documento.modelo_url}
              maxLength={2000}
              placeholder="https://"
              onChange={event => alterarDocumento(documento.id, 'modelo_url', event.target.value)}
            />
          </div>
          <button type="button" onClick={() => removerDocumento(documento.id)}>
            Remover documento {indice + 1}
          </button>
        </div>
      ))}
      <button type="button" disabled={documentos.length >= 20} onClick={adicionarDocumento}>
        Adicionar documento exigido
      </button>
      {error && (
        <p role="alert" className={s.fieldError}>
          {error}
        </p>
      )}
    </section>
  )
}
