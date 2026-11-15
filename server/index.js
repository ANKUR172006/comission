import express from 'express'
import cors from 'cors'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { ObjectId } from 'mongodb'
import { env } from './env.js'
import { clients, commissions, connect, payments, users } from './db.js'
import { createToken, publicUser, requireAdmin, requireAuth } from './auth.js'

const app = express()
app.use(cors())
app.use(express.json())

/* ---------- small helpers ---------- */

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100
const today = () => new Date().toISOString().slice(0, 10)
const emailPattern = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
const CURRENCIES = ['USD', 'INR']
const TYPES = ['one_time', 'daily']

function asId(value) {
  try {
    return new ObjectId(String(value))
  } catch {
    return null
  }
}

function asDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null
}

function addDays(isoDate, days) {
  const date = new Date(`${isoDate}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

function asAmount(value) {
  const number = typeof value === 'number' ? value : Number.parseFloat(String(value ?? ''))
  return Number.isFinite(number) ? round2(number) : null
}

const sum = (rows) => round2(rows.reduce((total, row) => total + row.amount, 0))

/** every daily payment period of a client, from the start date up to today (+ tomorrow) */
function periodsFor(client, limit = 400) {
  const base = client.startDate || today()
  const end = addDays(today(), 1)
  const dates = []

  let date = base
  let guard = 0
  while (date <= end && guard < limit * 2) {
    dates.push(date)
    date = addDays(date, 1)
    guard += 1
  }

  return dates.length === 0 ? [base] : dates.slice(-limit)
}

function walletOf(rows) {
  const total = sum(rows)
  const paid = sum(rows.filter((row) => row.paid))
  return { total, paid, pending: round2(total - paid) }
}

/** how many days of a client's payment have come in, per client */
async function doneDaysByClient() {
  const rows = await payments.find({ done: true }).toArray()
  const map = new Map()
  for (const row of rows) {
    const key = String(row.clientId)
    map.set(key, (map.get(key) || 0) + 1)
  }
  return map
}

/** a daily commission is the rate × the days the payment came; one time is counted once */
function accrue(row, days) {
  const rate = round2(row.amount)
  const count = row.type === 'daily' ? days : 1
  return { rate, days: count, amount: round2(rate * count) }
}

/* ---------- auth ---------- */

// login is email only - the email must already be added by the admin
app.post('/api/auth/login', async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase()
  if (!emailPattern.test(email)) {
    return res.status(400).json({ error: 'Enter a valid email' })
  }

  const user = await users.findOne({ email, active: true })
  if (!user) {
    return res.status(401).json({ error: 'This email is not added by the admin' })
  }

  res.json({ token: createToken(user), user: publicUser(user) })
})

app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user) })
})

/* ---------- partners (admin only) ---------- */

app.get('/api/partners', requireAuth, requireAdmin, async (_req, res) => {
  const [list, rows, clientDocs, days] = await Promise.all([
    users.find({ role: 'partner' }).sort({ name: 1 }).toArray(),
    commissions.find({}).toArray(),
    clients.find({}).toArray(),
    doneDaysByClient(),
  ])
  const currencyOf = new Map(clientDocs.map((doc) => [String(doc._id), doc.currency || 'USD']))
  const accrued = rows.map((row) => ({
    ...accrue(row, days.get(String(row.clientId)) || 0),
    partnerId: String(row.partnerId),
    clientId: String(row.clientId),
    paid: Boolean(row.paid),
  }))

  res.json(
    list.map((partner) => {
      const mine = accrued.filter((row) => row.partnerId === String(partner._id))
      return {
        id: String(partner._id),
        name: partner.name,
        email: partner.email,
        active: Boolean(partner.active),
        currency: currencyOf.get(String(mine[0]?.clientId)) || 'USD',
        ...walletOf(mine),
      }
    }),
  )
})

app.post('/api/partners', requireAuth, requireAdmin, async (req, res) => {
  const name = String(req.body?.name || '').trim()
  const email = String(req.body?.email || '').trim().toLowerCase()

  if (!name) return res.status(400).json({ error: 'Partner name is required' })
  if (!emailPattern.test(email)) {
    return res.status(400).json({ error: 'A valid email is required' })
  }

  const existing = await users.findOne({ email })
  if (existing) return res.status(400).json({ error: 'This email is already added' })

  const result = await users.insertOne({
    role: 'partner',
    name,
    email,
    active: true,
    createdAt: new Date(),
  })

  res.json({
    id: String(result.insertedId),
    name,
    email,
    active: true,
    currency: 'USD',
    total: 0,
    paid: 0,
    pending: 0,
  })
})

app.patch('/api/partners/:id', requireAuth, requireAdmin, async (req, res) => {
  const id = asId(req.params.id)
  if (!id) return res.status(400).json({ error: 'Bad id' })

  const update = {}
  if (req.body?.name !== undefined) {
    const name = String(req.body.name).trim()
    if (!name) return res.status(400).json({ error: 'Partner name is required' })
    update.name = name
  }
  if (req.body?.email !== undefined) {
    const email = String(req.body.email).trim().toLowerCase()
    if (!emailPattern.test(email)) {
      return res.status(400).json({ error: 'A valid email is required' })
    }
    const taken = await users.findOne({ email, _id: { $ne: id } })
    if (taken) return res.status(400).json({ error: 'This email is already added' })
    update.email = email
  }
  if (req.body?.active !== undefined) update.active = Boolean(req.body.active)

  if (Object.keys(update).length === 0) return res.status(400).json({ error: 'Nothing to update' })

  const result = await users.updateOne({ _id: id, role: 'partner' }, { $set: update })
  if (result.matchedCount === 0) return res.status(404).json({ error: 'Partner not found' })
  res.json({ ok: true })
})

app.delete('/api/partners/:id', requireAuth, requireAdmin, async (req, res) => {
  const id = asId(req.params.id)
  if (!id) return res.status(400).json({ error: 'Bad id' })

  await users.deleteOne({ _id: id, role: 'partner' })
  await commissions.deleteMany({ partnerId: id })
  res.json({ ok: true })
})

/* ---------- clients (admin only) ---------- */

function clientView(client, collected, shared, todayIn) {
  const collectedTotal = round2(collected?.total || 0)
  const dailyAmount = client.dailyAmount || 0
  return {
    id: String(client._id),
    name: client.name,
    currency: client.currency || 'USD',
    dailyAmount,
    weeklyAmount: round2(dailyAmount * 7),
    payToClientAmount: client.payToClientAmount || 0,
    payToClientDate: client.payToClientDate ?? null,
    startDate: client.startDate ?? null,
    collected: collectedTotal,
    todayIn: round2(todayIn || 0),
    donePeriods: collected?.count || 0,
    totalPeriods: periodsFor(client).length,
    shared: round2(shared || 0),
    remaining: round2(collectedTotal - (shared || 0)),
  }
}

async function clientTotals() {
  const [collected, commissionDocs, todayRows, days] = await Promise.all([
    payments
      .aggregate([
        { $match: { done: true } },
        { $group: { _id: '$clientId', total: { $sum: '$amount' }, count: { $sum: 1 } } },
      ])
      .toArray(),
    commissions.find({}).toArray(),
    payments.find({ done: true, date: today() }).toArray(),
    doneDaysByClient(),
  ])

  // partners are shared the daily rate for each day the client's payment came
  const shared = new Map()
  for (const row of commissionDocs) {
    const key = String(row.clientId)
    const { amount } = accrue(row, days.get(key) || 0)
    shared.set(key, round2((shared.get(key) || 0) + amount))
  }

  return {
    collected: new Map(collected.map((row) => [String(row._id), row])),
    shared,
    todayIn: new Map(todayRows.map((row) => [String(row.clientId), row.amount])),
  }
}

app.get('/api/clients', requireAuth, requireAdmin, async (_req, res) => {
  const list = await clients.find({}).sort({ createdAt: -1 }).toArray()
  const totals = await clientTotals()
  res.json(
    list.map((client) =>
      clientView(
        client,
        totals.collected.get(String(client._id)),
        totals.shared.get(String(client._id)),
        totals.todayIn.get(String(client._id)),
      ),
    ),
  )
})

function readClientBody(body) {
  const name = String(body?.name || '').trim()
  const currency = CURRENCIES.includes(body?.currency) ? body.currency : 'USD'
  const dailyAmount = asAmount(body?.dailyAmount)
  const payToClientAmount = asAmount(body?.payToClientAmount)
  const payToClientDate = asDate(body?.payToClientDate)
  const startDate = asDate(body?.startDate) || today()

  if (!name) return { error: 'Client name is required' }
  if (dailyAmount === null || dailyAmount <= 0) {
    return { error: 'Daily amount must be greater than 0' }
  }
  if (payToClientAmount === null || payToClientAmount < 0) {
    return { error: 'The weekly amount to pay the client is required' }
  }
  if (!payToClientDate) return { error: 'The pay-to-client date is required' }

  return {
    value: {
      name,
      currency,
      dailyAmount,
      payToClientAmount,
      payToClientDate,
      startDate,
    },
  }
}

app.post('/api/clients', requireAuth, requireAdmin, async (req, res) => {
  const { value, error } = readClientBody(req.body)
  if (error) return res.status(400).json({ error })

  const result = await clients.insertOne({ ...value, createdAt: new Date() })
  res.json(clientView({ _id: result.insertedId, ...value }, null, 0, 0))
})

app.patch('/api/clients/:id', requireAuth, requireAdmin, async (req, res) => {
  const id = asId(req.params.id)
  if (!id) return res.status(400).json({ error: 'Bad id' })

  const client = await clients.findOne({ _id: id })
  if (!client) return res.status(404).json({ error: 'Client not found' })

  const { value, error } = readClientBody({ ...client, ...req.body })
  if (error) return res.status(400).json({ error })

  await clients.updateOne({ _id: id }, { $set: value })
  res.json({ ok: true })
})

app.delete('/api/clients/:id', requireAuth, requireAdmin, async (req, res) => {
  const id = asId(req.params.id)
  if (!id) return res.status(400).json({ error: 'Bad id' })

  await clients.deleteOne({ _id: id })
  await Promise.all([
    payments.deleteMany({ clientId: id }),
    commissions.deleteMany({ clientId: id }),
  ])
  res.json({ ok: true })
})

/* ---------- client payment checklist ---------- */

app.get('/api/clients/:id/checklist', requireAuth, requireAdmin, async (req, res) => {
  const id = asId(req.params.id)
  if (!id) return res.status(400).json({ error: 'Bad id' })

  const client = await clients.findOne({ _id: id })
  if (!client) return res.status(404).json({ error: 'Client not found' })

  const saved = await payments.find({ clientId: id }).toArray()
  const byDate = new Map(saved.map((row) => [row.date, row]))

  const periods = periodsFor(client).map((date) => {
    const row = byDate.get(date)
    return {
      date,
      amount: row?.amount ?? client.dailyAmount,
      done: Boolean(row?.done),
    }
  })

  const dailyAmount = client.dailyAmount || 0
  res.json({
    clientId: String(id),
    clientName: client.name,
    currency: client.currency || 'USD',
    dailyAmount,
    weeklyAmount: round2(dailyAmount * 7),
    collected: sum(periods.filter((period) => period.done)),
    periods,
  })
})

// tick / untick one period of the checklist
app.post('/api/clients/:id/checklist/toggle', requireAuth, requireAdmin, async (req, res) => {
  const id = asId(req.params.id)
  const date = asDate(req.body?.date)
  if (!id) return res.status(400).json({ error: 'Bad id' })
  if (!date) return res.status(400).json({ error: 'A valid date is required' })

  const client = await clients.findOne({ _id: id })
  if (!client) return res.status(404).json({ error: 'Client not found' })

  const existing = await payments.findOne({ clientId: id, date })
  const done = !existing?.done
  const amount = asAmount(req.body?.amount) ?? existing?.amount ?? client.dailyAmount

  await payments.updateOne(
    { clientId: id, date },
    { $set: { done, amount }, $setOnInsert: { createdAt: new Date() } },
    { upsert: true },
  )

  res.json({ ok: true, date, done, amount })
})

/* ---------- commissions ---------- */

async function commissionRows(filter) {
  const [rows, partnerDocs, clientDocs, doneDays] = await Promise.all([
    commissions.find(filter).sort({ date: -1, _id: -1 }).toArray(),
    users.find({ role: 'partner' }).toArray(),
    clients.find({}).toArray(),
    doneDaysByClient(),
  ])
  const partnerName = new Map(partnerDocs.map((doc) => [String(doc._id), doc.name]))
  const clientMeta = new Map(
    clientDocs.map((doc) => [String(doc._id), { name: doc.name, currency: doc.currency || 'USD' }]),
  )

  return rows.map((row) => {
    const meta = clientMeta.get(String(row.clientId))
    const earned = accrue(row, doneDays.get(String(row.clientId)) || 0)
    return {
      id: String(row._id),
      partnerId: String(row.partnerId),
      partnerName: partnerName.get(String(row.partnerId)) || 'Removed partner',
      clientId: String(row.clientId),
      clientName: meta?.name || 'Removed client',
      currency: meta?.currency || 'USD',
      type: row.type || 'daily',
      rate: earned.rate,
      days: earned.days,
      amount: earned.amount,
      date: row.date,
      paid: Boolean(row.paid),
    }
  })
}

app.get('/api/commissions', requireAuth, requireAdmin, async (req, res) => {
  const filter = {}
  const partnerId = asId(req.query.partnerId)
  const clientId = asId(req.query.clientId)
  if (partnerId) filter.partnerId = partnerId
  if (clientId) filter.clientId = clientId
  if (TYPES.includes(req.query.type)) filter.type = req.query.type

  res.json(await commissionRows(filter))
})

app.post('/api/commissions', requireAuth, requireAdmin, async (req, res) => {
  const partnerId = asId(req.body?.partnerId)
  const clientId = asId(req.body?.clientId)
  const type = String(req.body?.type || 'daily')
  const amount = asAmount(req.body?.amount)
  const date = asDate(req.body?.date) || today()

  if (!partnerId) return res.status(400).json({ error: 'Choose a partner' })
  if (!clientId) return res.status(400).json({ error: 'Choose a client' })
  if (!TYPES.includes(type)) return res.status(400).json({ error: 'Type must be one time or daily' })
  if (amount === null || amount <= 0) {
    return res.status(400).json({ error: 'Amount must be greater than 0' })
  }

  const [partner, client] = await Promise.all([
    users.findOne({ _id: partnerId, role: 'partner' }),
    clients.findOne({ _id: clientId }),
  ])
  if (!partner) return res.status(400).json({ error: 'Partner not found' })
  if (!client) return res.status(400).json({ error: 'Client not found' })

  const result = await commissions.insertOne({
    partnerId,
    clientId,
    type,
    amount,
    date,
    paid: Boolean(req.body?.paid),
    createdAt: new Date(),
  })

  const [created] = await commissionRows({ _id: result.insertedId })
  res.json(created)
})

app.patch('/api/commissions/:id', requireAuth, requireAdmin, async (req, res) => {
  const id = asId(req.params.id)
  if (!id) return res.status(400).json({ error: 'Bad id' })

  const update = {}
  if (req.body?.paid !== undefined) update.paid = Boolean(req.body.paid)
  if (req.body?.amount !== undefined) {
    const amount = asAmount(req.body.amount)
    if (amount === null || amount <= 0) {
      return res.status(400).json({ error: 'Amount must be greater than 0' })
    }
    update.amount = amount
  }
  if (req.body?.date !== undefined) {
    const date = asDate(req.body.date)
    if (!date) return res.status(400).json({ error: 'A valid date is required' })
    update.date = date
  }
  if (Object.keys(update).length === 0) return res.status(400).json({ error: 'Nothing to update' })

  await commissions.updateOne({ _id: id }, { $set: update })
  res.json({ ok: true })
})

app.delete('/api/commissions/:id', requireAuth, requireAdmin, async (req, res) => {
  const id = asId(req.params.id)
  if (!id) return res.status(400).json({ error: 'Bad id' })

  await commissions.deleteOne({ _id: id })
  res.json({ ok: true })
})

/* ---------- partner wallet (admin view and partner view) ---------- */

async function partnerWallet(partnerId) {
  const rows = await commissionRows({ partnerId })
  const grouped = new Map()

  for (const row of rows) {
    if (!grouped.has(row.clientId)) {
      grouped.set(row.clientId, {
        clientId: row.clientId,
        clientName: row.clientName,
        entries: [],
      })
    }
    grouped.get(row.clientId).entries.push(row)
  }

  const byClient = [...grouped.values()]
    .map((group) => ({
      clientId: group.clientId,
      clientName: group.clientName,
      currency: group.entries[0]?.currency || 'USD',
      oneTime: sum(group.entries.filter((row) => row.type === 'one_time')),
      daily: sum(group.entries.filter((row) => row.type === 'daily')),
      ...walletOf(group.entries),
      entries: group.entries,
    }))
    .sort((a, b) => b.total - a.total)

  return {
    summary: {
      ...walletOf(rows),
      currency: byClient[0]?.currency || 'USD',
      clients: byClient.length,
      entries: rows.length,
    },
    byClient,
  }
}

app.get('/api/partners/:id/wallet', requireAuth, requireAdmin, async (req, res) => {
  const id = asId(req.params.id)
  if (!id) return res.status(400).json({ error: 'Bad id' })
  res.json(await partnerWallet(id))
})

app.get('/api/me/wallet', requireAuth, async (req, res) => {
  res.json(await partnerWallet(req.user._id))
})

/* ---------- errors + optional built frontend ---------- */

app.use((err, _req, res, _next) => {
  console.error(err)
  res.status(500).json({ error: 'Server error' })
})

const dist = fileURLToPath(new URL('../dist', import.meta.url))
if (existsSync(dist)) {
  app.use(express.static(dist))
}

const database = await connect()
app.listen(env.PORT, () => {
  console.log(`API ready on http://localhost:${env.PORT} (database: ${database})`)
  console.log(`admin login: ${env.ADMIN_EMAIL}`)
})
