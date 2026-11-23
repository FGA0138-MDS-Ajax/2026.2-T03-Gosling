import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import AuthProvider from '../contexts/AuthProvider'
import * as auth from '../services/authService'
import * as service from '../services/voluntarioService'
import { writeSession } from '../services/sessionStore'

vi.mock('../services/vagasService', () => ({ listarVagas: async () => ({ itens: [], total: 0, pagina: 1, por_pagina: 20 }) }))
vi.mock('../services/authService', () => ({ getSession: vi.fn(), getProfile: vi.fn() }))
vi.mock('../services/voluntarioService', () => ({ getVolunteerProfile: vi.fn(), updateVolunteerProfile: vi.fn(), uploadVolunteerPhoto: vi.fn(), removeVolunteerPhoto: vi.fn() }))
const usuario = { id: 3, nome: 'Maria da Silva', email: 'maria@example.com', perfil: 'VOLUNTARIO', tipo: null }
const perfil = { ...usuario, identificacao: '12345678901', telefone: '61999999999', cidade: 'Brasília', estado: 'DF', biografia: 'Gosto de ensinar.',
  localizacao: { cep: '70000123', logradouro: 'Rua residencial privada', numero: '7', cidade: 'Brasília', estado: 'DF', latitude: '-15.1234567', longitude: '-47.7654321', origem_coordenadas: 'MANUAL' },
  causas: ['Educação'], causa_ids: [1], causas_legadas: [], disponibilidades: ['DIA:SABADO', 'PERIODO:MANHA', 'CARGA_HORARIA:4'] }
beforeEach(() => {
  vi.resetAllMocks()
  writeSession('token-teste', Math.floor(Date.now()/1000)+3600)
  auth.getSession.mockResolvedValue({ usuario, expires_at: Math.floor(Date.now()/1000)+3600 })
  auth.getProfile.mockResolvedValue(usuario)
  service.getVolunteerProfile.mockResolvedValue(perfil)
  service.updateVolunteerProfile.mockImplementation(async ({nome_completo,...campos}) => ({ ...perfil, ...campos, nome: nome_completo }))
})
function open(path='/voluntario/perfil') {
  return render(<MemoryRouter initialEntries={[path]}><AuthProvider><App /></AuthProvider></MemoryRouter>)
}
const loaded = () => screen.findByRole('heading',{name:'Maria da Silva',exact:true})
const save = user => user.click(screen.getByRole('button',{name:'Salvar alterações'}))
async function editName(user, value='Maria Souza') {
  await user.click(screen.getByRole('button',{name:/^Editar Nome: Maria/}))
  fireEvent.change(screen.getByLabelText('Nome completo'),{target:{value}})
  await user.click(screen.getByRole('button',{name:'Confirmar'}))
}
describe('perfil do voluntário — RF06', () => {
  it('abre pela área, mascara CPF e converte disponibilidade legada para a grade',async()=>{
    const user=userEvent.setup(); open('/voluntario')
    await user.click(await screen.findByRole('link',{name:'Editar meu perfil'})); await loaded()
    expect(screen.getByText('•••.456.789-••')).toBeVisible()
    expect(screen.queryByText('12345678901')).not.toBeInTheDocument()
    expect(screen.getByRole('checkbox',{name:'Educação'})).toBeChecked()
    expect(screen.getByRole('checkbox',{name:'Sábado, Manhã'})).toBeChecked()
    expect(screen.getByRole('checkbox',{name:'Sábado, Tarde'})).not.toBeChecked()
    expect(screen.getByRole('slider',{name:/Carga horária semanal/})).toHaveValue('4')
  })
  it('salva nome, interesses e pares exatos, sem criar produtos de dias e turnos',async()=>{
    const user=userEvent.setup(); open(); await loaded(); await editName(user)
    await user.click(screen.getByRole('checkbox',{name:'Meio ambiente'}))
    await user.click(screen.getByRole('checkbox',{name:'Segunda, Noite'}))
    fireEvent.change(screen.getByRole('slider'),{target:{value:'6'}})
    await save(user)
    expect(await screen.findByText('Perfil atualizado com sucesso.')).toBeVisible()
    const payload=service.updateVolunteerProfile.mock.calls[0][0]
    expect(payload).toMatchObject({nome_completo:'Maria Souza',causa_ids:[1,3],causas_legadas:[],
      disponibilidade_semanal:[{dia:'SABADO',periodo:'MANHA'},{dia:'SEGUNDA',periodo:'NOITE'}],carga_horaria_semanal:6})
    for(const key of ['email','identificacao','id','senha','password','perfil']) expect(payload).not.toHaveProperty(key)
    expect(payload).not.toHaveProperty('causas')
    await user.click(screen.getByRole('link',{name:'Voltar para minha área'}))
    expect(await screen.findByText('Olá, Maria Souza.')).toBeVisible()
  })
  it('descarta alterações locais sem chamar a API',async()=>{
    const user=userEvent.setup(); open(); await loaded()
    await user.click(screen.getByRole('checkbox',{name:'Saúde'}))
    await user.click(screen.getByRole('button',{name:'Descartar'}))
    expect(screen.getByRole('checkbox',{name:'Saúde'})).not.toBeChecked()
    expect(service.updateVolunteerProfile).not.toHaveBeenCalled()
  })
  it('preserva interesses anteriores e não inclui dados legados no novo payload',async()=>{
    service.getVolunteerProfile.mockResolvedValue({...perfil,causas:['Educação','Uma causa anterior'],causas_legadas:['Uma causa anterior'],disponibilidades:['Fins de Semana']})
    const user=userEvent.setup(); open(); await loaded(); await editName(user); await save(user)
    await screen.findByText('Perfil atualizado com sucesso.')
    expect(service.updateVolunteerProfile.mock.calls[0][0].causas_legadas).toContain('Uma causa anterior')
    expect(service.updateVolunteerProfile.mock.calls[0][0]).not.toHaveProperty('disponibilidades')
  })
  it('diferencia preferências de compromissos do calendário',async()=>{
    open(); await loaded()
    expect(screen.getByText(/Estas preferências não são compromissos/)).toBeVisible()
  })
  it('valida nome antes de confirmar e salvar',async()=>{
    const user=userEvent.setup(); open(); await loaded()
    await user.click(screen.getByRole('button',{name:/^Editar Nome: Maria/}))
    fireEvent.change(screen.getByLabelText('Nome completo'),{target:{value:' '}})
    await user.click(screen.getByRole('button',{name:'Confirmar'}))
    expect(screen.getByText('Informe seu nome completo.')).toBeVisible()
    expect(service.updateVolunteerProfile).not.toHaveBeenCalled()
  })
  it('mantém as alterações após falha e bloqueia envios repetidos',async()=>{
    let reject; service.updateVolunteerProfile.mockReturnValue(new Promise((_,r)=>{reject=r}))
    const user=userEvent.setup(); open(); await loaded(); await editName(user)
    const form=screen.getByRole('form',{name:'Editar perfil de voluntário'})
    fireEvent.submit(form); fireEvent.submit(form)
    expect(service.updateVolunteerProfile).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button',{name:'Salvando…'})).toBeDisabled()
    reject(new Error('Sem conexão'))
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível salvar o perfil.')
    expect(screen.getByRole('button',{name:/^Editar Nome: Maria Souza/})).toBeVisible()
    expect(screen.getByRole('button',{name:'Salvar alterações'})).toBeEnabled()
  })
  it('mostra os erros 422 nos grupos e permite focá-los',async()=>{
    service.updateVolunteerProfile.mockRejectedValue({response:{status:422,data:{detail:[
      {loc:['body','causas',0],msg:'Causa inválida.'},
      {loc:['body','disponibilidade_semanal',0],msg:'Disponibilidade inválida.'},
    ]}}})
    const user=userEvent.setup(); open(); await loaded()
    await user.click(screen.getByRole('checkbox',{name:'Saúde'})); await save(user)
    expect(await screen.findByText('Causa inválida.')).toBeVisible()
    expect(screen.getByRole('group',{name:'Causas de interesse'})).toHaveAccessibleDescription('Causa inválida.')
    expect(screen.getByRole('group',{name:'Causas de interesse'})).toHaveFocus()
    expect(screen.getByText('Disponibilidade inválida.')).toBeVisible()
  })
  it('aponta os campos de dados pessoais recusados pela API',async()=>{
    service.updateVolunteerProfile.mockRejectedValue({response:{status:422,data:{detail:[{loc:['body','cidade'],msg:'Cidade inválida.'}]}}})
    const user=userEvent.setup(); open(); await loaded(); await editName(user); await save(user)
    expect(await screen.findByText('Cidade inválida.')).toBeVisible()
    expect(screen.getByLabelText('Cidade (opcional)')).toHaveAccessibleDescription('Cidade inválida.')
  })
  it('permite repetir o carregamento após erro',async()=>{
    service.getVolunteerProfile.mockRejectedValueOnce(new Error('Rede'))
    const user=userEvent.setup(); open()
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar o perfil.')
    await user.click(screen.getByRole('button',{name:'Tentar novamente'})); await loaded()
  })
  it('a prévia pública omite CPF, contatos e localização',async()=>{
    const user=userEvent.setup(); open(); await loaded()
    await user.click(screen.getByRole('button',{name:'Ver perfil público'}))
    const modal=within(screen.getByRole('dialog'))
    expect(modal.getByRole('heading',{name:'Maria da Silva'})).toBeVisible()
    expect(modal.queryByText(perfil.email)).not.toBeInTheDocument()
    expect(modal.queryByText('Brasília')).not.toBeInTheDocument()
    expect(modal.queryByText('Rua residencial privada')).not.toBeInTheDocument()
    expect(modal.queryByText('70000123')).not.toBeInTheDocument()
    expect(modal.queryByText('-15.1234567')).not.toBeInTheDocument()
  })
  it('salva endereço detalhado privado e limpa coordenadas ao corrigir o endereço',async()=>{
    const user=userEvent.setup(); open(); await loaded()
    await user.click(screen.getByRole('button',{name:/^Editar Onde mora:/}))
    expect(screen.getByLabelText('Logradouro')).toHaveValue('Rua residencial privada')
    fireEvent.change(screen.getByLabelText('Número ou S/N'),{target:{value:'88'}})
    await user.click(screen.getByRole('button',{name:'Confirmar'})); await save(user)
    expect(await screen.findByText('Perfil atualizado com sucesso.')).toBeVisible()
    expect(service.updateVolunteerProfile).toHaveBeenCalledWith(expect.objectContaining({
      localizacao: expect.objectContaining({numero:'88',cep:'70000123',latitude:null,longitude:null}),
    }))
  })
  it('envia a foto pelo serviço e mantém alterações ainda não salvas',async()=>{
    service.uploadVolunteerPhoto.mockResolvedValue({...perfil,foto_url:'/api/v1/midia/foto.webp'})
    const user=userEvent.setup(); open(); await loaded()
    await user.click(screen.getByRole('checkbox',{name:'Saúde'}))
    const file=new File(['imagem'],'avatar.png',{type:'image/png'})
    await user.upload(screen.getByLabelText('Arquivo da foto'),file)
    expect(service.uploadVolunteerPhoto).toHaveBeenCalledWith(file)
    await screen.findByText('Perfil atualizado com sucesso.')
    expect(screen.getByRole('checkbox',{name:'Saúde'})).toBeChecked()
  })
  it('impede acesso de organização ao perfil do voluntário',async()=>{
    const org={...usuario,perfil:'ORGANIZACAO',tipo:'ONG'}
    auth.getSession.mockResolvedValue({usuario:org,expires_at:Math.floor(Date.now()/1000)+3600})
    open()
    expect(await screen.findByRole('heading',{name:'Área de Organização'})).toBeVisible()
    expect(service.getVolunteerProfile).not.toHaveBeenCalled()
  })
})
