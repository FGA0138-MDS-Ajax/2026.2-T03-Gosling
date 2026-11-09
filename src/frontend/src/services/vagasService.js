import http from './http'

export async function listarVagas({ pagina = 1, signal } = {}) {
  const { data } = await http.get('/vagas', {
    params: { pagina, por_pagina: 20 },
    publicRequest: true,
    signal,
  })
  return data
}

export async function publicarVaga(payload) {
  const { data, status } = await http.post('/vagas', payload)
  if (status !== 201) throw new Error('A publicação não foi confirmada.')
  return data
}
