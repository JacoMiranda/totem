import { useEffect, useState, type ReactNode } from 'react';
import { SetupScreen } from './components/SetupScreen';
import { BarraDev } from './components/BarraDev';
import { ConfirmarModal } from './components/ConfirmarModal';
import { ErrorBoundary } from './components/ErrorBoundary';
import { PainelSuporte } from './components/PainelSuporte';
import { getDeviceConfig } from '../shared/deviceConfig';
import { IA_LOCAL_APENAS } from './lib/ia';
import { precarregarVosk } from './lib/offline/vosk';
import { iniciarSincronizacaoEmSegundoPlano } from './lib/sync';
import { useInatividade } from './lib/useInatividade';
import { pararFala } from './lib/vozKiosk';
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
 *
 * Envolto por: `PainelSuporte` (escotilha de manutenção por trás de PIN),
 * `ErrorBoundary` (tela branca nunca, num totem em quiosque) e reset por
 * inatividade (o relato de uma pessoa não fica na tela pra próxima).
 */
function App() {
  const [configurado, setConfigurado] = useState(() => Boolean(getDeviceConfig()));
  const etapa = useJourneyStore((s) => s.etapa);
  const reiniciar = useJourneyStore((s) => s.reiniciar);

  useEffect(() => {
    if (!configurado) return undefined;

    // Carrega o modelo de transcrição offline (Vosk, ~32 MB). Em modo
    // IA_LOCAL_APENAS ele é o mecanismo principal, então carrega sempre;
    // senão, só quando há conexão (pra cachear pro uso offline futuro).
    // Silencioso: falhar aqui não afeta a jornada.
    if (IA_LOCAL_APENAS || navigator.onLine) void precarregarVosk();

    return iniciarSincronizacaoEmSegundoPlano();
  }, [configurado]);

  const jornadaAtiva = configurado && etapa !== 'inicio';

  const { avisando, segundos, continuar } = useInatividade({
    // Conclusão volta sozinha mais rápido (protocolo/PIN não devem ficar na
    // tela); nas telas de preenchimento, mais folga pra quem digita devagar.
    timeoutMs: etapa === 'conclusao' ? 30_000 : 90_000,
    avisoMs: 15_000,
    onTimeout: () => {
      pararFala();
      reiniciar();
    },
    ativo: jornadaAtiva,
  });

  let conteudo: ReactNode;
  if (!configurado) {
    conteudo = <SetupScreen onConcluido={() => setConfigurado(true)} />;
  } else {
    switch (etapa) {
      case 'relato':
        conteudo = <Relato />;
        break;
      case 'classificacao':
        conteudo = <Classificacao />;
        break;
      case 'conclusao':
        conteudo = <Conclusao />;
        break;
      default:
        conteudo = <Inicio />;
    }
  }

  return (
    <>
      <PainelSuporte />
      <ErrorBoundary>{conteudo}</ErrorBoundary>

      {avisando && (
        <ConfirmarModal
          titulo="Ainda está aí?"
          descricao={`Sem resposta, o atendimento volta ao início em ${segundos}s.`}
          confirmarLabel="Continuar"
          cancelarLabel="Encerrar agora"
          onConfirmar={continuar}
          onCancelar={() => {
            pararFala();
            reiniciar();
          }}
        />
      )}

      <BarraDev />
    </>
  );
}

export default App;
