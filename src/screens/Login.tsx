import { useState } from 'react'
import type { FormEvent } from 'react'
import { useAuth } from '../auth/AuthProvider'

type Status = 'idle' | 'sending' | 'sent' | 'error'

export default function Login() {
  const { signInWithMagicLink } = useAuth()
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setStatus('sending')
    setErrorMsg('')
    try {
      await signInWithMagicLink(email.trim())
      setStatus('sent')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong')
      setStatus('error')
    }
  }

  if (status === 'sent') {
    return (
      <main className="screen screen--center">
        <h1 className="brand">Tandem</h1>
        <p>
          Check your inbox — a magic link is on its way to <strong>{email}</strong>.
        </p>
        <p className="muted">Open it on this device to sign in.</p>
      </main>
    )
  }

  return (
    <main className="screen screen--center">
      <h1 className="brand">Tandem</h1>
      <p className="muted">Two-person accountability, in sync.</p>
      <form className="login-form" onSubmit={onSubmit}>
        <input
          className="input"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <button className="btn btn--primary" type="submit" disabled={status === 'sending'}>
          {status === 'sending' ? 'Sending…' : 'Send magic link'}
        </button>
        {status === 'error' && <p className="error">{errorMsg}</p>}
      </form>
    </main>
  )
}
