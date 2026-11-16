import { useCallback, useEffect, useState } from 'react'
import { listarVagas } from '../services/vagasService'

export function useVagas(pagina, { porPagina = 20, causa = '', modalidade = '', periodo = '' } = {}) {
  const [resultado, setResultado] = useState({
    itens: [], total: 0, pagina: 1, por_pagina: 20, chave: null, erro: '',
  })
  const [revisao, setRevisao] = useState(0)
  const consulta = `${pagina}:${porPagina}:${causa}:${modalidade}:${periodo}`
  const chave = `${consulta}:${revisao}`

  useEffect(() => {
    const controller = new AbortController()
    let ativo = true
    listarVagas({ pagina, porPagina, causa, modalidade, periodo, signal: controller.signal })
      .then((data) => {
        if (ativo) setResultado({ ...data, chave: `${consulta}:${revisao}`, erro: '' })
      })
      .catch(() => {
        if (ativo) setResultado({
          itens: [], total: 0, pagina, por_pagina: porPagina, chave: `${consulta}:${revisao}`,
          erro: 'Não foi possível carregar as vagas. Tente novamente.',
        })
      })
    return () => { ativo = false; controller.abort() }
  }, [pagina, porPagina, causa, modalidade, periodo, consulta, revisao])

  const recarregar = useCallback(() => setRevisao((atual) => atual + 1), [])
  return {
    ...resultado,
    carregando: resultado.chave !== chave,
    erro: resultado.chave === chave ? resultado.erro : '',
    recarregar,
  }
}
