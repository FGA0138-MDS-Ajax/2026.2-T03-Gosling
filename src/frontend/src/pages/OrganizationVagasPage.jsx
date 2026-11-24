import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { listOrganizationVagas } from '../services/organizationService'
import { horarioSalvamento } from '../utils/rascunhoVaga'
import layout from './Vagas.module.css'
import styles from './OrganizationVagas.module.css'

const STATUS = {
  ABERTA: 'Aberta',
  ENCERRADA: 'Encerrada',
  SUSPENSA: 'Suspensa',
  RASCUNHO: 'Rascunho',
}

const dateFormatter = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo' })

function VagaResumo({ vaga }) {
  const status = vaga.status ?? vaga.estado_vaga
  const rascunho = status === 'RASCUNHO'
  const titulo = vaga.titulo?.trim() || 'Rascunho sem título'
  const local = vaga.local || [vaga.cidade, vaga.estado_uf].filter(Boolean).join(' / ')
  const data = rascunho ? vaga.atualizado_em : vaga.data_criacao
  const instante = data ? new Date(data) : null
  const dataFormatada =
    instante && !Number.isNaN(instante.getTime())
      ? (rascunho ? horarioSalvamento : dateFormatter).format(instante)
      : null

  return (
    <tr role="row" className={styles.vaga} aria-labelledby={`minha-vaga-${vaga.id}`}>
      <th role="rowheader" scope="row" className={styles.titulo}>
        {vaga.descricao && !rascunho ? (
          <details className={styles.detalhes}>
            <summary id={`minha-vaga-${vaga.id}`}>{titulo}</summary>
            <p className={styles.descricao}>{vaga.descricao}</p>
          </details>
        ) : <span id={`minha-vaga-${vaga.id}`}>{titulo}</span>}
        {local && <span className={styles.local}>{local}</span>}
      </th>
      <td role="cell" className={styles.situacao}>
        <span className={styles.status} data-status={status}>
          {STATUS[status] ?? status}
        </span>
      </td>
      <td role="cell" className={styles.data} data-ausente={!dataFormatada}>
        {dataFormatada && (
          <>
            <span className={styles.rotuloMobile}>{rascunho ? 'Salvo em ' : 'Criada em '}</span>
            <time dateTime={data}>{dataFormatada}</time>
          </>
        )}
        {!dataFormatada && 'Indisponível'}
      </td>
      <td role="cell" className={styles.candidaturas}>
        {rascunho ? (
          <Link className={styles.editar} to={`/vagas?rascunho=${vaga.id}`}>
            Editar rascunho
          </Link>
        ) : (
          <>
            <span className={styles.contagem} data-disponivel={vaga.total_candidaturas != null}>
              {vaga.total_candidaturas ?? 'Indisponível'}
            </span>
            <span className={styles.rotuloMobile}>
              {vaga.total_candidaturas === 1 ? 'candidatura' : 'candidaturas'}
            </span>
          </>
        )}
      </td>
    </tr>
  )
}

export default function OrganizationVagasPage() {
  const { usuario } = useAuth()
  return <PainelVagas key={usuario.id} podePublicar={usuario.tipo === 'ONG'} />
}

function PainelVagas({ podePublicar }) {
  const [estado, setEstado] = useState(null)
  const rascunhos = estado === 'RASCUNHO'
  const [pagina, setPagina] = useState(1)
  const [tentativa, setTentativa] = useState(0)
  const [resultado, setResultado] = useState(null)
  const carregando =
    resultado?.pagina !== pagina ||
    resultado?.tentativa !== tentativa ||
    resultado?.estado !== estado
  const erro = !carregando && resultado?.erro
  const dados = resultado?.dados

  useEffect(() => {
    const controller = new AbortController()
    listOrganizationVagas({ pagina, estado, signal: controller.signal })
      .then(dados => {
        if (controller.signal.aborted) return
        if (!Array.isArray(dados?.itens)) throw new Error('Resposta de listagem inválida')
        setResultado({ dados, pagina, tentativa, estado })
      })
      .catch(() => {
        if (!controller.signal.aborted) setResultado({ erro: true, pagina, tentativa, estado })
      })
    return () => controller.abort()
  }, [pagina, tentativa, estado])

  function selecionarEstado(proximo) {
    if (estado === proximo) return
    setEstado(proximo)
    setPagina(1)
  }

  return (
    <div className={styles.pagina}>
      <div className={styles.barra}>
        <header className={styles.cabecalho}>
          <Link className={layout.brand} to="/">
            VolunJá
          </Link>
          <nav aria-label="Navegação da organização">
            <Link to="/organizacao">Minha área</Link>
            <Link to="/organizacao/perfil">Perfil</Link>
          </nav>
        </header>
      </div>
      <main className={styles.painel}>
        <div className={styles.heading}>
          <h1 id="suas-vagas">Suas vagas</h1>
          {podePublicar && (
            <Link className={styles.publicar} to="/vagas" state={{ abrirPublicacao: true }}>
              Publicar vaga
            </Link>
          )}
        </div>
        <div className={styles.filtros} role="group" aria-label="Estado das vagas">
          <button type="button" aria-pressed={!rascunhos} onClick={() => selecionarEstado(null)}>
            Publicadas
          </button>
          <button
            type="button"
            aria-pressed={rascunhos}
            onClick={() => selecionarEstado('RASCUNHO')}
          >
            Rascunhos
          </button>
        </div>
        {carregando ? (
          <p className={styles.feedback} role="status">
            Carregando suas vagas…
          </p>
        ) : erro ? (
          <div className={styles.feedback}>
            <p className={layout.error} role="alert">
              Não foi possível carregar suas vagas.
            </p>
            <button
              className={layout.secondaryButton}
              type="button"
              onClick={() => setTentativa(atual => atual + 1)}
            >
              Tentar novamente
            </button>
          </div>
        ) : dados.itens.length === 0 ? (
          <p className={styles.feedback}>
            {pagina > 1
              ? 'Nenhuma vaga nesta página.'
              : rascunhos
                ? 'Sua organização ainda não tem rascunhos.'
                : 'Sua organização ainda não tem vagas.'}
          </p>
        ) : (
          <table className={styles.tabela} role="table" aria-labelledby="suas-vagas">
            <thead role="rowgroup">
              <tr role="row">
                <th role="columnheader" scope="col">
                  Vaga
                </th>
                <th role="columnheader" scope="col">
                  Situação
                </th>
                <th role="columnheader" scope="col">
                  {rascunhos ? 'Último salvamento' : 'Criada em'}
                </th>
                <th role="columnheader" scope="col">
                  {rascunhos ? 'Ações' : 'Candidaturas'}
                </th>
              </tr>
            </thead>
            <tbody role="rowgroup">
              {dados.itens.map(vaga => (
                <VagaResumo key={vaga.id} vaga={vaga} />
              ))}
            </tbody>
          </table>
        )}
        {(pagina > 1 || dados?.total_paginas > 1) && (
          <nav
            className={`${layout.pagination} ${styles.paginacao}`}
            aria-label="Páginas das minhas vagas"
          >
            <button
              type="button"
              disabled={carregando || pagina === 1}
              onClick={() => setPagina(pagina - 1)}
            >
              Anterior
            </button>
            <span aria-live="polite">
              Página {pagina}
              {!carregando && dados?.total_paginas >= pagina ? ` de ${dados.total_paginas}` : ''}
            </span>
            <button
              type="button"
              disabled={carregando || erro || !(pagina < dados?.total_paginas)}
              onClick={() => setPagina(pagina + 1)}
            >
              Próxima
            </button>
          </nav>
        )}
      </main>
    </div>
  )
}
