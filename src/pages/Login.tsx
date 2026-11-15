import { useState } from 'react'
import { api, setToken, type SessionUser } from '../api'
import { Button, Field, Input } from '../components/ui'

export default function Login({ onLogin }: { onLogin: (user: SessionUser) => void }) {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    setError('')
    setBusy(true)
    try {
      const result = await api.login(email)
      setToken(result.token)
      onLogin(result.user)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-100 text-sm font-semibold text-zinc-900">
            C
          </div>
          <div>
            <h1 className="text-base font-semibold text-zinc-100">Commission Panel</h1>
            <p className="text-xs text-zinc-500">Admin and partners sign in here</p>
          </div>
        </div>

        <form
          className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-900/60 p-5"
          onSubmit={(e) => {
            e.preventDefault()
            submit()
          }}
        >
          <Field label="Email">
            <Input
              type="email"
              value={email}
              autoFocus
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </Field>

          {error ? <p className="text-xs text-red-400">{error}</p> : null}

          <Button type="submit" variant="primary" disabled={busy} className="w-full">
            {busy ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>

        <p className="mt-4 text-center text-xs text-zinc-600">
          No password needed — only emails added by the admin can sign in. Admin:{' '}
          ankurjhattipur@gmail.com
        </p>
      </div>
    </div>
  )
}
