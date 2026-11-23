import { Link } from 'react-router-dom'
import Modal from './ui/Modal'
import s from './CandidaturaModal.module.css'

// Tratamento de agenda para o conflito 409 da candidatura (issue #45).
// A exibição detalhada dos compromissos em conflito fica para a issue #54.
export default function ConflitoAgendaModal({ conflito, onClose }) {
  return (
    <Modal title="Conflito de horário" onClose={onClose}>
      <div className={s.corpo}>
        <p role="alert" className={s.sucesso}>{conflito.mensagem}</p>
        <p className={s.dica}>A candidatura não foi enviada. Confira sua agenda antes de tentar de novo.</p>
        <div className={s.acoes}>
          <Link className={s.principal} to="/voluntario/agenda">Abrir minha agenda</Link>
          <button type="button" className={s.secundario} onClick={onClose}>Voltar para a vaga</button>
        </div>
      </div>
    </Modal>
  )
}
