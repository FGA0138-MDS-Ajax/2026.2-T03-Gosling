import LoginPage from './LoginPage'

const CADASTROS_PROJETO_SOCIAL = [
  {
    pergunta: 'Ainda não cadastrou seu projeto?',
    texto: 'Cadastre seu projeto social',
    to: '/cadastro/projeto-social',
  },
  {
    pergunta: 'Não é responsável por um projeto social?',
    texto: 'Voltar ao login geral',
    to: '/login',
  },
]

export default function ProjetoSocialLoginPage() {
  return (
    <LoginPage
      titulo="Entrar como projeto social"
      subtitulo="Acesse a conta do responsável pelo projeto social."
      cadastros={CADASTROS_PROJETO_SOCIAL}
    />
  )
}
