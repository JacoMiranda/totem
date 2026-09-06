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
| `inicio-consentimento` | logo após as boas-vindas — **lê o texto da LGPD inteiro**, encadeado (`await falarFrase(...)`), antes de mostrar "Sim, concordo" / "Não concordo" |
| `consentimento-recusado` | quando o cidadão toca em "Não concordo" |
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

## Consentimento LGPD falado

O texto do consentimento é **lido em voz alta** antes de o cidadão escolher, e o
aceite é uma escolha ativa entre dois botões grandes — não um checkbox. Quem não
lê bem depende do áudio: consentimento só é informado se a pessoa teve acesso
real ao conteúdo.

O texto falado (`inicio-consentimento` em `config/kiosk_audio.php`) e o texto
escrito (`Inicio.tsx`) precisam dizer a mesma coisa — ao mudar um, mude o outro
e rode `ouvidoria:gerar-audios-kiosk --only=inicio-consentimento`.

`falarFrase()` resolve quando a locução **termina**, o que permite encadear
boas-vindas → consentimento sem sobrepor as vozes.

### Interromper a fala

`falarFrase()` devolve `true` se a locução terminou sozinha e `false` se foi
**interrompida**. `falarSequencia(...ids)` usa isso para abortar a fila quando
alguém interrompe — sem isso, tocar em "Concordo" no meio das boas-vindas
silenciava a fala atual mas deixava a PRÓXIMA da fila começar, sobrepondo-se à
locução da tela seguinte (três vozes ao mesmo tempo).

Regra: os botões que avançam a jornada **nunca esperam o áudio acabar**. Eles
chamam `pararFala()` e seguem. Travar o botão obrigaria todo cidadão a ouvir o
texto legal inteiro a cada atendimento; o consentimento é informado porque a
pessoa tem *acesso* ao conteúdo (texto na tela + "Ouvir novamente"), não porque
foi forçada a ouvir tudo.
