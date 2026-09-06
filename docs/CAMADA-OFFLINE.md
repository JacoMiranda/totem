# Camada offline — transcrição e classificação sem IA de nuvem

O totem precisa funcionar sem internet. Quando a Gemini não responde (ou não
há rede), o kiosk cai para processamento **local**, no próprio dispositivo.

## Tiers de processamento do relato (Relato.tsx)

| # | Condição | Transcrição | Classificação |
|---|---|---|---|
| 1 | Online, Gemini OK | `POST /ai/transcribe-analyze` (Gemini) | Gemini |
| 2 | Gemini falhou / offline, **com áudio** | **Vosk** (WASM, no dispositivo) | `fallbackLocalAnalysis` (léxico local) — `degraded: true` |
| 3 | Nada disso | — (áudio fica salvo na fila e sincroniza depois) | cidadão digita; `fallbackLocalAnalysis` no "Continuar" |

Em qualquer caso a manifestação **nunca se perde**: o áudio vai pra
IndexedDB antes de qualquer rede e é reprocessado pelo servidor quando
sincroniza (ver `sync.ts`).

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
