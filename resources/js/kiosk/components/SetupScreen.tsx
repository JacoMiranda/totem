import { useState } from 'react';
import { setDeviceConfig } from '../lib/deviceConfig';

/**
 * Tela de provisionamento do totem - roda UMA VEZ por máquina física
 * (ver docs/PLANO-SISTEMA-PROFISSIONAL.md, "kiosk/ scripts de
 * provisionamento"). Quem preenche é a equipe técnica na instalação do
 * totem, não o cidadão - a device key é gerada uma única vez em
 * POST /devices (painel admin) e colada aqui manualmente.
 */
export function SetupScreen({ onConcluido }: { onConcluido: () => void }) {
  const [codigo, setCodigo] = useState('');
  const [nome, setNome] = useState('');
  const [deviceKey, setDeviceKeyInput] = useState('');

  const podeSalvar = codigo.trim() && nome.trim() && deviceKey.trim();

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-900 p-6">
      <div className="w-full max-w-md bg-white rounded-3xl p-8 shadow-2xl flex flex-col gap-4">
        <h1 className="text-xl font-extrabold text-slate-900">Configuração do Totem</h1>
        <p className="text-sm text-slate-500">
          Preenchimento único, feito pela equipe técnica na instalação. O cidadão nunca vê esta tela depois de
          configurada.
        </p>

        <label className="text-xs font-bold text-slate-600 uppercase tracking-wide">
          Código do dispositivo
          <input
            className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            placeholder="TOTEM-CENTRO-01"
          />
        </label>

        <label className="text-xs font-bold text-slate-600 uppercase tracking-wide">
          Nome/local
          <input
            className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Totem - Recepção Central"
          />
        </label>

        <label className="text-xs font-bold text-slate-600 uppercase tracking-wide">
          Device key
          <input
            className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-mono"
            type="password"
            value={deviceKey}
            onChange={(e) => setDeviceKeyInput(e.target.value)}
            placeholder="gerada em Dispositivos (painel admin)"
          />
        </label>

        <button
          type="button"
          disabled={!podeSalvar}
          onClick={() => {
            setDeviceConfig({ codigo: codigo.trim(), nome: nome.trim(), deviceKey: deviceKey.trim() });
            onConcluido();
          }}
          className="mt-2 w-full rounded-xl bg-blue-600 py-3 text-sm font-bold text-white disabled:opacity-40"
        >
          Salvar e iniciar atendimento
        </button>
      </div>
    </main>
  );
}
