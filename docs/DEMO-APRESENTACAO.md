# Empresa-demo e roteiro de apresentação

Ambiente fictício pronto para gravação de vídeo, demonstração comercial e
prints de marketing. Empresa: **Rede Aurora** (varejo, 4 lojas).

## Como preparar

```bash
php artisan ouvidoria:semear-demo --fresh
```

`--fresh` apaga a demo anterior e recria do zero. Sem `--fresh`, atualiza
sem duplicar. Em produção exige `--force` (é ambiente de dados fictícios).

O comando imprime tudo no fim. Resumo:

| Acesso | Onde | Credenciais |
|---|---|---|
| **Painel** (admin) | `/admin` | `demo@aurora.test` / `demo1234` |
| **Painel** (analista) | `/admin` | `analista@aurora.test` / `demo1234` |
| **Mural público** | `/mural/demoredeauroraouvidoria` | — (link direto) |
| **Totem** | `/atendimento` | device key `demo-aurora-recepcao` (ou `-centro`, `-norte`, `-shopping`) |

Dados: ~170 manifestações nos últimos 150 dias, 4 totens (Recepção, Matriz
Centro, Filial Norte, Loja Shopping), respostas oficiais nos casos
resolvidos, mistura realista de teor (reclamação, elogio, dúvida,
sugestão, denúncia) e status.

Números que o mural mostra (variam um pouco a cada `--fresh`):
~92% respondidas · ~82% resolvidas · ~93% no prazo · ~82% das reclamações
resolvidas · tempo médio ~2 dias · ~30 dias sem atraso · 6 elogios em
rotação.

## Roteiro de vídeo (~3 min)

**1. O problema (20s)** — "Ouvidoria hoje: caixinha de sugestão, formulário
que ninguém lê, telefone que não atende. O cidadão desiste, a empresa não
enxerga o que está acontecendo."

**2. O totem (60s)** — Abrir `/atendimento` (device key acima).
- **Tela de espera**: já mostra "Ouvidoria Rede Aurora", os números
  (90% respondidas, 91% no prazo, resposta média ~2 dias), um elogio, e o
  botão grande **"Fazer minha manifestação"**. "A pessoa vê que a empresa
  responde antes de registrar."
- Toque → a voz dá as boas-vindas e **lê o termo LGPD**.
- Dois botões grandes: **Sim, concordo** / Não concordo. Tocar em Sim.
- Tela de relato: segurar o microfone e falar uma reclamação curta
  ("esperei muito na fila do caixa hoje de manhã").
- Mostrar o texto transcrito aparecendo + a classificação automática
  (teor: Reclamação, sentimento: Insatisfeito, urgência).
- Confirmar → **protocolo + PIN** na tela. "Pronto. Levou 40 segundos e
  não precisou saber escrever."
- (Opcional) mostrar o botão **"Cancelar atendimento"** e o reset por
  inatividade — "é um totem, tem que se virar sozinho".

**3. O painel (60s)** — Entrar em `/admin` como `demo@aurora.test`.
- **Manifestações**: a lista já cheia, filtros por teor/status/urgência.
  Abrir uma reclamação → resumo, áudio original, histórico, campo de
  resposta oficial.
- **Relatórios**: os gráficos (volume no tempo, por teor, por sentimento,
  SLA). "A empresa vê padrão: 'toda segunda de manhã a fila do caixa
  estoura' — e aí dá pra agir."

**4. O mural (30s)** — Abrir `/mural/demoredeauroraouvidoria` em tela
cheia. "E isto fica numa TV na recepção. O cliente vê que a empresa
responde 92% das manifestações, resolve 82%, no prazo. Transparência
vira confiança no canal — e mais gente usa."

**5. Fecho (10s)** — "Totem de escuta ativa: o cidadão fala, a IA
organiza, a equipe resolve, e todo mundo vê o resultado."

## Prints de marketing

- Mural em tela cheia (F11) num monitor 16:9 — melhor take.
- Totem na etapa de classificação (mostra a IA trabalhando).
- Relatórios com os gráficos preenchidos.
- Lista de manifestações filtrada por "Reclamação" + "Alta".

## Cuidados

- Tudo fictício. Protocolo `AURORA-*`, e-mails `@aurora.test`, CNPJ
  `00.000.000/0001-00`. Nenhum dado real.
- Se for gravar em produção, rode em uma conta separada e **não** deixe a
  demo com o mural ligado num domínio institucional (o link é
  semi-público).
- Para limpar depois: `php artisan ouvidoria:semear-demo --fresh` e, se
  quiser remover de vez, apagar a organização `RedeAurora` pelo tinker.
