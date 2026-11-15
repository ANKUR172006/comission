import { useEffect, useState } from 'react'
import { api, clearToken, getToken, type SessionUser } from './api'
import Login from './pages/Login'
import AdminApp from './pages/AdminApp'
import PartnerPortal from './pages/PartnerPortal'

export default function App() {
  const [user, setUser] = useState<SessionUser | null>(null)
  const [checking, setChecking] = useState(true)

  // restore the session from the saved token on first load
  useEffect(() => {
    if (!getToken()) {
      setChecking(false)
      return
    }
    api
      .me()
      .then((result) => setUser(result.user))
      .catch(() => clearToken())
      .finally(() => setChecking(false))
  }, [])

  const logout = () => {
    clearToken()
    setUser(null)
  }

  if (checking) {
    return <div className="p-10 text-sm text-zinc-500">Loading…</div>
  }

  if (!user) return <Login onLogin={setUser} />

  if (user.role === 'admin') return <AdminApp user={user} onLogout={logout} />

  return <PartnerPortal user={user} onLogout={logout} />
}
