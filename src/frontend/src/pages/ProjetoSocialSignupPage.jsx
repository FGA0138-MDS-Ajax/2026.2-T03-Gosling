import { Link } from 'react-router-dom'
import styles from './Auth.module.css'

export default function ProjetoSocialSignupPage() {
  return (
    <main className={styles.status}>
      <span className={styles.brand}>VolunJá</span>
      <h1>Cadastro de projeto social</h1>
      <p>O cadastro de projetos sociais ainda não está disponível.</p>
      <p>Se você já tem uma conta, entre para acessar seu perfil.</p>
      <Link className={styles.primaryLink} to="/login/projeto-social">
        Entrar na minha conta
      </Link>
    </main>
  )
}
