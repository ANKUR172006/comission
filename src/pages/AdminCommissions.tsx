import { useEffect, useMemo, useState } from 'react'
import {
  api,
  formatDate,
  money,
  todayISO,
  type Client,
  type Commission,
  type CommissionType,
  type Partner,
} from '../api'
import {
  Button,
  Card,
  CardHeader,
  ConfirmDialog,
  EmptyState,
  Field,
  Input,
  Pill,
  Select,
  StatCard,
  TableWrap,
  Td,
  Th,
  Tr,
} from '../components/ui'

const typeLabel: Record<CommissionType, string> = { one_time: 'One time', daily: 'Daily' }

export default function AdminCommissions() {
  const [rows, setRows] = useState<Commission[]>([])
  const [partners, setPartners] = useState<Partner[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [removing, setRemoving] = useState<Commission | null>(null)

  // quick entry form
  const [partnerId, setPartnerId] = useState('')
  const [clientId, setClientId] = useState('')
  const [type, setType] = useState<CommissionType>('daily')
  const [amount, setAmount] = useState('')

  // filters
  const [filterDate, setFilterDate] = useState('')
  const [filterPartner, setFilterPartner] = useState('all')
  const [filterType, setFilterType] = useState<'all' | CommissionType>('all')

  const load = async () => {
    try {
      const [rowList, partnerList, clientList] = await Promise.all([
        api.commissions.list(),
        api.partners.list(),
        api.clients.list(),
      ])
      setRows(rowList)
      setPartners(partnerList)
      setClients(clientList)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const visible = useMemo(
    () =>
      rows
        .filter((row) => (filterDate ? row.date === filterDate : true))
        .filter((row) => (filterPartner === 'all' ? true : row.partnerId === filterPartner))
        .filter((row) => (filterType === 'all' ? true : row.type === filterType)),
    [rows, filterDate, filterPartner, filterType],
  )

  const shownTotal = visible.reduce((sum, row) => sum + row.amount, 0)
  const allTotal = rows.reduce((sum, row) => sum + row.amount, 0)
  // total still to pay: every client's unpaid commissions added together
  const unpaidTotal = rows.reduce((sum, row) => (row.paid ? sum : sum + row.amount), 0)

  // only show a currency symbol on the totals when every entry shares one currency
  const shownCurrencies = new Set(visible.map((row) => row.currency))
  const shownCurrency = shownCurrencies.size === 1 ? [...shownCurrencies][0] : null
  const allCurrencies = new Set(rows.map((row) => row.currency))
  const allCurrency = allCurrencies.size === 1 ? [...allCurrencies][0] : null
  const grand = (value: number, currency: Commission['currency'] | null) =>
    currency ? money(value, currency) : value.toFixed(2)

  const addEntry = async () => {
    setError('')
    setMessage('')
    try {
      // a daily commission is counted from the client's checklist start date;
      // a one time commission needs no date, so it is stored as today
      const client = clients.find((c) => c.id === clientId)
      const entryDate = type === 'daily' ? client?.startDate ?? todayISO() : todayISO()
      await api.commissions.create({
        partnerId,
        clientId,
        type,
        amount: Number.parseFloat(amount),
        date: entryDate,
      })
      setAmount('')
      setMessage('Entry added')
      await load()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  const togglePaid = async (row: Commission) => {
    try {
      await api.commissions.update(row.id, { paid: !row.paid })
      await load()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  const canAdd =
    partnerId !== '' && clientId !== '' && amount !== '' &&
    !Number.isNaN(Number.parseFloat(amount)) && Number.parseFloat(amount) > 0

  const selectedClient = clients.find((client) => client.id === clientId)
  const entrySymbol = selectedClient?.currency === 'INR' ? '₹' : '$'

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader title="Add commission entry" />
        <div className="flex flex-wrap items-end gap-3 px-5 py-4">
          <div className="min-w-[160px]">
            <Field label="Partner">
              <Select value={partnerId} onChange={(e) => setPartnerId(e.target.value)}>
                <option value="">Select partner…</option>
                {partners
                  .filter((p) => p.active)
                  .map((partner) => (
                    <option key={partner.id} value={partner.id}>
                      {partner.name}
                    </option>
                  ))}
              </Select>
            </Field>
          </div>
          <div className="min-w-[200px]">
            <Field label="Client">
              <Select value={clientId} onChange={(e) => setClientId(e.target.value)}>
                <option value="">Select client…</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="w-32">
            <Field label="Type">
              <Select value={type} onChange={(e) => setType(e.target.value as CommissionType)}>
                <option value="daily">Daily</option>
                <option value="one_time">One time</option>
              </Select>
            </Field>
          </div>
          <div className="w-28">
            <Field label={`Amount (${entrySymbol})`}>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
              />
            </Field>
          </div>
          <Button variant="primary" onClick={addEntry} disabled={!canAdd} className="mb-0.5">
            Add entry
          </Button>
          <p className="mb-2.5 text-xs text-zinc-500">
            Daily counts from the client's checklist start date · One time needs no date
          </p>
          {message ? <p className="mb-2.5 text-xs text-emerald-400">{message}</p> : null}
          {error ? <p className="mb-2.5 text-xs text-red-400">{error}</p> : null}
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Entries shown" value={visible.length} />
        <StatCard label="Total of entries shown" value={grand(shownTotal, shownCurrency)} />
        <StatCard label="Total to pay (unpaid)" value={grand(unpaidTotal, allCurrency)} tone="orange" />
        <StatCard label="All entries" value={grand(allTotal, allCurrency)} />
      </div>

      <Card>
        <CardHeader
          title="All commission entries"
          action={
            <div className="flex flex-wrap items-center gap-2">
              <Input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="w-40"
              />
              <Button variant="ghost" onClick={() => setFilterDate('')}>
                Clear date
              </Button>
              <Select
                value={filterPartner}
                onChange={(e) => setFilterPartner(e.target.value)}
                className="w-44"
              >
                <option value="all">All partners</option>
                {partners.map((partner) => (
                  <option key={partner.id} value={partner.id}>
                    {partner.name}
                  </option>
                ))}
              </Select>
              <Select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as 'all' | CommissionType)}
                className="w-36"
              >
                <option value="all">All types</option>
                <option value="daily">Daily</option>
                <option value="one_time">One time</option>
              </Select>
            </div>
          }
        />

        {visible.length === 0 ? (
          <EmptyState message="No commission entries for this filter." />
        ) : (
          <TableWrap minWidth="min-w-[1000px]">
            <thead>
              <tr className="border-b border-zinc-800">
                <Th>Date</Th>
                <Th>Partner</Th>
                <Th>Client</Th>
                <Th>Type</Th>
                <Th>Counting</Th>
                <Th right>Amount</Th>
                <Th>Status</Th>
                <Th right>Actions</Th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <Tr key={row.id}>
                  <Td className="text-zinc-400">{formatDate(row.date)}</Td>
                  <Td className="font-medium text-zinc-100">{row.partnerName}</Td>
                  <Td className="text-zinc-300">{row.clientName}</Td>
                  <Td>
                    <Pill tone={row.type === 'one_time' ? 'blue' : 'zinc'}>
                      {typeLabel[row.type]}
                    </Pill>
                  </Td>
                  <Td className="text-zinc-400">
                    {row.type === 'daily'
                      ? `${money(row.rate, row.currency)} × ${row.days} day${row.days === 1 ? '' : 's'}`
                      : '—'}
                  </Td>
                  <Td right className="font-medium text-zinc-100">
                    {money(row.amount, row.currency)}
                  </Td>
                  <Td>
                    {row.paid ? <Pill tone="green">Paid</Pill> : <Pill tone="orange">Unpaid</Pill>}
                  </Td>
                  <Td right>
                    <div className="flex justify-end gap-2">
                      <Button
                        variant={row.paid ? 'secondary' : 'success'}
                        onClick={() => togglePaid(row)}
                      >
                        {row.paid ? 'Mark unpaid' : 'Mark paid'}
                      </Button>
                      <Button variant="danger" onClick={() => setRemoving(row)}>
                        Delete
                      </Button>
                    </div>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </TableWrap>
        )}
      </Card>

      <ConfirmDialog
        open={removing !== null}
        title="Delete entry"
        message={
          removing
            ? `Delete ${removing.partnerName}'s ${money(removing.amount, removing.currency)} entry for ${removing.clientName}?`
            : ''
        }
        onCancel={() => setRemoving(null)}
        onConfirm={async () => {
          if (!removing) return
          try {
            await api.commissions.remove(removing.id)
            await load()
          } catch (err) {
            setError((err as Error).message)
          }
          setRemoving(null)
        }}
      />
    </div>
  )
}
