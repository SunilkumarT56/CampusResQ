import type { HostsService } from '../hosts/hosts.service';
import type { NetworkLink, NetworkTopology, VerificationResult } from './topology.types';
import type { DockerEnforcementResult } from './docker-network.service';

export class NetworkVerificationService {
  constructor(private readonly hosts: HostsService) {}

  async verify(topology: NetworkTopology, docker: DockerEnforcementResult): Promise<VerificationResult> {
    const statuses = await this.hosts.findAll();
    const hostAvailability = Object.fromEntries(statuses.map((host) => [host.id, host.status]));
    const linkAvailability = Object.fromEntries(
      topology.links.map((link) => [link.id, this.isLinkAvailable(link, hostAvailability, docker)])
    );
    const errors = Object.entries(hostAvailability)
      .filter(([, status]) => status !== 'online')
      .map(([id]) => `${id} is offline`);

    if (docker.error && !errors.includes(docker.error)) {
      errors.push(docker.error);
    }
    if (docker.errors && docker.errors.length > 0) {
      for (const err of docker.errors) {
        if (!errors.includes(err)) errors.push(err);
      }
    }

    return { hostAvailability, linkAvailability, dockerEnforcement: docker.status, errors };
  }

  private isLinkAvailable(
    link: NetworkLink,
    hosts: Record<string, 'online' | 'offline'>,
    docker?: DockerEnforcementResult
  ): boolean {
    if (docker?.linkStatus && docker.linkStatus[link.id] !== undefined) {
      return docker.linkStatus[link.id];
    }
    const sourceOnline = hosts[link.source] === 'online';
    const targetOnline = link.target === 'router-1' ? true : hosts[link.target] === 'online';
    return link.isActive && sourceOnline && targetOnline;
  }
}
