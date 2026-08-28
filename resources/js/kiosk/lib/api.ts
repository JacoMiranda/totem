import axios from 'axios';
import { getDeviceConfig } from './deviceConfig';

/**
 * Cliente HTTP do kiosk - sempre injeta `X-Device-Key` da config local
 * (ver deviceConfig.ts). Base URL relativa (`/api/v1`) porque o kiosk é
 * servido pelo MESMO Laravel que expõe a API (não é um domínio separado -
 * ver bootstrap/app.php e routes/web.php `/atendimento`).
 */
export const api = axios.create({ baseURL: '/api/v1' });

api.interceptors.request.use((config) => {
  const device = getDeviceConfig();
  if (device?.deviceKey) {
    config.headers['X-Device-Key'] = device.deviceKey;
  }

  return config;
});

/** true quando o erro é de rede (offline/timeout) - não uma resposta HTTP de erro de verdade (4xx/5xx). */
export function isNetworkError(erro: unknown): boolean {
  return axios.isAxiosError(erro) && !erro.response;
}
