const baseURL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')

export class ApiError extends Error {
  constructor(message: string, public status: number, public code?: string) {
    super(message)
    this.name = 'ApiError'
  }
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${baseURL}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...init.headers,
    },
  })
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    if (response.status === 401) window.dispatchEvent(new CustomEvent('kardia:session-expired'))
    throw new ApiError(body.error || `Falha na API (${response.status})`, response.status, body.code)
  }
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}
