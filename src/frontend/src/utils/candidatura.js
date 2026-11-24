// Regras de envio de documentos (Documento de Arquitetura, MR09): PDF, JPG ou PNG de até 5 MB.
export const TIPOS_ACEITOS = {
  'application/pdf': 'PDF',
  'image/jpeg': 'JPG',
  'image/png': 'PNG',
}
export const ACCEPT_DOCUMENTOS = '.pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png'
export const TAMANHO_MAXIMO = 5 * 1024 * 1024

export function validarArquivo(arquivo) {
  if (!arquivo) return 'Anexe este documento.'
  if (!TIPOS_ACEITOS[arquivo.type]) return 'Envie um arquivo PDF, JPG ou PNG.'
  if (arquivo.size === 0) return 'O arquivo está vazio.'
  if (arquivo.size > TAMANHO_MAXIMO) return 'O arquivo deve ter até 5 MB.'
  return ''
}

// Traduz a resposta de erro da API em uma situação que a tela sabe tratar.
// 409 é conflito de agenda, salvo quando a API informa que a candidatura já existe.
export function interpretarErroCandidatura(falha) {
  const status = falha?.response?.status
  const detail = falha?.response?.data?.detail
  const mensagem = typeof detail === 'string' ? detail : detail?.mensagem

  if (status === 409) {
    if (detail?.codigo === 'CANDIDATURA_DUPLICADA') {
      return { tipo: 'duplicada', mensagem: mensagem || 'Você já se candidatou a esta vaga.' }
    }
    return {
      tipo: 'conflito',
      mensagem: mensagem || 'Esta vaga tem encontros no mesmo horário de compromissos da sua agenda.',
      conflitos: Array.isArray(detail?.conflitos) ? detail.conflitos : [],
    }
  }
  if (status === 422 && Array.isArray(detail)) {
    const indices = detail.map((item) => item.loc?.[2]).filter((valor) => Number.isInteger(valor))
    return {
      tipo: 'campos',
      mensagem: 'Confira os documentos indicados e tente novamente.',
      indices,
      detalhes: detail.map((item) => item.msg).filter(Boolean),
    }
  }
  if (status === 404) return { tipo: 'indisponivel', mensagem: 'Esta vaga não está mais disponível para candidaturas.' }
  if (status === 403) return { tipo: 'proibido', mensagem: mensagem || 'Só contas de voluntário podem se candidatar.' }
  if (status === 401) return { tipo: 'sessao', mensagem: 'Sua sessão expirou. Entre novamente para se candidatar.' }
  return { tipo: 'geral', mensagem: mensagem || 'Não foi possível enviar a candidatura. Tente novamente.' }
}
