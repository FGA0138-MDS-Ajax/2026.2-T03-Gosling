import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import PhoneInput from './PhoneInput'

function Form({ initial = '' }) {
  const [value, setValue] = useState(initial)
  return <PhoneInput aria-label="Telefone" name="telefone" value={value} onValueChange={setValue} />
}

describe('campo de telefone', () => {
  it('aplica máscara durante a digitação e bloqueia mais de onze dígitos e letras', async () => {
    const user = userEvent.setup()
    render(<Form />)
    const input = screen.getByRole('textbox', { name: 'Telefone' })
    await user.type(input, '61abc99999000012345')
    expect(input).toHaveValue('(61) 99999-0000')
    expect(input).toHaveAttribute('maxlength', '15')
    await user.clear(input)
    await user.type(input, '6133334444')
    expect(input).toHaveValue('(61) 3333-4444')
  })

  it('formata números existentes e aceita colagem com código brasileiro', async () => {
    const user = userEvent.setup()
    render(<Form initial="61999990000" />)
    const input = screen.getByRole('textbox', { name: 'Telefone' })
    expect(input).toHaveValue('(61) 99999-0000')
    await user.clear(input)
    await user.click(input)
    await user.paste('+55 (11) 98888-7777')
    expect(input).toHaveValue('(11) 98888-7777')
    await user.clear(input)
    await user.paste('61999990000999999999')
    expect(input).toHaveValue('(61) 99999-0000')
  })

  it('permite apagar ao lado da pontuação e esvaziar o DDD sem prender o cursor', async () => {
    const user = userEvent.setup()
    render(<Form initial="6133334444" />)
    const input = screen.getByRole('textbox', { name: 'Telefone' })
    await user.click(input)
    input.setSelectionRange(10, 10)
    await user.keyboard('{Backspace}')
    expect(input).toHaveValue('(61) 3334-444')
    await user.clear(input)
    await user.type(input, '61')
    expect(input).toHaveValue('(61)')
    await user.keyboard('{Backspace}{Backspace}')
    expect(input).toHaveValue('')
  })

  it('mantém o cursor ao substituir dígitos no meio do telefone', async () => {
    const user = userEvent.setup()
    render(<Form initial="61999990000" />)
    const input = screen.getByRole('textbox', { name: 'Telefone' })
    await user.click(input)
    input.setSelectionRange(1, 3)
    await user.keyboard('11')
    expect(input).toHaveValue('(11) 99999-0000')
    expect(input.selectionStart).toBe(5)
  })
})
