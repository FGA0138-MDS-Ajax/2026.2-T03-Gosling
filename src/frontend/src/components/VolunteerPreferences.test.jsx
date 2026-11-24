import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { expect, it, vi } from 'vitest'
import { Interests } from './VolunteerPreferences'

it('oferece somente o catálogo recebido e altera a seleção por ID', async () => {
  const change = vi.fn()
  render(<Interests value={[]} onChange={change} catalogo={{ itens: [{ id: 41, nome: 'Causa do servidor', ativo: true }], carregando: false, erro: '' }} />)
  expect(screen.queryByRole('checkbox', { name: 'Educação' })).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('checkbox', { name: 'Causa do servidor' }))
  expect(change).toHaveBeenCalledWith([41])
})

it('preserva interesses inativos e privados até a remoção explícita', async () => {
  function Form() {
    const [ids, setIds] = useState([41])
    const [legadas, setLegadas] = useState(['Interesse privado'])
    return <Interests value={ids} onChange={setIds} legadas={legadas} onLegacyChange={setLegadas}
      catalogo={{ itens: [{ id: 41, nome: 'Causa antiga', ativo: false }], carregando: false, erro: '' }} />
  }
  render(<Form />)
  const user = userEvent.setup()
  expect(screen.getByRole('checkbox', { name: 'Causa antiga (anterior)' })).toBeChecked()
  await user.click(screen.getByRole('checkbox', { name: 'Causa antiga (anterior)' }))
  expect(screen.queryByRole('checkbox', { name: 'Causa antiga (anterior)' })).not.toBeInTheDocument()
  expect(screen.getByRole('checkbox', { name: 'Interesse privado (anterior)' })).toBeChecked()
  await user.click(screen.getByRole('checkbox', { name: 'Interesse privado (anterior)' }))
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
})
