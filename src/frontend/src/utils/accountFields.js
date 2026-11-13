export function phoneDigits(value = '') {
  const digits = String(value ?? '').replace(/\D/g, '')
  return /^55\d{10,11}$/.test(digits) ? digits.slice(2) : digits
}

export function formatPhone(value = '') {
  const digits = phoneDigits(value).slice(0, 11)
  if (!digits) return ''
  if (digits.length < 2) return `(${digits}`
  const ddd = `(${digits.slice(0, 2)})`
  const number = digits.slice(2)
  if (!number) return ddd
  const split = number.length > 8 ? 5 : 4
  return `${ddd} ${number.slice(0, split)}${number.length > split ? `-${number.slice(split)}` : ''}`
}

export const PHONE_HINT = 'DDD e número: (61) 3333-4444 ou (61) 99999-0000.'
export const PHONE_ERROR = 'Informe 10 ou 11 dígitos, incluindo o DDD.'
export const validPhone = (value) => /^[0-9]{10,11}$/.test(phoneDigits(value))

export const PASSWORD_RULES = [
  { id: 'length', label: 'Pelo menos 8 caracteres', check: (value) => [...value].length >= 8 },
  { id: 'uppercase', label: 'Uma letra maiúscula', check: (value) => /\p{Lu}/u.test(value) },
  { id: 'number', label: 'Um número', check: (value) => /[0-9]/.test(value) },
  { id: 'symbol', label: 'Um símbolo ou caractere especial', check: (value) => /[\p{P}\p{S}]/u.test(value) },
  { id: 'no-spaces', label: 'Sem espaços', check: (value) => value.length > 0 && !/\s/u.test(value) },
]

export const PASSWORD_ERROR = 'Use pelo menos 8 caracteres, uma letra maiúscula, um número e um símbolo, sem espaços.'
export const validPassword = (value) => PASSWORD_RULES.every((rule) => rule.check(value))
