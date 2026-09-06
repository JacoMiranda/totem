import { describe, expect, it } from 'vitest';
import { fallbackLocalAnalysis } from './fallbackAnalysis';

/**
 * Classificador local (offline / Gemini indisponível). É heurístico -
 * os testes fixam o comportamento esperado nos casos claros, não exigem
 * perfeição em texto ambíguo.
 */
describe('fallbackLocalAnalysis', () => {
  it('elogio claro', () => {
    const r = fallbackLocalAnalysis(
      'Quero elogiar o atendimento, foi excelente e muito rápido. Parabéns à equipe!',
    );
    expect(r.category).toBe('Elogio');
    expect(r.sentiment).toBe('Excelente');
    expect(r.urgency).toBe('Baixa');
  });

  it('reclamação sobre fila/demora', () => {
    const r = fallbackLocalAnalysis(
      'Péssimo, esperei duas horas na fila e o atendimento foi horrível. Um absurdo essa demora.',
    );
    expect(r.category).toBe('Reclamação');
    expect(r.sentiment).toBe('Insatisfeito');
    expect(['Alta', 'Média']).toContain(r.urgency);
  });

  it('denúncia sempre vira urgência crítica', () => {
    const r = fallbackLocalAnalysis(
      'Venho denunciar um caso de corrupção e desvio de verba no setor de compras.',
    );
    expect(r.category).toBe('Denúncia');
    expect(r.urgency).toBe('Crítica');
  });

  it('dúvida por pergunta', () => {
    const r = fallbackLocalAnalysis('Onde fica o setor de protocolo e qual o horário de funcionamento?');
    expect(r.category).toBe('Dúvida');
    expect(r.urgency).toBe('Baixa');
  });

  it('sugestão de melhoria', () => {
    const r = fallbackLocalAnalysis('Sugiro que ampliem o horário de atendimento. Seria bom abrir aos sábados.');
    expect(r.category).toBe('Sugestão');
  });

  it('negação inverte o sentimento', () => {
    const bom = fallbackLocalAnalysis('O atendimento foi bom e a equipe foi atenciosa.');
    const naoBom = fallbackLocalAnalysis('O atendimento não foi bom e a equipe não foi atenciosa.');
    expect(bom.sentiment === 'Satisfeito' || bom.sentiment === 'Excelente').toBe(true);
    expect(['Neutro', 'Preocupado', 'Insatisfeito']).toContain(naoBom.sentiment);
  });

  it('resumo usa as primeiras frases e keywords ignoram stopwords', () => {
    const r = fallbackLocalAnalysis(
      'A sala de espera estava lotada e sem cadeiras. A climatização não funcionava e fazia muito calor.',
    );
    expect(r.summary.length).toBeGreaterThan(10);
    expect(r.summary.length).toBeLessThanOrEqual(201);
    expect(r.keywords.length).toBeGreaterThan(0);
    expect(r.keywords).not.toContain('a');
    expect(r.keywords).not.toContain('e');
  });

  it('texto vazio não quebra', () => {
    const r = fallbackLocalAnalysis('');
    expect(r.sentiment).toBeTruthy();
    expect(r.category).toBeTruthy();
    expect(r.keywords.length).toBeGreaterThan(0);
  });
});
