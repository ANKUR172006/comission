import crypto from 'node:crypto'
import { ObjectId } from 'mongodb'
import { env } from './env.js'
import { users } from './db.js'

/* ---------- tokens (HMAC signed, 7 day life) ---------- */

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

function sign(value) {
  return crypto.createHmac('sha256', env.TOKEN_SECRET).update(value).digest('base64url')
}

export function createToken(user) {
  const body = Buffer.from(
    JSON.stringify({ uid: String(user._id), exp: Date.now() + WEEK_MS }),
  ).toString('base64url')
  return `${body}.${sign(body)}`
}

function readToken(token) {
  if (typeof token !== 'string' || !token.includes('.')) return null
  const [body, signature] = token.split('.')
  const expected = sign(body)
  if (
    signature.length !== expected.length ||
    !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  ) {
    return null
  }
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString())
    return payload.exp > Date.now() ? payload : null
  } catch {
    return null
  }
}

/* ---------- middlewares ---------- */

export function publicUser(user) {
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    role: user.role,
  }
}

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  const payload = readToken(token)
  if (!payload) return res.status(401).json({ error: 'Not signed in' })

  let user = null
  try {
    user = await users.findOne({ _id: new ObjectId(payload.uid) })
  } catch {
    user = null
  }
  if (!user || !user.active) return res.status(401).json({ error: 'Account not available' })

  req.user = user
  next()
}

export function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' })
  next()
}
