// quick connectivity check - run with: npm run check
import dns from 'node:dns'
import { MongoClient } from 'mongodb'
import { env } from './env.js'

// Windows + Node c-ares can refuse SRV lookups against the local resolver,
// so we point Node at public DNS servers before connecting.
dns.setServers(['8.8.8.8', '1.1.1.1'])

const client = new MongoClient(env.MONGODB_URI, { serverSelectionTimeoutMS: 20000 })
try {
  await client.connect()
  const db = client.db(env.MONGODB_DB)
  await db.command({ ping: 1 })
  console.log('CONNECTED ok, database:', db.databaseName)
  const collections = await db.listCollections().toArray()
  console.log('collections:', collections.map((c) => c.name).join(', ') || '(none)')
} catch (error) {
  console.log('FAILED:', error.message)
} finally {
  await client.close()
}
