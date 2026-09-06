import { useState } from 'react';
import { setDeviceConfig } from '../lib/deviceConfig';
import {
  entrar,
  listarDevicesPareaveis,
  mensagemErro,
  parearDevice,
  sairPareamento,
  type DevicePareavel,
  type UsuarioPareamento,
} from '../lib/pareamentoApi';

/**
 * Primeira tela do totem: LOGIN da equipe do cliente + escolha de qual
 * totem esta máquina vai ser. Roda uma vez por máquina física - depois o
 * cidadão nunca mais vê isto (a config fica no localStorage).
 *
 * Substitui a versão anterior, que pedia pra colar uma device key de 48
 * caracteres à mão. Aqui a chave é emitida pelo servidor no momento do
 * pareamento (POST /devices/{id}/pair) e o token de equipe é descartado
 * logo em seguida - ver pareamentoApi.ts.
 */
export function SetupScreen({ onConcluido }: { onConcluido: () => void }) {
  const [usuario, setUsuario] = useState<UsuarioPareamento | null>(null);
  const [devices, setDevices] = useState<DevicePareavel[]>([]);
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const fazerLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    setOcupado(true);
    try {
      const u = await entrar(email.trim(), senha);
      setUsuario(u);
      setDevices(await listarDevicesPareaveis());
    } catch (err) {
      setErro(mensagemErro(err, 'Não foi possível entrar. Confira e-mail e senha.'));
    } finally {
      setOcupado(false);
    }
  };

  const escolher = async (device: DevicePareavel) => {
    setErro(null);
    setOcupado(true);
    try {
      const { codigo, nome, deviceKey } = await parearDevice(device.id);
      setDeviceConfig({ codigo, nome, deviceKey });
      await sairPareamento(); // não deixa credencial de equipe no totem
      onConcluido();
    } catch (err) {
      setErro(mensagemErro(err, 'Não foi possível parear este totem.'));
      setOcupado(false);
    }
  };

  const trocarConta = async () => {
    await sairPareamento();
    setUsuario(null);
    setDevices([]);
    setSenha('');
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-900 p-6">
      <div className="w-full max-w-lg bg-white rounded-3xl p-8 shadow-2xl flex flex-col gap-5">
        <header className="text-center">
          <div className="text-4xl">🏛️</div>
          <h1 className="text-xl font-extrabold text-slate-900 mt-2">Configuração do Totem</h1>
          <p className="text-sm text-slate-500">
            {usuario
              ? 'Escolha qual totem esta tela vai ser.'
              : 'Entre com a sua conta para ver os totens contratados.'}
          </p>
        </header>

        {erro && (
          <p className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-3">{erro}</p>
        )}

        {!usuario ? (
          <form onSubmit={fazerLogin} className="flex flex-col gap-3">
            <label className="text-xs font-bold text-slate-600 uppercase tracking-wide">
              E-mail
              <input
                type="email"
                autoComplete="username"
                required
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@orgao.gov.br"
              />
            </label>

            <label className="text-xs font-bold text-slate-600 uppercase tracking-wide">
              Senha
              <input
                type="password"
                autoComplete="current-password"
                required
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
              />
            </label>

            <button
              type="submit"
              disabled={ocupado || !email.trim() || !senha}
              className="mt-1 w-full rounded-xl bg-blue-600 py-3.5 text-sm font-extrabold text-white disabled:opacity-40"
            >
              {ocupado ? 'A entrar…' : 'Entrar'}
            </button>
          </form>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>
                Conectado como <strong className="text-slate-700">{usuario.name}</strong>
              </span>
              <button type="button" onClick={trocarConta} className="underline hover:text-slate-700">
                trocar conta
              </button>
            </div>

            {devices.length === 0 ? (
              <p className="text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-xl p-4">
                Nenhum totem liberado para a sua conta ainda. Fale com o administrador para liberar os
                dispositivos do seu pacote.
              </p>
            ) : (
              <ul className="flex flex-col gap-2 max-h-80 overflow-y-auto">
                {devices.map((d) => (
                  <li key={d.id}>
                    <button
                      type="button"
                      disabled={ocupado || !d.ativo}
                      onClick={() => escolher(d)}
                      className="w-full text-left rounded-2xl border-2 border-slate-200 hover:border-blue-500 hover:bg-blue-50/60 p-4 transition-all disabled:opacity-40 disabled:hover:border-slate-200 disabled:hover:bg-transparent"
                    >
                      <span className="block text-sm font-extrabold text-slate-900">{d.nome}</span>
                      <span className="block text-xs text-slate-500">
                        {d.codigo}
                        {d.unidade ? ` · ${d.unidade}` : ''}
                      </span>
                      <span className="block text-[11px] mt-1 text-slate-400">
                        {!d.ativo
                          ? 'desativado'
                          : d.ultimaSyncEm
                            ? `última sincronização: ${new Date(d.ultimaSyncEm).toLocaleString('pt-BR')}`
                            : 'nunca usado'}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <p className="text-[11px] text-slate-400">
              Ao escolher, esta máquina passa a ser aquele totem. Se o mesmo totem já estiver em outra
              máquina, a outra é desconectada.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
