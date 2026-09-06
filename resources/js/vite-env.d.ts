/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_KIOSK_IA_LOCAL?: string;
  readonly VITE_KIOSK_VOSK?: string;
  readonly VITE_PWA?: string;
  readonly VITE_APP_NAME?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
