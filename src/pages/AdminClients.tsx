import { Fragment, useEffect, useMemo, useState } from 'react'
import {
  api,
  formatDate,
  money,
  todayISO,
  type Checklist,
  type Client,
  type Currency,
} from '../api'
import {
  Button,
  Card,
  CardHeader,
  ConfirmDialog,
  EmptyState,
  Field,
  Input,
  Modal,
  Pill,
  Select,
  TableWrap,
  Td,
  Th,
  Tr,
} from '../components/ui'

export default function AdminClients() {
  const [clients, setClients] = useState<Client[]>([])
  const [openId, setOpenId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Client | null>(null)
  const [deleting, setDeleting] = useState<Client | null>(null)

  const load = async () => {
    try {
      setClients(await api.clients.list())
    } catch (err) {
      setError((err as Error).message)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return clients
    return clients.filter((client) => client.name.toLowerCase().includes(term))
  }, [clients, search])

  // grand totals: only show a currency symbol when every client uses the same one
  const currencies = new Set(clients.map((client) => client.currency))
  const grandCurrency = currencies.size === 1 ? [...currencies][0] : null
  const total = (pick: (client: Client) => number) =>
    clients.reduce((sum, client) => sum + pick(client), 0)
  const grand = (value: number) =>
    grandCurrency ? money(value, grandCurrency) : value.toFixed(2)

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <SummaryCard label="Coming in today" value={grand(total((c) => c.todayIn))} tone="green" />
        <SummaryCard label="Collected till date" value={grand(total((c) => c.collected))} />
      </div>

      <Card>
        <CardHeader
          title="All clients"
          action={
            <div className="flex flex-wrap items-center gap-2">
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search client…"
                className="w-48"
              />
              <Button
                variant="primary"
                onClick={() => {
                  setEditing(null)
                  setFormOpen(true)
                }}
              >
                + Add client
              </Button>
            </div>
          }
        />

        {error ? <p className="px-5 py-3 text-sm text-red-400">{error}</p> : null}

        {filtered.length === 0 ? (
          <EmptyState
            message={
              clients.length === 0
                ? 'No clients yet. Add a client, tick each day the payment comes, then share with partners.'
                : 'No client matches your search.'
            }
          />
        ) : (
          <TableWrap minWidth="min-w-[1180px]">
            <thead>
              <tr className="border-b border-zinc-800">
                <Th>Client</Th>
                <Th right>Daily in</Th>
                <Th right>Weekly (×7)</Th>
                <Th right>To pay client / week</Th>
                <Th right>Today</Th>
                <Th right>Collected</Th>
                <Th>Checklist</Th>
                <Th right>Actions</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((client) => {
                const isOpen = openId === client.id
                const cur = client.currency
                return (
                  <Fragment key={client.id}>
                    <Tr>
                      <Td>
                        <button
                          className="font-medium text-zinc-100 hover:underline"
                          onClick={() => setOpenId(isOpen ? null : client.id)}
                        >
                          {client.name}
                        </button>
                        <span className="ml-2 text-xs text-zinc-500">{cur === 'INR' ? '₹' : '$'}</span>
                      </Td>
                      <Td right className="font-medium text-zinc-100">
                        {money(client.dailyAmount, cur)}
                      </Td>
                      <Td right className="font-medium text-sky-300">
                        {money(client.weeklyAmount, cur)}
                      </Td>
                      <Td right className="text-zinc-300">
                        {money(client.payToClientAmount, cur)}
                      </Td>
                      <Td right className={client.todayIn > 0 ? 'text-emerald-400' : 'text-zinc-500'}>
                        {money(client.todayIn, cur)}
                      </Td>
                      <Td right className="font-medium text-emerald-400">
                        {money(client.collected, cur)}
                      </Td>
                      <Td>
                        <div className="w-32">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-zinc-400">
                              {client.donePeriods}/{client.totalPeriods} days
                            </span>
                            <span className="text-sky-400">
                              {percent(client.donePeriods, client.totalPeriods)}%
                            </span>
                          </div>
                          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
                            <div
                              className="h-full rounded-full bg-emerald-500 transition-all"
                              style={{
                                width: `${percent(client.donePeriods, client.totalPeriods)}%`,
                              }}
                            />
                          </div>
                        </div>
                      </Td>
                      <Td right>
                        <div className="flex justify-end gap-2">
                          <Button onClick={() => setOpenId(isOpen ? null : client.id)}>
                            {isOpen ? 'Hide' : 'Open'}
                          </Button>
                          <Button
                            onClick={() => {
                              setEditing(client)
                              setFormOpen(true)
                            }}
                          >
                            Edit
                          </Button>
                          <Button variant="danger" onClick={() => setDeleting(client)}>
                            Delete
                          </Button>
                        </div>
                      </Td>
                    </Tr>

                    {isOpen ? (
                      <tr className="border-b border-zinc-800 bg-zinc-950/60">
                        <td colSpan={8} className="px-5 py-4">
                          <ClientPanel
                            client={client}
                            onChanged={load}
                            onError={setError}
                          />
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                )
              })}
            </tbody>
          </TableWrap>
        )}
      </Card>

      <ClientForm
        open={formOpen}
        editing={editing}
        onClose={() => setFormOpen(false)}
        onSaved={async () => {
          setFormOpen(false)
          await load()
        }}
        onError={setError}
      />

      <ConfirmDialog
        open={deleting !== null}
        title="Delete client"
        message={
          deleting
            ? `Delete ${deleting.name} with its daily checklist and every partner commission on it? This cannot be undone.`
            : ''
        }
        onCancel={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return
          try {
            await api.clients.remove(deleting.id)
            if (openId === deleting.id) setOpenId(null)
            await load()
          } catch (err) {
            setError((err as Error).message)
          }
          setDeleting(null)
        }}
      />
    </div>
  )
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: 'green' | 'orange'
}) {
  const color =
    tone === 'green' ? 'text-emerald-400' : tone === 'orange' ? 'text-amber-400' : 'text-zinc-100'
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-5 py-4">
      <p className="text-xs tracking-wide text-zinc-500 uppercase">{label}</p>
      <p className={`mt-1 text-xl font-semibold ${color}`}>{value}</p>
    </div>
  )
}

/* ---------- expanded panel: daily payment checklist ---------- */

const percent = (done: number, total: number) => (total > 0 ? Math.round((done / total) * 100) : 0)

function ClientPanel({
  client,
  onChanged,
  onError,
}: {
  client: Client
  onChanged: () => Promise<void> | void
  onError: (message: string) => void
}) {
  const [checklist, setChecklist] = useState<Checklist | null>(null)
  const [busyDate, setBusyDate] = useState('')

  const cur = client.currency

  const reloadPanel = async () => {
    setChecklist(await api.clients.checklist(client.id))
  }

  useEffect(() => {
    reloadPanel().catch((err) => onError((err as Error).message))
  }, [client.id])

  const toggle = async (periodDate: string) => {
    setBusyDate(periodDate)
    try {
      await api.clients.toggleChecklist(client.id, { date: periodDate })
      await reloadPanel()
      await onChanged()
    } catch (err) {
      onError((err as Error).message)
    } finally {
      setBusyDate('')
    }
  }

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/60">
      <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
        <h3 className="text-xs font-semibold tracking-wide text-zinc-300 uppercase">
          Daily payment checklist
        </h3>
        <span className="text-xs text-zinc-500">
          Collected{' '}
          <span className="text-emerald-400">{money(checklist?.collected ?? 0, cur)}</span>
          {' · '}Shared{' '}
          <span className="text-amber-400">{money(client.shared, cur)}</span>
          {(checklist?.periods.length ?? 0) > 0 ? (
            <button
              className="ml-3 text-xs text-sky-400 hover:underline"
              onClick={() => {
                const today = checklist?.periods.find((p) => p.date === todayISO())
                if (today) toggle(today.date)
              }}
            >
              Tick today
            </button>
          ) : null}
        </span>
      </div>

      {checklist ? (
        <div className="max-h-80 overflow-y-auto">
          {[...checklist.periods].reverse().map((period) => (
            <div
              key={period.date}
              className={`flex items-center justify-between gap-3 border-b border-zinc-800 px-4 py-2 last:border-0 ${
                period.date === todayISO() ? 'bg-sky-500/5' : ''
              }`}
            >
              <button
                onClick={() => toggle(period.date)}
                disabled={busyDate === period.date}
                className="flex items-center gap-3 text-left disabled:opacity-50"
              >
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded border text-xs ${
                    period.done
                      ? 'border-emerald-600 bg-emerald-600 text-white'
                      : 'border-zinc-600 bg-zinc-950'
                  }`}
                >
                  {period.done ? '✓' : ''}
                </span>
                <span className={period.done ? 'text-zinc-500 line-through' : 'text-zinc-200'}>
                  {formatDate(period.date)}
                  {period.date === todayISO() ? (
                    <span className="ml-2 text-xs text-sky-400">today</span>
                  ) : null}
                </span>
              </button>
              <div className="flex items-center gap-3">
                <span className="text-sm text-zinc-300">{money(period.amount, cur)}</span>
                {period.done ? (
                  <Pill tone="green">Received</Pill>
                ) : (
                  <Pill tone="orange">Waiting</Pill>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="px-4 py-6 text-sm text-zinc-500">Loading checklist…</p>
      )}
    </div>
  )
}

/* ---------- add / edit client ---------- */

function ClientForm({
  open,
  editing,
  onClose,
  onSaved,
  onError,
}: {
  open: boolean
  editing: Client | null
  onClose: () => void
  onSaved: () => void
  onError: (message: string) => void
}) {
  const [name, setName] = useState('')
  const [currency, setCurrency] = useState<Currency>('USD')
  const [daily, setDaily] = useState('')
  const [payClient, setPayClient] = useState('')
  const [payClientDate, setPayClientDate] = useState(todayISO())
  const [startDate, setStartDate] = useState(todayISO())

  const [lastOpen, setLastOpen] = useState(false)
  if (open !== lastOpen) {
    setLastOpen(open)
    if (open) {
      setName(editing?.name ?? '')
      setCurrency(editing?.currency ?? 'USD')
      setDaily(editing ? String(editing.dailyAmount) : '')
      setPayClient(editing ? String(editing.payToClientAmount) : '')
      setPayClientDate(editing?.payToClientDate ?? todayISO())
      setStartDate(editing?.startDate ?? todayISO())
    }
  }

  const weekly = (Number.parseFloat(daily) || 0) * 7

  const save = async () => {
    const body = {
      name,
      currency,
      dailyAmount: Number.parseFloat(daily),
      payToClientAmount: Number.parseFloat(payClient),
      payToClientDate: payClientDate,
      startDate,
    }
    try {
      if (editing) await api.clients.update(editing.id, body)
      else await api.clients.create(body)
      onSaved()
    } catch (err) {
      onError((err as Error).message)
      onClose()
    }
  }

  return (
    <Modal
      open={open}
      title={editing ? `Edit ${editing.name}` : 'Add client'}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save}>
            {editing ? 'Save changes' : 'Add client'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2">
            <Field label="Client name">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. ABC" />
            </Field>
          </div>
          <Field label="Currency">
            <Select value={currency} onChange={(e) => setCurrency(e.target.value as Currency)}>
              <option value="USD">$ Dollar</option>
              <option value="INR">₹ Rupee</option>
            </Select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Daily amount (in)" hint="Money coming in every day.">
            <Input
              type="number"
              step="0.01"
              min="0"
              value={daily}
              onChange={(e) => setDaily(e.target.value)}
              placeholder="3.40"
            />
          </Field>
          <Field label="Weekly (auto)" hint="Daily amount × 7.">
            <div className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm font-medium text-sky-300">
              {money(weekly, currency)}
            </div>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="To pay client (weekly)" hint="What we pay the client each week.">
            <Input
              type="number"
              step="0.01"
              min="0"
              value={payClient}
              onChange={(e) => setPayClient(e.target.value)}
              placeholder="0.00"
            />
          </Field>
          <Field label="Pay-to-client date">
            <Input
              type="date"
              value={payClientDate}
              onChange={(e) => setPayClientDate(e.target.value)}
            />
          </Field>
        </div>

        <Field label="Daily checklist starts" hint="The checklist has one row per day from here.">
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </Field>
      </div>
    </Modal>
  )
}
