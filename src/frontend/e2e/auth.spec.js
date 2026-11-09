import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

test('login é acessível e responsivo nos três tamanhos', async ({ page }) => {
  for (const width of [1280, 768, 360]) {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/login')
    await expect(page.getByRole('heading', { name: 'Entre no VolunJá' })).toBeVisible()
    expect(await page.evaluate(() =>
      document.documentElement.scrollWidth <= window.innerWidth,
    )).toBe(true)
    const accessibility = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze()
    expect(accessibility.violations).toEqual([])
    await page.screenshot({ path: test.info().outputPath(`login-${width}.png`), fullPage: true })
  }
})

test('abre o acesso ao cadastro do voluntário pelo teclado no celular', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 900 })
  await page.goto('/login')
  const signup = page.getByRole('link', { name: 'Cadastre-se como voluntário' })
  await expect(signup).toHaveAttribute('href', '/cadastro/voluntario')
  await signup.focus()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/cadastro\/voluntario$/)
  await expect(page.getByRole('heading', { name: 'Cadastro de voluntário' })).toBeVisible()
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([])
  await page.getByRole('link', { name: 'Entrar na minha conta' }).click()
  await expect(page).toHaveURL(/\/login$/)
})

test('nega acesso sem login, trata erros e encaminha os três perfis', async ({ page }) => {
  const password = process.env.DEMO_PASSWORD
  expect(password, 'Defina DEMO_PASSWORD para as contas fictícias').toBeTruthy()

  await page.goto('/voluntario')
  await expect(page).toHaveURL(/\/login$/)
  await page.getByLabel('E-mail').fill('voluntario@example.com')
  await page.getByLabel('Senha', { exact: true }).fill('senha-incorreta')
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('E-mail ou senha inválidos')

  for (const [email, perfil, path] of [
    ['voluntario@example.com', 'Voluntário', '/voluntario'],
    ['ong@example.com', 'Organização', '/organizacao'],
    ['admin@example.com', 'Administrador', '/admin'],
  ]) {
    if (perfil === 'Administrador') await page.goto('/admin/login')
    await page.getByLabel('E-mail').fill(email)
    await page.getByLabel('Senha', { exact: true }).fill(password)
    await page.getByRole('button', { name: 'Entrar', exact: true }).click()
    await expect(page).toHaveURL(new RegExp(path + '$'))
    await expect(page.getByRole('heading', { name: 'Área de ' + perfil })).toBeVisible()
    if (perfil === 'Organização') {
      await expect(page.getByText('Tipo de organização: ONG')).toBeVisible()
    }
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Área de ' + perfil })).toBeVisible()

    if (perfil === 'Voluntário') {
      await page.evaluate(() => {
        const key = 'volunja:session'
        const session = JSON.parse(sessionStorage.getItem(key))
        session.access_token = 'token-invalido'
        sessionStorage.setItem(key, JSON.stringify(session))
      })
      await page.reload()
      await expect(page).toHaveURL(/\/login$/)
      await expect(page.getByRole('status')).toContainText('Sua sessão expirou')
    } else {
      await page.getByRole('button', { name: 'Sair' }).click()
      await expect(page).toHaveURL(perfil === 'Administrador' ? /\/admin\/login$/ : /\/login$/)
    }
    expect(await page.evaluate(() => sessionStorage.getItem('volunja:session'))).toBeNull()
  }
})

test('proxy limita tentativas e não limita a rota de saúde', async ({ request }) => {
  let limited = false
  for (let index = 0; index < 20; index += 1) {
    const response = await request.post('/api/v1/auth/login', {
      data: { email: 'ausente@example.com', senha: 'senha-invalida' },
      headers: { 'X-Forwarded-For': '192.0.2.' + (index + 1) },
    })
    if (response.status() === 429) {
      limited = true
      break
    }
    expect(response.status()).toBe(401)
  }
  expect(limited).toBe(true)
  expect((await request.get('/api/v1/health')).status()).toBe(200)
})
