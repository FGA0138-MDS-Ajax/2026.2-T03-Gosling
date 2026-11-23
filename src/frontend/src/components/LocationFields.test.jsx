import { useState } from 'react'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import LocationFields from './LocationFields'
import { localizacaoInicial } from '../utils/localizacao'
import { consultarCep } from '../services/cepService'

vi.mock('../services/cepService', () => ({ consultarCep: vi.fn() }))

function Form({ inicial = {}, onChange = () => {} }) {
  const [value, setValue] = useState(localizacaoInicial(inicial))
  return <LocationFields value={value} onChange={data => { setValue(data); onChange(data) }} allowBrowser />
}

describe('endereço detalhado', () => {
  it('consulta somente por ação explícita e mantém correção manual', async () => {
    const user = userEvent.setup()
    consultarCep.mockResolvedValue({ cep: '70000001', logradouro: 'Rua consultada', bairro: 'Centro', cidade: 'Brasília', estado: 'DF' })
    render(<Form />)
    await user.type(screen.getByLabelText('CEP'), '70000001')
    expect(consultarCep).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Consultar CEP' }))
    expect(await screen.findByText('CEP consultado. Confira e corrija os campos antes de salvar.')).toBeVisible()
    expect(screen.getByLabelText('Logradouro')).toHaveValue('Rua consultada')
    await user.clear(screen.getByLabelText('Logradouro'))
    await user.type(screen.getByLabelText('Logradouro'), 'Rua corrigida')
    expect(screen.getByLabelText('Logradouro')).toHaveValue('Rua corrigida')
  })
  it('não confirma falha e permite preencher sem o serviço', async () => {
    consultarCep.mockRejectedValue(new Error('CEP não encontrado. Preencha manualmente.'))
    const user = userEvent.setup()
    render(<Form inicial={{ cep: '99999999' }} />)
    await user.click(screen.getByRole('button', { name: 'Consultar CEP' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('CEP não encontrado.')
    expect(screen.queryByText(/CEP consultado/)).not.toBeInTheDocument()
    await user.type(screen.getByLabelText('Bairro'), 'Bairro manual')
    expect(screen.getByLabelText('Bairro')).toHaveValue('Bairro manual')
  })
  it('não sobrescreve correção manual com consulta atrasada e invalida ponto antigo', async () => {
    let resolver
    consultarCep.mockImplementation(() => new Promise(resolve => { resolver = resolve }))
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Form inicial={{ cep: '70000001', latitude: '-15.8', longitude: '-48.1' }} onChange={onChange} />)
    await user.click(screen.getByRole('button', { name: 'Consultar CEP' }))
    await user.type(screen.getByLabelText('Logradouro'), 'Correção manual')
    await act(async () => resolver({ logradouro: 'Resposta antiga' }))
    expect(screen.getByLabelText('Logradouro')).toHaveValue('Correção manual')
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ latitude: '', longitude: '' }))
  })
  it('geolocalização exige clique e recusa não impede edição', async () => {
    const getCurrentPosition = vi.fn((sucesso, erro) => erro({ code: 1 }))
    vi.stubGlobal('navigator', { ...navigator, geolocation: { getCurrentPosition } })
    const user = userEvent.setup()
    render(<Form />)
    expect(getCurrentPosition).not.toHaveBeenCalled()
    await user.click(screen.getByText('Coordenadas para distância e mapa (opcional)'))
    await user.click(screen.getByRole('button', { name: 'Usar minha localização (opcional)' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Preencha o endereço manualmente.')
    expect(screen.getByLabelText('CEP')).toBeEnabled()
    vi.unstubAllGlobals()
  })
})
