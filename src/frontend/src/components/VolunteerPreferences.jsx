import { DIAS, PERIODOS } from '../utils/volunteerProfile'
import { Icon } from './ui/Layout'
import s from './VolunteerPreferences.module.css'

const DESIGN_CAUSAS = ['Meio ambiente', 'Educação', 'Alimentação', 'Proteção animal', 'Pessoas idosas', 'Cultura', 'Saúde', 'Esporte']
// Mantém os valores já usados pela API e os interesses de contas antigas.
const labels = { 'Meio Ambiente': 'Meio ambiente', Animais: 'Proteção animal', Idosos: 'Pessoas idosas' }
const valueFor = label => Object.keys(labels).find(key => labels[key] === label) || label

export function Interests({ value, onChange, disabled = false, error }) {
  const catalogo = [...new Set([...DESIGN_CAUSAS.map(valueFor), ...value])]
  return <div className={s.chips} role="group" tabIndex={error ? -1 : undefined} aria-describedby={error ? 'causas-error' : undefined} aria-label="Causas de interesse">{catalogo.map(causa => {
    const selected = value.includes(causa)
    return <button type="button" role="checkbox" aria-checked={selected} disabled={disabled} key={causa}
      className={selected ? s.selected : ''} onClick={() => onChange(selected ? value.filter(v => v !== causa) : [...value, causa])}>
      {selected && <Icon name="imgIcon12" />}{labels[causa] || causa}</button>
  })}</div>
}

export function Availability({ value, onChange, hours, onHoursChange, disabled = false, error }) {
  function toggle(dia, periodo) {
    const selected = value.some(f => f.dia === dia && f.periodo === periodo)
    onChange(selected ? value.filter(f => f.dia !== dia || f.periodo !== periodo) : [...value, { dia, periodo }])
  }
  return <div className={s.availability}>
    <div className={s.matrix} role="group" tabIndex={error ? -1 : undefined} aria-describedby={error ? 'disponibilidade_semanal-error' : undefined} aria-label="Disponibilidade semanal por dia e turno">
      <span />{DIAS.map(dia => <span className={s.day} key={dia.value}>{dia.label.slice(0, 3)}</span>)}
      {PERIODOS.map(periodo => <div className={s.row} key={periodo.value}>
        <span className={s.period}>{periodo.label}</span>{DIAS.map(dia => {
          const selected = value.some(f => f.dia === dia.value && f.periodo === periodo.value)
          return <button key={dia.value} type="button" role="checkbox" disabled={disabled} aria-checked={selected}
            aria-label={`${dia.label}, ${periodo.label}`} className={selected ? s.active : ''} onClick={() => toggle(dia.value, periodo.value)}>
            {selected && <Icon name="imgIcon13" />}</button>
        })}</div>)}
    </div>
    <div className={s.hours}><label htmlFor="cargaHoraria">Carga horária semanal<small>Quanto tempo você pode doar</small></label>
      <input type="range" id="cargaHoraria" name="cargaHoraria" min="1" max="60" step="1" value={hours || 1}
        disabled={disabled} aria-valuetext={hours ? `Até ${hours} horas` : 'Não informada'} onChange={e => onHoursChange(Number(e.target.value))} />
      <output htmlFor="cargaHoraria">{hours ? `Até ${hours} h` : 'A definir'}</output>
      {hours && <button className={s.clear} type="button" disabled={disabled} onClick={() => onHoursChange(null)}>Limpar carga horária</button>}
    </div>
  </div>
}
