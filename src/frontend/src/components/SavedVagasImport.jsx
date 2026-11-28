import { useState } from 'react'
import { useSavedVagas } from '../hooks/useSavedVagas'
import s from '../pages/Area.module.css'

export default function SavedVagasImport() {
  const saved = useSavedVagas()
  const [feedback, setFeedback] = useState(null)
  if (!saved.allowed || saved.visitor || (!saved.local.length && feedback?.key !== saved.key)) return null

  async function importar() {
    const result = await saved.importLocal()
    if (!result) return
    setFeedback({ key: saved.key, message: `${result.imported} ${result.imported === 1 ? 'vaga importada' : 'vagas importadas'} para sua conta.${result.failed ? ' Algumas vagas não puderam ser importadas; os salvos locais foram preservados para tentar novamente.' : ''}` })
  }

  return <section className={s.card} aria-label="Importar vagas salvas deste navegador">
    <h2>Leve seus salvos com você</h2>
    {saved.local.length > 0 && <>
      <p className={s.muted}>Há {saved.local.length} {saved.local.length === 1 ? 'vaga salva' : 'vagas salvas'} neste navegador. Você pode vinculá-las à sua conta para acessar em outros dispositivos.</p>
      <div><button type="button" className={s.secondary} disabled={saved.importing || saved.loading} onClick={importar}>{saved.importing ? 'Importando…' : 'Importar salvos deste navegador'}</button></div>
    </>}
    {feedback?.key === saved.key && <p role="status">{feedback.message}</p>}
  </section>
}
