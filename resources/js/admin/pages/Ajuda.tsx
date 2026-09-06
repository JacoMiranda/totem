import { useMemo, useState } from 'react';
import { temPapelMinimo, useAuthStore } from '../lib/authStore';
import { type Artigo, type Bloco, ARTIGOS } from '../ajuda/artigos';

/**
 * Central de Ajuda (/admin/ajuda). Conteúdo estático (ver ajuda/artigos.ts),
 * com busca. Dois públicos: "Usar o painel" (todos os papéis) e "Operação e
 * suporte técnico" (só admin).
 */
type Aba = 'equipe' | 'tecnico';

export function Ajuda() {
  const { user } = useAuthStore();
  const podeTecnico = temPapelMinimo(user?.role, 'admin');
  const [aba, setAba] = useState<Aba>('equipe');
  const [q, setQ] = useState('');
  const [categoria, setCategoria] = useState<string | null>(null);
  const [aberto, setAberto] = useState<string | null>(null);

  const abaEfetiva: Aba = podeTecnico ? aba : 'equipe';

  const resultados = useMemo(() => {
    const termo = q.trim().toLowerCase();
    return ARTIGOS.filter((a) => a.publico === abaEfetiva)
      .filter((a) => !categoria || a.categoria === categoria)
      .filter((a) => !termo || textoDoArtigo(a).includes(termo))
      .sort((a, b) => (termo ? relevancia(b, termo) - relevancia(a, termo) : 0));
  }, [q, categoria, abaEfetiva]);

  const categorias = useMemo(
    () => [...new Set(ARTIGOS.filter((a) => a.publico === abaEfetiva).map((a) => a.categoria))],
    [abaEfetiva],
  );

  return (
    <div className="flex flex-col gap-5 max-w-4xl">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900">Central de Ajuda</h1>
        <p className="text-sm text-slate-500">Como usar o sistema. Busque por uma palavra ou navegue pelas categorias.</p>
      </div>

      {podeTecnico && (
        <div className="flex rounded-xl border border-slate-300 overflow-hidden text-sm font-bold self-start">
          {(
            [
              ['equipe', 'Usar o painel'],
              ['tecnico', 'Operação e suporte técnico'],
            ] as const
          ).map(([v, rot]) => (
            <button
              key={v}
              type="button"
              onClick={() => {
                setAba(v);
                setCategoria(null);
              }}
              className={`px-4 py-2 ${abaEfetiva === v ? 'bg-blue-600 text-white' : 'text-slate-600'}`}
            >
              {rot}
            </button>
          ))}
        </div>
      )}

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar na ajuda…"
        className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm"
      />

      <div className="flex flex-wrap gap-2">
        <Chip ativo={!categoria} onClick={() => setCategoria(null)}>
          Todas
        </Chip>
        {categorias.map((c) => (
          <Chip key={c} ativo={categoria === c} onClick={() => setCategoria(c)}>
            {c}
          </Chip>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        {resultados.length === 0 && (
          <p className="rounded-xl bg-white border border-slate-200 p-6 text-center text-slate-400">
            Nada encontrado. Tente outra palavra ou fale com o suporte.
          </p>
        )}
        {resultados.map((a) => (
          <article key={a.id} className="rounded-xl bg-white border border-slate-200 overflow-hidden">
            <button
              type="button"
              onClick={() => setAberto(aberto === a.id ? null : a.id)}
              className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50"
            >
              <span className="font-bold text-slate-800">{a.titulo}</span>
              <span className="shrink-0 text-xs font-bold uppercase text-slate-400">{a.categoria}</span>
            </button>
            {aberto === a.id && (
              <div className="border-t border-slate-100 px-4 py-4 flex flex-col gap-3 text-sm text-slate-700">
                {a.corpo.map((b, i) => (
                  <BlocoView key={i} bloco={b} />
                ))}
              </div>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}

function BlocoView({ bloco }: { bloco: Bloco }) {
  if ('h' in bloco) return <p className="font-extrabold text-slate-900">{bloco.h}</p>;
  if ('p' in bloco) return <p className="leading-relaxed">{bloco.p}</p>;
  if ('ul' in bloco)
    return (
      <ul className="flex flex-col gap-1.5 pl-1">
        {bloco.ul.map((x, i) => (
          <li key={i} className="flex gap-2 leading-relaxed">
            <span className="text-blue-500 font-bold">•</span>
            {x}
          </li>
        ))}
      </ul>
    );
  if ('passos' in bloco)
    return (
      <ol className="flex flex-col gap-1.5">
        {bloco.passos.map((x, i) => (
          <li key={i} className="flex gap-2 leading-relaxed">
            <span className="shrink-0 w-5 h-5 rounded-full bg-blue-600 text-white text-[11px] font-bold flex items-center justify-center">
              {i + 1}
            </span>
            {x}
          </li>
        ))}
      </ol>
    );
  if ('nota' in bloco)
    return <p className="rounded-lg bg-amber-50 border border-amber-200 text-amber-800 p-3 leading-relaxed">💡 {bloco.nota}</p>;
  if ('codigo' in bloco)
    return (
      <pre className="rounded-lg bg-slate-900 text-slate-100 text-[12px] p-3 overflow-x-auto whitespace-pre-wrap">
        {bloco.codigo}
      </pre>
    );

  return null;
}

function Chip({ ativo, onClick, children }: { ativo: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-xs font-bold ${
        ativo ? 'bg-slate-900 text-white' : 'bg-white border border-slate-300 text-slate-600'
      }`}
    >
      {children}
    </button>
  );
}

function textoDoArtigo(a: Artigo): string {
  const blocos = a.corpo
    .map((b) =>
      'p' in b ? b.p : 'h' in b ? b.h : 'nota' in b ? b.nota : 'codigo' in b ? b.codigo : 'ul' in b ? b.ul.join(' ') : b.passos.join(' '),
    )
    .join(' ');

  return `${a.titulo} ${a.tags.join(' ')} ${a.categoria} ${blocos}`.toLowerCase();
}

function relevancia(a: Artigo, termo: string): number {
  let n = 0;
  if (a.titulo.toLowerCase().includes(termo)) n += 10;
  if (a.tags.some((t) => t.includes(termo))) n += 5;
  if (textoDoArtigo(a).includes(termo)) n += 1;

  return n;
}
