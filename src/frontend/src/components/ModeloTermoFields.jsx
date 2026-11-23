import { useState } from 'react'
import { carregarMidiaPrivada } from '../services/midiaService'
import { modeloTermoLocal } from '../utils/documentosVaga'
import {
  arquivoValido,
  LIMITE_MODELO_TERMO,
  nomeMidiaLocal,
  tamanhoDoArquivo,
  TIPO_MODELO_TERMO,
} from '../utils/midia'
import s from '../pages/Vagas.module.css'

export default function ModeloTermoFields({ documento, numero, onChange, onError }) {
  const { arquivoModelo, modelo_url: url, modelo } = documento
  const [baixando, setBaixando] = useState(false)
  const anexado = Boolean(arquivoModelo || modeloTermoLocal(url))
  const nome = arquivoModelo?.name ?? modelo?.nome ?? 'Modelo de termo.pdf'
  const tamanho = arquivoModelo?.size ?? modelo?.tamanho_bytes

  function selecionar(event) {
    const arquivo = event.target.files[0]
    event.target.value = ''
    if (!arquivo) return
    if (!arquivoValido(arquivo, [TIPO_MODELO_TERMO], LIMITE_MODELO_TERMO)) {
      onError('Selecione um PDF de até 5 MB para o modelo do termo.')
      return
    }
    onChange({ arquivoModelo: arquivo, modelo_url: '', modelo: null })
    onError('')
  }

  async function baixar() {
    setBaixando(true)
    onError('')
    try {
      const blob = arquivoModelo ?? (await carregarMidiaPrivada(nomeMidiaLocal(url)))
      const temporaria = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = temporaria
      link.download = nome
      link.click()
      setTimeout(() => URL.revokeObjectURL(temporaria), 1000)
    } catch {
      onError('Não foi possível baixar o modelo. Tente novamente.')
    } finally {
      setBaixando(false)
    }
  }

  return (
    <div className={s.formField}>
      <label htmlFor={`doc-pdf-${documento.id}`}>
        {anexado ? 'Trocar' : 'Anexar'} PDF do termo {numero}
      </label>
      <input
        id={`doc-pdf-${documento.id}`}
        type="file"
        accept={TIPO_MODELO_TERMO}
        aria-describedby={`doc-pdf-hint-${documento.id}`}
        onChange={selecionar}
      />
      <small id={`doc-pdf-hint-${documento.id}`}>
        Até 5 MB. O modelo poderá ser baixado na página da vaga depois da publicação.
      </small>
      {anexado && (
        <>
          <span className={s.nomeModelo}>
            {nome}
            {tamanho !== undefined && ` · PDF · ${tamanhoDoArquivo(tamanho)}`}
          </span>
          <div className={s.midiaAcoes}>
            <button type="button" onClick={baixar} disabled={baixando}>
              {baixando ? 'Baixando…' : `Baixar modelo ${numero}`}
            </button>
            <button
              type="button"
              onClick={() => onChange({ arquivoModelo: null, modelo_url: '', modelo: null })}
            >
              Remover modelo {numero}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
