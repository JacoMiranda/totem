import { useEffect, useRef, useState } from 'react';
import { clearDeviceConfig, getDeviceConfig } from '../../shared/deviceConfig';
import db from '../lib/db';
import { drenarFila } from '../lib/sync';
import { diagnosticoNavegador, navegadorDetectado } from '../lib/diagnostico';
import { pararFala } from '../lib/vozKiosk';
import { useJourneyStore } from '../store/journeyStore';
import { ConfirmarModal } from './ConfirmarModal';

/**
 * Escotilha de manutenção do totem. Num totem em tela cheia / modo quiosque
 * o cidadão não deve conseguir sair - mas o SUPORTE precisa. Isto NÃO
 * substitui o travamento do sistema operacional (Chrome --kiosk, Fully
 * Kiosk, Assigned Access - ver docs/MODO-QUIOSQUE.md); é a camada do app
 * pros casos moles: sair da tela cheia, recarregar, abrir a administração
 * (ex.: pareou o totem errado), re-parear, ver diagnóstico, esvaziar a
 * fila local presa.
 *
 * Ativação: segurar 3s o canto INFERIOR DIREITO (área invisível) -> PIN.
 * (Os cantos de cima têm os botões Voltar/Cancelar da BarraJornada.)
 * O PIN vem de VITE_SUPORTE_PIN no build do totem (default '0000' - TROCAR).
 */
const PIN_SUPORTE = String(import.meta.env.VITE_SUPORTE_PIN ?? '0000');
const SEGURAR_MS = 3000;

type Tela = 'fechado' | 'pin' | 'painel';

export function PainelSuporte() {
  const [tela, setTela] = useState<Tela>('fechado');
  const [pin, setPin] = useState('');
  const [erroPin, setErroPin] = useState(false);
  const [confirmando, setConfirmando] = useState<null | 'reparear' | 'fila'>(null);
  const [diag, setDiag] = useState<string>('');
  const segurar = useRef<number | undefined>(undefined);
  const { reiniciar } = useJourneyStore();

  const iniciarSegurar = () => {
    segurar.current = window.setTimeout(() => {
      setPin('');
      setErroPin(false);
      setTela('pin');
    }, SEGURAR_MS);
  };
  const cancelarSegurar = () => window.clearTimeout(segurar.current);

  useEffect(() => {
    if (tela !== 'painel') return;
    (async () => {
      const itens = await db.fila.toArray();
      const cont = itens.reduce<Record<string, number>>((acc, i) => {
        acc[i.status] = (acc[i.status] ?? 0) + 1;

        return acc;
      }, {});
      const cfg = getDeviceConfig();
      setDiag(
        [
          `Totem: ${cfg?.nome ?? '—'} (${cfg?.codigo ?? '—'})`,
          `Navegador: ${navegadorDetectado()}`,
          diagnosticoNavegador(),
          `Conexão: ${navigator.onLine ? 'online' : 'offline'}`,
          `Fila local: ${itens.length ? JSON.stringify(cont) : 'vazia'}`,
        ].join('\n'),
      );
    })();
  }, [tela]);

  const digitar = (d: string) => {
    const novo = (pin + d).slice(0, 8);
    setPin(novo);
    setErroPin(false);
    if (novo.length >= PIN_SUPORTE.length) {
      if (novo === PIN_SUPORTE) {
        setTela('painel');
      } else {
        setErroPin(true);
        setPin('');
      }
    }
  };

  const fechar = () => {
    setTela('fechado');
    setPin('');
    setConfirmando(null);
  };

  return (
    <>
      {/* Gatilho invisível - canto inferior direito */}
      <div
        onPointerDown={iniciarSegurar}
        onPointerUp={cancelarSegurar}
        onPointerLeave={cancelarSegurar}
        onPointerCancel={cancelarSegurar}
        className="fixed bottom-0 right-0 z-40 h-14 w-14"
        aria-hidden="true"
      />

      {tela === 'pin' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-6">
          <div className="w-full max-w-xs rounded-3xl bg-white p-6 shadow-2xl flex flex-col gap-4">
            <p className="text-center text-sm font-bold text-slate-700">Código de suporte</p>
            <div className="text-center text-2xl font-mono tracking-widest text-slate-900 min-h-8">
              {'•'.repeat(pin.length)}
            </div>
            {erroPin && <p className="text-center text-xs text-rose-600">Código incorreto.</p>}
            <div className="grid grid-cols-3 gap-2">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => digitar(d)}
                  className="rounded-xl bg-slate-100 py-4 text-xl font-bold text-slate-800 hover:bg-slate-200"
                >
                  {d}
                </button>
              ))}
              <button
                type="button"
                onClick={fechar}
                className="rounded-xl bg-slate-100 py-4 text-sm font-bold text-slate-500 hover:bg-slate-200"
              >
                sair
              </button>
              <button
                type="button"
                onClick={() => digitar('0')}
                className="rounded-xl bg-slate-100 py-4 text-xl font-bold text-slate-800 hover:bg-slate-200"
              >
                0
              </button>
              <button
                type="button"
                onClick={() => setPin(pin.slice(0, -1))}
                className="rounded-xl bg-slate-100 py-4 text-xl font-bold text-slate-800 hover:bg-slate-200"
              >
                ⌫
              </button>
            </div>
          </div>
        </div>
      )}

      {tela === 'painel' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-6">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-extrabold text-slate-900">Manutenção do totem</h3>
              <button type="button" onClick={fechar} className="text-sm font-bold text-slate-500">
                fechar
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <BotaoPainel onClick={() => void document.exitFullscreen?.().catch(() => {})}>
                Sair da tela cheia
              </BotaoPainel>
              <BotaoPainel onClick={() => window.location.reload()}>Recarregar</BotaoPainel>
              <BotaoPainel
                onClick={() => {
                  pararFala();
                  reiniciar();
                  fechar();
                }}
              >
                Voltar ao início
              </BotaoPainel>
              <BotaoPainel onClick={() => void drenarFila()}>Forçar sincronização</BotaoPainel>
              <BotaoPainel onClick={() => (window.location.href = '/admin')}>Abrir administração</BotaoPainel>
              <BotaoPainel onClick={() => setConfirmando('fila')} perigo>
                Esvaziar fila local
              </BotaoPainel>
              <BotaoPainel onClick={() => setConfirmando('reparear')} perigo>
                Trocar / re-parear totem
              </BotaoPainel>
            </div>

            <pre className="mt-1 max-h-48 overflow-auto rounded-xl bg-slate-900 p-3 text-[11px] leading-relaxed text-slate-100 whitespace-pre-wrap select-all">
              {diag}
            </pre>
          </div>
        </div>
      )}

      {confirmando === 'fila' && (
        <ConfirmarModal
          titulo="Esvaziar a fila local?"
          descricao="Apaga manifestações que ainda não sincronizaram com o servidor. Use só se orientado pelo suporte."
          confirmarLabel="Esvaziar"
          perigo
          onConfirmar={async () => {
            await db.fila.clear();
            setConfirmando(null);
          }}
          onCancelar={() => setConfirmando(null)}
        />
      )}

      {confirmando === 'reparear' && (
        <ConfirmarModal
          titulo="Re-parear este totem?"
          descricao="Remove a configuração do dispositivo. Será preciso entrar e escolher o totem de novo."
          confirmarLabel="Re-parear"
          perigo
          onConfirmar={() => {
            clearDeviceConfig();
            window.location.reload();
          }}
          onCancelar={() => setConfirmando(null)}
        />
      )}
    </>
  );
}

function BotaoPainel({
  children,
  onClick,
  perigo = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  perigo?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl px-3 py-3 text-sm font-bold ${
        perigo ? 'bg-rose-50 text-rose-700 hover:bg-rose-100' : 'bg-slate-100 text-slate-800 hover:bg-slate-200'
      }`}
    >
      {children}
    </button>
  );
}
