import axios from 'axios';
import { useAuthStore } from './authStore';

/** Cliente HTTP do painel - Sanctum bearer token (ver AuthController), nunca X-Device-Key (isso é só do totem). */
export const api = axios.create({ baseURL: '/api/v1' });

api.interceptors.request.use((config) => {
  const { token } = useAuthStore.getState();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

// Token expirado/revogado (ver config/sanctum.php - expiração de 8h) - desloga
// e manda de volta pro login em vez de deixar a UI num estado inconsistente.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().encerrarSessao();
    }

    return Promise.reject(error);
  },
);
