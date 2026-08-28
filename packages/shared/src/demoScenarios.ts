/**
 * Porta fiel de `loadDemoScenario` do protótipo - os 4 textos de
 * demonstração/treinamento. No kiosk de produção, esconder atrás de um
 * modo "demonstração" ativável só com device key de teste (ver
 * docs/MIGRACAO-DO-PROTOTIPO.md).
 */
export const DEMO_SCENARIOS = {
  elogio:
    'Gostaria de parabenizar toda a equipa pelo atendimento excelente de hoje. Fui atendido muito rápido e todos foram muito atenciosos e profissionais.',
  reclamacao:
    'Estou insatisfeito com o tempo de espera na fila de atendimento. Fiquei mais de duas horas a aguardar e não havia lugares suficientes para todos.',
  sugestao:
    'Sugiro o alargamento do horário de atendimento até às 19h para que os trabalhadores que saem mais tarde consigam utilizar o serviço.',
  denuncia:
    'Venho denunciar irregularidades no cumprimento de horário e cobrança indevida de taxas que deveriam ser gratuitas neste setor.',
} as const;

export type DemoScenarioKey = keyof typeof DEMO_SCENARIOS;
