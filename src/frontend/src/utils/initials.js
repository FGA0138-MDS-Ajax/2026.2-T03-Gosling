export function initials(nome = '') {
  return nome.trim().split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase() || 'V'
}
