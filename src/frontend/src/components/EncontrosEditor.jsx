import { criarEncontro } from '../utils/ocorrencias'
import styles from '../pages/Vagas.module.css'

export default function EncontrosEditor({ encontros, onChange, erro }) {
  function atualizar(id, campo, valor) {
    onChange(encontros.map((item) => {
      if (item.id !== id) return item
      const atualizado = { ...item, [campo]: valor }
      if (campo === 'dataInicio' && (!item.dataFim || item.dataFim === item.dataInicio)) {
        atualizado.dataFim = valor
      }
      return atualizado
    }))
  }

  return (
    <fieldset className={styles.schedule}>
      <legend>Datas e horários dos encontros</legend>
      <p className={styles.scheduleHelp}>
        Selecione cada dia pelo calendário e informe início e fim.
        Todos os horários são de Brasília.
      </p>
      {encontros.map((item, indice) => (
        <div className={styles.meeting} key={item.id}>
          <div className={styles.meetingHeading}>
            <h3>Encontro {indice + 1}</h3>
            {encontros.length > 1 && (
              <button
                type="button"
                aria-label={`Remover encontro ${indice + 1}`}
                onClick={() => onChange(encontros.filter((atual) => atual.id !== item.id))}
              >
                Remover
              </button>
            )}
          </div>
          <div className={styles.meetingFields}>
            <label htmlFor={`data-inicio-${item.id}`}>
              Data de início
              <input
                id={`data-inicio-${item.id}`} type="date" required
                aria-label={`Data de início do encontro ${indice + 1}`}
                value={item.dataInicio}
                onChange={(event) => atualizar(item.id, 'dataInicio', event.target.value)}
              />
            </label>
            <label htmlFor={`hora-inicio-${item.id}`}>
              Hora de início
              <input
                id={`hora-inicio-${item.id}`} type="time" required
                aria-label={`Hora de início do encontro ${indice + 1}`}
                value={item.horaInicio}
                onChange={(event) => atualizar(item.id, 'horaInicio', event.target.value)}
              />
            </label>
            <label htmlFor={`data-fim-${item.id}`}>
              Data de término
              <input
                id={`data-fim-${item.id}`} type="date" required
                aria-label={`Data de término do encontro ${indice + 1}`}
                value={item.dataFim}
                onChange={(event) => atualizar(item.id, 'dataFim', event.target.value)}
              />
            </label>
            <label htmlFor={`hora-fim-${item.id}`}>
              Hora de término
              <input
                id={`hora-fim-${item.id}`} type="time" required
                aria-label={`Hora de término do encontro ${indice + 1}`}
                value={item.horaFim}
                onChange={(event) => atualizar(item.id, 'horaFim', event.target.value)}
              />
            </label>
          </div>
        </div>
      ))}
      {erro && <p className={styles.error} role="alert">{erro}</p>}
      <button
        className={styles.secondaryButton}
        type="button"
        disabled={encontros.length >= 100}
        onClick={() => onChange([...encontros, criarEncontro()])}
      >
        Adicionar encontro
      </button>
    </fieldset>
  )
}
