const baseURL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')
const DEFAULT_TIMEOUT_MS = 15_000

export class ApiError extends Error {
  constructor(message: string, public status: number, public code?: string, public requestId?: string) {
    super(message)
    this.name = 'ApiError'
  }
}

export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(input, { ...init, signal: controller.signal })
  } catch (error) {
    if (controller.signal.aborted) {
      throw new ApiError('A solicitação demorou mais que o esperado. Verifique a conexão e tente novamente.', 408, 'TIMEOUT')
    }
    if (error instanceof TypeError) {
      throw new ApiError('Não foi possível conectar ao KPS Cardio. A alteração pode ser tentada novamente.', 0, 'NETWORK_ERROR')
    }
    throw error
  } finally {
    window.clearTimeout(timeoutId)
  }
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetchWithTimeout(`${baseURL}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      ...init.headers,
    },
  })
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    if (response.status === 401) window.dispatchEvent(new CustomEvent('kpscardio:session-expired'))
    throw new ApiError(body.error || `Falha na API (${response.status})`, response.status, body.code, response.headers.get('X-Request-ID') || body.requestId)
  }
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}
