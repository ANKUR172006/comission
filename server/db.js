import dns from 'node:dns'
import { MongoClient } from 'mongodb'
import { env } from './env.js'

// Windows + Node can refuse SRV lookups against the local DNS resolver,
// so we point Node at public DNS servers before connecting.
dns.setServers(['8.8.8.8', '1.1.1.1'])

export const client = new MongoClient(env.MONGODB_URI, { serverSelectionTimeoutMS: 20000 })
export const db = client.db(env.MONGODB_DB)

export const users = db.collection('users')
export const clients = db.collection('clients')
/** one row per day of a client's payment checklist that the admin ticked */
export const payments = db.collection('payments')
/** commission given to a partner for a client, one time or daily */
export const commissions = db.collection('commissions')

/** "Vinit:vinit@mail.com, x@mail.com" -> [{ name, email }] */
function readSeedPartners() {
  return env.SEED_PARTNERS.split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [first, second] = entry.split(':')
      const email = (second ?? first).trim().toLowerCase()
      const name = (second ? first : email.split('@')[0]).trim()
      return { name, email }
    })
    .filter((partner) => partner.email.includes('@'))
}

export async function connect() {
  await client.connect()
  await db.command({ ping: 1 })

  await users.createIndex({ email: 1 }, { unique: true })
  await payments.createIndex({ clientId: 1, date: 1 }, { unique: true })
  await commissions.createIndex({ partnerId: 1 })
  await commissions.createIndex({ clientId: 1 })
  await commissions.createIndex({ date: -1 })

  // the admin account always follows ADMIN_EMAIL in server/.env
  await users.updateOne(
    { email: env.ADMIN_EMAIL },
    {
      $set: { role: 'admin', name: env.ADMIN_NAME, active: true },
      $setOnInsert: { createdAt: new Date() },
    },
    { upsert: true },
  )

  // login is email only, so drop any old password hashes
  await users.updateMany({ passwordHash: { $exists: true } }, { $unset: { passwordHash: '' } })

  // and remove admins that are no longer the configured admin email
  await users.deleteMany({ role: 'admin', email: { $ne: env.ADMIN_EMAIL } })

  // partners listed in .env are created once, then managed in the panel
  for (const partner of readSeedPartners()) {
    await users.updateOne(
      { email: partner.email },
      {
        $setOnInsert: {
          role: 'partner',
          name: partner.name,
          email: partner.email,
          active: true,
          createdAt: new Date(),
        },
      },
      { upsert: true },
    )
  }

  return db.databaseName
}
