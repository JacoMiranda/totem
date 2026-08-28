import { SENTIMENTS, getSentimentEmoji } from '@totem/shared'
import './App.css'

/**
 * Placeholder da Fase 0 - só confirma que @totem/shared resolve
 * corretamente daqui. A jornada de verdade (Início -> Relato ->
 * Classificação -> Conclusão -> Arquivo) entra na Fase 3, ver
 * docs/MIGRACAO-DO-PROTOTIPO.md.
 */
function App() {
  return (
    <main style={{ padding: '2rem', textAlign: 'center' }}>
      <h1>Totem — Ouvidoria Cidadã (kiosk)</h1>
      <p>Fase 0: fundação. A jornada do cidadão entra na Fase 3.</p>
      <p>
        {SENTIMENTS.map((s) => (
          <span key={s} title={s} style={{ fontSize: '2rem', margin: '0 0.5rem' }}>
            {getSentimentEmoji(s)}
          </span>
        ))}
      </p>
    </main>
  )
}

export default App
