import { beforeEach, describe, expect, it, vi } from 'vitest'
import http from './http'
import { baixarComprovante, enviarCandidatura } from './candidaturasService'

vi.mock('./http', () => ({ default: { post: vi.fn(), get: vi.fn() } }))

beforeEach(() => vi.resetAllMocks())

describe('serviço de candidaturas', () => {
  it('envia multipart para POST /vagas/{id}/candidaturas com índice e arquivo de cada documento', async () => {
    http.post.mockResolvedValue({ status: 201, data: { id: 9 } })
    const rg = new File(['a'], 'rg.pdf', { type: 'application/pdf' })
    const termo = new File(['b'], 'termo.png', { type: 'image/png' })

    await expect(enviarCandidatura(7, [{ indice: 0, arquivo: rg }, { indice: 2, arquivo: termo }])).resolves.toEqual({ id: 9 })

    const [url, formulario, opcoes] = http.post.mock.calls[0]
    expect(url).toBe('/vagas/7/candidaturas')
    expect(formulario).toBeInstanceOf(FormData)
    expect(formulario.getAll('documentos_exigidos')).toEqual(['0', '2'])
    expect(formulario.getAll('arquivos').map((arquivo) => arquivo.name)).toEqual(['rg.pdf', 'termo.png'])
    expect(opcoes.timeout).toBeGreaterThan(10000)
  })

  it('só aceita a candidatura como criada quando o servidor responde 201', async () => {
    http.post.mockResolvedValue({ status: 200, data: { id: 9 } })
    await expect(enviarCandidatura(7, [])).rejects.toThrow('O servidor não confirmou a candidatura.')
  })

  it('baixa o comprovante como arquivo pelo recurso de comprovantes', async () => {
    const pdf = new Blob(['%PDF'], { type: 'application/pdf' })
    http.get.mockResolvedValue({ data: pdf })
    await expect(baixarComprovante(41)).resolves.toBe(pdf)
    expect(http.get).toHaveBeenCalledWith('/candidaturas/41/comprovante', { responseType: 'blob' })
  })
})
