export interface MuralDados {
  titulo: string;
  tema: 'claro' | 'escuro';
  atualizadoEm: string;
  janelaDias: number;
  amostraPequena: boolean;
  indicadores: {
    respondidasPct: number | null;
    resolvidasPct: number | null;
    noPrazoPct: number | null;
    reclamacoesResolvidasPct: number | null;
    satisfacaoPct: number | null;
    tempoMedioRespostaHoras: number | null;
  };
  compromisso: {
    tudoNoPrazo: boolean;
    diasSemAtraso: number;
    diasOuvindo: number;
  };
  porPeriodo: { rotulo: string; total: number }[];
  distribuicao: { chave: 'Elogio' | 'Sugestão' | 'Dúvida' | 'Reclamação'; pct: number }[];
  clima: {
    positivoPct: number | null;
    neutroPct: number | null;
    atentoPct: number | null;
  };
  elogios: { texto: string; unidade: string | null; quando: string }[];
}
