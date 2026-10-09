import { DockerNetworkService } from './docker-network.service';
import { DEFAULT_CAPACITY, DEFAULT_LATENCY, HOST_NODES } from './topology.constants';
import { NetworkVerificationService } from './network-verification.service';
import { TopologyRepository } from './topology.repository';
import type { NetworkTopology, TopologyType } from './topology.types';
import type { HostsService } from '../hosts/hosts.service';

export class TopologyService {
  private active: NetworkTopology = this.empty();
  private changing = false;
  private readonly repository = new TopologyRepository();
  private readonly docker = new DockerNetworkService();
  private readonly verification: NetworkVerificationService;

  constructor(private readonly hosts: HostsService) {
    this.verification = new NetworkVerificationService(hosts);
    void this.restore();
  }

  async configure(type: TopologyType): Promise<NetworkTopology> {
    if (this.changing) throw new Error('A topology change is already in progress');
    this.changing = true;
    const previous = this.active;
    try {
      const candidate = this.generate(type);
      const dockerResult = await this.docker.apply(type);
      candidate.verification = await this.verification.verify(candidate, dockerResult);
      candidate.verified =
        candidate.verification.dockerEnforcement === 'verified' && candidate.verification.errors.length === 0;
      candidate.status = candidate.verified ? 'configured' : 'failed';
      if (candidate.status === 'failed') {
        this.active = previous;
        throw new Error(candidate.verification.errors.join('; ') || 'Docker topology enforcement failed');
      }
      this.active = candidate;
      await this.repository.save(candidate);
      return candidate;
    } finally {
      this.changing = false;
    }
  }

  get(): NetworkTopology {
    return this.active;
  }

  async status(): Promise<NetworkTopology> {
    if (!this.active.type) return this.active;
    const dockerResult = await this.docker.checkStatus();
    const result = await this.verification.verify(this.active, dockerResult);
    return {
      ...this.active,
      verification: result,
      verified: result.dockerEnforcement === 'verified' && result.errors.length === 0,
    };
  }

  async setLinkState(id: string, isActive: boolean): Promise<NetworkTopology> {
    if (!this.active.type) throw new Error('No topology is configured');
    const link = this.active.links.find((item) => item.id === id);
    if (!link) throw new Error(`Unknown link: ${id}`);
    const next = {
      ...this.active,
      links: this.active.links.map((item) => (item.id === id ? { ...item, isActive } : item)),
    };
    const dockerResult = await this.docker.setLinkState(this.active.type, id, isActive);
    const result = await this.verification.verify(next, dockerResult);
    this.active = {
      ...next,
      verification: result,
      verified: result.dockerEnforcement === 'verified',
      status: result.dockerEnforcement === 'verified' ? 'configured' : 'failed',
    };
    await this.repository.save(this.active);
    return this.active;
  }

  private async restore(): Promise<void> {
    const saved = await this.repository.load();
    if (saved) {
      this.active = {
        ...saved,
        verified: false,
        verification: { ...saved.verification, errors: ['Startup verification required'] },
        status: 'failed',
      };
    }
  }

  private generate(type: TopologyType): NetworkTopology {
    const nodes =
      type === 'STAR'
        ? [...HOST_NODES, { id: 'router-1', label: 'Router 1', type: 'ROUTER' as const }]
        : [...HOST_NODES];
    const pairs =
      type === 'STAR'
        ? HOST_NODES.map((host) => [host.id, 'router-1'])
        : HOST_NODES.map((host, index) => [host.id, HOST_NODES[(index + 1) % HOST_NODES.length].id]);
    const links = pairs.map(([source, target], index) => ({
      id: `link-${index + 1}`,
      source,
      target,
      capacity: DEFAULT_CAPACITY,
      latency: DEFAULT_LATENCY,
      isActive: true,
    }));
    return {
      status: 'unconfigured',
      type,
      nodes,
      links,
      verified: false,
      configuredAt: new Date().toISOString(),
      verification: {
        hostAvailability: {},
        linkAvailability: {},
        dockerEnforcement: 'not-configured',
        errors: [],
      },
    };
  }

  private empty(): NetworkTopology {
    return {
      status: 'unconfigured',
      type: null,
      nodes: [],
      links: [],
      verified: false,
      configuredAt: null,
      verification: {
        hostAvailability: {},
        linkAvailability: {},
        dockerEnforcement: 'not-configured',
        errors: [],
      },
    };
  }
}
