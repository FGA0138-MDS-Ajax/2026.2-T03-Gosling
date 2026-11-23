import { useEffect, useId, useRef, useState } from 'react'
import { consultarCep } from '../services/cepService'
import { CAMPOS_ENDERECO } from '../utils/localizacao'
import { ESTADOS, NOMES_ESTADOS } from '../utils/volunteerProfile'
import s from './LocationFields.module.css'

export default function LocationFields({ value, onChange, errors = {}, disabled = false, hideRegion = false, allowBrowser = false, cityLabel = 'Cidade', stateLabel = 'Estado' }) {
  const id = useId()
  const controle = useRef(null)
  const revisao = useRef(0)
  const [consultando, setConsultando] = useState(false)
  const [aviso, setAviso] = useState(null)
  const conteudo = JSON.stringify(value || {})
  useEffect(() => () => { controle.current?.abort(); revisao.current++ }, [conteudo, disabled])

  function cancelar() { controle.current?.abort(); revisao.current++; setConsultando(false) }
  function mudar(campo, novo) {
    cancelar(); setAviso(null)
    const ponto = ['latitude', 'longitude'].includes(campo)
      ? { origem_coordenadas: 'MANUAL' } : { latitude: '', longitude: '', origem_coordenadas: '' }
    onChange({ ...value, ...ponto, [campo]: novo })
  }
  async function buscarCep() {
    cancelar()
    const atual = revisao.current
    const controller = new AbortController()
    controle.current = controller
    setConsultando(true); setAviso({ texto: 'Consultando CEP…' })
    try {
      const dados = await consultarCep(value?.cep, controller.signal)
      if (controller.signal.aborted || atual !== revisao.current) return
      onChange({ ...value, ...dados, latitude: '', longitude: '', origem_coordenadas: '' })
      setAviso({ texto: 'CEP consultado. Confira e corrija os campos antes de salvar.' })
    } catch (erro) {
      if (!controller.signal.aborted && atual === revisao.current) setAviso({ erro: true, texto: erro.message })
    } finally { if (controle.current === controller) setConsultando(false) }
  }
  function usarLocalizacao() {
    cancelar()
    const atual = revisao.current
    if (!navigator.geolocation) { setAviso({ erro: true, texto: 'Localização indisponível neste navegador. Você pode informar o endereço manualmente.' }); return }
    setAviso({ texto: 'Aguardando sua permissão para consultar a localização…' })
    navigator.geolocation.getCurrentPosition(posicao => {
      if (atual !== revisao.current) return
      onChange({ ...value, latitude: String(Number(posicao.coords.latitude.toFixed(7))),
        longitude: String(Number(posicao.coords.longitude.toFixed(7))), origem_coordenadas: 'NAVEGADOR' })
      setAviso({ texto: 'Coordenadas preenchidas. Confira se representam o local desejado antes de salvar.' })
    }, () => {
      if (atual === revisao.current) setAviso({ erro: true, texto: 'Não foi possível obter sua localização. Preencha o endereço manualmente.' })
    }, { timeout: 8000, maximumAge: 0, enableHighAccuracy: false })
  }
  function campo(nome, rotulo, props = {}) {
    const erro = errors[`localizacao.${nome}`] || (['cidade', 'estado'].includes(nome) ? errors[nome] : null)
    const attrs = { id: `${id}-${nome}`, name: `localizacao.${nome}`, value: value?.[nome] ?? '',
      onChange: event => mudar(nome, event.target.value), disabled,
      'aria-invalid': Boolean(erro), 'aria-describedby': erro ? `${id}-${nome}-erro` : undefined }
    return <div className={s.field} key={nome}><label htmlFor={attrs.id}>{rotulo}</label>
      {nome === 'estado' ? <select {...attrs}><option value="">Não informado</option>{ESTADOS.map(uf => <option key={uf} value={uf}>{NOMES_ESTADOS[uf]} ({uf})</option>)}</select>
        : <input {...attrs} maxLength={CAMPOS_ENDERECO[nome]} {...props} />}
      {erro && <span id={`${id}-${nome}-erro`} className={s.error}>{erro}</span>}</div>
  }
  return <fieldset className={s.root} disabled={disabled}>
    <legend>Endereço detalhado (opcional)</legend>
    <p className={s.hint}>Consulte o CEP ou preencha manualmente. A consulta de CEP não define coordenadas.</p>
    <div className={s.cep}>{campo('cep', 'CEP', { inputMode: 'numeric', autoComplete: 'postal-code', placeholder: '00000-000' })}
      <button type="button" disabled={disabled || consultando} onClick={buscarCep}>{consultando ? 'Consultando…' : 'Consultar CEP'}</button></div>
    {aviso && <p role={aviso.erro ? 'alert' : 'status'} className={aviso.erro ? s.error : s.hint}>{aviso.texto}</p>}
    <div className={s.grid}>
      {campo('logradouro', 'Logradouro', { autoComplete: 'address-line1' })}
      {campo('numero', 'Número ou S/N')}
      {campo('complemento', 'Complemento', { autoComplete: 'address-line2' })}
      {campo('bairro', 'Bairro')}
      {campo('regiao_administrativa', 'Região administrativa')}
      {!hideRegion && campo('cidade', cityLabel, { autoComplete: 'address-level2' })}
      {!hideRegion && campo('estado', stateLabel)}
    </div>
    <details className={s.coordinates} open={Boolean(errors['localizacao.latitude'] || errors['localizacao.longitude']) || undefined}><summary>Coordenadas para distância e mapa (opcional)</summary>
      <p className={s.hint}>Informe um ponto confirmado. Deixe em branco se não souber; o endereço pode ser salvo sem ele.</p>
      <div className={s.grid}>{campo('latitude', 'Latitude', { inputMode: 'decimal', maxLength: 12 })}{campo('longitude', 'Longitude', { inputMode: 'decimal', maxLength: 13 })}</div>
      {allowBrowser && <button type="button" onClick={usarLocalizacao}>Usar minha localização (opcional)</button>}
      <button type="button" onClick={() => { cancelar(); onChange({ ...value, latitude: '', longitude: '', origem_coordenadas: '' }); setAviso(null) }}>Remover coordenadas</button>
    </details>
    {errors.localizacao && <p role="alert" className={s.error}>{errors.localizacao}</p>}
  </fieldset>
}
