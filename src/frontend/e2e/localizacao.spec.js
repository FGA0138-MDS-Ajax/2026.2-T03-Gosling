import { randomInt, randomUUID } from 'node:crypto'
import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

const api = process.env.E2E_API_URL ?? 'http://127.0.0.1:8000'

function cnpjFicticio() {
  const numeros = Array.from({ length: 12 }, () => randomInt(10))
  for (const pesos of [
    [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2],
    [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2],
  ]) {
    const resto = numeros.reduce((soma, numero, i) => soma + numero * pesos[i], 0) % 11
    numeros.push(resto < 2 ? 0 : 11 - resto)
  }
  return numeros.join('')
}

test('CEP com correção manual persiste e a vaga tem endereço diferente da sede e da residência privada', async ({
  browser,
  request,
}) => {
  const senha = process.env.DEMO_PASSWORD
  expect(senha).toBeTruthy()
  async function login(email, admin = false) {
    const response = await request.post(`${api}/api/v1/${admin ? 'admin' : 'auth'}/login`, {
      data: { email, senha },
    })
    expect(response.status()).toBe(200)
    return response.json()
  }
  const admin = await login('admin@example.com', true)
  const headers = { Authorization: `Bearer ${admin.access_token}` }
  const criados = []
  const contextos = []
  async function criar(dados) {
    const response = await request.post(`${api}/api/v1/admin/usuarios`, {
      headers,
      data: { senha, ...dados },
    })
    expect(response.status()).toBe(201)
    const conta = await response.json()
    criados.push(conta.id)
    return conta
  }
  async function abrir(conta, mobile = false) {
    const sessao = await login(conta.email)
    const context = await browser.newContext({
      viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 1000 },
    })
    contextos.push(context)
    await context.addInitScript(
      data =>
        sessionStorage.setItem(
          'volunja:session',
          JSON.stringify({ access_token: data.access_token, expires_at: data.expires_at }),
        ),
      sessao,
    )
    return {
      page: await context.newPage(),
      headers: { Authorization: `Bearer ${sessao.access_token}` },
    }
  }
  try {
    const ong = await criar({
      perfil: 'ORGANIZACAO',
      nome: 'ONG Localização Teste',
      email: `local-ong-${randomUUID()}@example.com`,
      razao_social: 'ONG Localização Teste',
      cnpj: cnpjFicticio(),
      area_atuacao: 'Educação',
      endereco: 'Sede da organização',
      responsavel: 'Responsável Teste',
      telefone: '61999990000',
    })
    const voluntario = await criar({
      perfil: 'VOLUNTARIO',
      nome: 'Voluntário Localização Teste',
      email: `local-vol-${randomUUID()}@example.com`,
    })
    const sede = await abrir(ong)
    await test.step('Cadastrar o endereço da sede por CEP', async () => {
      await sede.page.route('https://viacep.com.br/ws/**', route =>
        route.fulfill({
          json: {
            cep: '70000-001',
            logradouro: 'Rua da sede',
            bairro: 'Centro',
            localidade: 'Brasília',
            uf: 'DF',
          },
        }),
      )
      await sede.page.goto('/organizacao/perfil')
      await sede.page.getByLabel('CEP', { exact: true }).fill('70000001')
      await sede.page.getByRole('button', { name: 'Consultar CEP', exact: true }).click()
      await expect(sede.page.getByRole('status')).toHaveText(
        'CEP consultado. Confira e corrija os campos antes de salvar.',
      )
      await sede.page.getByLabel('Número ou S/N').fill('99')
      await sede.page.getByRole('button', { name: 'Salvar alterações' }).click()
      await expect(sede.page.getByText('Perfil atualizado com sucesso.')).toBeVisible()
      const perfilOng = await request.get(`${api}/api/v1/organizacoes/me`, {
        headers: sede.headers,
      })
      expect((await perfilOng.json()).localizacao).toMatchObject({
        cep: '70000001',
        numero: '99',
        latitude: null,
        longitude: null,
      })
    })

    const privado = await abrir(voluntario, true)
    await test.step('Preencher e salvar a residência manualmente no celular', async () => {
      await privado.page.route('https://viacep.com.br/ws/**', route =>
        route.fulfill({ json: { erro: true } }),
      )
      await privado.page.goto('/voluntario/perfil')
      await privado.page
        .getByRole('button', { name: 'Dados pessoais e contato', exact: true })
        .click()
      await privado.page.getByRole('button', { name: /^Editar Onde mora:/ }).click()
      const modal = privado.page.getByRole('dialog')
      await modal.getByLabel('CEP', { exact: true }).fill('70000002')
      await modal.getByRole('button', { name: 'Consultar CEP', exact: true }).click()
      await expect(modal.getByRole('alert')).toContainText('CEP não encontrado.')
      await modal.getByLabel('Logradouro', { exact: true }).fill('Rua residencial privada')
      await modal.getByLabel('Número ou S/N').fill('44')
      await modal.getByLabel('Cidade (opcional)', { exact: true }).fill('Brasília')
      await modal.getByLabel('Estado (opcional)', { exact: true }).selectOption('DF')
      await modal.getByText('Coordenadas para distância e mapa (opcional)', { exact: true }).click()
      await modal.getByLabel('Latitude', { exact: true }).fill('-15.1234567')
      await modal.getByLabel('Longitude', { exact: true }).fill('-47.7654321')
      expect(
        (
          await new AxeBuilder({ page: privado.page })
            .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
            .analyze()
        ).violations,
      ).toEqual([])
      expect(
        await privado.page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true)
      await privado.page.screenshot({
        path: test.info().outputPath('endereco-privado-mobile.png'),
        fullPage: true,
      })
      await modal.getByRole('button', { name: 'Confirmar', exact: true }).click()
      await privado.page.getByRole('button', { name: 'Salvar alterações' }).click()
      await expect(privado.page.getByText('Perfil atualizado com sucesso.')).toBeVisible()
    })

    await test.step('Conferir a persistência e a privacidade da prévia', async () => {
      await privado.page.reload()
      await privado.page.setViewportSize({ width: 1280, height: 1000 })
      await privado.page.getByRole('button', { name: 'Ver perfil público' }).click()
      const previa = privado.page.getByRole('dialog')
      await expect(previa.getByText('Rua residencial privada')).toHaveCount(0)
      await expect(previa.getByText('70000002')).toHaveCount(0)
      await expect(previa.getByText('-15.1234567')).toHaveCount(0)
      const perfilPrivado = await request.get(`${api}/api/v1/voluntarios/me`, {
        headers: privado.headers,
      })
      expect(perfilPrivado.headers()['cache-control']).toBe('no-store')
      expect((await perfilPrivado.json()).localizacao).toMatchObject({
        numero: '44',
        latitude: '-15.1234567',
        longitude: '-47.7654321',
      })
    })

    await test.step('Publicar uma atividade em endereço diferente da sede', async () => {
      await sede.page.goto('/vagas')
      await sede.page.getByRole('button', { name: 'Publicar vaga', exact: true }).click()
      const publicacao = sede.page.getByRole('dialog')
      const titulo = `Encontro com endereço próprio ${randomUUID()}`
      for (const [label, valor] of [
        ['Título da vaga', titulo],
        ['Descrição', 'Atividade fictícia em outro endereço.'],
        ['Atividades do voluntário', 'Apoiar a atividade no endereço do encontro.'],
        ['Local ou atividade remota', 'Centro comunitário do encontro'],
        ['Carga horária (horas)', '3'],
        ['Número de vagas', '2'],
        ['Data de início do encontro 1', '2099-11-16'],
        ['Hora de início do encontro 1', '09:00'],
        ['Data de término do encontro 1', '2099-11-16'],
        ['Hora de término do encontro 1', '12:00'],
        ['Logradouro', 'Rua do encontro'],
        ['Número ou S/N', '12'],
        ['Cidade', 'Brasília'],
      ])
        await publicacao.getByLabel(label, { exact: true }).fill(valor)
      await publicacao
        .getByRole('combobox', { name: 'Causa', exact: true })
        .selectOption({ label: 'Educação' })
      await publicacao.getByRole('combobox', { name: 'Estado', exact: true }).selectOption('DF')
      await publicacao
        .getByText('Coordenadas para distância e mapa (opcional)', { exact: true })
        .click()
      await publicacao.getByLabel('Latitude', { exact: true }).fill('-15.8')
      await publicacao.getByLabel('Longitude', { exact: true }).fill('-48.1')
      const respostaPublicacao = sede.page.waitForResponse(
        r => r.request().method() === 'POST' && r.url().endsWith('/vagas'),
      )
      await publicacao.getByRole('button', { name: 'Publicar vaga', exact: true }).click()
      const response = await respostaPublicacao
      expect(response.status()).toBe(201)
      const vaga = await response.json()
      expect(vaga.localizacao).toMatchObject({ numero: '12', logradouro: 'Rua do encontro' })
      expect(vaga.origem_localizacao).toBe('PROPRIA')
      const ongDepois = await request.get(`${api}/api/v1/organizacoes/me`, {
        headers: sede.headers,
      })
      expect((await ongDepois.json()).localizacao.numero).toBe('99')
      const publica = await request.get(`${api}/api/v1/vagas/${vaga.id}`)
      expect(await publica.text()).not.toContain('Rua residencial privada')
      await privado.page.goto(`/vagas/${vaga.id}`)
      await expect(privado.page.getByRole('link', { name: 'Como chegar' })).toHaveAttribute(
        'href',
        /query=-15\.8000000%2C-48\.1000000/,
      )
    })
  } finally {
    for (const context of contextos) await context.close().catch(() => {})
    for (const id of criados.reverse()) {
      const response = await request.delete(
        `${api}/api/v1/admin/usuarios/${id}?excluir_vagas=true`,
        { headers },
      )
      expect(response.status()).toBe(204)
    }
  }
})
