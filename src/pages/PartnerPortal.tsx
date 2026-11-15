import { useEffect, useState } from 'react'
import { api, formatDate, money, type SessionUser, type Wallet } from '../api'
import { Button, Pill, StatCard } from '../components/ui'

export default function PartnerPortal({
  user,
  onLogout,
}: {
  user: SessionUser
  onLogout: () => void
}) {
  const [data, setData] = useState<Wallet | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api
      .myWallet()
      .then(setData)
      .catch((err) => setError((err as Error).message))
  }, [])

  return (
    <div className="min-h-full">
      <header className="border-b border-zinc-800 bg-zinc-950">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div>
            <h1 className="text-base font-semibold text-zinc-100">{user.name}</h1>
            <p className="text-xs text-zinc-500">My wallet</p>
          </div>
          <div className="flex items-center gap-3">
            <Pill tone="blue">Partner</Pill>
            <Button onClick={onLogout}>Sign out</Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-5 px-4 py-6 sm:px-6">
        {error ? <p className="text-sm text-red-400">{error}</p> : null}

        {data ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Wallet total" value={money(data.summary.total, data.summary.currency)} />
              <StatCard label="Clients" value={data.summary.clients} />
              <StatCard
                label="Received (paid)"
                value={money(data.summary.paid, data.summary.currency)}
                tone="green"
              />
              <StatCard
                label="Still pending"
                value={money(data.summary.pending, data.summary.currency)}
                tone="orange"
              />
            </div>

            {data.byClient.length === 0 ? (
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-5 py-10 text-center text-sm text-zinc-500">
                No commission added for you yet.
              </div>
            ) : (
              data.byClient.map((group) => (
                <div
                  key={group.clientId}
                  className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/60"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 px-5 py-4">
                    <div>
                      <h2 className="text-sm font-semibold text-zinc-100">{group.clientName}</h2>
                      <p className="text-xs text-zinc-500">
                        One time {money(group.oneTime, group.currency)} · Daily{' '}
                        {money(group.daily, group.currency)}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-4 text-xs">
                      <span className="text-zinc-400">
                        Total{' '}
                        <span className="font-medium text-zinc-100">
                          {money(group.total, group.currency)}
                        </span>
                      </span>
                      <span className="text-zinc-400">
                        Paid{' '}
                        <span className="font-medium text-emerald-400">
                          {money(group.paid, group.currency)}
                        </span>
                      </span>
                      <span className="text-zinc-400">
                        Pending{' '}
                        <span className="font-medium text-amber-400">
                          {money(group.pending, group.currency)}
                        </span>
                      </span>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[620px] text-sm">
                      <thead>
                        <tr className="border-b border-zinc-800">
                          <th className="px-5 py-3 text-left text-xs font-medium tracking-wide text-zinc-500 uppercase">
                            Date
                          </th>
                          <th className="px-5 py-3 text-left text-xs font-medium tracking-wide text-zinc-500 uppercase">
                            Type
                          </th>
                          <th className="px-5 py-3 text-right text-xs font-medium tracking-wide text-zinc-500 uppercase">
                            My amount
                          </th>
                          <th className="px-5 py-3 text-left text-xs font-medium tracking-wide text-zinc-500 uppercase">
                            Status
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.entries.map((entry) => (
                          <tr
                            key={entry.id}
                            className="border-b border-zinc-800 last:border-0 hover:bg-zinc-800/40"
                          >
                            <td className="px-5 py-3 text-zinc-400">{formatDate(entry.date)}</td>
                            <td className="px-5 py-3">
                              {entry.type === 'one_time' ? (
                                <Pill tone="blue">One time</Pill>
                              ) : (
                                <Pill>Daily</Pill>
                              )}
                            </td>
                            <td className="px-5 py-3 text-right font-medium text-zinc-100">
                              {money(entry.amount, entry.currency)}
                            </td>
                            <td className="px-5 py-3">
                              {entry.paid ? (
                                <Pill tone="green">Paid</Pill>
                              ) : (
                                <Pill tone="orange">Unpaid</Pill>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))
            )}
          </>
        ) : (
          <p className="text-sm text-zinc-500">Loading…</p>
        )}
      </main>
    </div>
  )
}
