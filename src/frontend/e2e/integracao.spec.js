import { randomInt, randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'
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

async function cargaSemanal(page, horas) {
  const slider = page.getByRole('slider', { name: /Carga horária semanal/ })
  await slider.focus()
  await slider.press('Home')
  for (let hora = 1; hora < horas; hora += 1) await slider.press('ArrowRight')
}

async function editarCampo(page, botao, campo, valor) {
  await page.getByRole('button', { name: botao }).click()
  const dialogo = page.getByRole('dialog')
  await dialogo.getByLabel(campo, { exact: true }).fill(valor)
  await dialogo.getByRole('button', { name: 'Confirmar', exact: true }).click()
}

test('cadastro de ONG mascara telefone e atualiza a checklist da senha ao digitar', async ({ page }) => {
  await page.goto('/cadastro/organizacao')
  const telefone = page.getByLabel('Telefone', { exact: true })
  await telefone.pressSequentially('6199999000012345')
  await expect(telefone).toHaveValue('(61) 99999-0000')
  await telefone.press('ControlOrMeta+A')
  await telefone.press('Backspace')
  await telefone.pressSequentially('6133334444')
  await expect(telefone).toHaveValue('(61) 3333-4444')
  const senha = page.getByLabel('Senha', { exact: true })
  const regras = page.getByRole('list', { name: 'Requisitos da senha' }).getByRole('listitem')
  await senha.fill('abcdefgh')
  await expect(regras.filter({ hasText: 'Pendente:' })).toHaveCount(3)
  await senha.pressSequentially('A1!')
  await expect(regras.filter({ hasText: 'Atendido:' })).toHaveCount(5)
  await senha.pressSequentially(' ')
  await expect(regras.filter({ hasText: 'Sem espaços' })).toContainText('Pendente:')
  await senha.press('Backspace')
  await expect(regras.filter({ hasText: 'Atendido:' })).toHaveCount(5)
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([])
})

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
  await captura(page, 'cadastro-voluntario-dados.png')
  await page.getByRole('button', { name: 'Continuar', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'O que move você?' })).toBeVisible()
  await page.getByRole('checkbox', { name: 'Educação', exact: true }).click()
  await captura(page, 'cadastro-voluntario-interesses.png')
  await page.getByRole('button', { name: 'Continuar', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Quando você pode ajudar?' })).toBeVisible()
  await page.getByRole('checkbox', { name: 'Segunda, Manhã', exact: true }).click()
  await page.getByRole('checkbox', { name: 'Sábado, Tarde', exact: true }).click()
  await cargaSemanal(page, 6)
  await captura(page, 'cadastro-voluntario-disponibilidade.png')
  const cadastro = page.waitForResponse((response) => response.url().endsWith('/api/v1/voluntarios') && response.request().method() === 'POST')
  await page.getByRole('button', { name: 'Criar conta de voluntário' }).click()
  const resposta = await cadastro
  expect(resposta.status()).toBe(201)
  const sessao = await resposta.json()
  ambiente.criados.push(sessao.usuario.id)
  await expect(page).toHaveURL(/\/voluntario$/)
  await expect(page.getByText('Localização: Brasília / DF')).toBeVisible()
  await page.getByRole('link', { name: 'Editar meu perfil' }).click()
  await expect(page.getByRole('heading', { name: 'Ana Teste de Integração', exact: true })).toBeVisible()
  await editarCampo(page, /^Editar Nome:/, 'Nome completo', 'Ana Silva Teste')
  await editarCampo(page, /^Editar Telefone:/, 'Telefone (opcional)', '(61) 98888-0000')
  await editarCampo(page, /^Editar Onde mora:/, 'Cidade (opcional)', 'Gama')
  await editarCampo(page, 'Adicionar biografia', 'Biografia (opcional)', 'Quero apoiar atividades de educação e cuidado com o meio ambiente.')
  await expect(page.getByRole('checkbox', { name: 'Educação', exact: true })).toBeChecked()
  await page.getByRole('checkbox', { name: 'Meio ambiente', exact: true }).click()
  await expect(page.getByRole('checkbox', { name: 'Segunda, Manhã', exact: true })).toBeChecked()
  await expect(page.getByRole('checkbox', { name: 'Sábado, Tarde', exact: true })).toBeChecked()
  await cargaSemanal(page, 4)
  await page.getByRole('button', { name: 'Salvar alterações' }).click()
  await expect(page.getByText('Perfil atualizado com sucesso.')).toBeVisible()
  await captura(page, 'perfil-voluntario-salvo.png')
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Ana Silva Teste', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Editar Onde mora: Gama, DF', exact: true })).toBeVisible()
  await expect(page.getByRole('checkbox', { name: 'Sábado, Tarde', exact: true })).toBeChecked()
  await expect(page.getByRole('checkbox', { name: 'Segunda, Tarde', exact: true })).not.toBeChecked()
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
  expect(perfil.disponibilidades).toEqual(['DIA:SEGUNDA', 'DIA:SABADO', 'PERIODO:MANHA', 'PERIODO:TARDE', 'CARGA_HORARIA:4'])
  const faixas = [{ dia: 'SEGUNDA', periodo: 'MANHA' }, { dia: 'SABADO', periodo: 'TARDE' }]
  expect(perfil.disponibilidade_semanal).toEqual(faixas)
  const legado = await request.put(`${api}/api/v1/voluntarios/me`, {
    headers, data: { biografia: 'Atualização pelo cliente antigo.', disponibilidades: perfil.disponibilidades },
  })
  expect(legado.status()).toBe(200)
  expect((await legado.json()).disponibilidade_semanal).toEqual(faixas)
  const invalida = await request.put(`${api}/api/v1/voluntarios/me`, {
    headers, data: { biografia: 'Não salvar.', disponibilidades: ['CARGA_HORARIA:999', 'DIA:FERIADO'] },
  })
  expect(invalida.status()).toBe(422)
  expect((await (await request.get(`${api}/api/v1/voluntarios/me`, { headers })).json()).biografia).toBe('Atualização pelo cliente antigo.')
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
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.getByRole('link', { name: 'Voltar para minha área' }).click()
  await expect(page.getByText('Olá, Ana Silva Teste.')).toBeVisible()
  await page.getByRole('button', { name: 'Sair' }).click()
  await expect(page).toHaveURL(/\/login$/)
  expect(await page.evaluate(() => sessionStorage.getItem('volunja:session'))).toBeNull()
})

test('contas persistentes em duas abas mantêm a identidade ao editar, restaurar e sair', async ({ page, context, request, ambiente }) => {
  const contas = []
  for (const nome of ['Conta Ana Teste', 'Conta Bruno Teste']) {
    const resposta = await request.post(`${api}/api/v1/voluntarios`, { data: {
      nome_completo: nome, email: `abas-${randomUUID()}@example.com`,
      identificacao: cpfFicticio(), password: ambiente.senha, consentimento_termos: true,
    } })
    expect(resposta.status()).toBe(201)
    const sessao = await resposta.json()
    contas.push(sessao)
    ambiente.criados.push(sessao.usuario.id)
  }
  // Este cenário exercita sessões. O limite do proxy tem seu próprio teste.
  await context.route('**/api/v1/auth/login', async route => {
    const resposta = await route.fetch({ url: `${api}/api/v1/auth/login` })
    await route.fulfill({ response: resposta })
  })
  async function entrar(aba, conta) {
    await aba.goto('/login')
    await aba.getByLabel('E-mail', { exact: true }).fill(conta.usuario.email)
    await aba.getByLabel('Senha', { exact: true }).fill(ambiente.senha)
    await aba.getByRole('checkbox', { name: 'Manter conectado' }).check()
    await aba.getByRole('button', { name: 'Entrar', exact: true }).click()
    await expect(aba.getByText(`Olá, ${conta.usuario.nome}.`, { exact: true })).toBeVisible()
  }

  await page.setViewportSize({ width: 1280, height: 900 })
  const temporaria = await context.newPage()
  await temporaria.goto('/login')
  await entrar(page, contas[0])
  const lembrada = await page.evaluate(() => localStorage.getItem('volunja:session'))
  await temporaria.getByLabel('E-mail', { exact: true }).fill(contas[1].usuario.email)
  await temporaria.getByLabel('Senha', { exact: true }).fill(ambiente.senha)
  await expect(temporaria.getByRole('checkbox', { name: 'Manter conectado' })).not.toBeChecked()
  await temporaria.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(temporaria.getByText('Olá, Conta Bruno Teste.', { exact: true })).toBeVisible()
  expect(await temporaria.evaluate(() => localStorage.getItem('volunja:session'))).toBe(lembrada)
  await temporaria.reload()
  await expect(temporaria.getByText('Olá, Conta Bruno Teste.', { exact: true })).toBeVisible()
  await temporaria.getByRole('button', { name: 'Sair', exact: true }).click()
  expect(await temporaria.evaluate(() => localStorage.getItem('volunja:session'))).toBe(lembrada)
  await temporaria.close()
  const outra = await context.newPage()
  await outra.setViewportSize({ width: 1280, height: 900 })
  await outra.goto('/voluntario')
  await expect(outra.getByText('Olá, Conta Ana Teste.', { exact: true })).toBeVisible()
  await outra.getByRole('button', { name: 'Sair', exact: true }).click()
  await entrar(outra, contas[1])

  await expect(page.getByRole('link', { name: 'Minha conta', exact: true })).toHaveText('CA')
  await page.getByRole('link', { name: 'Editar meu perfil', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Conta Ana Teste', exact: true })).toBeVisible()
  await editarCampo(page, /^Editar Nome:/, 'Nome completo', 'Ana Atualizada Teste')
  await page.getByRole('button', { name: 'Salvar alterações', exact: true }).click()
  await expect(page.getByText('Perfil atualizado com sucesso.')).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Ana Atualizada Teste', exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Minha conta', exact: true })).toHaveText('AA')
  const atualizada = await request.get(`${api}/api/v1/voluntarios/me`, {
    headers: { Authorization: `Bearer ${contas[0].access_token}` },
  })
  expect((await atualizada.json()).nome).toBe('Ana Atualizada Teste')
  const preservada = await request.get(`${api}/api/v1/voluntarios/me`, {
    headers: { Authorization: `Bearer ${contas[1].access_token}` },
  })
  expect((await preservada.json()).nome).toBe('Conta Bruno Teste')

  await page.getByRole('button', { name: 'Sair', exact: true }).click()
  await page.reload()
  await expect(page).toHaveURL(/\/login$/)
  await outra.reload()
  await expect(outra.getByText('Olá, Conta Bruno Teste.', { exact: true })).toBeVisible()
  await outra.getByRole('button', { name: 'Sair', exact: true }).click()
  expect(await outra.evaluate(() => localStorage.getItem('volunja:session'))).toBeNull()
  await outra.close()
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
  await page.getByLabel(/Causa/).selectOption({ label: 'Educação' })
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
  await expect(vaga).toContainText(local)
  await vaga.getByRole('link', { name: titulo, exact: true }).click()
  await expect(page.getByRole('heading', { name: titulo, exact: true })).toBeVisible()
  await expect(page.getByText('1,25 h por encontro', { exact: true })).toBeVisible()
  const encontros = page.getByRole('list', { name: 'Encontros da vaga' }).getByRole('listitem')
  await expect(encontros).toHaveCount(2)
  await expect(encontros.nth(0).locator('time')).toHaveAttribute('datetime', /2026-11-16T12:00:00/)
  await expect(encontros.nth(1).locator('time')).toHaveAttribute('datetime', /2026-11-17T12:00:00/)
  await expect(encontros.nth(0)).toContainText('09:00')
  await expect(encontros.nth(0)).toContainText('10:15')
  await expect(encontros.nth(1)).toContainText('10:15')
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

test('salva rascunho incompleto, protege edição em duas abas e publica o mesmo ID', async ({
  page,
  request,
  ambiente,
}) => {
  const cadastro = await request.post(`${api}/api/v1/admin/usuarios`, {
    headers: ambiente.headers,
    data: {
      perfil: 'ORGANIZACAO',
      nome: 'ONG Rascunhos Teste',
      email: `rascunhos-${randomUUID()}@example.com`,
      senha: ambiente.senha,
      razao_social: 'ONG Rascunhos Teste',
      cnpj: cnpjFicticio(),
      area_atuacao: 'Educação',
      endereco: 'Brasília, Distrito Federal',
      responsavel: 'Responsável Teste',
      telefone: '61999990000',
    },
  })
  expect(cadastro.status()).toBe(201)
  const conta = await cadastro.json()
  ambiente.criados.push(conta.id)

  const login = await request.post(`${api}/api/v1/auth/login`, {
    data: { email: conta.email, senha: ambiente.senha },
  })
  expect(login.status()).toBe(200)
  const { access_token, expires_at } = await login.json()
  await page.context().addInitScript(sessao => {
    sessionStorage.setItem('volunja:session', JSON.stringify(sessao))
  }, { access_token, expires_at })

  const titulo = `Rascunho de oficina ${randomUUID().slice(0, 8)}`
  const data = '2099-11-16'
  const modal = page.getByRole('dialog')

  const rascunho = await test.step('Salvar o formulário parcial com foto e encontro incompleto', async () => {
    await page.goto('/organizacao/vagas')
    await page.getByRole('link', { name: 'Publicar vaga', exact: true }).click()
    await modal.getByLabel('Título da vaga', { exact: true }).fill(titulo)
    await modal.getByLabel('Data de início do encontro 1', { exact: true }).fill(data)
    const foto = fileURLToPath(new URL('../public/design/home-hero.jpg', import.meta.url))
    await modal.getByLabel('Fotos da atividade', { exact: true }).setInputFiles(foto)
    await modal.getByRole('button', { name: 'Adicionar documento exigido' }).click()
    await modal.getByLabel('Link do modelo 1 (opcional)', { exact: true }).fill('https://example.com/modelo.pdf')

    const resposta = page.waitForResponse(response =>
      response.request().method() === 'POST' && response.url().endsWith('/vagas/rascunhos'),
    )
    await modal.getByRole('button', { name: 'Salvar rascunho', exact: true }).click()
    const resultado = await resposta
    expect(resultado.status()).toBe(201)
    const salvo = await resultado.json()
    expect(salvo.dados.fotos).toHaveLength(1)
    await expect(modal.getByRole('status')).toContainText('Rascunho salvo em')
    expect((await request.get(`${api}/api/v1/vagas/${salvo.id}`)).status()).toBe(404)
    return salvo
  })

  await test.step('Reabrir pelo painel e preservar a versão salva em outra aba', async () => {
    await page.goto('/organizacao/vagas')
    await page.getByRole('button', { name: 'Rascunhos', exact: true }).click()
    const linha = page.getByRole('row', { name: titulo })
    await expect(linha.locator('time')).toBeVisible()
    await captura(page, 'rascunhos-no-painel.png')
    await linha.getByRole('link', { name: 'Editar rascunho' }).click()
    await expect(modal.getByLabel('Data de início do encontro 1')).toHaveValue(data)
    await expect(modal.getByRole('img', { name: 'Foto salva 1' })).toBeVisible()
    await expect(modal.getByLabel('Link do modelo 1 (opcional)')).toHaveValue('https://example.com/modelo.pdf')

    const outra = await page.context().newPage()
    try {
      await outra.goto(page.url())
      const editor = outra.getByRole('dialog')
      await editor.getByLabel('Descrição', { exact: true }).fill('Descrição salva pela outra aba.')
      const alteracao = outra.waitForResponse(response =>
        response.request().method() === 'PATCH' && response.url().endsWith(`/rascunhos/${rascunho.id}`),
      )
      await editor.getByRole('button', { name: 'Salvar rascunho', exact: true }).click()
      expect((await alteracao).status()).toBe(200)

      await modal.getByLabel('Descrição', { exact: true }).fill('Alteração ainda aberta nesta aba.')
      await modal.getByRole('button', { name: 'Salvar rascunho', exact: true }).click()
      await expect(modal.getByRole('alert')).toContainText('alterado em outra aba')
      await expect(modal.getByLabel('Descrição', { exact: true })).toHaveValue('Alteração ainda aberta nesta aba.')
      await modal.getByRole('button', { name: 'Carregar versão salva' }).click()
      await expect(modal.getByLabel('Descrição', { exact: true })).toHaveValue('Descrição salva pela outra aba.')
    } finally {
      await outra.close()
    }
  })

  await test.step('Concluir as informações e tornar a mesma vaga pública', async () => {
    const campos = [
      ['Atividades do voluntário', 'Apoiar a oficina de leitura da comunidade.'],
      ['Local ou atividade remota', 'Biblioteca comunitária'],
      ['Carga horária (horas)', '3'],
      ['Número de vagas', '2'],
      ['Hora de início do encontro 1', '09:00'],
      ['Data de término do encontro 1', data],
      ['Hora de término do encontro 1', '12:00'],
      ['Nome do documento 1', 'Termo de participação'],
    ]
    for (const [rotulo, valor] of campos) {
      await modal.getByLabel(rotulo, { exact: true }).fill(valor)
    }
    await modal.getByLabel('Causa', { exact: true }).selectOption({ label: 'Educação' })

    const publicacao = page.waitForResponse(response =>
      response.request().method() === 'POST' && response.url().endsWith(`/rascunhos/${rascunho.id}/publicar`),
    )
    await modal.getByRole('button', { name: 'Publicar vaga', exact: true }).click()
    expect((await publicacao).status()).toBe(200)
    const publica = await request.get(`${api}/api/v1/vagas/${rascunho.id}`)
    expect(publica.status()).toBe(200)
    expect(await publica.json()).toMatchObject({
      id: rascunho.id,
      titulo,
      status: 'ABERTA',
      fotos: rascunho.dados.fotos,
      documentos_exigidos: [{ nome: 'Termo de participação' }],
    })
    await expect(modal).toHaveCount(0)
    await expect(page.getByRole('heading', { name: titulo, exact: true })).toBeVisible()
  })
})
