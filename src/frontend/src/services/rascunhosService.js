import http from './http'

const endpoint = '/vagas/rascunhos'

export async function consultarRascunho(id, signal) {
  const { data } = await http.get(`${endpoint}/${id}`, { signal })
  return data
}

export async function salvarRascunho(rascunho, dados) {
  if (!rascunho) {
    const { data } = await http.post(endpoint, dados)
    return data
  }

  const { data } = await http.patch(`${endpoint}/${rascunho.id}`, {
    versao: rascunho.versao,
    dados,
  })
  return data
}

export async function publicarRascunho(rascunho, dados) {
  const { data } = await http.post(`${endpoint}/${rascunho.id}/publicar`, {
    versao: rascunho.versao,
    dados,
  })
  return data
}
