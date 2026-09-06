import type { Category, Sentiment, Urgency } from './enums';

export interface AnaliseFallback {
  sentiment: Sentiment;
  category: Category;
  urgency: Urgency;
  summary: string;
  keywords: string[];
}

/**
 * Análise LOCAL (sem IA) usada quando a Gemini está indisponível OU o totem
 * está offline (ver docs/CAMADA-OFFLINE.md). Substituiu a heurística de ~5
 * palavras do protótipo por um classificador léxico com pesos + negação
 * (estilo VADER-lite) para pt-BR. Continua sendo um FALLBACK - a equipe
 * revê no painel -, mas erra bem menos que a versão original.
 *
 * `LocalAnalysisFallback.php` faz o mesmo papel no servidor de forma mais
 * simples (lá o Gemini já é o primário; o fallback PHP só cobre "online
 * mas IA fora do ar"). Este aqui é o que roda quando o totem está TOTALMENTE
 * offline, então vale a pena ser mais caprichado.
 */

const NEGADORES = ['não', 'nao', 'nunca', 'jamais', 'nem', 'nenhum', 'nenhuma', 'sem'];
const INTENSIFICADORES: Record<string, number> = {
  muito: 1.5,
  bastante: 1.4,
  extremamente: 1.8,
  totalmente: 1.6,
  completamente: 1.6,
  péssimo: 1, // já forte no léxico; aqui só evita cair no default
  'super': 1.4,
  demais: 1.4,
  bem: 1.2,
};

/** peso em [-3, +3]. Negação inverte; intensificador multiplica o termo seguinte. */
const LEXICO_SENTIMENTO: Record<string, number> = {
  // positivo
  excelente: 3, ótimo: 2.5, otimo: 2.5, maravilhoso: 3, perfeito: 2.5, parabéns: 2.5, parabens: 2.5,
  obrigado: 1.5, agradeço: 1.5, agradeco: 1.5, gratidão: 1.5, gratidao: 1.5, elogio: 2, elogiar: 2,
  bom: 1.5, boa: 1.5, satisfeito: 2, satisfeita: 2, gostei: 2, adorei: 2.5, eficiente: 2,
  rápido: 1.5, rapido: 1.5, atencioso: 2, atenciosa: 2, educado: 1.5, cordial: 1.5, resolvido: 1.5,
  // negativo
  péssimo: -3, pessimo: -3, horrível: -3, horrivel: -3, ruim: -2, terrível: -3, terrivel: -3,
  insatisfeito: -2, insatisfeita: -2, revoltado: -2.5, revoltada: -2.5, absurdo: -2.5, vergonha: -2.5,
  descaso: -2.5, demora: -1.5, demorado: -1.5, lento: -1.5, fila: -1, espera: -1, aguardando: -1,
  problema: -1.5, falha: -1.5, erro: -1.5, reclamação: -1.5, reclamacao: -1.5, reclamar: -1.5,
  grosseiro: -2.5, grossa: -2, maltratado: -2.5, maltratada: -2.5, ignorado: -2, ignorada: -2,
  sujo: -1.5, quebrado: -1.5, estragado: -1.5, cancelado: -1.5, prejuízo: -2, prejuizo: -2,
  // preocupação / gravidade
  urgente: -1.5, grave: -2, perigo: -2, perigoso: -2, risco: -1.5, medo: -1.5, ameaça: -2.5, ameaca: -2.5,
};

const PALAVRAS_CATEGORIA: Record<Category, string[]> = {
  Denúncia: [
    'denúncia', 'denuncia', 'denunciar', 'corrupção', 'corrupcao', 'propina', 'desvio', 'fraude',
    'irregular', 'irregularidade', 'ilegal', 'crime', 'assédio', 'assedio', 'abuso', 'ameaça', 'ameaca',
    'suborno', 'superfaturamento', 'nepotismo', 'má conduta', 'ma conduta',
  ],
  Reclamação: [
    'reclamação', 'reclamacao', 'reclamar', 'péssimo', 'pessimo', 'ruim', 'horrível', 'horrivel',
    'demora', 'demorado', 'fila', 'espera', 'descaso', 'problema', 'falha', 'não funciona', 'nao funciona',
    'mal atendido', 'maltratado', 'grosseiro', 'insatisfeito', 'absurdo', 'transtorno', 'prejuízo', 'prejuizo',
  ],
  Dúvida: [
    'dúvida', 'duvida', 'como faço', 'como faco', 'como posso', 'onde', 'quando', 'qual', 'quais',
    'preciso saber', 'gostaria de saber', 'informação', 'informacao', 'me informar', 'é possível', 'e possivel',
    'quanto custa', 'que horas', 'funciona',
  ],
  Elogio: [
    'elogio', 'elogiar', 'parabéns', 'parabens', 'excelente', 'ótimo atendimento', 'otimo atendimento',
    'agradeço', 'agradeco', 'obrigado', 'gostaria de agradecer', 'muito bom', 'nota dez', 'atencioso',
    'eficiente', 'gostei muito', 'maravilhoso',
  ],
  Sugestão: [
    'sugestão', 'sugestao', 'sugiro', 'sugerir', 'poderia', 'seria bom', 'seria melhor', 'proponho',
    'proposta', 'recomendo', 'ideia', 'melhoria', 'melhorar', 'que tal', 'deveria ter', 'faltou',
    'seria interessante',
  ],
};

/** categorias mais graves ganham na hora do empate */
const PRIORIDADE_CATEGORIA: Category[] = ['Denúncia', 'Reclamação', 'Dúvida', 'Elogio', 'Sugestão'];

const STOPWORDS = new Set([
  'a', 'o', 'e', 'de', 'da', 'do', 'das', 'dos', 'em', 'no', 'na', 'nos', 'nas', 'um', 'uma', 'uns', 'umas',
  'que', 'com', 'por', 'para', 'pra', 'pro', 'se', 'os', 'as', 'ao', 'à', 'aos', 'às', 'meu', 'minha', 'seu',
  'sua', 'este', 'esta', 'isso', 'ele', 'ela', 'eu', 'você', 'voce', 'mais', 'muito', 'já', 'ja', 'não', 'nao',
  'foi', 'ser', 'está', 'esta', 'estão', 'estao', 'tem', 'ter', 'há', 'ha', 'mas', 'como', 'quando', 'onde',
  'porque', 'então', 'entao', 'aqui', 'ali', 'lá', 'la', 'me', 'te', 'nós', 'nos', 'dia', 'hoje',
]);

function tokenizar(texto: string): string[] {
  return texto
    .toLowerCase()
    .normalize('NFC')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function pontuarSentimento(tokens: string[]): number {
  let total = 0;
  let contagem = 0;

  for (let i = 0; i < tokens.length; i++) {
    const peso = LEXICO_SENTIMENTO[tokens[i]];
    if (peso === undefined) continue;

    let valor = peso;
    const anterior = tokens[i - 1];
    const doisAntes = tokens[i - 2];
    if (INTENSIFICADORES[anterior]) valor *= INTENSIFICADORES[anterior];
    if (NEGADORES.includes(anterior) || NEGADORES.includes(doisAntes)) valor *= -0.9;

    total += valor;
    contagem++;
  }

  return contagem === 0 ? 0 : total / Math.sqrt(contagem);
}

function classificarSentimento(score: number): Sentiment {
  if (score >= 2) return 'Excelente';
  if (score >= 0.6) return 'Satisfeito';
  if (score > -0.6) return 'Neutro';
  if (score > -2) return 'Preocupado';
  return 'Insatisfeito';
}

function classificarCategoria(textoLower: string, tokens: string[]): Category {
  const placar = new Map<Category, number>();
  for (const cat of PRIORIDADE_CATEGORIA) {
    let n = 0;
    for (const termo of PALAVRAS_CATEGORIA[cat]) {
      if (termo.includes(' ') ? textoLower.includes(termo) : tokens.includes(termo)) n++;
    }
    placar.set(cat, n);
  }

  let melhor: Category = 'Dúvida';
  let melhorN = 0;
  for (const cat of PRIORIDADE_CATEGORIA) {
    const n = placar.get(cat) ?? 0;
    if (n > melhorN) {
      melhorN = n;
      melhor = cat;
    }
  }

  // sem nenhuma pista: interrogação => Dúvida, senão Sugestão (default do protótipo)
  if (melhorN === 0) return textoLower.includes('?') ? 'Dúvida' : 'Sugestão';

  return melhor;
}

function definirUrgencia(categoria: Category, textoLower: string, score: number): Urgency {
  if (categoria === 'Denúncia') return 'Crítica';
  if (/\burgent|imediat|perigo|risco de vida|grave\b/.test(textoLower)) return 'Alta';
  if (categoria === 'Reclamação') return score <= -2 ? 'Alta' : 'Média';
  if (categoria === 'Elogio' || categoria === 'Dúvida') return 'Baixa';

  return 'Média';
}

function extrairKeywords(tokens: string[]): string[] {
  const freq = new Map<string, number>();
  for (const t of tokens) {
    if (t.length < 4 || STOPWORDS.has(t)) continue;
    freq.set(t, (freq.get(t) ?? 0) + 1);
  }

  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
    .slice(0, 5)
    .map(([palavra]) => palavra);
}

function resumir(texto: string): string {
  const frases = texto.replace(/\s+/g, ' ').trim().match(/[^.!?]+[.!?]?/g) ?? [texto];
  let resumo = frases[0]?.trim() ?? '';
  if (resumo.length < 90 && frases[1]) resumo += ' ' + frases[1].trim();

  return resumo.length > 200 ? resumo.slice(0, 197).trimEnd() + '…' : resumo;
}

export function fallbackLocalAnalysis(text: string): AnaliseFallback {
  const texto = (text ?? '').trim();
  const tokens = tokenizar(texto);
  const lower = texto.toLowerCase();

  const score = pontuarSentimento(tokens);
  const category = classificarCategoria(lower, tokens);
  const sentiment = classificarSentimento(score);
  const urgency = definirUrgencia(category, lower, score);
  const keywords = extrairKeywords(tokens);

  return {
    sentiment,
    category,
    urgency,
    summary: resumir(texto) || 'Relato registrado sem resumo automático.',
    keywords: keywords.length > 0 ? keywords : ['cidadão', 'serviço-público'],
  };
}
