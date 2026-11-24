import { Link } from 'react-router-dom'
import Modal from './ui/Modal'
import { horarioDoEncontro } from '../utils/ocorrencias'
import s from './CandidaturaModal.module.css'

const FUSO = 'America/Sao_Paulo'
const dataLonga = new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, weekday: 'long', day: '2-digit', month: 'long' })
const dataIso = new Intl.DateTimeFormat('en-CA', { timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit' })
const capitalizar = (texto) => texto.charAt(0).toUpperCase() + texto.slice(1)
const quando = ({ inicio, fim }) => `${capitalizar(dataLonga.format(new Date(inicio)))}, ${horarioDoEncontro({ inicio, fim })}`

// Conflito de horário na candidatura (RF27, issue #54): mostra o que conflita,
// leva ao calendário com os dados para corrigir e permite tentar de novo.
// Neste caminho nunca aparece confirmação, comprovante ou aviso de sucesso.
export default function ConflitoAgendaModal({ conflito, vaga, origem, onClose, onTentarNovamente }) {
  const conflitos = [...(conflito.conflitos ?? [])].sort((a, b) => new Date(a.inicio) - new Date(b.inicio))
  const primeiro = conflitos[0]
  const estadoCalendario = {
    data: primeiro ? dataIso.format(new Date(primeiro.inicio)) : undefined,
    conflito: { vagaId: vaga.id, titulo: vaga.titulo, conflitos },
    voltarPara: origem,
  }

  return (
    <Modal title="Conflito de horário" onClose={onClose}>
      <div className={s.corpo}>
        <p role="alert" className={s.sucesso}>{conflito.mensagem}</p>
        <p className={s.dica}>
          A candidatura para <strong>{vaga.titulo}</strong> não foi enviada.
        </p>
        {conflitos.length > 0 ? (
          <section aria-labelledby="conflito-compromissos">
            <h3 id="conflito-compromissos" className={s.titulo}>Compromissos no mesmo horário</h3>
            <ul className={s.encontros} aria-label="Compromissos em conflito">
              {conflitos.map((item) => (
                <li key={`${item.vaga_id}-${item.inicio}`}>
                  <strong>{item.titulo}</strong>
                  <span>{quando(item)}</span>
                  {item.ocorrencia && <span>Coincide com o encontro desta vaga: {quando(item.ocorrencia)}</span>}
                </li>
              ))}
            </ul>
            <p className={s.dica}>Horários de Brasília.</p>
          </section>
        ) : (
          <p className={s.dica}>Não recebemos os detalhes do compromisso. Confira os horários no seu calendário.</p>
        )}
        <div className={s.acoes}>
          <Link className={s.principal} to="/voluntario/agenda" state={estadoCalendario}>Ver meu calendário</Link>
          <button type="button" className={s.secundario} onClick={onTentarNovamente}>Revisar e tentar de novo</button>
          <button type="button" className={s.secundario} onClick={onClose}>Voltar para a vaga</button>
        </div>
      </div>
    </Modal>
  )
}
