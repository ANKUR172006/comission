import { useEffect, useState } from 'react'
import { api, money, type Currency, type SessionUser } from '../api'
import { Pill } from '../components/ui'
import AdminClients from './AdminClients'
import AdminPartners from './AdminPartners'
import AdminCommissions from './AdminCommissions'

type Tab = 'clients' | 'partners' | 'entries'

const tabs: { id: Tab; label: string }[] = [
  { id: 'clients', label: 'Clients' },
  { id: 'partners', label: 'Partners' },
  { id: 'entries', label: 'Commissions' },
]

export default function AdminApp({
  user,
  onLogout,
}: {
  user: SessionUser
  onLogout: () => void
}) {
  const [tab, setTab] = useState<Tab>('clients')
  const [totals, setTotals] = useState<{
    clients: number
    partners: number
    allocated: number
    currency: Currency | null
  }>({ clients: 0, partners: 0, allocated: 0, currency: null })

  useEffect(() => {
    Promise.all([api.clients.list(), api.partners.list()])
      .then(([clients, partners]) => {
        const currencies = new Set(partners.map((p) => p.currency))
        setTotals({
          clients: clients.length,
          partners: partners.filter((p) => p.active).length,
          allocated: partners.reduce((sum, p) => sum + p.total, 0),
          currency: currencies.size === 1 ? [...currencies][0] : null,
        })
      })
      .catch(() => undefined)
  }, [tab])

  return (
    <div className="min-h-full">
      <header className="border-b border-zinc-800 bg-zinc-950">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-100 text-sm font-semibold text-zinc-900">
              C
            </div>
            <div>
              <h1 className="text-base font-semibold text-zinc-100">Commission Admin</h1>
              <p className="text-xs text-zinc-500">
                {totals.clients} clients · {totals.partners} active partners ·{' '}
                {totals.currency
                  ? money(totals.allocated, totals.currency)
                  : totals.allocated.toFixed(2)}{' '}
                allocated
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Pill tone="blue">Admin</Pill>
            <span className="hidden text-xs text-zinc-500 sm:inline">{user.email}</span>
            <button
              onClick={onLogout}
              className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm font-medium text-zinc-200 hover:bg-zinc-800"
            >
              Sign out
            </button>
          </div>
        </div>

        <nav className="mx-auto max-w-7xl overflow-x-auto px-4 sm:px-6">
          <div className="flex gap-1 pb-2">
            {tabs.map((item) => (
              <button
                key={item.id}
                onClick={() => setTab(item.id)}
                className={`rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap ${
                  tab === item.id
                    ? 'bg-zinc-100 text-zinc-900'
                    : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </nav>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {tab === 'clients' ? <AdminClients /> : null}
        {tab === 'partners' ? <AdminPartners /> : null}
        {tab === 'entries' ? <AdminCommissions /> : null}
      </main>
    </div>
  )
}
