import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { BottomNav, Header } from '../components/ui/Layout'
import { consultarCalendario } from '../services/calendarioService'
import {
  CANDIDATURAS_ALTERADAS, DIAS_DA_SEMANA, STATUS_ATIVOS, agruparPorDia, ehDia, hojeEmBrasilia,
  inicioDoMes, nomeDoMes, rotuloDoDia, semanasDoMes, somarDias, somarMeses, tituloDoDia,
} from '../utils/calendario'
import { horarioDoEncontro } from '../utils/ocorrencias'
import s from './Agenda.module.css'

const STATUS = {
  PENDENTE: { rotulo: 'Pendente', detalhe: 'aguardando a organização' },
  ACEITA: { rotulo: 'Aceita', detalhe: 'participação confirmada' },
}

const atividades = (quantidade) => (quantidade === 1 ? '1 atividade' : `${quantidade} atividades`)
const chaveOcorrencia = ({ vaga_id, inicio, fim }) => `${vaga_id}/${Date.parse(inicio)}/${Date.parse(fim)}`

// Calendário e agenda diária do voluntário (RF26, issue #49).
export default function AgendaPage() {
  const { state } = useLocation()
  const hoje = hojeEmBrasilia()
  const diaInicial = ehDia(state?.data) ? state.data : hoje
  const conflito = state?.conflito
  const ocorrenciasEmConflito = new Set((conflito?.conflitos ?? []).map(chaveOcorrencia))

  const [mes, setMes] = useState(inicioDoMes(diaInicial))
  const [selecionado, setSelecionado] = useState(diaInicial)
  const [versao, setVersao] = useState(0)
  const [consulta, setConsulta] = useState({ chave: null, eventos: [], erro: false })

  const semanas = useMemo(() => semanasDoMes(mes), [mes])
  const inicio = semanas[0][0].dia
  const fim = somarDias(semanas.at(-1).at(-1).dia, 1)
  const chave = `${inicio}/${fim}`

  useEffect(() => {
    const controle = new AbortController()
    consultarCalendario({ inicio, fim }, controle.signal)
      .then((lista) => {
        if (controle.signal.aborted) return
        const ativos = (Array.isArray(lista) ? lista : []).filter((evento) => STATUS_ATIVOS.includes(evento.status))
        setConsulta({ chave: `${inicio}/${fim}`, eventos: ativos, erro: false })
      })
      .catch(() => {
        if (!controle.signal.aborted) setConsulta((atual) => ({ ...atual, chave: `${inicio}/${fim}`, erro: true }))
      })
    return () => controle.abort()
  }, [inicio, fim, versao])

  useEffect(() => {
    const recarregar = () => setVersao((valor) => valor + 1)
    const aoVoltar = () => { if (document.visibilityState === 'visible') recarregar() }
    window.addEventListener(CANDIDATURAS_ALTERADAS, recarregar)
    document.addEventListener('visibilitychange', aoVoltar)
    return () => {
      window.removeEventListener(CANDIDATURAS_ALTERADAS, recarregar)
      document.removeEventListener('visibilitychange', aoVoltar)
    }
  }, [])

  const atual = consulta.chave === chave
  const carregando = !atual
  const erro = atual && consulta.erro
  const porDia = useMemo(() => (atual && !consulta.erro ? agruparPorDia(consulta.eventos) : new Map()), [atual, consulta])
  const doDia = porDia.get(selecionado) ?? []
  const noMes = [...porDia.keys()].some((dia) => dia.startsWith(mes.slice(0, 7)))

  function irParaMes(novoMes, dia) {
    setMes(novoMes)
    setSelecionado(dia ?? novoMes)
  }

  function tentarNovamente() {
    setConsulta((anterior) => ({ ...anterior, chave: null }))
    setVersao((valor) => valor + 1)
  }

  return (
    <div className={s.page}>
      <Header />
      <main className={s.main}>
        <div className={s.topo}>
          <h1>Minha agenda</h1>
          <p className={s.dica}>Suas candidaturas pendentes e aceitas. Horários de Brasília.</p>
        </div>

        {conflito && (
          <section className={s.conflito} aria-labelledby="agenda-conflito">
            <h2 id="agenda-conflito">Conflito com {conflito.titulo}</h2>
            <p>Os compromissos que coincidem com essa vaga estão marcados como “Em conflito”.</p>
            {state?.voltarPara && <Link to={state.voltarPara}>Voltar para a vaga</Link>}
          </section>
        )}

        <div className={s.colunas}>
          <section className={s.calendario} aria-labelledby="agenda-mes">
            <div className={s.navegacao}>
              <h2 id="agenda-mes" aria-live="polite">{nomeDoMes(mes)}</h2>
              <div className={s.botoes}>
                <button type="button" onClick={() => irParaMes(somarMeses(mes, -1))} aria-label="Mês anterior">‹</button>
                <button type="button" onClick={() => irParaMes(inicioDoMes(hoje), hoje)}>Hoje</button>
                <button type="button" onClick={() => irParaMes(somarMeses(mes, 1))} aria-label="Próximo mês">›</button>
              </div>
            </div>
            <table className={s.grade}>
              <caption className={s.oculto}>Calendário de {nomeDoMes(mes)}</caption>
              <thead>
                <tr>{DIAS_DA_SEMANA.map(([curto, longo]) => <th key={curto} scope="col"><abbr title={longo}>{curto}</abbr></th>)}</tr>
              </thead>
              <tbody>
                {semanas.map((semana) => (
                  <tr key={semana[0].dia}>
                    {semana.map(({ dia, doMes }) => {
                      const quantidade = porDia.get(dia)?.length ?? 0
                      const classes = [s.dia, doMes ? '' : s.foraDoMes, dia === hoje ? s.hoje : '', dia === selecionado ? s.selecionado : ''].filter(Boolean).join(' ')
                      return (
                        <td key={dia}>
                          <button
                            type="button"
                            className={classes}
                            aria-pressed={dia === selecionado}
                            aria-label={`${rotuloDoDia(dia)}${quantidade ? `, ${atividades(quantidade)}` : ''}`}
                            onClick={() => (doMes ? setSelecionado(dia) : irParaMes(inicioDoMes(dia), dia))}
                          >
                            <span>{Number(dia.slice(8))}</span>
                            {quantidade > 0 && <span className={s.marca} aria-hidden="true">{quantidade}</span>}
                          </button>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className={s.diaPainel} aria-labelledby="agenda-dia">
            <h2 id="agenda-dia">{tituloDoDia(selecionado)}</h2>
            {carregando && <p role="status" className={s.dica}>Carregando sua agenda…</p>}
            {erro && (
              <div className={s.erro}>
                <p role="alert">Não foi possível carregar sua agenda.</p>
                <button type="button" onClick={tentarNovamente}>Tentar novamente</button>
              </div>
            )}
            {atual && !erro && doDia.length === 0 && (
              <div className={s.vazio}>
                <p>Nenhuma atividade neste dia.</p>
                {!noMes && <p className={s.dica}>Você não tem atividades em {nomeDoMes(mes).toLowerCase()}.</p>}
                <Link to="/vagas">Explorar vagas</Link>
              </div>
            )}
            {atual && !erro && doDia.length > 0 && (
              <ul className={s.eventos} aria-label="Atividades do dia">
                {doDia.map((evento) => {
                  const status = STATUS[evento.status]
                  return (
                    <li key={`${evento.candidatura_id}-${evento.inicio}`} className={s.evento}>
                      <p className={s.horario}>{horarioDoEncontro(evento)}</p>
                      <Link to={`/vagas/${evento.vaga_id}`} className={s.titulo}>{evento.titulo_vaga}</Link>
                      <p className={s.dica}>{evento.organizacao.nome}</p>
                      <p className={s.etiquetas}>
                        <span className={evento.status === 'ACEITA' ? s.aceita : s.pendente}>{status.rotulo}</span>
                        <span className={s.dica}>{status.detalhe}</span>
                        {ocorrenciasEmConflito.has(chaveOcorrencia(evento)) && <span className={s.emConflito}>Em conflito</span>}
                      </p>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
