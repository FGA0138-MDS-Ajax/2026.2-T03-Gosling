import axios from 'axios'
import {
  clearSession,
  readSession,
  SESSION_EXPIRED_EVENT,
} from './sessionStore'

const http = axios.create({ baseURL: '/api/v1', timeout: 10000 })

http.interceptors.request.use((config) => {
  if (!config.publicRequest) {
    const session = readSession()
    if (config.expectedAuthToken !== undefined && config.expectedAuthToken !== session?.access_token) {
      return Promise.reject(new axios.CanceledError('A sessão mudou antes do envio.'))
    }
    config.authToken = session?.access_token
    if (config.authToken) {
      config.headers.Authorization = `Bearer ${config.authToken}`
    }
  }
  return config
})

http.interceptors.response.use(
  (response) => response,
  (error) => {
    const request = error.config
    if (
      error.response?.status === 401 &&
      request &&
      !request.publicRequest &&
      request.authToken &&
      request.authToken === readSession()?.access_token
    ) {
      clearSession({ expired: true })
      window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT))
    }
    return Promise.reject(error)
  },
)

export default http
