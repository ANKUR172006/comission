/* ---------- shared types (mirror of what the API returns) ---------- */

export type Role = 'admin' | 'partner'

/** client amounts can be in dollars or rupees */
export type Currency = 'USD' | 'INR'

/** a commission can be a single one time payment or a repeating daily one */
export type CommissionType = 'one_time' | 'daily'

export type SessionUser = {
  id: string
  name: string
  email: string
  role: Role
}

export type Partner = {
  id: string
  name: string
  email: string
  active: boolean
  currency: Currency
  /** everything ever given to this partner (his wallet) */
  total: number
  paid: number
  pending: number
}

export type Client = {
  id: string
  name: string
  currency: Currency
  /** money coming in from the client every day */
  dailyAmount: number
  /** dailyAmount x 7, calculated on the server */
  weeklyAmount: number
  /** what we pay the client each week */
  payToClientAmount: number
  payToClientDate: string | null
  startDate: string | null
  /** daily payments actually collected (ticked rows) */
  collected: number
  /** daily payments collected today */
  todayIn: number
  donePeriods: number
  totalPeriods: number
  /** everything shared to partners for this client */
  shared: number
  /** collected − shared */
  remaining: number
}

export type ChecklistPeriod = {
  date: string
  amount: number
  done: boolean
}

export type Checklist = {
  clientId: string
  clientName: string
  currency: Currency
  dailyAmount: number
  weeklyAmount: number
  collected: number
  periods: ChecklistPeriod[]
}

export type Commission = {
  id: string
  partnerId: string
  partnerName: string
  clientId: string
  clientName: string
  currency: Currency
  type: CommissionType
  /** per-day rate for daily, the amount for one time */
  rate: number
  /** days counted (days the payment came for daily, 1 for one time) */
  days: number
  /** rate × days — what is actually owed */
  amount: number
  date: string
  paid: boolean
}

export type WalletClient = {
  clientId: string
  clientName: string
  currency: Currency
  oneTime: number
  daily: number
  total: number
  paid: number
  pending: number
  entries: Commission[]
}

export type Wallet = {
  summary: {
    total: number
    paid: number
    pending: number
    currency: Currency
    clients: number
    entries: number
  }
  byClient: WalletClient[]
}

/* ---------- token storage ---------- */

const TOKEN_KEY = 'commission-token'

export const getToken = () => localStorage.getItem(TOKEN_KEY)
export const setToken = (token: string) => localStorage.setItem(TOKEN_KEY, token)
export const clearToken = () => localStorage.removeItem(TOKEN_KEY)

/* ---------- request helper ---------- */

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = getToken()
  const res = await fetch('/api' + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  const data = await res.json().catch(() => null)
  if (!res.ok) throw new Error(data?.error || 'Request failed')
  return data as T
}

/* ---------- endpoints ---------- */

export const api = {
  login: (email: string) =>
    request<{ token: string; user: SessionUser }>('POST', '/auth/login', { email }),

  me: () => request<{ user: SessionUser }>('GET', '/auth/me'),

  partners: {
    list: () => request<Partner[]>('GET', '/partners'),
    create: (body: { name: string; email: string }) => request<Partner>('POST', '/partners', body),
    update: (id: string, body: Partial<{ name: string; email: string; active: boolean }>) =>
      request<{ ok: true }>('PATCH', `/partners/${id}`, body),
    remove: (id: string) => request<{ ok: true }>('DELETE', `/partners/${id}`),
    wallet: (id: string) => request<Wallet>('GET', `/partners/${id}/wallet`),
  },

  clients: {
    list: () => request<Client[]>('GET', '/clients'),
    create: (body: {
      name: string
      currency: Currency
      dailyAmount: number
      payToClientAmount: number
      payToClientDate: string
      startDate: string
    }) => request<Client>('POST', '/clients', body),
    update: (
      id: string,
      body: Partial<{
        name: string
        currency: Currency
        dailyAmount: number
        payToClientAmount: number
        payToClientDate: string
        startDate: string
      }>,
    ) => request<{ ok: true }>('PATCH', `/clients/${id}`, body),
    remove: (id: string) => request<{ ok: true }>('DELETE', `/clients/${id}`),
    checklist: (id: string) => request<Checklist>('GET', `/clients/${id}/checklist`),
    toggleChecklist: (id: string, body: { date: string; amount?: number }) =>
      request<{ ok: true; date: string; done: boolean; amount: number }>(
        'POST',
        `/clients/${id}/checklist/toggle`,
        body,
      ),
  },

  commissions: {
    list: (query: { partnerId?: string; clientId?: string; type?: CommissionType } = {}) => {
      const params = new URLSearchParams()
      if (query.partnerId) params.set('partnerId', query.partnerId)
      if (query.clientId) params.set('clientId', query.clientId)
      if (query.type) params.set('type', query.type)
      const suffix = params.toString() ? `?${params}` : ''
      return request<Commission[]>('GET', `/commissions${suffix}`)
    },
    create: (body: {
      partnerId: string
      clientId: string
      type: CommissionType
      amount: number
      date: string
      paid?: boolean
    }) => request<Commission>('POST', '/commissions', body),
    update: (id: string, body: Partial<{ paid: boolean; amount: number; date: string }>) =>
      request<{ ok: true }>('PATCH', `/commissions/${id}`, body),
    remove: (id: string) => request<{ ok: true }>('DELETE', `/commissions/${id}`),
  },

  myWallet: () => request<Wallet>('GET', '/me/wallet'),
}

/* ---------- tiny display helpers ---------- */

const symbols: Record<Currency, string> = { USD: '$', INR: '₹' }

export function money(value: number, currency: Currency = 'USD'): string {
  return symbols[currency] + value.toFixed(2)
}

export function formatDate(value: string | null): string {
  if (!value) return '—'
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}
