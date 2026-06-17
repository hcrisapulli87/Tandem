import { useState } from 'react'
import type { FormEvent } from 'react'
import { useAuth } from '../auth/AuthProvider'

type Step = 'email' | 'code'
type Status = 'idle' | 'working' | 'error'

export default function Login() {
  const { sendCode, verifyCode } = useAuth()
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  const onEmailSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setStatus('working')
    setErrorMsg('')
    try {
      await sendCode(email.trim())
      setStep('code')
      setStatus('idle')
    } catch (err) {
      setErrorMsg(messageFor(err))
      setStatus('error')
    }
  }

  const onCodeSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setStatus('working')
    setErrorMsg('')
    try {
      // On success, onAuthStateChange flips the app to the signed-in view.
      await verifyCode(email.trim(), code.trim())
    } catch (err) {
      setErrorMsg(messageFor(err))
      setStatus('error')
    }
  }

  if (step === 'code') {
    return (
      <main className="screen screen--center">
        <h1 className="brand">Tandem</h1>
        <p className="muted">
          Enter the 6-digit code we emailed to <strong>{email}</strong>.
        </p>
        <form className="login-form" onSubmit={onCodeSubmit}>
          <input
            className="input code-input"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={6}
            placeholder="123456"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            required
            autoFocus
          />
          <button
            className="btn btn--primary"
            type="submit"
            disabled={status === 'working' || code.length < 6}
          >
            {status === 'working' ? 'Verifying…' : 'Verify & sign in'}
          </button>
          {status === 'error' && <p className="error">{errorMsg}</p>}
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() => {
              setStep('email')
              setCode('')
              setStatus('idle')
              setErrorMsg('')
            }}
          >
            Use a different email
          </button>
        </form>
      </main>
    )
  }

  return (
    <main className="screen screen--center">
      <h1 className="brand">Tandem</h1>
      <p className="muted">Two-person accountability, in sync.</p>
      <form className="login-form" onSubmit={onEmailSubmit}>
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
        <button className="btn btn--primary" type="submit" disabled={status === 'working'}>
          {status === 'working' ? 'Sending…' : 'Email me a code'}
        </button>
        {status === 'error' && <p className="error">{errorMsg}</p>}
      </form>
    </main>
  )
}

function messageFor(err: unknown): string {
  const msg = err instanceof Error ? err.message : 'Something went wrong'
  if (/rate limit/i.test(msg)) return 'Too many emails for now — wait a few minutes and try again.'
  if (/invalid|expired|token/i.test(msg))
    return 'That code didn’t match or has expired. Check the newest email or resend.'
  if (/signups? not allowed|not authorized|not allowed/i.test(msg))
    return 'That email isn’t set up for this app yet.'
  return msg
}
