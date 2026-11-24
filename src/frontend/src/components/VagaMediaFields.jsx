import s from '../pages/Vagas.module.css'

export default function VagaMediaFields({ fotos, setFotos, documentos, setDocumentos, error }) {
  function change(id, field, value) { setDocumentos(items => items.map(item => item.id === id ? { ...item, [field]: value } : item)) }
  return <section className={s.mediaFields} aria-labelledby="vaga-midia-title">
    <h3 id="vaga-midia-title">Fotos e documentos (opcional)</h3>
    <div className={s.formField}><label htmlFor="vaga-fotos">Fotos da atividade</label>
      <input id="vaga-fotos" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={e => setFotos([...e.target.files])} aria-describedby="vaga-fotos-hint" />
      <small id="vaga-fotos-hint">Até 10 imagens JPG, PNG ou WebP, de até 5 MB cada. As fotos serão públicas.</small>
      {fotos.length > 0 && <ul>{fotos.map((file,i) => <li key={i}>{file.name}</li>)}</ul>}
    </div>
    {documentos.map((doc, i) => <div key={doc.id} className={s.documentFields}>
      <div className={s.formField}><label htmlFor={`doc-nome-${doc.id}`}>Nome do documento {i+1}</label><input id={`doc-nome-${doc.id}`} value={doc.nome} maxLength={150} onChange={e => change(doc.id,'nome',e.target.value)} /></div>
      <div className={s.formField}><label htmlFor={`doc-url-${doc.id}`}>Link do modelo {i+1} (opcional)</label><input id={`doc-url-${doc.id}`} type="url" value={doc.modelo_url} maxLength={2000} placeholder="https://" onChange={e => change(doc.id,'modelo_url',e.target.value)} /></div>
      <button type="button" onClick={() => setDocumentos(items => items.filter(item => item.id !== doc.id))}>Remover documento {i+1}</button>
    </div>)}
    <button type="button" disabled={documentos.length >= 20} onClick={() => setDocumentos(items => [...items,{id:crypto.randomUUID(),nome:'',modelo_url:''}])}>Adicionar documento exigido</button>
    {error && <p role="alert" className={s.fieldError}>{error}</p>}
  </section>
}
