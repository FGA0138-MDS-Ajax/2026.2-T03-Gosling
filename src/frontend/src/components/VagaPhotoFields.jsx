import { useEffect, useState } from 'react'
import { carregarMidiaPrivada } from '../services/midiaService'
import {
  arquivoValido,
  LIMITE_FOTO_VAGA,
  MAX_FOTOS_VAGA,
  nomeMidiaLocal,
  posicaoDaFoto,
  TIPOS_IMAGEM,
} from '../utils/midia'
import s from '../pages/Vagas.module.css'

function FotoRascunho({ foto, numero }) {
  const { arquivo, url } = foto
  const nome = nomeMidiaLocal(url)
  const [previa, setPrevia] = useState(null)
  const [falhou, setFalhou] = useState(false)

  useEffect(() => {
    if (!arquivo && !nome) return

    const controller = new AbortController()
    let temporaria

    async function carregar() {
      try {
        const blob = arquivo ?? (await carregarMidiaPrivada(nome, controller.signal))
        if (controller.signal.aborted) return
        temporaria = URL.createObjectURL(blob)
        setPrevia(temporaria)
      } catch (erro) {
        if (controller.signal.aborted) return
        if (erro.response?.status === 404) {
          setPrevia(url)
        } else {
          setFalhou(true)
        }
      }
    }

    carregar()
    return () => {
      controller.abort()
      if (temporaria) URL.revokeObjectURL(temporaria)
    }
  }, [arquivo, nome, url])

  const src = arquivo || nome ? previa : url
  const alternativo = arquivo ? `Prévia da foto ${numero}` : `Foto salva ${numero}`

  return (
    <div className={s.fotoPrevia}>
      {src && !falhou ? (
        <img
          src={src}
          alt={alternativo}
          style={posicaoDaFoto(foto.enquadramento)}
          onError={() => setFalhou(true)}
        />
      ) : (
        <span>{falhou ? 'Prévia indisponível' : 'Carregando foto…'}</span>
      )}
    </div>
  )
}

export default function VagaPhotoFields({ fotos, setFotos, onError }) {
  function selecionar(event) {
    const arquivos = Array.from(event.target.files)
    event.target.value = ''
    if (!arquivos.length) return

    if (fotos.length + arquivos.length > MAX_FOTOS_VAGA) {
      onError(`Selecione até ${MAX_FOTOS_VAGA} fotos para a vaga.`)
      return
    }
    if (arquivos.some(arquivo => !arquivoValido(arquivo, TIPOS_IMAGEM, LIMITE_FOTO_VAGA))) {
      onError('Use imagens JPG, PNG ou WebP de até 10 MB cada.')
      return
    }

    const novas = arquivos.map(arquivo => ({
      id: crypto.randomUUID(),
      arquivo,
      enquadramento: { x: 50, y: 50 },
    }))
    setFotos(atuais => [...atuais, ...novas])
    onError('')
  }

  function mover(origem, destino) {
    setFotos(atuais => {
      const ordenadas = [...atuais]
      const [foto] = ordenadas.splice(origem, 1)
      ordenadas.splice(destino, 0, foto)
      return ordenadas
    })
  }

  function remover(id) {
    setFotos(atuais => atuais.filter(foto => foto.id !== id))
    onError('')
  }

  function ajustar(id, eixo, valor) {
    setFotos(atuais =>
      atuais.map(foto =>
        foto.id === id
          ? { ...foto, enquadramento: { ...foto.enquadramento, [eixo]: Number(valor) } }
          : foto,
      ),
    )
  }

  return (
    <div className={s.formField}>
      <label htmlFor="vaga-fotos">Fotos da atividade</label>
      <input
        id="vaga-fotos"
        type="file"
        accept={TIPOS_IMAGEM.join(',')}
        multiple
        onChange={selecionar}
        aria-describedby="vaga-fotos-hint"
      />
      <small id="vaga-fotos-hint">
        Até {MAX_FOTOS_VAGA} imagens JPG, PNG ou WebP de até 10 MB cada. A primeira é a capa.
        As fotos ficam públicas quando a vaga é publicada.
      </small>
      {fotos.length > 0 && (
        <ul className={s.fotosDaVaga} aria-label="Ordem das fotos da vaga">
          {fotos.map((foto, indice) => {
            const numero = indice + 1
            return (
              <li key={foto.id}>
                <FotoRascunho foto={foto} numero={numero} />
                <strong>{indice === 0 ? 'Capa' : `Foto ${numero}`}</strong>
                {foto.arquivo && <span>{foto.arquivo.name}</span>}
                <div className={s.fotoAcoes}>
                  <button type="button" disabled={indice === 0} onClick={() => mover(indice, 0)}>
                    Definir foto {numero} como capa
                  </button>
                  <button
                    type="button"
                    disabled={indice === 0}
                    onClick={() => mover(indice, indice - 1)}
                  >
                    Subir foto {numero}
                  </button>
                  <button
                    type="button"
                    disabled={indice === fotos.length - 1}
                    onClick={() => mover(indice, indice + 1)}
                  >
                    Descer foto {numero}
                  </button>
                  <button type="button" onClick={() => remover(foto.id)}>
                    Remover foto {numero}
                  </button>
                </div>
                <details className={s.enquadramento}>
                  <summary>Ajustar enquadramento da foto {numero}</summary>
                  <label>
                    Posição horizontal da foto {numero}
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={foto.enquadramento.x}
                      onChange={event => ajustar(foto.id, 'x', event.target.value)}
                    />
                  </label>
                  <label>
                    Posição vertical da foto {numero}
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={foto.enquadramento.y}
                      onChange={event => ajustar(foto.id, 'y', event.target.value)}
                    />
                  </label>
                </details>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
