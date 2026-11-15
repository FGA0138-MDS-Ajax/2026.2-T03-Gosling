import { useCallback, useEffect, useState } from 'react'
import { listarVagas } from '../services/vagasService'

export function useVagas(pagina) {
  const [resultado, setResultado] = useState({
    itens: [], total: 0, pagina: 1, por_pagina: 20, chave: null, erro: '',
  })
  const [revisao, setRevisao] = useState(0)
  const chave = `${pagina}:${revisao}`

  useEffect(() => {
    const controller = new AbortController()
    let ativo = true
    listarVagas({ pagina, signal: controller.signal })
      .then((data) => {
        if (ativo) setResultado({ ...data, chave: `${pagina}:${revisao}`, erro: '' })
      })
      .catch(() => {
        if (ativo) setResultado({
          itens: [], total: 0, pagina, por_pagina: 20, chave: `${pagina}:${revisao}`,
          erro: 'Não foi possível carregar as vagas. Tente novamente.',
        })
      })
    return () => { ativo = false; controller.abort() }
  }, [pagina, revisao])

  const recarregar = useCallback(() => setRevisao((atual) => atual + 1), [])
  return {
    ...resultado,
    carregando: resultado.chave !== chave,
    erro: resultado.chave === chave ? resultado.erro : '',
    recarregar,
  }
}
