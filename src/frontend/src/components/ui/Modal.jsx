import { useEffect, useRef } from 'react'
import s from './Modal.module.css'

export default function Modal({ title, onClose, children }) {
  const dialog = useRef(null)
  const close = useRef(onClose)
  useEffect(() => { close.current = onClose }, [onClose])
  useEffect(() => {
    const el = dialog.current
    const previous = document.activeElement
    el.showModal()
    el.querySelector('input,select,textarea')?.focus()
    const cancel = e => { e.preventDefault(); close.current() }
    el.addEventListener('cancel', cancel)
    return () => { el.removeEventListener('cancel', cancel); el.close(); previous?.focus() }
  }, [])
  return <dialog ref={dialog} className={s.dialog} aria-labelledby="modal-title">
    <header><h2 id="modal-title">{title}</h2><button type="button" aria-label="Fechar" onClick={onClose}>×</button></header>{children}
  </dialog>
}
