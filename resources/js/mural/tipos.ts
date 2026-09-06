export interface MuralDados {
  titulo: string;
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
  elogios: { texto: string; unidade: string | null; quando: string }[];
}
