# Camada offline — transcrição e classificação sem IA de nuvem

O totem precisa funcionar sem internet. Quando a Gemini não responde (ou não
há rede), o kiosk cai para processamento **local**, no próprio dispositivo.

## Tiers de processamento do relato (Relato.tsx)

| # | Condição | Transcrição | Classificação |
|---|---|---|---|
| 1 | Online, Gemini OK | `POST /ai/transcribe-analyze` (Gemini) | Gemini |
| 2 | Gemini falhou / offline, **com áudio** | **Vosk** (WASM, no dispositivo) | `fallbackLocalAnalysis` (léxico local) — `degraded: true` |
| 3 | Gemini falhou, sem Vosk, **com áudio** | — botão **"Enviar sem escrever"**: pula pra Classificação, o áudio sincroniza e a equipe transcreve | cidadão escolhe teor/sentimento na tela; `degraded: true` |
| 4 | Nada disso | — | cidadão digita; `fallbackLocalAnalysis` no "Continuar" |

Em qualquer caso a manifestação **nunca se perde**: o áudio vai pra
IndexedDB antes de qualquer rede e é reprocessado pelo servidor quando
sincroniza (ver `sync.ts`).

### Upload do áudio (`POST /manifestations/{id}/audio`)

- **Sem `mimetypes:`** na validação. Um webm/ogg só-áudio é detectado pelo
  libmagic como `video/webm` / `application/octet-stream` — a regra
  `mimetypes:audio/*` rejeitava (422) e **nenhum áudio chegava em
  produção**. Valida extensão (`webm|ogg|mp4|m4a|mp3|wav|aac`) + tamanho
  (25 MB); o arquivo vem do próprio totem, já autenticado por device key.
- `sync.ts` usa timeout de 90 s no upload (o de 20 s da IA estourava numa
  conexão de recepção) e manda a extensão certa pra ogg/wav.

### Sincronização (`sync.ts`) — o que garante que "chegou"

- `enviarItem` **persiste protocolo/PIN na fila local assim que a
  manifestação é criada no servidor**, ANTES de tentar o upload do áudio.
  Se o áudio falhar depois, o cidadão ainda vê o protocolo real (não o
  `PENDENTE-` temporário) e o item volta pra `pendente` (retenta só o
  áudio, sem recriar o registro).
- `drenarFila` reenvia também itens em `erro` (até `MAX_TENTATIVAS`): um
  payload rejeitado por um bug de servidor já corrigido num deploy volta a
  ser aceito sem intervenção.
- A tela ⏳ "Guardado — número temporário" (`Conclusao.tsx`, prefixo
  `PENDENTE-`) só aparece quando a criação da manifestação **de fato não
  passou** (offline, ou erro real na criação) — não quando só o áudio
  falhou.

## Transcrição — Vosk

- Lib: `vosk-browser` (build WASM do Kaldi num Web Worker). `import()` dinâmico
  (`resources/js/kiosk/lib/offline/vosk.ts`) → chunk separado de ~5,8 MB,
  fora do precache, cacheado no 1º uso.
- Modelo: **`vosk-model-small-pt-0.3`** (~32 MB) em `public/models/vosk/`
  (gitignored). Baixar com:
  ```bash
  php artisan ouvidoria:baixar-modelo-vosk         # baixa o .zip oficial e converte pra .tar.gz
  php artisan ouvidoria:baixar-modelo-vosk --force # rebaixa
  ```
- `App.tsx` chama `precarregarVosk()` no boot **se houver conexão** → o
  `.tar.gz` cai no cache do Service Worker (`vosk-model`, CacheFirst) e fica
  disponível offline depois.
- `transcreverAudioOffline(blob)`: decodifica o áudio, reamostra pra 16 kHz
  mono, alimenta o `KaldiRecognizer`, devolve o texto (ou `null` se algo
  falhar — nunca lança).
- Precisão: modelo pequeno, esperar transcrição aproximada. A equipe revê no
  painel. O cidadão pode corrigir o texto antes de finalizar.

> ⚠️ `vosk-browser` está em v0.0.8 (~4 anos, usa `ScriptProcessorNode`
> deprecado internamente). Funciona, mas **precisa de teste manual no
> navegador do totem** — não há como validar o Web Worker em CI. Alternativas
> se der problema: `Vosklet` (mais novo) ou Whisper via `@huggingface/transformers`.

## Classificação local — `resources/js/shared/fallbackAnalysis.ts`

Substituiu a heurística de ~5 palavras do protótipo por:
- **Sentimento**: léxico pt-BR com pesos `[-3,+3]` + negação (`não bom` → negativo)
  + intensificadores (`muito`, `extremamente`). Score → 5 níveis.
- **Categoria**: conjuntos de palavras-chave por categoria, com prioridade
  (Denúncia > Reclamação > Dúvida > Elogio > Sugestão) no empate. Sem pista:
  `?` → Dúvida, senão Sugestão.
- **Urgência**: Denúncia → Crítica; sinais de urgência → Alta; Reclamação forte
  → Alta; Elogio/Dúvida → Baixa.
- **Palavras-chave**: frequência, sem stopwords, top 5.
- **Resumo**: 1–2 primeiras frases (máx. ~200 chars).

Testes: `resources/js/shared/fallbackAnalysis.test.ts` (Vitest — `npm test`).

`app/Services/Ai/LocalAnalysisFallback.php` é a versão server-side, mais
simples (lá o Gemini é o primário).

## Próximos passos possíveis

- Classificação por **zero-shot** (transformers.js) para a categoria — mais
  robusto que léxico, mas +100 MB de modelo.
- Classificador treinado com as manifestações reais rotuladas pela equipe.
- Legenda ao vivo durante a gravação (feed contínuo pro Vosk, não só no fim).
