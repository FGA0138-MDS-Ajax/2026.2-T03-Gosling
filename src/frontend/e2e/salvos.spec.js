import { randomUUID } from 'node:crypto'
import { expect, test as base } from '@playwright/test'

const api = process.env.E2E_API_URL ?? 'http://127.0.0.1:8000'

const test = base.extend({
  ambiente: async ({ request, browser }, executar) => {
    const senha = process.env.DEMO_PASSWORD
    expect(senha, 'Defina DEMO_PASSWORD para as contas fictícias').toBeTruthy()
    async function login(email, admin = false) {
      const response = await request.post(`${api}/api/v1/${admin ? 'admin' : 'auth'}/login`, { data: { email, senha } })
      expect(response.status()).toBe(200)
      return response.json()
    }
    const admin = await login('admin@example.com', true)
    const headers = { Authorization: `Bearer ${admin.access_token}` }
    const criados = []
    const contexts = []
    try {
      async function voluntario() {
        const email = `salvos-${randomUUID()}@example.com`
        const response = await request.post(`${api}/api/v1/admin/usuarios`, {
          headers, data: { nome: 'Voluntário Teste Salvos', email, senha, perfil: 'VOLUNTARIO' },
        })
        expect(response.status()).toBe(201)
        criados.push((await response.json()).id)
        return login(email)
      }
      const first = await voluntario()
      const second = await voluntario()
      const ong = await login('ong@example.com')
      const publication = await request.post(`${api}/api/v1/vagas`, {
        headers: { Authorization: `Bearer ${ong.access_token}` },
        data: {
          titulo: `Oficina teste salvos ${randomUUID()}`, descricao: 'Atividade fictícia de teste de favoritos.',
          atividades: 'Organizar livros e apoiar a leitura.', causa: 'Educação', modalidade: 'PRESENCIAL',
          local: 'Brasília, DF', periodo: 'MANHA', carga_horaria: 3, numero_vagas: 10,
          ocorrencias: [{ inicio: '2099-11-16T09:00:00-03:00', fim: '2099-11-16T12:00:00-03:00' }],
        },
      })
      expect(publication.status()).toBe(201)
      const vaga = await publication.json()
      async function abrir(sessao, viewport = { width: 1280, height: 900 }) {
        const context = await browser.newContext({ viewport })
        contexts.push(context)
        await context.addInitScript(data => sessionStorage.setItem('volunja:session', JSON.stringify({
          access_token: data.access_token, expires_at: data.expires_at, persistent: false,
        })), sessao)
        return context.newPage()
      }
      async function ids(sessao) {
        const response = await request.get(`${api}/api/v1/voluntarios/me/vagas-salvas`, {
          headers: { Authorization: `Bearer ${sessao.access_token}` },
        })
        expect(response.status()).toBe(200)
        return (await response.json()).vaga_ids
      }
      await executar({ vaga, first, second, abrir, ids })
    } finally {
      for (const context of contexts) await context.close()
      for (const id of criados.reverse()) {
        const response = await request.delete(`${api}/api/v1/admin/usuarios/${id}`, { headers })
        expect(response.status(), `Limpeza do voluntário ${id}`).toBe(204)
      }
    }
  },
})

test('salvos persistem entre telas e navegadores e ficam isolados por conta', async ({ ambiente }) => {
  const { vaga, first, second, abrir, ids } = ambiente
  const page = await abrir(first)
  await page.goto(`/vagas/${vaga.id}`)
  const summary = page.getByRole('complementary', { name: 'Participar desta vaga' })
  const salvar = summary.getByRole('button', { name: 'Salvar vaga' })
  await expect(salvar).toHaveAttribute('aria-pressed', 'false')
  await salvar.click()
  await expect(summary.getByRole('button', { name: 'Vaga salva' })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('status')).toHaveText('Vaga salva na sua conta.')
  expect(await ids(first)).toEqual([vaga.id])

  const outroNavegador = await abrir(first)
  await outroNavegador.goto(`/vagas/${vaga.id}`)
  await expect(outroNavegador.getByRole('complementary', { name: 'Participar desta vaga' }).getByRole('button', { name: 'Vaga salva' })).toHaveAttribute('aria-pressed', 'true')
  const outraConta = await abrir(second)
  await outraConta.goto(`/vagas/${vaga.id}`)
  await expect(outraConta.getByRole('complementary', { name: 'Participar desta vaga' }).getByRole('button', { name: 'Salvar vaga' })).toHaveAttribute('aria-pressed', 'false')
  expect(await ids(second)).toEqual([])

  await page.goto('/vagas')
  const remover = page.getByRole('button', { name: `Remover dos salvos: ${vaga.titulo}`, exact: true })
  await expect(remover).toHaveAttribute('aria-pressed', 'true')
  await remover.click()
  await expect(page.getByRole('button', { name: `Salvar: ${vaga.titulo}`, exact: true })).toHaveAttribute('aria-pressed', 'false')
  expect(await ids(first)).toEqual([])
  await outroNavegador.reload()
  await expect(outroNavegador.getByRole('complementary', { name: 'Participar desta vaga' }).getByRole('button', { name: 'Salvar vaga' })).toHaveAttribute('aria-pressed', 'false')
})

test('importação no celular exige escolha e confirma persistência no servidor', async ({ ambiente }) => {
  const { vaga, first, abrir, ids } = ambiente
  const page = await abrir(first, { width: 360, height: 900 })
  await page.goto('/login')
  await page.evaluate(vagaId => {
    localStorage.setItem('volunja:saved-vagas:visitante', JSON.stringify([vagaId]))
    localStorage.setItem('volunja:saved-vagas:999999', '[999999]')
  }, vaga.id)
  await page.goto('/voluntario')
  const importar = page.getByRole('button', { name: 'Importar salvos deste navegador' })
  await expect(importar).toBeEnabled()
  expect(await ids(first)).toEqual([])
  await importar.click()
  await expect(page.getByRole('status')).toHaveText('1 vaga importada para sua conta.')
  expect(await ids(first)).toEqual([vaga.id])
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('volunja:saved-vagas:visitante')))).toEqual([])
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('volunja:saved-vagas:999999')))).toEqual([999999])
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.screenshot({ path: test.info().outputPath('importacao-salvos-mobile.png'), fullPage: true })
})
