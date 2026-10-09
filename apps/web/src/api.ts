import axios from 'axios';
export type HostPriority = 'URGENT' | 'MEDIUM' | 'LOW';
export type HostStatus = 'online' | 'offline';
export interface Host { id: string; name: string; priority: HostPriority; status: HostStatus; lastSuccessfulHealthCheck: string | null; responseTimeMs: number | null; }
const client = axios.create({ baseURL: import.meta.env.VITE_API_BASE_URL ?? '/api' });
export const getHosts = async () => (await client.get<Host[]>('/hosts')).data;
export const getApiHealth = async () => (await client.get<{ status: string }>('/health')).data;
