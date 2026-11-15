import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import OrganizationSignupPage from './OrganizationSignupPage'
import http from '../services/http'
import { readSession, writeSession } from '../services/sessionStore'

const values = {
  nome: 'ONG Exemplo', razao_social: 'Associação Exemplo', cnpj: '11.222.333/0001-81',
  area_atuacao: 'Educação', endereco: 'Rua das Flores, 100', responsavel: 'Pessoa Responsável',
  email: 'ONG@example.com', telefone: '(61) 99999-9999', senha: 'SenhaTeste123!',
}
let requests
beforeEach(() => {
  requests = []
  vi.spyOn(http, 'post').mockImplementation(async (...args) => {
    requests.push(args)
    return { data: { id: 1, homologada: true, perfil: 'ORGANIZACAO', tipo: 'ONG' } }
  })
})

function open() {
  render(<MemoryRouter><OrganizationSignupPage /></MemoryRouter>)
}
async function fill(user) {
  for (const [name, value] of Object.entries(values)) {
    fireEvent.change(document.getElementById(name), { target: { value } })
  }
  await user.click(screen.getByRole('checkbox'))
}

describe('cadastro da ONG — RF02', () => {
  it('valida obrigatoriedade, consentimento e foco sem enviar pedido', async () => {
    const user = userEvent.setup()
    open()
    await user.click(screen.getByRole('button', { name: 'Cadastrar organização' }))
    expect(screen.getByLabelText('Nome da organização')).toHaveFocus()
    expect(screen.getByText('Confirme o consentimento para continuar.')).toBeVisible()
    expect(http.post).not.toHaveBeenCalled()
  })

  it('mantém o foco enquanto o usuário corrige um campo após a validação', async () => {
    const user = userEvent.setup()
    open()
    await user.click(screen.getByRole('button', { name: 'Cadastrar organização' }))
    await user.type(screen.getByLabelText('Nome da organização'), 'Nome corrigido')
    expect(screen.getByLabelText('Nome da organização')).toHaveValue('Nome corrigido')
    expect(screen.getByLabelText('Nome da organização')).toHaveFocus()
  })

  it('envia contrato normalizado, usa pedido público e exibe aprovação automática', async () => {
    const user = userEvent.setup()
    open()
    await fill(user)
    await user.click(screen.getByRole('button', { name: 'Cadastrar organização' }))
    expect(await screen.findByRole('heading', { name: 'Cadastro concluído' })).toBeVisible()
    expect(screen.getByRole('status')).toHaveTextContent('aprovada automaticamente')
    expect(requests[0]).toEqual(['/organizacoes', {
      ...values, cnpj: '11222333000181', email: 'ong@example.com', telefone: '61999999999',
      descricao: '', consentimento_termos: true,
    }, { publicRequest: true }])
    expect(readSession()).toBeNull()
    expect(screen.getByRole('link', { name: 'Ir para o login' })).toHaveAttribute('href', '/login')
  })

  it.each([['cnpj', '11222333000180'], ['email', 'invalido'], ['telefone', '123'], ['senha', 'curta']])('rejeita %s inválido', async (name, value) => {
    const user = userEvent.setup()
    open()
    await fill(user)
    fireEvent.change(document.getElementById(name), { target: { value } })
    await user.click(screen.getByRole('button', { name: 'Cadastrar organização' }))
    expect(document.getElementById(name)).toHaveAttribute('aria-invalid', 'true')
    expect(document.getElementById(name)).toHaveFocus()
    expect(http.post).not.toHaveBeenCalled()
  })

  it('preserva CNPJ alfanumérico compatível com o backend', async () => {
    const user = userEvent.setup()
    open()
    await fill(user)
    fireEvent.change(document.getElementById('cnpj'), { target: { value: '12ABC34501DE35' } })
    await user.click(screen.getByRole('button', { name: 'Cadastrar organização' }))
    expect(await screen.findByRole('heading', { name: 'Cadastro concluído' })).toBeVisible()
    expect(requests[0][1].cnpj).toBe('12ABC34501DE35')
  })

  it('atualiza os requisitos da senha ao digitar e volta a indicar o requisito removido', async () => {
    const user = userEvent.setup()
    open()
    const checklist = screen.getByRole('list', { name: 'Requisitos da senha' })
    expect(within(checklist).getAllByRole('listitem').every((item) => item.textContent.includes('Pendente:'))).toBe(true)
    const senha = screen.getByLabelText('Senha', { exact: true })
    await user.type(senha, 'abcdefgh')
    expect(within(checklist).getByText('Pelo menos 8 caracteres')).toHaveTextContent('Atendido:')
    expect(within(checklist).getByText('Uma letra maiúscula')).toHaveTextContent('Pendente:')
    await user.type(senha, 'A1!')
    expect(within(checklist).getAllByRole('listitem').every((item) => item.textContent.includes('Atendido:'))).toBe(true)
    expect(senha).toHaveAccessibleDescription(/Pelo menos 8 caracteres/)
    await user.type(senha, ' ')
    expect(within(checklist).getByText('Sem espaços')).toHaveTextContent('Pendente:')
    await user.keyboard('{Backspace}{Backspace}')
    expect(within(checklist).getByText('Um símbolo ou caractere especial')).toHaveTextContent('Pendente:')
  })

  it.each(['abcdefgh1!', 'Abcdefgh!', 'Abcdefgh1', 'Abc1!def '])('bloqueia senha que não atende a todos os requisitos: %s', async (senha) => {
    const user = userEvent.setup()
    open()
    await fill(user)
    fireEvent.change(screen.getByLabelText('Senha', { exact: true }), { target: { value: senha } })
    await user.click(screen.getByRole('button', { name: 'Cadastrar organização' }))
    expect(screen.getByLabelText('Senha', { exact: true })).toHaveAttribute('aria-invalid', 'true')
    expect(http.post).not.toHaveBeenCalled()
  })

  it('envia apenas os dígitos depois de aplicar máscara e limitar a colagem', async () => {
    const user = userEvent.setup()
    open()
    await fill(user)
    const telefone = screen.getByLabelText('Telefone', { exact: true })
    await user.clear(telefone)
    await user.paste('6199999000099999')
    expect(telefone).toHaveValue('(61) 99999-0000')
    await user.click(screen.getByRole('button', { name: 'Cadastrar organização' }))
    expect(requests[0][1].telefone).toBe('61999990000')
  })

  it.each(['E-mail já cadastrado.', 'CNPJ já cadastrado.'])('apresenta conflito — %s', async (detail) => {
    http.post.mockRejectedValue({ response: { status: 409, data: { detail } } })
    const user = userEvent.setup()
    open()
    await fill(user)
    await user.click(screen.getByRole('button', { name: 'Cadastrar organização' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(detail)
    expect(screen.getByRole('button', { name: 'Cadastrar organização' })).toBeEnabled()
  })

  it('associa validação 422 ao campo e mantém dados para correção', async () => {
    http.post.mockRejectedValue({ response: { status: 422, data: { detail: [{ loc: ['body', 'cnpj'], msg: 'CNPJ inválido.' }] } } })
    const user = userEvent.setup()
    open()
    await fill(user)
    await user.click(screen.getByRole('button', { name: 'Cadastrar organização' }))
    expect(await screen.findByText('CNPJ inválido.')).toBeVisible()
    expect(screen.getByLabelText('CNPJ')).toHaveFocus()
    expect(screen.getByLabelText('Nome da organização')).toHaveValue(values.nome)
  })

  it('impede envio duplicado e diferencia homologação pendente', async () => {
    let finish
    http.post.mockReturnValue(new Promise((resolve) => { finish = resolve }))
    const user = userEvent.setup()
    open()
    await fill(user)
    await user.click(screen.getByRole('button', { name: 'Cadastrar organização' }))
    expect(screen.getByRole('button', { name: 'Cadastrando…' })).toBeDisabled()
    fireEvent.submit(screen.getByRole('form'))
    expect(http.post).toHaveBeenCalledTimes(1)
    await act(async () => finish({ data: { homologada: false } }))
    expect(screen.getByRole('status')).toHaveTextContent('aguarda homologação')
  })

  it('permite tentar novamente após falha de rede sem apagar a sessão existente', async () => {
    writeSession('sessao-existente', 2000000000)
    http.post.mockRejectedValueOnce(new Error('Offline'))
    const user = userEvent.setup()
    open()
    await fill(user)
    await user.click(screen.getByRole('button', { name: 'Cadastrar organização' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível concluir')
    expect(readSession().access_token).toBe('sessao-existente')
    await user.click(screen.getByRole('button', { name: 'Cadastrar organização' }))
    expect(await screen.findByRole('heading', { name: 'Cadastro concluído' })).toBeVisible()
  })
})
