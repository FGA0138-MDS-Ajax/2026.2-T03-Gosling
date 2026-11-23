import s from '../pages/Vagas.module.css'

export default function VagaMediaFields({
  fotos,
  setFotos,
  fotosSalvas,
  onRemoverFoto,
  documentos,
  setDocumentos,
  error,
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
      <div className={s.formField}>
        <label htmlFor="vaga-fotos">Fotos da atividade</label>
        <input
          id="vaga-fotos"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          onChange={event => setFotos([...event.target.files])}
          aria-describedby="vaga-fotos-hint"
        />
        <small id="vaga-fotos-hint">
          Até 10 imagens JPG, PNG ou WebP, de até 5 MB cada. As fotos serão públicas.
        </small>
        {fotos.length > 0 && (
          <ul>
            {fotos.map((arquivo, indice) => (
              <li key={indice}>{arquivo.name}</li>
            ))}
          </ul>
        )}
        {fotosSalvas.length > 0 && (
          <ul className={s.fotosSalvas} aria-label="Fotos salvas no rascunho">
            {fotosSalvas.map((url, indice) => (
              <li key={`${url}-${indice}`}>
                <img src={url} alt={`Foto salva ${indice + 1}`} loading="lazy" />
                <button type="button" onClick={() => onRemoverFoto(indice)}>
                  Remover foto {indice + 1}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
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
