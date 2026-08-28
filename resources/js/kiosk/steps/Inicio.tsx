import { useState } from 'react';
import { api } from '../lib/api';
import { useJourneyStore } from '../store/journeyStore';

/**
 * Etapa 1 (Início) - consentimento LGPD (obrigatório) + identificação
 * opcional (pessoa/empresa, ver RequerenteController) antes de seguir pro
 * Relato. O modo anônimo continua sendo o padrão (botão "Continuar
 * anônimo" sempre disponível, sem preencher nada).
 */
export function Inicio() {
  const { consentimentoLgpd, setConsentimento, requerente, setRequerente, irPara } = useJourneyStore();
  const [mostrarIdentificacao, setMostrarIdentificacao] = useState(false);
  const [tipo, setTipo] = useState<'person' | 'company'>('person');
  const [nome, setNome] = useState('');
  const [documento, setDocumento] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const identificar = async () => {
    setErro(null);
    setEnviando(true);
    try {
      if (tipo === 'person') {
        const { data } = await api.post('/people', { nome, cpf: documento });
        setRequerente({ type: 'person', id: data.id, label: data.nome });
      } else {
        const { data } = await api.post('/companies', { razaoSocial: nome, cnpj: documento });
        setRequerente({ type: 'company', id: data.id, label: data.razaoSocial });
      }
      setMostrarIdentificacao(false);
    } catch {
      setErro('Não foi possível confirmar os dados agora. Pode seguir anônimo e tentar se identificar depois.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-lg bg-white rounded-3xl p-8 shadow-xl flex flex-col gap-5 text-center">
        <div className="text-5xl">🏛️</div>
        <h1 className="text-2xl font-extrabold text-slate-900">Ouvidoria Cidadã</h1>
        <p className="text-sm text-slate-500">
          O seu relato ajuda a melhorar o atendimento público. Pode falar ou escrever livremente na próxima etapa.
        </p>

        {requerente ? (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm rounded-xl p-3 flex items-center justify-between">
            <span>Identificado(a) como {requerente.label}</span>
            <button type="button" className="underline text-xs" onClick={() => setRequerente(null)}>
              remover
            </button>
          </div>
        ) : mostrarIdentificacao ? (
          <div className="text-left flex flex-col gap-2 bg-slate-50 border border-slate-200 rounded-xl p-4">
            <div className="flex gap-2 text-xs font-bold">
              <button
                type="button"
                onClick={() => setTipo('person')}
                className={`flex-1 rounded-lg py-2 ${tipo === 'person' ? 'bg-blue-600 text-white' : 'bg-white border border-slate-300'}`}
              >
                Pessoa física
              </button>
              <button
                type="button"
                onClick={() => setTipo('company')}
                className={`flex-1 rounded-lg py-2 ${tipo === 'company' ? 'bg-blue-600 text-white' : 'bg-white border border-slate-300'}`}
              >
                Empresa
              </button>
            </div>
            <input
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder={tipo === 'person' ? 'Nome completo' : 'Razão social'}
              value={nome}
              onChange={(e) => setNome(e.target.value)}
            />
            <input
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder={tipo === 'person' ? 'CPF' : 'CNPJ'}
              value={documento}
              onChange={(e) => setDocumento(e.target.value)}
            />
            {erro && <p className="text-xs text-rose-600">{erro}</p>}
            <div className="flex gap-2">
              <button
                type="button"
                disabled={enviando || !nome.trim() || !documento.trim()}
                onClick={identificar}
                className="flex-1 rounded-lg bg-blue-600 text-white text-sm font-bold py-2 disabled:opacity-40"
              >
                {enviando ? 'Confirmando…' : 'Confirmar'}
              </button>
              <button
                type="button"
                onClick={() => setMostrarIdentificacao(false)}
                className="rounded-lg border border-slate-300 text-sm font-bold py-2 px-4"
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setMostrarIdentificacao(true)}
            className="text-sm text-blue-700 underline"
          >
            Desejo me identificar (opcional)
          </button>
        )}

        <label className="flex items-start gap-2 text-left text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-xl p-3">
          <input
            type="checkbox"
            checked={consentimentoLgpd}
            onChange={(e) => setConsentimento(e.target.checked)}
            className="mt-0.5"
          />
          Concordo que meu relato seja registrado para fins de melhoria do atendimento público, conforme a Lei Geral
          de Proteção de Dados (LGPD). Meus dados de identificação são opcionais e só ficam vinculados se eu optar
          por me identificar acima.
        </label>

        <button
          type="button"
          disabled={!consentimentoLgpd}
          onClick={() => irPara('relato')}
          className="w-full rounded-xl bg-blue-600 py-4 text-base font-extrabold text-white disabled:opacity-40"
        >
          Iniciar meu relato
        </button>
      </div>
    </main>
  );
}
