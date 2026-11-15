import { readFileSync } from 'node:fs'

/** Reads server/.env into a plain object. No dependency needed for that. */
function readEnvFile() {
  try {
    const raw = readFileSync(new URL('./.env', import.meta.url), 'utf8')
    return Object.fromEntries(
      raw
        .split('\n')
        .filter((line) => line.trim() && !line.trim().startsWith('#') && line.includes('='))
        .map((line) => {
          const i = line.indexOf('=')
          return [line.slice(0, i).trim(), line.slice(i + 1).trim()]
        }),
    )
  } catch {
    return {}
  }
}

const file = readEnvFile()
const pick = (key, fallback) => process.env[key] ?? file[key] ?? fallback

export const env = {
  MONGODB_URI: pick('MONGODB_URI', ''),
  MONGODB_DB: pick('MONGODB_DB', 'commission'),
  PORT: Number(pick('PORT', '4000')),
  TOKEN_SECRET: pick('TOKEN_SECRET', 'dev-secret'),
  ADMIN_NAME: pick('ADMIN_NAME', 'Admin'),
  ADMIN_EMAIL: pick('ADMIN_EMAIL', '').toLowerCase(),
  SEED_PARTNERS: pick('SEED_PARTNERS', ''),
}

if (!env.MONGODB_URI) {
  console.error('MONGODB_URI missing. Add it to server/.env')
  process.exit(1)
}

if (!env.ADMIN_EMAIL) {
  console.error('ADMIN_EMAIL missing. Add it to server/.env')
  process.exit(1)
}
