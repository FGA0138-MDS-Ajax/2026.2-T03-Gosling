import VagaDocumentFields from './VagaDocumentFields'
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
  return (
    <section className={s.mediaFields} aria-labelledby="vaga-midia-title">
      <h3 id="vaga-midia-title">Fotos e documentos (opcional)</h3>
      <VagaPhotoFields fotos={fotos} setFotos={setFotos} onError={onError} />
      <VagaDocumentFields documentos={documentos} setDocumentos={setDocumentos} onError={onError} />
      {error && (
        <p role="alert" className={s.fieldError}>
          {error}
        </p>
      )}
    </section>
  )
}
