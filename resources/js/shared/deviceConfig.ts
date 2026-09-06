/**
 * Configuração local do totem (device key + código) - NUNCA embutida no
 * bundle (o mesmo JS roda em qualquer totem fisico), guardada uma única
 * vez por máquina via a tela de provisionamento (ver SetupScreen) e
 * persistida em localStorage - mesmo modelo de "segredo do dispositivo",
 * análogo a um totem pareado (o próprio conceito de device.key do backend,
 * ver DeviceApiKeyAuth). Diferente da chave Gemini (essa sim nunca sai do
 * servidor, ver GeminiAiService) - a device key É um segredo do CLIENTE
 * por design.
 *
 * Fica em `shared/` porque os DOIS apps escrevem aqui: o kiosk, ao parear
 * pela própria tela de login, e o painel, no botão "Abrir totem" da tela
 * de Dispositivos (mesma origem, mesmo localStorage).
 */

const STORAGE_KEY = 'totem:device-config';

export interface DeviceConfig {
  deviceKey: string;
  codigo: string;
  nome: string;
}

export function getDeviceConfig(): DeviceConfig | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    return JSON.parse(raw) as DeviceConfig;
  } catch {
    return null;
  }
}

export function setDeviceConfig(config: DeviceConfig): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export function clearDeviceConfig(): void {
  localStorage.removeItem(STORAGE_KEY);
}
