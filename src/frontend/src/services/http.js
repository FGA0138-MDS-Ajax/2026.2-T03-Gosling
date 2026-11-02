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
      request.authToken === readSession()?.access_token
    ) {
      clearSession()
      window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT))
    }
    return Promise.reject(error)
  },
)

export default http
