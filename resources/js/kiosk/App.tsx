import { useEffect, useState } from 'react';
import { SetupScreen } from './components/SetupScreen';
import { getDeviceConfig } from './lib/deviceConfig';
import { iniciarSincronizacaoEmSegundoPlano } from './lib/sync';
import { useJourneyStore } from './store/journeyStore';
import { Classificacao } from './steps/Classificacao';
import { Conclusao } from './steps/Conclusao';
import { Inicio } from './steps/Inicio';
import { Relato } from './steps/Relato';

/**
 * Jornada do cidadão (Início -> Relato -> Classificação -> Conclusão) -
 * ver docs/MIGRACAO-DO-PROTOTIPO.md e Fase 3 do roteiro adaptado
 * (CLAUDE.md/plano de sessão). Antes da jornada, exige a configuração de
 * dispositivo (device key) uma única vez por totem físico.
 */
function App() {
  const [configurado, setConfigurado] = useState(() => Boolean(getDeviceConfig()));
  const etapa = useJourneyStore((s) => s.etapa);

  useEffect(() => {
    if (!configurado) return undefined;

    return iniciarSincronizacaoEmSegundoPlano();
  }, [configurado]);

  if (!configurado) {
    return <SetupScreen onConcluido={() => setConfigurado(true)} />;
  }

  switch (etapa) {
    case 'relato':
      return <Relato />;
    case 'classificacao':
      return <Classificacao />;
    case 'conclusao':
      return <Conclusao />;
    default:
      return <Inicio />;
  }
}

export default App;
