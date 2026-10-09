import axios from 'axios';
import type { HostConfig, HostStatusResponse } from './host.types';

export class HostsService {
  private readonly configs: HostConfig[] = [
    ['host-1', 'Emergency Service', 'URGENT'],
    ['host-2', 'Authentication Service', 'URGENT'],
    ['host-3', 'Academic Platform', 'MEDIUM'],
    ['host-4', 'File Transfer', 'LOW'],
    ['host-5', 'Background Processing', 'LOW'],
  ].map(([id, name, priority]) => ({
    id,
    name,
    priority: priority as HostConfig['priority'],
    url: process.env[`HOST_${id.split('-')[1]}_URL`] ?? `http://${id}:8000`,
  }));

  private readonly lastSuccessful = new Map<string, string>();
  private readonly timeoutMs = Number(process.env.HOST_TIMEOUT_MS ?? 1500);

  async findAll(): Promise<HostStatusResponse[]> {
    return Promise.all(this.configs.map((config) => this.check(config)));
  }

  async findOne(id: string): Promise<HostStatusResponse | undefined> {
    const config = this.configs.find((host) => host.id === id);
    return config ? this.check(config) : undefined;
  }

  private async check(config: HostConfig): Promise<HostStatusResponse> {
    const started = Date.now();
    try {
      const response = await axios.get<{ status: string }>(`${config.url}/health`, {
        timeout: this.timeoutMs,
        validateStatus: (status) => status >= 200 && status < 300,
      });
      if (response.data.status !== 'ok') throw new Error('Host health check failed');
      const timestamp = new Date().toISOString();
      this.lastSuccessful.set(config.id, timestamp);
      return { ...config, status: 'online', lastSuccessfulHealthCheck: timestamp, responseTimeMs: Date.now() - started };
    } catch {
      return {
        id: config.id,
        name: config.name,
        priority: config.priority,
        status: 'offline',
        lastSuccessfulHealthCheck: this.lastSuccessful.get(config.id) ?? null,
        responseTimeMs: null,
      };
    }
  }
}
