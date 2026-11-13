import { PASSWORD_RULES } from '../utils/accountFields'
import styles from './PasswordChecklist.module.css'

export default function PasswordChecklist({ value = '', id }) {
  return <ul id={id} className={styles.list} aria-label="Requisitos da senha" aria-live="polite">
    {PASSWORD_RULES.map(({ id: ruleId, label, check }) => {
      const passed = check(value)
      return <li key={ruleId} className={passed ? styles.passed : styles.pending}>
        <span className={styles.icon} aria-hidden="true">{passed ? '✓' : '✕'}</span>
        <span className={styles.visuallyHidden}>{passed ? 'Atendido: ' : 'Pendente: '}</span>
        {label}
      </li>
    })}
  </ul>
}
