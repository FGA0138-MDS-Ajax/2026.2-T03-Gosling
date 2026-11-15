import { useLayoutEffect, useRef } from 'react'
import { formatPhone } from '../utils/accountFields'

function caretAfterDigits(value, quantity) {
  if (!quantity) return value.startsWith('(') ? 1 : 0
  let count = 0
  let position = 0
  while (position < value.length && count < quantity) {
    if (/[0-9]/.test(value[position])) count += 1
    position += 1
  }
  while (position < value.length && !/[0-9]/.test(value[position])) position += 1
  return position
}

export default function PhoneInput({ value = '', onValueChange, ...props }) {
  const input = useRef(null)
  const caret = useRef(null)
  const formatted = formatPhone(value)

  useLayoutEffect(() => {
    if (caret.current === null || document.activeElement !== input.current) return
    const position = caretAfterDigits(formatted, caret.current)
    input.current.setSelectionRange(position, position)
    caret.current = null
  })

  function change(next, position) {
    caret.current = next.slice(0, position).replace(/\D/g, '').length
    onValueChange(formatPhone(next))
  }

  function eraseSeparator(event) {
    if (!['Backspace', 'Delete'].includes(event.key)) return
    const { selectionStart: start, selectionEnd: end } = event.currentTarget
    if (start !== end) return
    const backwards = event.key === 'Backspace'
    let position = backwards ? start - 1 : start
    if (position < 0 || position >= formatted.length || /[0-9]/.test(formatted[position])) return
    event.preventDefault()
    while (position >= 0 && position < formatted.length && !/[0-9]/.test(formatted[position])) {
      position += backwards ? -1 : 1
    }
    if (position < 0 || position >= formatted.length) return
    const next = formatted.slice(0, position) + formatted.slice(position + 1)
    change(next, backwards ? position : start)
  }

  return <input {...props} ref={input} type="tel" inputMode="numeric" autoComplete="tel" maxLength={15}
    value={formatted}
    onChange={(event) => change(event.target.value, event.target.selectionStart ?? event.target.value.length)}
    onKeyDown={eraseSeparator}
    onPaste={(event) => {
      event.preventDefault()
      const text = event.clipboardData.getData('text')
      const { selectionStart: start, selectionEnd: end } = event.currentTarget
      change(formatted.slice(0, start) + text + formatted.slice(end), start + text.length)
    }} />
}
