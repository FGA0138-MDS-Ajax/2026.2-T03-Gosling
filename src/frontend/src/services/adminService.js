import http from './http'

export async function listarCadastros(filtros = {}, signal) {
  const params = { pagina: filtros.pagina ?? 1, por_pagina: 20 }
  if (filtros.busca) params.busca = filtros.busca
  if (filtros.perfil) params.perfil = filtros.perfil
  if (filtros.ativo !== '') params.ativo = filtros.ativo
  const { data } = await http.get('/admin/usuarios', { params, signal })
  return data
}

export async function consultarCadastro(id) {
  const { data } = await http.get(`/admin/usuarios/${id}`)
  return data
}

export async function criarCadastro(payload) {
  const { data } = await http.post('/admin/usuarios', payload)
  return data
}

export async function excluirCadastro(id, excluirVagas = false) {
  await http.delete(`/admin/usuarios/${id}`, {
    params: { excluir_vagas: excluirVagas },
  })
}
