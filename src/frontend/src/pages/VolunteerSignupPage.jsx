import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import styles from './OrganizationSignup.module.css'

const estados = {
  AC: 'Acre',
  AL: 'Alagoas',
  AP: 'Amapá',
  AM: 'Amazonas',
  BA: 'Bahia',
  CE: 'Ceará',
  DF: 'Distrito Federal',
  ES: 'Espírito Santo',
  GO: 'Goiás',
  MA: 'Maranhão',
  MT: 'Mato Grosso',
  MS: 'Mato Grosso do Sul',
  MG: 'Minas Gerais',
  PA: 'Pará',
  PB: 'Paraíba',
  PR: 'Paraná',
  PE: 'Pernambuco',
  PI: 'Piauí',
  RJ: 'Rio de Janeiro',
  RN: 'Rio Grande do Norte',
  RS: 'Rio Grande do Sul',
  RO: 'Rondônia',
  RR: 'Roraima',
  SC: 'Santa Catarina',
  SP: 'São Paulo',
  SE: 'Sergipe',
  TO: 'Tocantins',
}

const campos = [
  ['nome_completo', 'Nome completo', { autoComplete: 'name', minLength: 3, maxLength: 150 }],
  ['email', 'E-mail', { type: 'email', autoComplete: 'email', maxLength: 254 }],
  ['identificacao', 'CPF', { minLength: 11, maxLength: 14, inputMode: 'numeric' }],
  ['cidade', 'Cidade', { autoComplete: 'address-level2', minLength: 2, maxLength: 100 }],
  ['estado', 'UF', { autoComplete: 'address-level1' }],
  ['telefone', 'Telefone com DDD', { type: 'tel', autoComplete: 'tel', maxLength: 20 }],
  ['password', 'Senha', { type: 'password', autoComplete: 'new-password', minLength: 8, maxLength: 1024 }],
]

export default function VolunteerSignupPage() {
  const { cadastrarVoluntario } = useAuth()
  const navigate = useNavigate()
  const envio = useRef(false)
  const [pendente, setPendente] = useState(false)
  const [erro, setErro] = useState('')

  async function cadastrar(event) {
    event.preventDefault()
    if (envio.current) return
    const dados = Object.fromEntries(new FormData(event.currentTarget))
    dados.consentimento_termos = dados.consentimento_termos === 'on'
    dados.telefone = dados.telefone.replace(/[()+\s-]/g, '')
    if (!/^[0-9]{10,15}$/.test(dados.telefone)) {
      setErro('Informe um telefone com DDD de 10 a 15 dígitos.')
      return
    }
    envio.current = true
    setPendente(true)
    setErro('')
    try {
      await cadastrarVoluntario(dados)
      navigate('/voluntario', { replace: true })
    } catch (falha) {
      const detalhe = falha.response?.data?.detail
      if (Array.isArray(detalhe)) {
        const campo = campos.find(([nome]) => nome === detalhe[0]?.loc?.at(-1))
        setErro(campo ? `Confira o campo ${campo[1]}.` : 'Confira os dados informados.')
      } else {
        setErro(typeof detalhe === 'string' ? detalhe : 'Não foi possível concluir o cadastro.')
      }
    } finally {
      envio.current = false
      setPendente(false)
    }
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}><Link to="/">VolunJá</Link><Link to="/login">Entrar na minha conta</Link></header>
      <section className={styles.card}>
        <h1>Cadastro de voluntário</h1>
        <form onSubmit={cadastrar} aria-busy={pendente}>
          <fieldset disabled={pendente}>
            <legend>Dados da conta</legend>
            <div className={styles.grid}>
              {campos.map(([nome, rotulo, props]) => (
                <div className={styles.field} key={nome}>
                  <label htmlFor={nome}>{rotulo}</label>
                  {nome === 'estado' ? (
                    <select id={nome} name={nome} defaultValue="" required {...props}>
                      <option value="" disabled>Selecione a UF</option>
                      {Object.entries(estados).map(([sigla, estado]) => (
                        <option key={sigla} value={sigla}>{estado} ({sigla})</option>
                      ))}
                    </select>
                  ) : <input id={nome} name={nome} required {...props} />}
                </div>
              ))}
            </div>
            <label className={styles.consent}><input type="checkbox" name="consentimento_termos" required />Aceito o uso dos dados informados para criar minha conta no VolunJá.</label>
            {erro && <p className={styles.error} role="alert">{erro}</p>}
            <button type="submit" className={styles.submit}>{pendente ? 'Cadastrando…' : 'Criar conta'}</button>
          </fieldset>
        </form>
      </section>
    </main>
  )
}
