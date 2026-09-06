# Modo quiosque — travar o totem físico

O app do totem (`/atendimento`) roda num navegador. Deixá-lo "à prova de
cidadão" — tela cheia, sem barra de endereço, sem trocar de aba, voltar
sozinho se travar — é **função do sistema operacional / do shell de
quiosque**, não do app. O que o app faz por cima disso está no fim deste
documento.

## O que o app já faz sozinho

- **Tela cheia no primeiro toque** — `Inicio.tsx` chama `requestFullscreen()`
  no primeiro gesto (única hora em que o navegador permite). Falha em
  silêncio no iOS Safari.
- **Reset por inatividade** — 90s parado nas telas de preenchimento (30s na
  conclusão) → aviso "ainda está aí?" por 15s → volta ao início. O relato,
  o áudio e a identificação de uma pessoa não ficam na tela pra próxima.
- **Nunca tela branca** — `ErrorBoundary` captura erro de render e mostra
  "tivemos um problema, recomeçar", reportando pro `/admin/logs`.
- **Escotilha de suporte** — segurar 3s o canto inferior direito → PIN
  (`VITE_SUPORTE_PIN`) → painel: sair da tela cheia, recarregar, voltar ao
  início, forçar sincronização, esvaziar fila local, re-parear. É o
  suficiente pros problemas "moles"; **não** substitui o travamento do SO.

## Travamento do SO — escolha por plataforma

### Android (tablet) — recomendado: **Fully Kiosk Browser**

O mais barato e comum pra totem de recepção. Faz o que o app não faz:

- Abre `https://SEU-DOMINIO/atendimento` em tela cheia, trava a saída
  (4 toques no canto + PIN de admin).
- Auto-start no boot, auto-reload diário, "remote admin" web.
- Protetor de tela + **acordar por detecção de movimento** (câmera/PIR) —
  o totem "acorda" quando alguém se aproxima.
- Permite microfone e câmera por config (a captação de áudio do relato
  depende disso).
- Alternativas com MDM completo: Scalefusion, SureMDM/SureLock, Android
  Enterprise "dedicated device" (COSU) via `Lock Task Mode`.

Config mínima no Fully Kiosk:
- Start URL: `https://SEU-DOMINIO/atendimento`
- Enable: *Website Integration → Fullscreen Mode*, *Kiosk Mode (Lock)*,
  *Auto Reload on Idle*, *Movement Detection*
- *Advanced Web Settings → Enable Microphone Access = ON*
- Screensaver: pode apontar pra um vídeo/imagem institucional.

### Windows (mini-PC / NUC)

- **Chrome/Edge em modo quiosque**:
  `chrome.exe --kiosk --incognito --disable-pinch --overscroll-history-navigation=0 https://SEU-DOMINIO/atendimento`
  (atalho na pasta *Inicializar*). Saída: `Alt+F4` — proteja com o item
  abaixo.
- **Assigned Access** (Acesso Atribuído do Windows): cria um usuário local
  que só roda o navegador em quiosque; a saída exige `Ctrl+Alt+Del` +
  senha de outra conta. `Configurações → Contas → Família e outros
  usuários → Configurar um quiosque`.
- Permissão de microfone: `edge://settings/content/microphone` (ou
  política de grupo) liberando o domínio, feito uma vez no perfil.

### iPad

- **Acesso Guiado** (triplo clique no botão + código) trava num app. Para
  travar o Safari numa URL, usar *Apple Configurator* / MDM com "Web Clip"
  em modo quiosque autônomo (Single App Mode).

## Transcrição offline no totem (Vosk)

No celular de teste a transcrição vem do Gemini (servidor). No **totem
físico** vale ligar o Vosk como rede de segurança pra quando o Gemini cai
ou a internet oscila:

1. No `.env` do build do totem (ou no ambiente de build):
   `VITE_KIOSK_VOSK=true`
2. Baixar o modelo pt-BR (~32 MB) pra `public/models/vosk/`:
   `php artisan ouvidoria:baixar-modelo-vosk`
3. O modelo entra no deploy como asset estático. No primeiro atendimento o
   navegador baixa e cacheia; depois funciona offline.

Precisão do Vosk é modesta — serve pra triagem, a equipe revê no painel. O
áudio original vai junto de qualquer forma.

Se preferir manter o totem 100% sem IA de nuvem: `VITE_KIOSK_IA_LOCAL=true`
(nem tenta o Gemini; classifica pelo léxico local, transcreve com Vosk).

## Variáveis relevantes (build do totem)

| Var | Efeito |
|---|---|
| `VITE_SUPORTE_PIN` | PIN do painel de manutenção (canto + 3s). **Trocar** do default `0000`. |
| `VITE_KIOSK_VOSK` | `true` liga a transcrição offline (precisa do modelo baixado). |
| `VITE_KIOSK_IA_LOCAL` | `true` = nunca chama o Gemini. |
| `VITE_PWA` | `true` liga o Service Worker (cacheia o modelo Vosk pra offline real). |
