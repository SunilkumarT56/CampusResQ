export type HostPriority = 'URGENT' | 'MEDIUM' | 'LOW';
export type HostStatus = 'online' | 'offline';
export interface HostConfig { id: string; name: string; priority: HostPriority; url: string; }
export interface HostStatusResponse { id: string; name: string; priority: HostPriority; status: HostStatus; lastSuccessfulHealthCheck: string | null; responseTimeMs: number | null; }
