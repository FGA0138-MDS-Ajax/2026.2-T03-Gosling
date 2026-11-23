export class ErroCep extends Error {
  constructor(codigo, mensagem) {
    super(mensagem)
    this.codigo = codigo
  }
}

export async function consultarCep(valor, signal) {
  if (!/^[0-9]{5}-?[0-9]{3}$/.test(valor?.trim() || ''))
    throw new ErroCep('INVALIDO', 'Informe um CEP com oito dígitos.')
  const cep = valor.trim().replace('-', '')
  const controller = new AbortController()
  const cancelar = () => controller.abort()
  if (signal?.aborted) controller.abort()
  signal?.addEventListener('abort', cancelar, { once: true })
  const tempo = setTimeout(cancelar, 8000)
  try {
    const resposta = await fetch(`https://viacep.com.br/ws/${cep}/json/`, {
      signal: controller.signal,
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
    })
    if (!resposta.ok) throw new Error('Consulta indisponível')
    const dados = await resposta.json()
    if (dados?.erro === true || dados?.erro === 'true')
      throw new ErroCep(
        'NAO_ENCONTRADO',
        'CEP não encontrado. Você pode preencher o endereço manualmente.',
      )
    if (
      dados?.cep?.replace('-', '') !== cep ||
      typeof dados.localidade !== 'string' ||
      dados.localidade.trim().length < 2 ||
      !ESTADOS.includes(dados.uf)
    )
      throw new Error('Resposta incompleta')
    return {
      cep,
      logradouro: typeof dados.logradouro === 'string' ? dados.logradouro : '',
      bairro: typeof dados.bairro === 'string' ? dados.bairro : '',
      cidade: dados.localidade,
      estado: dados.uf,
    }
  } catch (erro) {
    if (signal?.aborted || erro instanceof ErroCep) throw erro
    throw new ErroCep(
      'INDISPONIVEL',
      'Não foi possível consultar o CEP. Tente novamente ou preencha o endereço manualmente.',
    )
  } finally {
    clearTimeout(tempo)
    signal?.removeEventListener('abort', cancelar)
  }
}
import { ESTADOS } from '../utils/volunteerProfile'
