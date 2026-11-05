/**
 * Comunicação com a API (pasta /server).
 * Em desenvolvimento, o Vite repassa tudo que começa com /api para http://localhost:3001.
 */
const TOKEN_KEY = 'senai-connect-token'

export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message) }
}

export function getToken() {
  try { return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY) } catch { return null }
}
export function setToken(token: string | null, remember = true) {
  try {
    localStorage.removeItem(TOKEN_KEY); sessionStorage.removeItem(TOKEN_KEY)
    if (token) (remember ? localStorage : sessionStorage).setItem(TOKEN_KEY, token)
  } catch { /* armazenamento indisponível */ }
}

export async function api<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  const token = getToken()
  let res: Response
  try {
    res = await fetch(`/api${path}`, {
      method: options.method || 'GET',
      headers: {
        ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    })
  } catch {
    throw new ApiError('Não foi possível falar com o servidor. A API (pasta server) está rodando?', 0)
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError(data.error || `Erro ${res.status}`, res.status)
  return data as T
}
