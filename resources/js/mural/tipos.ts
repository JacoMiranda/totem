export interface MuralDados {
  titulo: string;
  tema: 'claro' | 'escuro';
  orientacao: { local: string | null; linhaCor: string | null };
  /** Servido pelo endereço ANTIGO (grace de 48h após troca do token). */
  linkMudando?: boolean;
  exigePin?: false;
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
  unidades: { nome: string; pct: number }[];
  distribuicao: { chave: 'Elogio' | 'Sugestão' | 'Dúvida' | 'Reclamação'; pct: number }[];
  clima: {
    positivoPct: number | null;
    neutroPct: number | null;
    atentoPct: number | null;
  };
  elogios: { texto: string; unidade: string | null; quando: string }[];
}

export interface MuralExigePin {
  exigePin: true;
  pinInvalido: boolean;
  titulo: string;
  tema: 'claro' | 'escuro';
}
