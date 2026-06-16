import { Routes, Route } from 'react-router-dom'
import { useAuth } from './auth/AuthProvider'
import { DataProvider } from './data/DataProvider'
import { Layout } from './components/Layout'
import Login from './screens/Login'
import Today from './screens/Today'
import MyList from './screens/MyList'

// Top-level gate: unauthenticated → Login; authenticated → the app (wrapped in
// DataProvider so Today and My List share one live data source).
export default function App() {
  const { loading, session } = useAuth()

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
    <DataProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Today />} />
          <Route path="/list" element={<MyList />} />
        </Route>
      </Routes>
    </DataProvider>
  )
}
