import { useState } from 'react'
import PasswordChecklist from './PasswordChecklist'
import PhoneInput from './PhoneInput'
import { PASSWORD_ERROR, PHONE_ERROR, phoneDigits, validPassword, validPhone } from '../utils/accountFields'
import styles from '../pages/Admin.module.css'

const CAMPOS_ONG = [
  ['razao_social', 'Razão social', 200, 3],
  ['cnpj', 'CNPJ', 18, 1],
  ['area_atuacao', 'Área de atuação', 150, 3],
  ['endereco', 'Endereço', 500, 5],
  ['responsavel', 'Responsável', 150, 3],
  ['telefone', 'Telefone', 15, 10],
]

export default function AdminContaForm({ onSalvar, onCancelar, salvando, erro, formRef }) {
  const [perfil, setPerfil] = useState('VOLUNTARIO')
  const [senha, setSenha] = useState('')
  const [telefone, setTelefone] = useState('')
  const [erroCampo, setErroCampo] = useState({})

  function enviar(event) {
    event.preventDefault()
    const dados = new FormData(event.currentTarget)
    const invalidos = {}
    if (!validPassword(senha)) invalidos.senha = PASSWORD_ERROR
    if (perfil === 'ORGANIZACAO' && !validPhone(telefone)) invalidos.telefone = PHONE_ERROR
    setErroCampo(invalidos)
    const primeiro = Object.keys(invalidos)[0]
    if (primeiro) {
      event.currentTarget.elements.namedItem(primeiro)?.focus()
      return
    }
    const payload = {
      nome: String(dados.get('nome')).trim(),
      email: String(dados.get('email')).trim(),
      senha: String(dados.get('senha')),
      perfil,
      ativo: dados.get('ativo') === 'on',
    }
    if (perfil === 'ORGANIZACAO') {
      for (const [campo] of CAMPOS_ONG) payload[campo] = String(dados.get(campo)).trim()
      payload.telefone = phoneDigits(telefone)
      payload.descricao = String(dados.get('descricao')).trim()
      payload.homologada = dados.get('homologada') === 'on'
    }
    onSalvar(payload)
  }

  return (
    <form ref={formRef} aria-label="Criar cadastro" onSubmit={enviar} aria-busy={salvando}>
      <fieldset className={styles.formFields} disabled={salvando}>
        <div className={styles.formGrid}>
          <label className={styles.fullWidth} htmlFor="admin-perfil">
            Tipo de conta
            <select id="admin-perfil" value={perfil} onChange={(event) => setPerfil(event.target.value)}>
              <option value="VOLUNTARIO">Voluntário</option>
              <option value="ORGANIZACAO">ONG</option>
              <option value="ADMINISTRADOR">Administrador</option>
            </select>
          </label>
          <label className={styles.fullWidth} htmlFor="admin-nome">
            Nome
            <input id="admin-nome" name="nome" minLength={3} maxLength={150} required />
          </label>
          <label htmlFor="admin-email">
            E-mail
            <input id="admin-email" name="email" type="email" autoComplete="off" maxLength={254} required />
          </label>
          <div className={styles.passwordField}>
            <label htmlFor="admin-senha">Senha inicial</label>
            <input id="admin-senha" name="senha" type="password" autoComplete="new-password" minLength={8} maxLength={1024} required
              value={senha} onChange={(event) => {
                setSenha(event.target.value)
                setErroCampo((current) => ({ ...current, senha: '' }))
              }}
              aria-invalid={Boolean(erroCampo.senha)}
              aria-describedby={`admin-senha-requisitos${erroCampo.senha ? ' admin-senha-erro' : ''}`} />
            <PasswordChecklist id="admin-senha-requisitos" value={senha} />
            {erroCampo.senha && <span className={styles.error} id="admin-senha-erro">{erroCampo.senha}</span>}
          </div>
          <label className={styles.checkbox} htmlFor="admin-ativo">
            <input id="admin-ativo" name="ativo" type="checkbox" defaultChecked />
            Conta ativa
          </label>
        </div>
        {perfil === 'ORGANIZACAO' && (
          <section className={styles.ongFields} aria-labelledby="dados-ong">
            <h3 id="dados-ong">Dados da ONG</h3>
            <div className={styles.formGrid}>
              {CAMPOS_ONG.map(([campo, texto, maxLength, minLength]) => (
                <label key={campo} htmlFor={`admin-${campo}`}>
                  {texto}
                  {campo === 'telefone' ? <PhoneInput id="admin-telefone" name="telefone" required
                    value={telefone} onValueChange={(value) => {
                      setTelefone(value)
                      setErroCampo((current) => ({ ...current, telefone: '' }))
                    }}
                    aria-invalid={Boolean(erroCampo.telefone)}
                    aria-describedby={erroCampo.telefone ? 'admin-telefone-erro' : undefined} /> :
                  <input id={`admin-${campo}`} name={campo} maxLength={maxLength} minLength={minLength} required />}
                  {campo === 'telefone' && erroCampo.telefone && <span className={styles.error} id="admin-telefone-erro">{erroCampo.telefone}</span>}
                </label>
              ))}
              <label className={styles.fullWidth} htmlFor="admin-descricao">
                Descrição
                <textarea id="admin-descricao" name="descricao" rows={3} maxLength={5000} />
              </label>
              <label className={styles.checkbox} htmlFor="admin-homologada">
                <input id="admin-homologada" name="homologada" type="checkbox" defaultChecked />
                ONG liberada para publicar vagas
              </label>
            </div>
          </section>
        )}
        {erro && <p className={styles.error} role="alert">{erro}</p>}
        <div className={styles.dialogActions}>
          <button className={styles.secondaryButton} type="button" onClick={onCancelar}>Cancelar</button>
          <button className={styles.primaryButton} type="submit">
            {salvando ? 'Criando…' : 'Criar cadastro'}
          </button>
        </div>
      </fieldset>
    </form>
  )
}
