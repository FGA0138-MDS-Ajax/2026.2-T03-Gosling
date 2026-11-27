import { useEffect, useRef, useState } from 'react'
import { atualizarVaga, detalharVagaGestao } from '../services/vagasService'
import styles from '../pages/Vagas.module.css'
import Modal from './ui/Modal'
import VagaFormDialog from './VagaFormDialog'

export default function GerenciarVagaDialog({ vaga, encerrar, fechar, concluido }) {
  if (encerrar) return <EncerrarVaga vaga={vaga} fechar={fechar} concluido={concluido} />
  return <CarregarEdicao id={vaga.id} fechar={fechar} concluido={concluido} />
}

function CarregarEdicao({ id, fechar, concluido }) {
  const [tentativa, tentar] = useState(0)
  const [resposta, setResposta] = useState(null)
  useEffect(() => {
    const controller = new AbortController()
    detalharVagaGestao(id, controller.signal)
      .then(vaga => { if (!controller.signal.aborted) setResposta({ tentativa, vaga }) })
      .catch(failure => {
        if (!controller.signal.aborted) setResposta({ tentativa, failure })
      })
    return () => controller.abort()
  }, [id, tentativa])

  if (resposta?.tentativa === tentativa && resposta.vaga) {
    return <VagaFormDialog vaga={resposta.vaga} fechar={fechar} concluido={concluido} />
  }

  return (
    <Modal title="Editar vaga" onClose={fechar}>
      {resposta?.tentativa === tentativa ? (
        <>
          <p role="alert" className={styles.error}>Não foi possível carregar os dados da vaga.</p>
          <button type="button" onClick={() => tentar(atual => atual + 1)}>Tentar novamente</button>
        </>
      ) : <p role="status">Carregando os dados da vaga…</p>}
    </Modal>
  )
}

function EncerrarVaga({ vaga, fechar, concluido }) {
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const envio = useRef(false)
  function cancelar() {
    if (!envio.current) fechar()
  }

  async function confirmar(event) {
    event.preventDefault()
    if (envio.current) return
    envio.current = true
    setSalvando(true)
    setErro('')
    try {
      const resultado = await atualizarVaga(vaga.id, { estado_vaga: 'ENCERRADA' })
      if ((resultado?.status ?? resultado?.estado_vaga) !== 'ENCERRADA') {
        throw new Error('Encerramento não confirmado.')
      }
      concluido(resultado)
    } catch (failure) {
      const detalhe = failure.response?.data?.detail
      setErro(typeof detalhe === 'string' ? detalhe : 'Não foi possível encerrar a vaga. Tente novamente.')
    } finally {
      envio.current = false
      setSalvando(false)
    }
  }

  return (
    <Modal title="Encerrar vaga" onClose={cancelar}>
      <form onSubmit={confirmar} aria-busy={salvando}>
        <p>Deseja encerrar as inscrições para <strong>{vaga.titulo}</strong>?</p>
        {erro && <p role="alert" className={styles.error}>{erro}</p>}
        <div className={styles.formActions}>
          <button type="button" disabled={salvando} onClick={cancelar}>Cancelar</button>
          <button className={styles.primaryButton} type="submit" disabled={salvando}>
            {salvando ? 'Encerrando…' : 'Confirmar encerramento'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
