import { Link } from 'react-router-dom'
import styles from './Auth.module.css'

export default function HomePage() {
  return (
    <main className={styles.home}>
      <span className={styles.brand}>VolunJá</span>
      <h1>Conectando pessoas e causas.</h1>
      <p>Encontre seu próximo encontro com o voluntariado.</p>
      <Link className={styles.primaryLink} to="/login">Entrar na minha conta</Link>
    </main>
  )
}
