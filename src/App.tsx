import { useAuth } from './auth/AuthProvider'
import Login from './screens/Login'

// Top-level gate: unauthenticated → Login; authenticated → the app.
// The authed routes (Today / My List) are wired in as those screens land.
export default function App() {
  const { loading, session, signOut } = useAuth()

  if (loading) {
    return (
      <main className="screen screen--center">
        <p className="muted">Loading…</p>
      </main>
    )
  }

  if (!session) {
    return <Login />
  }

  return (
    <main className="screen screen--center">
      <h1 className="brand">Tandem</h1>
      <p className="muted">Signed in as {session.user.email}</p>
      <p className="muted">Today screen coming up next.</p>
      <button className="btn btn--ghost" onClick={() => void signOut()}>
        Sign out
      </button>
    </main>
  )
}
