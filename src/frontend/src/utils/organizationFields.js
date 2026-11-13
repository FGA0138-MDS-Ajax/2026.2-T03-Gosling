import { PHONE_HINT } from './accountFields'

export const organizationFields = [
  { name: 'nome', label: 'Nome da organização', minLength: 3, maxLength: 150 },
  { name: 'razao_social', label: 'Razão social', minLength: 3, maxLength: 200 },
  { name: 'cnpj', label: 'CNPJ', maxLength: 18, hint: 'Informe os 14 caracteres, com ou sem pontuação.' },
  { name: 'area_atuacao', label: 'Área de atuação', minLength: 3, maxLength: 150 },
  { name: 'endereco', label: 'Endereço', minLength: 5, maxLength: 500 },
  { name: 'responsavel', label: 'Responsável', minLength: 3, maxLength: 150 },
  { name: 'email', label: 'E-mail', type: 'email', autoComplete: 'email', maxLength: 254 },
  { name: 'telefone', label: 'Telefone', type: 'tel', autoComplete: 'tel', maxLength: 15, hint: PHONE_HINT },
  { name: 'senha', label: 'Senha', type: 'password', autoComplete: 'new-password', minLength: 8, maxLength: 1024 },
]

export function validCnpj(value) {
  if (!/^[A-Z0-9]{12}[0-9]{2}$/.test(value) || /^(.)\1+$/.test(value)) return false
  let base = value.slice(0, 12)
  for (const weights of [[5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2], [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]]) {
    const sum = weights.reduce((total, weight, index) => total + (base.charCodeAt(index) - 48) * weight, 0)
    const remainder = sum % 11
    base += remainder < 2 ? '0' : String(11 - remainder)
  }
  return base === value
}
