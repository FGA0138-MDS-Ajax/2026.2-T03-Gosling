import { useEffect, useState } from 'react'
import { listarCausas } from '../services/causasService'

export function useCausas() {
  const [estado, setEstado] = useState({ itens: [], revisao: -1, erro: '' })
  const [tentativa, setTentativa] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    listarCausas(controller.signal).then(itens => {
      if (!controller.signal.aborted) setEstado({ itens, revisao: tentativa, erro: '' })
    }).catch(() => {
      if (!controller.signal.aborted) setEstado(old => ({ ...old, revisao: tentativa, erro: 'Não foi possível carregar as causas.' }))
    })
    return () => controller.abort()
  }, [tentativa])
  return { itens: estado.itens, carregando: estado.revisao !== tentativa, erro: estado.revisao === tentativa ? estado.erro : '', recarregar: () => setTentativa(old => old + 1) }
}

export const normalizarRotulo = texto => (texto || '').normalize('NFKC').trim().toLowerCase()
export const causaPorNome = (itens, nome) => itens.find(causa => [causa.nome, ...(causa.aliases || [])].some(rotulo => normalizarRotulo(rotulo) === normalizarRotulo(nome)))
