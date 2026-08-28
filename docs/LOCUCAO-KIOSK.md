# Locução do totem (áudios pré-gravados)

As frases **fixas** da jornada do cidadão não batem na API a cada atendimento —
são geradas uma vez e servidas como WAV estático. Só o conteúdo **dinâmico**
(ex.: ler o resumo do relato do próprio cidadão) usa `POST /ai/tts`.

## Peças

| Onde | O quê |
|---|---|
| `config/kiosk_audio.php` | Catálogo: voz + `frases` fixas (id => texto) + `conclusao_combos` (5 categorias × 5 sentimentos) |
| `app/Console/Commands/GerarAudiosKiosk.php` | `ouvidoria:gerar-audios-kiosk` — gera os WAV via Gemini TTS |
| `app/Support/Wav.php` | Embrulha o PCM cru do Gemini num container WAV de 44 bytes |
| `public/audio/kiosk/*.wav` + `manifest.json` | Saída (versionada). O `manifest.json` mapeia id → arquivo/texto/hash |
| `resources/js/kiosk/lib/vozKiosk.ts` | `falarFrase(id)`, `falarConclusao(cat, sent)`, `falarTexto(texto)`, `pararFala()` |

## Gerar / atualizar os áudios

```bash
php artisan ouvidoria:gerar-audios-kiosk            # gera o que falta (idempotente)
php artisan ouvidoria:gerar-audios-kiosk --force    # regera tudo
php artisan ouvidoria:gerar-audios-kiosk --only=boas-vindas,conclusao-online
php artisan ouvidoria:gerar-audios-kiosk --limite=8 # para após 8 (respeita cota diária)
php artisan ouvidoria:gerar-audios-kiosk --reconstruir  # só reescreve o manifest a partir dos .wav em disco (sem API)
```

Trocou o texto de uma frase no `config/kiosk_audio.php`? O `hash` muda e a próxima
execução regera só ela.

### ⚠️ Cota do free tier

O modelo `gemini-2.5-flash-preview-tts` no **free tier** tem limite baixo
(~10 requisições/dia). As 9 frases fixas já estão geradas. As **25 combinações
de conclusão** (`conclusao-{categoria}-{sentimento}`) ainda não — rode o comando
em lotes ao longo de alguns dias (`--limite=`), ou ative billing no projeto Google.
Enquanto faltam, `falarConclusao()` cai automaticamente na frase genérica
`conclusao-online` (que existe).

## Gatilhos no kiosk

| Frase | Quando |
|---|---|
| `boas-vindas` | primeiro toque na tela inicial (autoplay exige gesto do usuário) |
| `relato-instrucao` | entra na etapa Relato |
| `relato-processando` | parou a gravação |
| `relato-sem-microfone` | falha de microfone |
| `classificacao-instrucao` | entra na etapa Classificação |
| `conclusao-online` / `conclusao-{cat}-{sent}` | conclusão, manifestação enviada |
| `conclusao-offline` | conclusão, manifestação ainda na fila local |

A fala é sempre **um extra**: se o WAV faltar → `speechSynthesis` nativo do
navegador; nunca lança, nunca bloqueia a jornada. O Service Worker (PWA) cacheia
os WAV em runtime (`CacheFirst`, ver `vite.config.ts`), então após a 1ª
reprodução funcionam offline.
