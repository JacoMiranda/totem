import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { setDeviceConfig } from '../../shared/deviceConfig';

interface Dispositivo {
  id: string;
  codigo: string;
  nome: string;
  unidade: string | null;
  ativo: boolean;
  organizacao: { id: string; nome: string } | null;
  ultimaSyncEm: string | null;
  versaoApp: string | null;
}

interface OrgOpcao {
  id: string;
  nome: string;
}

export function Devices() {
  const [dispositivos, setDispositivos] = useState<Dispositivo[]>([]);
  const [plataforma, setPlataforma] = useState(false);
  const [orgs, setOrgs] = useState<OrgOpcao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [q, setQ] = useState('');
  const [orgFiltro, setOrgFiltro] = useState('');
  const [novoCodigo, setNovoCodigo] = useState('');
  const [novoNome, setNovoNome] = useState('');
  const [novoOrg, setNovoOrg] = useState('');
  const [chaveRevelada, setChaveRevelada] = useState<{ codigo: string; chave: string } | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const recarregar = () => {
    setCarregando(true);
    const params: Record<string, string> = {};
    if (q) params.q = q;
    if (orgFiltro) params.organizacaoId = orgFiltro;
    api
      .get('/devices', { params })
      .then(({ data }) => {
        setDispositivos(Array.isArray(data?.dispositivos) ? data.dispositivos : []);
        setPlataforma(Boolean(data?.plataforma));
        setOrgs(Array.isArray(data?.organizacoes) ? data.organizacoes : []);
        setErro(null);
      })
      .catch(() => setErro('Não foi possível carregar os dispositivos. Recarregue a página.'))
      .finally(() => setCarregando(false));
  };

  useEffect(() => {
    const t = setTimeout(recarregar, 250);

    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, orgFiltro]);

  const criar = async () => {
    setErro(null);
    try {
      const body: Record<string, unknown> = { codigo: novoCodigo, nome: novoNome };
      if (plataforma) body.organizacaoId = novoOrg;
      const { data } = await api.post('/devices', body);
      setChaveRevelada({ codigo: novoCodigo, chave: data.deviceKey });
      setNovoCodigo('');
      setNovoNome('');
      recarregar();
    } catch {
      setErro('Não foi possível cadastrar. Confira o código (único) e a empresa.');
    }
  };

  const rotacionar = async (id: string, codigo: string) => {
    const { data } = await api.post(`/devices/${id}/rotate-key`);
    setChaveRevelada({ codigo, chave: data.deviceKey });
  };

  const abrirTotem = async (d: Dispositivo) => {
    const ok = window.confirm(
      `Abrir "${d.nome}" nesta máquina?\n\n` +
        'Este computador passa a ser esse totem e vai direto para a tela de atendimento. ' +
        'Se o totem já estiver aberto em outra máquina, aquela será desconectada.',
    );
    if (!ok) return;

    try {
      const { data } = await api.post(`/devices/${d.id}/pair`);
      setDeviceConfig({ codigo: data.codigo, nome: data.nome, deviceKey: data.deviceKey });
      window.location.href = '/atendimento';
    } catch {
      setErro('Não foi possível abrir este totem.');
    }
  };

  const alternarAtivo = async (id: string, ativo: boolean) => {
    await api.patch(`/devices/${id}`, { ativo: !ativo });
    recarregar();
  };

  const varias = useMemo(() => new Set(dispositivos.map((d) => d.organizacao?.id)).size > 1, [dispositivos]);
  const mostrarEmpresa = plataforma && varias;

  return (
    <div className={`flex flex-col gap-4 ${plataforma ? 'max-w-5xl' : 'max-w-3xl'}`}>
      <h1 className="text-xl font-extrabold text-slate-900">Dispositivos (totems)</h1>

      {erro && <p className="rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm p-3">{erro}</p>}

      {chaveRevelada && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 text-sm">
          <p className="font-bold text-amber-800">
            Device key de <span className="font-mono">{chaveRevelada.codigo}</span> - anote agora, não será mostrada de novo:
          </p>
          <p className="font-mono text-amber-900 break-all mt-1">{chaveRevelada.chave}</p>
          <button type="button" onClick={() => setChaveRevelada(null)} className="text-xs underline mt-2">
            Fechar
          </button>
        </div>
      )}

      {(plataforma || dispositivos.length > 8) && (
        <div className="flex flex-wrap gap-2 bg-white border border-slate-200 rounded-xl p-3">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={plataforma ? 'Buscar por código, nome ou empresa…' : 'Buscar…'}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm flex-1 min-w-48"
          />
          {plataforma && (
            <select value={orgFiltro} onChange={(e) => setOrgFiltro(e.target.value)} className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm">
              <option value="">Todas as empresas</option>
              {orgs.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.nome}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap gap-2 items-end">
        {plataforma && (
          <label className="text-xs font-bold text-slate-500 flex-1 min-w-40">
            Empresa
            <select value={novoOrg} onChange={(e) => setNovoOrg(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm">
              <option value="">escolher…</option>
              {orgs.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.nome}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="text-xs font-bold text-slate-500 flex-1 min-w-32">
          Código
          <input value={novoCodigo} onChange={(e) => setNovoCodigo(e.target.value)} placeholder="TOTEM-CENTRO-01" className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
        </label>
        <label className="text-xs font-bold text-slate-500 flex-1 min-w-32">
          Nome/local
          <input value={novoNome} onChange={(e) => setNovoNome(e.target.value)} placeholder="Recepção Central" className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
        </label>
        <button
          type="button"
          disabled={!novoCodigo.trim() || !novoNome.trim() || (plataforma && !novoOrg)}
          onClick={criar}
          className="rounded-lg bg-blue-600 text-white text-sm font-bold px-4 py-1.5 disabled:opacity-40"
        >
          Cadastrar
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs font-bold uppercase text-slate-500">
            <tr>
              {mostrarEmpresa && <th className="p-3">Empresa</th>}
              <th className="p-3">Código</th>
              <th className="p-3">Nome</th>
              <th className="p-3">Ativo</th>
              <th className="p-3">Última sync</th>
              <th className="p-3">Ações</th>
            </tr>
          </thead>
          <tbody>
            {dispositivos.map((d) => (
              <tr key={d.id} className="border-t border-slate-100">
                {mostrarEmpresa && <td className="p-3 text-xs font-semibold text-slate-600">{d.organizacao?.nome ?? '—'}</td>}
                <td className="p-3 font-mono">{d.codigo}</td>
                <td className="p-3">{d.nome}</td>
                <td className="p-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${d.ativo ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'}`}>
                    {d.ativo ? 'ativo' : 'inativo'}
                  </span>
                </td>
                <td className="p-3 text-xs text-slate-500">{d.ultimaSyncEm ? new Date(d.ultimaSyncEm).toLocaleString('pt-BR') : 'nunca'}</td>
                <td className="p-3 flex gap-2 items-center">
                  <button
                    type="button"
                    disabled={!d.ativo}
                    onClick={() => abrirTotem(d)}
                    className="rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3 py-1.5 disabled:opacity-40 transition-colors"
                  >
                    Abrir totem
                  </button>
                  <button type="button" onClick={() => rotacionar(d.id, d.codigo)} className="text-xs text-blue-700 underline">
                    Nova chave
                  </button>
                  <button type="button" onClick={() => alternarAtivo(d.id, d.ativo)} className="text-xs text-rose-600 underline">
                    {d.ativo ? 'Desativar' : 'Ativar'}
                  </button>
                </td>
              </tr>
            ))}
            {!carregando && dispositivos.length === 0 && (
              <tr>
                <td colSpan={mostrarEmpresa ? 6 : 5} className="p-6 text-center text-slate-400">
                  Nenhum dispositivo encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-400">{dispositivos.length} totens</p>
    </div>
  );
}
