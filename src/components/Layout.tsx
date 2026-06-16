import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'

const linkClass = ({ isActive }: { isActive: boolean }) =>
  isActive ? 'navlink navlink--active' : 'navlink'

export function Layout() {
  const { signOut } = useAuth()
  return (
    <div className="app">
      <header className="appbar">
        <span className="appbar__brand">Tandem</span>
        <nav className="appbar__nav">
          <NavLink to="/" end className={linkClass}>
            Today
          </NavLink>
          <NavLink to="/list" className={linkClass}>
            My List
          </NavLink>
        </nav>
        <button className="btn btn--ghost btn--sm" onClick={() => void signOut()}>
          Sign out
        </button>
      </header>
      <main className="screen">
        <Outlet />
      </main>
    </div>
  )
}
