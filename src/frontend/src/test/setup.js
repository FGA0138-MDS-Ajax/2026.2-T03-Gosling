import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'

beforeEach(() => { sessionStorage.clear(); localStorage.clear() })
HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); this.querySelector('input,select,textarea,button')?.focus() }
HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
afterEach(() => {
  cleanup()
  sessionStorage.clear()
  vi.useRealTimers()
})
