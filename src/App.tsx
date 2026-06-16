// App shell. Routing + auth gating are wired in once those pieces land;
// for now this renders a minimal placeholder so the scaffold is verifiable.
export default function App() {
  return (
    <main className="screen screen--center">
      <h1 className="brand">Tandem</h1>
      <p className="muted">Two-person accountability, in sync.</p>
    </main>
  )
}
