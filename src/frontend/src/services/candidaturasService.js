import http from './http'

// Contrato: Documento de Arquitetura, Quadro 7 (módulos candidaturas e comprovantes).
// Os documentos seguem em multipart/form-data: para cada arquivo, o índice do
// documento exigido da vaga que ele atende, na mesma ordem.
export async function enviarCandidatura(vagaId, documentos = []) {
  const formulario = new FormData()
  for (const { indice, arquivo } of documentos) {
    formulario.append('documentos_exigidos', String(indice))
    formulario.append('arquivos', arquivo)
  }
  const resposta = await http.post(`/vagas/${vagaId}/candidaturas`, formulario, { timeout: 60000 })
  if (resposta.status !== 201) {
    throw new Error('O servidor não confirmou a candidatura.')
  }
  return resposta.data
}

export async function baixarComprovante(candidaturaId) {
  const { data } = await http.get(`/candidaturas/${candidaturaId}/comprovante`, { responseType: 'blob' })
  return data
}
