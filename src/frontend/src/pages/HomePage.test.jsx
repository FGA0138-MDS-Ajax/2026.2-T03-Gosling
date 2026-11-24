import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'
import HomePage from './HomePage'
import { useAuth } from '../hooks/useAuth'
import * as service from '../services/vagasService'
import { VAGAS_TESTE } from '../test/fixtures/vagas'

vi.mock('../hooks/useAuth', () => ({ useAuth: vi.fn() }))
vi.mock('../services/vagasService', () => ({ listarVagas: vi.fn() }))

const futuro = [{ id: 9, inicio: '2099-11-21T11:00:00Z', fim: '2099-11-21T15:00:00Z' }]
const [educacao, social, ambiente] = VAGAS_TESTE
const comFoto = { ...educacao, fotos: ['/design/detalhe-imgContainer.png'], ocorrencias: futuro }
const remota = { ...social, modalidade: 'REMOTO', ocorrencias: futuro }
const presencial = { ...ambiente, ocorrencias: futuro }

function Destino() {
  const { pathname, search } = useLocation()
  return <h1>Destino {decodeURIComponent(pathname + search)}</h1>
}
function open() {
  return render(<MemoryRouter><Routes><Route path="/" element={<HomePage />} /><Route path="/vagas" element={<Destino />} /><Route path="/vagas/:id" element={<Destino />} /></Routes></MemoryRouter>)
}
beforeEach(() => {
  vi.resetAllMocks()
  useAuth.mockReturnValue({ usuario: null, loading: false })
  service.listarVagas.mockResolvedValue({ itens: [comFoto, remota, presencial], total: 3, pagina: 1, por_pagina: 100 })
})

it('calcula os números com os dados da API e mostra destaques e vagas presenciais', async () => {
  open()
  expect(await screen.findByRole('link', { name: '3 vagas abertas agora' })).toHaveAttribute('href', '/vagas')
  expect(service.listarVagas).toHaveBeenCalledWith(expect.objectContaining({ pagina: 1, porPagina: 100 }))
  const numeros = within(screen.getByLabelText('O VolunJá em números'))
  expect(numeros.getByText('encontros agendados').nextSibling).toHaveTextContent('3')
  expect(numeros.getByText('de atividades programadas').nextSibling).toHaveTextContent('12 h')
  const destaques = within(screen.getByRole('region', { name: 'Em destaque esta semana.' }))
  expect(destaques.getByRole('heading', { name: comFoto.titulo })).toBeVisible()
  expect(destaques.getByText('Sáb, 21 nov')).toBeVisible()
  const perto = within(screen.getByRole('region', { name: 'Perto de você.' }))
  expect(perto.queryByRole('heading', { name: remota.titulo })).not.toBeInTheDocument()
  expect(perto.getByRole('heading', { name: presencial.titulo })).toBeVisible()
  expect(screen.getByRole('link', { name: 'Ver todas as 3 vagas' })).toHaveAttribute('href', '/vagas')
})

it('leva aos filtros pela busca do topo e pelos atalhos de causa', async () => {
  const user = userEvent.setup(); open()
  await screen.findByRole('link', { name: '3 vagas abertas agora' })
  expect(await screen.findByRole('link', { name: /Educação\s*1 vaga aberta/ })).toHaveAttribute('href', '/vagas?causa_id=1')
  const busca = within(screen.getByRole('search', { name: 'Buscar vagas' }))
  await user.selectOptions(busca.getByLabelText('Causa'), '3')
  await user.selectOptions(busca.getByLabelText('Quando'), 'MANHA')
  await user.click(busca.getByRole('button', { name: 'Buscar' }))
  expect(screen.getByRole('heading', { name: 'Destino /vagas?causa_id=3&periodo=MANHA' })).toBeVisible()
})

it('leva ao detalhe pelo título do card', async () => {
  const user = userEvent.setup(); open()
  const perto = within(await screen.findByRole('region', { name: 'Perto de você.' }))
  await user.click(await perto.findByRole('link', { name: presencial.titulo }))
  expect(screen.getByRole('heading', { name: `Destino /vagas/${presencial.id}` })).toBeVisible()
})

it('não mostra números quando a listagem falha e permite repetir', async () => {
  service.listarVagas.mockRejectedValueOnce(new Error('Rede'))
  const user = userEvent.setup(); open()
  expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar as vagas.')
  expect(screen.queryByLabelText('O VolunJá em números')).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Tentar novamente' }))
  expect(await screen.findByRole('link', { name: '3 vagas abertas agora' })).toBeVisible()
})
