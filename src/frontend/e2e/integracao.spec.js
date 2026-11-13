import { randomInt, randomUUID } from 'node:crypto'
import AxeBuilder from '@axe-core/playwright'
import { expect, test as base } from '@playwright/test'

const api = process.env.E2E_API_URL ?? 'http://127.0.0.1:8000'

// Cada execução usa contas próprias e remove somente os registros que criou.
const test = base.extend({
  ambiente: async ({ request }, executar) => {
    const senha = process.env.DEMO_PASSWORD
    expect(senha, 'Defina DEMO_PASSWORD para a conta administrativa fictícia').toBeTruthy()
    const login = await request.post(`${api}/api/v1/admin/login`, {
      data: { email: 'admin@example.com', senha },
    })
    expect(login.status()).toBe(200)
    const { access_token } = await login.json()
    const headers = { Authorization: `Bearer ${access_token}` }
    const criados = []
    try {
      await executar({ senha, headers, criados })
    } finally {
      for (const id of criados.reverse()) {
        const resposta = await request.delete(`${api}/api/v1/admin/usuarios/${id}?excluir_vagas=true`, { headers })
        expect(resposta.status(), `Limpeza da conta de teste ${id}`).toBe(204)
      }
    }
  },
})

function cpfFicticio() {
  const numeros = Array.from({ length: 9 }, () => randomInt(10))
  for (const tamanho of [9, 10]) {
    const soma = numeros.reduce((total, numero, indice) => total + numero * (tamanho + 1 - indice), 0)
    numeros.push((soma * 10 % 11) % 10)
  }
  return numeros.join('')
}

function cnpjFicticio() {
  const numeros = Array.from({ length: 12 }, () => randomInt(10))
  for (const pesos of [[5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2], [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]]) {
    const resto = numeros.reduce((total, numero, indice) => total + numero * pesos[indice], 0) % 11
    numeros.push(resto < 2 ? 0 : 11 - resto)
  }
  return numeros.join('')
}

async function captura(page, nome) {
  const path = test.info().outputPath(nome)
  await page.screenshot({ path, fullPage: true })
  await test.info().attach(nome, { path, contentType: 'image/png' })
}

test('cadastro e perfil persistem no MySQL e isolam dois voluntários', async ({ page, request, ambiente }) => {
  const email = `voluntario-${randomUUID()}@example.com`
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/cadastro/voluntario')
  await page.getByLabel('Nome completo').fill('Ana Teste de Integração')
  await page.getByLabel('CPF', { exact: true }).fill(cpfFicticio())
  await page.getByLabel('E-mail', { exact: true }).fill(email)
  await page.getByLabel('Telefone', { exact: true }).fill('(61) 99999-0000')
  await page.getByLabel('Cidade', { exact: true }).fill('Brasília')
  await page.getByLabel('Estado', { exact: true }).selectOption('DF')
  await page.getByLabel('Senha', { exact: true }).fill(ambiente.senha)
  await page.getByRole('checkbox').check()
  await captura(page, 'cadastro-voluntario.png')
  const cadastro = page.waitForResponse((response) => response.url().endsWith('/api/v1/voluntarios') && response.request().method() === 'POST')
  await page.getByRole('button', { name: 'Criar conta de voluntário' }).click()
  const resposta = await cadastro
  expect(resposta.status()).toBe(201)
  const sessao = await resposta.json()
  ambiente.criados.push(sessao.usuario.id)
  await expect(page).toHaveURL(/\/voluntario$/)
  await expect(page.getByText('Localização: Brasília / DF')).toBeVisible()
  await page.getByRole('link', { name: 'Editar meu perfil' }).click()
  await expect(page.getByLabel('Nome completo')).toHaveValue('Ana Teste de Integração')
  await page.getByLabel('Nome completo').fill('Ana Silva Teste')
  await page.getByLabel('Telefone (opcional)').fill('(61) 98888-0000')
  await page.getByLabel('Cidade (opcional)').fill('Gama')
  await page.getByLabel('Sobre você (opcional)').fill('Quero apoiar atividades de educação e cuidado com o meio ambiente.')
  await page.getByRole('checkbox', { name: 'Educação', exact: true }).check()
  await page.getByRole('checkbox', { name: 'Meio Ambiente', exact: true }).check()
  await page.getByRole('checkbox', { name: 'Sábado', exact: true }).check()
  await page.getByRole('checkbox', { name: 'Manhã', exact: true }).check()
  await page.getByLabel(/Carga horária semanal/).fill('4')
  await page.getByRole('button', { name: 'Salvar alterações' }).click()
  await expect(page.getByText('Perfil atualizado com sucesso.')).toBeVisible()
  await captura(page, 'perfil-voluntario-salvo.png')
  await page.reload()
  await expect(page.getByLabel('Nome completo')).toHaveValue('Ana Silva Teste')
  await expect(page.getByLabel('Cidade (opcional)')).toHaveValue('Gama')
  await expect(page.getByRole('checkbox', { name: 'Sábado', exact: true })).toBeChecked()
  const acessibilidade = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
  expect(acessibilidade.violations).toEqual([])
  await page.setViewportSize({ width: 360, height: 900 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await captura(page, 'perfil-voluntario-celular.png')

  const outro = await request.post(`${api}/api/v1/voluntarios`, { data: {
    nome_completo: 'Outro Voluntário Teste', email: `outro-${randomUUID()}@example.com`,
    identificacao: cpfFicticio(), password: ambiente.senha, consentimento_termos: true,
  } })
  expect(outro.status()).toBe(201)
  const outraSessao = await outro.json()
  ambiente.criados.push(outraSessao.usuario.id)
  const headers = { Authorization: `Bearer ${sessao.access_token}` }
  const consulta = await request.get(`${api}/api/v1/voluntarios/me?id=${outraSessao.usuario.id}`, { headers })
  const perfil = await consulta.json()
  expect(perfil.id).toBe(sessao.usuario.id)
  expect(perfil.telefone).toBe('61988880000')
  expect(perfil.disponibilidades).toEqual(['DIA:SABADO', 'PERIODO:MANHA', 'CARGA_HORARIA:4'])
  expect(perfil).not.toHaveProperty('senha_hash')
  const atualizacao = await request.put(`${api}/api/v1/voluntarios/me?id=${outraSessao.usuario.id}`, {
    headers, data: { cidade: 'Gama' },
  })
  expect(atualizacao.status()).toBe(200)
  const outroPerfil = await request.get(`${api}/api/v1/voluntarios/me`, {
    headers: { Authorization: `Bearer ${outraSessao.access_token}` },
  })
  expect((await outroPerfil.json()).cidade).toBeNull()
  expect((await request.get(`${api}/api/v1/voluntarios/me`)).status()).toBe(401)
  expect((await request.put(`${api}/api/v1/voluntarios/me`, { headers: ambiente.headers, data: {} })).status()).toBe(403)
  await page.getByRole('link', { name: 'Voltar para minha área' }).click()
  await expect(page.getByText('Olá, Ana Silva Teste.')).toBeVisible()
  await page.getByRole('button', { name: 'Sair' }).click()
  await expect(page).toHaveURL(/\/login$/)
  expect(await page.evaluate(() => sessionStorage.getItem('volunja:session'))).toBeNull()
})

test('publicação mostra erros por campo e salva local longo, carga decimal e encontros', async ({ page, request, ambiente, browser }) => {
  const cadastro = await request.post(`${api}/api/v1/admin/usuarios`, { headers: ambiente.headers, data: {
    perfil: 'ORGANIZACAO', nome: 'ONG Integração Teste', email: `ong-${randomUUID()}@example.com`,
    senha: ambiente.senha, razao_social: 'ONG Integração Teste', cnpj: cnpjFicticio(),
    area_atuacao: 'Educação', endereco: 'Brasília, Distrito Federal', responsavel: 'Responsável Teste',
    telefone: '61999990000',
  } })
  expect(cadastro.status()).toBe(201)
  const conta = await cadastro.json()
  ambiente.criados.push(conta.id)
  const login = await request.post(`${api}/api/v1/auth/login`, { data: { email: conta.email, senha: ambiente.senha } })
  expect(login.status()).toBe(200)
  const sessao = await login.json()
  await page.goto('/login')
  // Sessão emitida pela API real; a página revalida o JWT em /auth/me.
  await page.evaluate(({ access_token, expires_at }) => {
    sessionStorage.setItem('volunja:session', JSON.stringify({ access_token, expires_at }))
  }, sessao)
  await page.setViewportSize({ width: 1280, height: 1050 })
  await page.goto('/vagas')
  await page.getByRole('button', { name: 'Publicar vaga', exact: true }).click()
  const modal = page.getByRole('dialog')
  await modal.getByRole('button', { name: 'Publicar vaga', exact: true }).click()
  await expect(page.getByLabel(/Título da vaga/)).toHaveAttribute('aria-invalid', 'true')
  await expect(page.getByLabel(/Título da vaga/)).toBeFocused()
  await expect(page.getByLabel(/Local ou atividade remota/)).toHaveAccessibleDescription('Use pelo menos 3 caracteres.')
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([])
  await captura(page, 'vagas-erros-por-campo.png')
  const titulo = `Oficina Teste ${randomUUID().slice(0, 8)}`
  await page.getByLabel(/Título da vaga/).fill(titulo)
  await page.getByLabel(/Descrição/).fill('Leitura compartilhada com a comunidade.')
  await page.getByLabel(/Atividades do voluntário/).fill('Organizar livros e apoiar as atividades de leitura.')
  await page.getByLabel(/Causa/).fill('Educação')
  const local = 'Centro comunitário, Brasília. '.repeat(10).trim()
  expect(local.length).toBeGreaterThan(200)
  await page.getByLabel(/Local ou atividade remota/).fill(local)
  await page.getByLabel(/Carga horária \(horas\)/).fill('1.25')
  await page.getByLabel(/Número de vagas/).fill('10')
  await page.getByLabel('Data de início do encontro 1').fill('2026-11-16')
  await page.getByLabel('Hora de início do encontro 1').fill('09:00')
  await page.getByLabel('Data de término do encontro 1').fill('2026-11-16')
  await page.getByLabel('Hora de término do encontro 1').fill('10:15')
  await page.getByRole('button', { name: 'Adicionar encontro' }).click()
  await page.getByLabel('Data de início do encontro 2').fill('2026-11-17')
  await page.getByLabel('Hora de início do encontro 2').fill('09:00')
  await page.getByLabel('Data de término do encontro 2').fill('2026-11-17')
  await page.getByLabel('Hora de término do encontro 2').fill('10:15')
  await page.getByLabel(/Carga horária \(horas\)/).scrollIntoViewIfNeeded()
  await captura(page, 'vagas-limites-e-encontros.png')
  await modal.getByRole('button', { name: 'Publicar vaga', exact: true }).click()
  await expect(page.getByRole('heading', { name: titulo })).toBeVisible()
  await page.reload()
  const vaga = page.getByRole('article').filter({ has: page.getByRole('heading', { name: titulo }) })
  await expect(vaga).toContainText('1.25 h')
  await expect(vaga).toContainText(local)
  await expect(vaga).toContainText('16/11/2026, das 09:00 às 10:15')
  await expect(vaga).toContainText('17/11/2026, das 09:00 às 10:15')
  await captura(page, 'vaga-publicada.png')
  const publico = await browser.newContext()
  try {
    const visitante = await publico.newPage()
    await visitante.goto(new URL('/vagas', page.url()).href)
    await expect(visitante.getByRole('heading', { name: titulo })).toBeVisible()
    await expect(visitante.getByRole('button', { name: 'Publicar vaga', exact: true })).toHaveCount(0)
  } finally {
    await publico.close()
  }
})
