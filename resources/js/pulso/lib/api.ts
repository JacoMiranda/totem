import axios from 'axios';

/** Cliente anônimo do Pulso Rápido - identificado só pelo hash na URL, sem Sanctum/device key. */
export const api = axios.create({ baseURL: '/api/v1' });
