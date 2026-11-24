import http from './http'

export async function listarVagas({ pagina = 1, porPagina = 20, causa, modalidade, periodo, signal } = {}) {
  const filtros = Object.fromEntries(Object.entries({ causa, modalidade, periodo }).filter(([, valor]) => valor))
  const { data } = await http.get('/vagas', {
    params: { pagina, por_pagina: porPagina, ...filtros },
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

export async function detalharVaga(id, signal) {
  const { data } = await http.get(`/vagas/${id}`, { publicRequest: true, signal })
  return data
}

export async function enviarFotoVaga(file) {
  const { data } = await http.post('/vagas/fotos', file, { headers: { 'Content-Type': file.type } })
  return data.url
}
