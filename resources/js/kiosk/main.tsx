import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

/**
 * Service Workers de builds antigos ficam registrados no navegador e
 * continuam servindo bundle velho do cache mesmo com o dev server no ar
 * (sintoma: "mudei o código e nada muda"). Enquanto o PWA está desligado
 * (ver VITE_PWA em vite.config.ts), desregistra qualquer SW e limpa os
 * caches na inicialização.
 */
if (import.meta.env.VITE_PWA !== 'true' && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations?.().then((regs) => {
    regs.forEach((r) => void r.unregister());
  });
  caches?.keys?.().then((chaves) => chaves.forEach((c) => void caches.delete(c)));
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
