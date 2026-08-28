import { MANIFESTATION_STATUSES } from '../shared'

/**
 * Placeholder da Fase 0 - projeto único (import relativo pro shared, não
 * pacote npm separado). Auth + painel de verdade entram na Fase 4.
 */
function App() {
  return (
    <main style={{ padding: '2rem', textAlign: 'center' }}>
      <h1>Totem — Painel Administrativo</h1>
      <p>Fase 0: fundação. Auth + gestão de manifestações entram na Fase 4.</p>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {MANIFESTATION_STATUSES.map((status) => (
          <li key={status}>{status}</li>
        ))}
      </ul>
    </main>
  )
}

export default App
