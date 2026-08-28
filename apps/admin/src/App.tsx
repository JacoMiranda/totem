import { MANIFESTATION_STATUSES } from '@totem/shared'
import './App.css'

/**
 * Placeholder da Fase 0 - só confirma que @totem/shared resolve
 * corretamente daqui. Auth + painel de verdade entram na Fase 4, ver
 * docs/PLANO-SISTEMA-PROFISSIONAL.md.
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
