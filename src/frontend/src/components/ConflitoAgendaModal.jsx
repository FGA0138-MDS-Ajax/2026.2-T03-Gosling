import { Link } from 'react-router-dom'
import Modal from './ui/Modal'
import { horarioDoEncontro } from '../utils/ocorrencias'
import s from './CandidaturaModal.module.css'

const FUSO = 'America/Sao_Paulo'
const dataLonga = new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, weekday: 'long', day: '2-digit', month: 'long' })
const dataIso = new Intl.DateTimeFormat('en-CA', { timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit' })
const capitalizar = (texto) => texto.charAt(0).toUpperCase() + texto.slice(1)
const quando = ({ inicio, fim }) => `${capitalizar(dataLonga.format(new Date(inicio)))}, ${horarioDoEncontro({ inicio, fim })}`
const sobrepoe = (a, b) => Date.parse(a.inicio) < Date.parse(b.fim) && Date.parse(a.fim) > Date.parse(b.inicio)

// Conflito de horário na candidatura (RF27, issue #54): mostra o que conflita,
// leva ao calendário com os dados para corrigir e permite tentar de novo.
// Neste caminho nunca aparece confirmação, comprovante ou aviso de sucesso.
export default function ConflitoAgendaModal({ conflito, vaga, origem, onClose, onTentarNovamente }) {
  const conflitos = [...(conflito.conflitos ?? [])]
    .sort((a, b) => Date.parse(a.inicio) - Date.parse(b.inicio))
    .map(item => ({
      ...item,
      encontros: (vaga.ocorrencias ?? []).filter(encontro => sobrepoe(item, encontro)),
    }))
  const primeiro = conflitos[0]
  const inicioConflito = primeiro && Math.max(
    Date.parse(primeiro.inicio),
    Date.parse(primeiro.encontros[0]?.inicio ?? primeiro.inicio),
  )
  const estadoCalendario = {
    data: primeiro ? dataIso.format(inicioConflito) : undefined,
    conflito: { vagaId: vaga.id, titulo: vaga.titulo, conflitos: conflito.conflitos },
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
                <li key={`${item.vaga_id}-${item.inicio}-${item.fim}`}>
                  <strong>{item.titulo_vaga}</strong>
                  <span>{quando(item)}</span>
                  {item.encontros.map(encontro => (
                    <span key={encontro.inicio}>Coincide com o encontro desta vaga: {quando(encontro)}</span>
                  ))}
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
