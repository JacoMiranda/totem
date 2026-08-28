# Migração do protótipo → sistema

Arquivo de origem: `cabine_de_ouvidoria_inteligente.html` (1811 linhas). Abaixo, para onde vai cada parte.

## Telas (jornada preservada)

| Protótipo (`section` id) | Novo local | Notas |
|---|---|---|
| `step1Welcome` | `apps/kiosk` — rota `/` | Botão gigante "Iniciar". Adicionar tela de consentimento LGPD antes de ir ao passo 2 |
| `step2Recording` | `apps/kiosk` — `/atendimento/relato` | Gravação + transcrição. Chamada de IA agora vai para `/ai/transcribe-analyze` |
| `step3Classification` | `apps/kiosk` — `/atendimento/classificacao` | Chips de sentimento/categoria/urgência + resumo + keywords |
| `step4Completed` | `apps/kiosk` — `/atendimento/conclusao` | Mostrar protocolo **+ PIN de acompanhamento** + aviso se ainda offline |
| `viewFolders` | Dividir: **kiosk** mostra só registros locais recentes do device; **admin** tem a gestão completa com filtros server-side |
| `transcriptionModal` | Componente em ambos | |

## Lógica JS → destino

| Função(ões) do protótipo | Destino | Ação |
|---|---|---|
| `apiKey`, `TEXT_API_ENDPOINT`, `TTS_API_ENDPOINT` | **remover do cliente** | Chave vai para `services/api` (env `GEMINI_API_KEY`) |
| `fetchWithRetry` (backoff 1/2/4/8/16s) | `services/api/src/modules/ai` | Retry passa a ser server-side |
| `processAudioRecording` + `systemInstruction` + `responseSchema` | `POST /ai/transcribe-analyze` | Manter o schema e o system prompt **idênticos** (ver abaixo) |
| `triggerManualAnalysis` | `POST /ai/analyze-text` | |
| `speakTextDirectly`, `playPcmAudio`, `extractSampleRate` | cliente chama `POST /ai/tts`; player PCM continua no cliente | Cache de áudio no servidor |
| `speakWithBrowserFallback`, `stopAllAudioPlayback` | `apps/kiosk/src/audio` | Fallback `speechSynthesis` mantido |
| `fallbackLocalAnalysis` (heurística por palavras) | `packages/shared/fallbackAnalysis.ts` | Usado quando `degraded:true` |
| `toggleRecording`, `startRecording`, `stopRecording`, `MediaRecorder`, `blobToBase64` | `apps/kiosk/src/audio/recorder.ts` | Blob vai para IndexedDB, não base64 em memória |
| `preWarmAudioAndMicrophone`, `prewarmedAudioStream`, health badge | `apps/kiosk/src/audio/micHealth.ts` | |
| `startTimer`/`stopTimer`, visualizador de ondas, `updateRecordingUI` | componentes React | animações `pulse`/`soundwave`/`breathe` → CSS do projeto |
| `initOptionalBrowserSpeech` / `speechRecognition` | `apps/kiosk/src/audio/liveCaption.ts` | legenda ao vivo best-effort |
| `goToStep`, `updateProgressStepper`, `validateStep2NextButton`, `checkFormReady` | React Router + estado (Zustand) + form (React Hook Form + Zod) | |
| `selectSentiment/Category/Urgency`, `applyAnalysisResult` | store da manifestação | enums de `packages/shared` |
| `currentManifestation` | store + schema Zod `ManifestationDraft` | |
| `confirmAndSave` | grava em IndexedDB (`syncStatus='pendente'`) e enfileira sync | **não** faz POST direto; o worker de sync faz |
| `archivedRecords` (array em memória) | IndexedDB no kiosk; PostgreSQL via API no admin | |
| `updateFolderCounts`, `filterFolder`, `renderFolderRecords`, `viewFullTranscription` | kiosk: leitura local; admin: `GET /manifestations` com filtros | |
| `getSentimentEmoji`, `getUrgencyBadgeClass` | `packages/shared/labels.ts` | |
| `copyTranscription` (usa `document.execCommand`) | `navigator.clipboard.writeText` | |
| `showToast` | componente de toast reutilizável | |
| `resetCabin` | reset do store + limpeza; chamado também pelo timeout de inatividade do kiosk | |

## System prompt e responseSchema (preservar no backend)

**Análise de áudio** (`processAudioRecording`): manter o `systemInstruction` em português com as 6 instruções
(transcrever fiel; sentimento ∈ 5 valores; categoria ∈ 5 valores; urgência ∈ 4 valores; resumo 1–2 frases;
3–5 keywords) e o `responseSchema` OBJECT com `required: [transcription, sentiment, category, urgency, summary, keywords]`.

**Análise de texto** (`triggerManualAnalysis`): mesmo schema sem `transcription`.

**TTS**: prompt `"Say warmly and naturally in Portuguese: <texto>"`, `responseModalities: ["AUDIO"]`,
`prebuiltVoiceConfig.voiceName` (default `Aoede`). Extrair `sampleRate` do `mimeType` (`rate=` → fallback 24000).

## Cenários de demonstração (`loadDemoScenario`)
Mover os 4 textos (`elogio`, `reclamacao`, `sugestao`, `denuncia`) para `packages/shared/demoScenarios.ts`.
No kiosk de produção, esconder atrás de um modo "demonstração/treinamento" ativável só com device key de teste.

## Diferenças de comportamento intencionais

1. **Nada é enviado à IA sem consentimento LGPD** aceito na tela inicial.
2. **Áudio persiste localmente** antes de qualquer rede; some só após sync confirmado + retenção.
3. **Protocolo** é do servidor (ou determinístico com prefixo do device) — não mais `Math.random()`.
4. **PIN de acompanhamento** novo, para a consulta pública.
5. Arquivo do totem ≠ base completa: totem vê só o recente local; equipe vê tudo no admin.
6. Sem chave de API no HTML.

## Segundo arquivo

`cabine_de_ouvidoria_inteligente_com_ia1.html` — comparar com o principal e consolidar as diferenças
antes da Fase 3 (provavelmente uma versão anterior). Não migrar os dois.
