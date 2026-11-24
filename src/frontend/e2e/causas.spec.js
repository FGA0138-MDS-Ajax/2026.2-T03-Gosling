import { randomUUID } from 'node:crypto'
import { expect, test } from '@playwright/test'

const api = process.env.E2E_API_URL ?? 'http://127.0.0.1:8000'

test('perfil, publicação, home e exploração usam a mesma causa por ID', async ({ browser, request }) => {
  const senha = process.env.DEMO_PASSWORD
  expect(senha, 'Defina DEMO_PASSWORD para as contas fictícias').toBeTruthy()
  async function login(email, admin = false) {
    const response = await request.post(`${api}/api/v1/${admin ? 'admin' : 'auth'}/login`, { data: { email, senha } })
    expect(response.status()).toBe(200)
    return response.json()
  }
  const admin = await login('admin@example.com', true)
  const headers = { Authorization: `Bearer ${admin.access_token}` }
  const catalogo = await request.get(`${api}/api/v1/causas`)
  expect(catalogo.status()).toBe(200)
  const causa = (await catalogo.json()).find(item => item.codigo === 'protecao-animal')
  expect(causa.ativo).toBe(true)
  const email = `catalogo-${randomUUID()}@example.com`
  const cadastro = await request.post(`${api}/api/v1/admin/usuarios`, {
    headers, data: { nome: 'Voluntário Catálogo', email, senha, perfil: 'VOLUNTARIO' },
  })
  expect(cadastro.status()).toBe(201)
  const voluntarioId = (await cadastro.json()).id
  const contexts = []
  async function abrir(sessao) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 1000 } })
    contexts.push(context)
    await context.addInitScript(data => sessionStorage.setItem('volunja:session', JSON.stringify({
      access_token: data.access_token, expires_at: data.expires_at,
    })), sessao)
    return context.newPage()
  }
  try {
    const sessao = await login(email)
    const page = await abrir(sessao)
    await page.goto('/voluntario/perfil')
    await page.getByRole('checkbox', { name: causa.nome, exact: true }).click()
    const perfilRequest = page.waitForRequest(r => r.method() === 'PUT' && r.url().endsWith('/voluntarios/me'))
    await page.getByRole('button', { name: 'Salvar alterações' }).click()
    const payloadPerfil = (await perfilRequest).postDataJSON()
    expect(payloadPerfil.causa_ids).toEqual([causa.id])
    expect(payloadPerfil).not.toHaveProperty('causas')
    await expect(page.getByText('Perfil atualizado com sucesso.')).toBeVisible()
    const perfil = await request.get(`${api}/api/v1/voluntarios/me`, { headers: { Authorization: `Bearer ${sessao.access_token}` } })
    expect((await perfil.json()).causa_ids).toEqual([causa.id])

    const ong = await abrir(await login('ong@example.com'))
    await ong.goto('/vagas')
    await ong.getByRole('button', { name: 'Publicar vaga', exact: true }).click()
    const dialogo = ong.getByRole('dialog')
    const titulo = `Atividade do catálogo ${randomUUID()}`
    for (const [label, valor] of [
      ['Título da vaga', titulo], ['Descrição', 'Atividade fictícia de teste do catálogo.'],
      ['Atividades do voluntário', 'Apoiar o cuidado com os animais.'],
      ['Local ou atividade remota', 'Brasília, DF'], ['Carga horária (horas)', '3'], ['Número de vagas', '2'],
      ['Data de início do encontro 1', '2099-11-16'], ['Hora de início do encontro 1', '09:00'],
      ['Data de término do encontro 1', '2099-11-16'], ['Hora de término do encontro 1', '12:00'],
    ]) await dialogo.getByLabel(label, { exact: true }).fill(valor)
    await dialogo.getByRole('combobox', { name: 'Causa', exact: true }).selectOption(String(causa.id))
    const publicacaoRequest = ong.waitForRequest(r => r.method() === 'POST' && r.url().endsWith('/vagas'))
    await dialogo.getByRole('button', { name: 'Publicar vaga', exact: true }).click()
    const payloadVaga = (await publicacaoRequest).postDataJSON()
    expect(payloadVaga.causa_id).toBe(causa.id)
    expect(payloadVaga).not.toHaveProperty('causa')
    await expect(ong.getByRole('heading', { name: titulo, exact: true })).toBeVisible()

    await page.goto('/')
    await page.getByRole('region', { name: 'Explore por causa.' }).getByRole('link', { name: new RegExp(causa.nome) }).click()
    await expect(page).toHaveURL(new RegExp(`causa_id=${causa.id}`))
    const filtros = page.getByRole('complementary', { name: 'Filtros' })
    await expect(filtros.getByRole('button', { name: causa.nome, exact: true })).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByRole('heading', { name: titulo, exact: true })).toBeVisible()
    await page.goto('/voluntario/perfil')
    await expect(page.getByRole('checkbox', { name: causa.nome, exact: true })).toBeChecked()
    await page.screenshot({ path: test.info().outputPath('catalogo-compartilhado-perfil.png'), fullPage: true })
  } finally {
    for (const context of contexts) await context.close()
    const response = await request.delete(`${api}/api/v1/admin/usuarios/${voluntarioId}`, { headers })
    expect(response.status()).toBe(204)
  }
})
