import axios from 'axios';
import { DockerClient } from './docker.client.js';

export interface VerificationDetails {
  hostAvailability: Record<string, 'online' | 'offline'>;
  linkAvailability: Record<string, boolean>;
  dockerEnforcement: 'unavailable' | 'not-configured' | 'verified';
  errors: string[];
  forwardingTested?: boolean;
  isolationTested?: boolean;
  details?: Record<string, any>;
}

export interface ApplyResult {
  status: 'verified' | 'unavailable' | 'not-configured';
  error?: string;
  errors?: string[];
  linkStatus?: Record<string, boolean>;
  verification: VerificationDetails;
}

const HOSTS = ['host-1', 'host-2', 'host-3', 'host-4', 'host-5'];

export class NetworkOrchestrator {
  private readonly docker = new DockerClient();
  private changing = false;
  private currentTopology: 'STAR' | 'RING' | null = null;
  private linkStates: Record<string, boolean> = {};

  async isReady(): Promise<boolean> {
    return this.docker.isDockerAvailable();
  }

  getCurrentTopology(): 'STAR' | 'RING' | null {
    return this.currentTopology;
  }

  getLinkStates(): Record<string, boolean> {
    return { ...this.linkStates };
  }

  async apply(type: 'STAR' | 'RING'): Promise<ApplyResult> {
    if (this.changing) {
      return {
        status: 'unavailable',
        error: 'A topology change is already in progress',
        errors: ['A topology change is already in progress'],
        verification: this.emptyVerification('unavailable', ['A topology change is already in progress']),
      };
    }

    if (!(await this.docker.isDockerAvailable())) {
      return {
        status: 'unavailable',
        error: 'Docker daemon is not accessible from the orchestrator',
        errors: ['Docker daemon is not accessible from the orchestrator'],
        verification: this.emptyVerification('unavailable', ['Docker daemon is not accessible']),
      };
    }

    this.changing = true;
    const previousTopology = this.currentTopology;
    const previousLinkStates = { ...this.linkStates };

    // Snapshot existing container network connections for rollback
    const containerIds = await this.resolveContainers();
    const snapshot = await this.snapshotNetworks(containerIds);

    try {
      if (type === 'STAR') {
        await this.configureStar(containerIds);
      } else {
        await this.configureRing(containerIds);
      }

      // Initialize all links as active
      this.currentTopology = type;
      this.linkStates = {
        'link-1': true,
        'link-2': true,
        'link-3': true,
        'link-4': true,
        'link-5': true,
      };

      // Run verification
      const verification = await this.verifyTopology(type, containerIds, this.linkStates);

      if (verification.errors.length > 0) {
        // Verification failed - rollback
        console.error('Topology verification failed:', verification.errors);
        await this.rollback(containerIds, snapshot);
        this.currentTopology = previousTopology;
        this.linkStates = previousLinkStates;
        return {
          status: 'unavailable',
          error: verification.errors.join('; '),
          errors: verification.errors,
          verification,
        };
      }

      // Verification passed! Clean up old networks that are no longer needed
      await this.cleanupUnusedNetworks(type);

      return {
        status: 'verified',
        verification,
        linkStatus: this.linkStates,
      };
    } catch (error: any) {
      console.error('Failed to configure topology:', error);
      await this.rollback(containerIds, snapshot);
      this.currentTopology = previousTopology;
      this.linkStates = previousLinkStates;
      const msg = error.message || 'Unknown configuration error';
      return {
        status: 'unavailable',
        error: msg,
        errors: [msg],
        verification: this.emptyVerification('unavailable', [msg]),
      };
    } finally {
      this.changing = false;
    }
  }

  async setLinkState(type: 'STAR' | 'RING', linkId: string, isActive: boolean): Promise<ApplyResult> {
    if (this.changing) {
      return {
        status: 'unavailable',
        error: 'A topology change is already in progress',
        errors: ['A topology change is already in progress'],
        verification: this.emptyVerification('unavailable', ['A topology change is already in progress']),
      };
    }
    this.changing = true;
    try {
      const containerIds = await this.resolveContainers();
      this.linkStates[linkId] = isActive;

      if (type === 'STAR') {
        // In STAR: link-1 is host-1 <-> router-1 on campusresq_star_host-1
        const hostIndex = Number(linkId.replace('link-', ''));
        const hostName = `host-${hostIndex}`;
        const netName = `campusresq_star_${hostName}`;
        const hostId = containerIds[hostName];
        if (hostId) {
          if (isActive) {
            await this.docker.connect(netName, hostId, hostName);
          } else {
            await this.docker.disconnect(netName, hostId);
          }
        }
      } else {
        // In RING:
        // link-1: host-1 <-> host-2 on campusresq_ring_1-2
        // link-2: host-2 <-> host-3 on campusresq_ring_2-3
        // link-3: host-3 <-> host-4 on campusresq_ring_3-4
        // link-4: host-4 <-> host-5 on campusresq_ring_4-5
        // link-5: host-5 <-> host-1 on campusresq_ring_5-1
        const netMap: Record<string, { net: string; host: string }> = {
          'link-1': { net: 'campusresq_ring_1-2', host: 'host-1' },
          'link-2': { net: 'campusresq_ring_2-3', host: 'host-2' },
          'link-3': { net: 'campusresq_ring_3-4', host: 'host-3' },
          'link-4': { net: 'campusresq_ring_4-5', host: 'host-4' },
          'link-5': { net: 'campusresq_ring_5-1', host: 'host-5' },
        };
        const mapping = netMap[linkId];
        if (mapping && containerIds[mapping.host]) {
          if (isActive) {
            await this.docker.connect(mapping.net, containerIds[mapping.host], mapping.host);
          } else {
            await this.docker.disconnect(mapping.net, containerIds[mapping.host]);
          }
        }
      }

      // Run verification for updated link state
      const verification = await this.verifyTopology(type, containerIds, this.linkStates);

      return {
        status: 'verified',
        verification,
        linkStatus: { ...this.linkStates },
      };
    } finally {
      this.changing = false;
    }
  }

  async verifyCurrent(): Promise<VerificationDetails> {
    if (!this.currentTopology) {
      return this.emptyVerification('not-configured', []);
    }
    const containerIds = await this.resolveContainers();
    return this.verifyTopology(this.currentTopology, containerIds, this.linkStates);
  }

  private async resolveContainers(): Promise<Record<string, string>> {
    const services = [...HOSTS, 'router-1', 'api', 'web'];
    const result: Record<string, string> = {};
    for (const service of services) {
      const id = await this.docker.findContainerId(service);
      if (id) {
        result[service] = id;
      }
    }
    return result;
  }

  private async snapshotNetworks(containerIds: Record<string, string>): Promise<Record<string, string[]>> {
    const snapshot: Record<string, string[]> = {};
    for (const [name, id] of Object.entries(containerIds)) {
      const nets = await this.docker.getContainerNetworks(id);
      snapshot[name] = Object.keys(nets);
    }
    return snapshot;
  }

  private async rollback(containerIds: Record<string, string>, snapshot: Record<string, string[]>): Promise<void> {
    console.log('Rolling back network configuration to snapshot...');
    for (const [name, id] of Object.entries(containerIds)) {
      const targetNets = snapshot[name] || [];
      const currentNets = Object.keys(await this.docker.getContainerNetworks(id));

      // Connect any missing
      for (const net of targetNets) {
        if (!currentNets.includes(net)) {
          try {
            await this.docker.connect(net, id, name);
          } catch (e: any) {
            console.warn(`Rollback connect ${net} to ${name} failed:`, e.message);
          }
        }
      }

      // Disconnect any extras
      for (const net of currentNets) {
        if (!targetNets.includes(net)) {
          try {
            await this.docker.disconnect(net, id);
          } catch (e: any) {
            console.warn(`Rollback disconnect ${net} from ${name} failed:`, e.message);
          }
        }
      }
    }
  }

  private async configureStar(containerIds: Record<string, string>): Promise<void> {
    const routerId = containerIds['router-1'];
    const apiId = containerIds['api'];
    const defaultNet = await this.getDefaultNetworkName();

    if (!routerId) throw new Error('router-1 container not found');

    // 1. Create star spoke networks
    for (const host of HOSTS) {
      const netName = `campusresq_star_${host}`;
      await this.docker.createNetwork(netName);

      // Connect router-1
      await this.docker.connect(netName, routerId, 'router-1');

      // Connect the host
      const hostId = containerIds[host];
      if (hostId) {
        await this.docker.connect(netName, hostId, host);
      }

      // Connect api for health checking and monitoring
      if (apiId) {
        await this.docker.connect(netName, apiId, 'api');
      }
    }

    // 2. Disconnect hosts and router from default bridge to eliminate direct bypass
    for (const host of HOSTS) {
      const hostId = containerIds[host];
      if (hostId && defaultNet) {
        await this.docker.disconnect(defaultNet, hostId);
      }
    }
    if (defaultNet) {
      await this.docker.disconnect(defaultNet, routerId);
    }
  }

  private async configureRing(containerIds: Record<string, string>): Promise<void> {
    const apiId = containerIds['api'];
    const defaultNet = await this.getDefaultNetworkName();

    const ringPairs = [
      ['host-1', 'host-2', 'campusresq_ring_1-2'],
      ['host-2', 'host-3', 'campusresq_ring_2-3'],
      ['host-3', 'host-4', 'campusresq_ring_3-4'],
      ['host-4', 'host-5', 'campusresq_ring_4-5'],
      ['host-5', 'host-1', 'campusresq_ring_5-1'],
    ];

    // 1. Create ring point-to-point networks
    for (const [h1, h2, netName] of ringPairs) {
      await this.docker.createNetwork(netName);

      const id1 = containerIds[h1];
      const id2 = containerIds[h2];

      if (id1) await this.docker.connect(netName, id1, h1);
      if (id2) await this.docker.connect(netName, id2, h2);

      if (apiId) {
        await this.docker.connect(netName, apiId, 'api');
      }
    }

    // 2. Disconnect hosts and router from default bridge
    for (const host of HOSTS) {
      const hostId = containerIds[host];
      if (hostId && defaultNet) {
        await this.docker.disconnect(defaultNet, hostId);
      }
    }
    const routerId = containerIds['router-1'];
    if (routerId && defaultNet) {
      await this.docker.disconnect(defaultNet, routerId);
    }
  }

  private async getDefaultNetworkName(): Promise<string> {
    const nets = await this.docker.runDocker(['network', 'ls', '--format', '{{.Name}}']);
    const list = nets.split('\n').map((n) => n.trim());
    const match = list.find((n) => n.includes('default') && n.includes('campusresq'));
    return match || 'campusresq_default';
  }

  private async cleanupUnusedNetworks(activeType: 'STAR' | 'RING'): Promise<void> {
    const allTopoNets = await this.docker.listTopologyNetworks();
    const keepPrefix = activeType === 'STAR' ? 'campusresq_star_' : 'campusresq_ring_';

    for (const net of allTopoNets) {
      if (!net.startsWith(keepPrefix)) {
        await this.docker.removeNetwork(net);
      }
    }
  }

  private async verifyTopology(
    type: 'STAR' | 'RING',
    containerIds: Record<string, string>,
    linkStates: Record<string, boolean>
  ): Promise<VerificationDetails> {
    const errors: string[] = [];
    const hostAvailability: Record<string, 'online' | 'offline'> = {};
    const linkAvailability: Record<string, boolean> = {};

    // 1. Verify Host Reachability (all 5 hosts online)
    for (const host of HOSTS) {
      const online = await this.checkHostHealth(host);
      hostAvailability[host] = online ? 'online' : 'offline';
      if (!online) {
        errors.push(`${host} is offline`);
      }
    }

    // Check router-1 in STAR
    if (type === 'STAR') {
      const routerOnline = await this.checkHostHealth('router-1');
      if (!routerOnline) {
        errors.push('router-1 is offline');
      }
    }

    // 2. Verify Links
    if (type === 'STAR') {
      for (let i = 1; i <= 5; i++) {
        const linkId = `link-${i}`;
        const host = `host-${i}`;
        const shouldBeActive = linkStates[linkId] ?? true;

        if (hostAvailability[host] === 'online') {
          const directOk = await this.testDirectConnection(containerIds[host], 'router-1', 8000);
          linkAvailability[linkId] = directOk;

          if (shouldBeActive && !directOk) {
            errors.push(`Required link ${linkId} (${host} <-> router-1) is not connected`);
          } else if (!shouldBeActive && directOk) {
            errors.push(`Failed link ${linkId} (${host} <-> router-1) is unexpectedly connected`);
          }
        } else {
          linkAvailability[linkId] = false;
        }
      }

      // 3. Verify STAR Isolation: Direct host-1 <-> host-2 must be blocked!
      const directBlocked = !(await this.testDirectConnection(containerIds['host-1'], 'host-2', 8000));
      if (!directBlocked) {
        errors.push('STAR Isolation violation: host-1 has direct connection to host-2 bypassing router-1');
      }

      // 4. Verify STAR Router Forwarding: host-1 reaches host-3 through router-1
      const forwardOk = await this.testStarForwarding('host-1', 'host-3');
      if (!forwardOk) {
        errors.push('STAR Forwarding failed: router-1 could not forward traffic from host-1 to host-3');
      }
    } else {
      // RING verification
      const ringPairs: [string, string, string][] = [
        ['link-1', 'host-1', 'host-2'],
        ['link-2', 'host-2', 'host-3'],
        ['link-3', 'host-3', 'host-4'],
        ['link-4', 'host-4', 'host-5'],
        ['link-5', 'host-5', 'host-1'],
      ];

      for (const [linkId, h1, h2] of ringPairs) {
        const shouldBeActive = linkStates[linkId] ?? true;
        if (hostAvailability[h1] === 'online' && hostAvailability[h2] === 'online') {
          const directOk = await this.testDirectConnection(containerIds[h1], h2, 8000);
          linkAvailability[linkId] = directOk;

          if (shouldBeActive && !directOk) {
            errors.push(`Required link ${linkId} (${h1} <-> ${h2}) is not connected`);
          } else if (!shouldBeActive && directOk) {
            errors.push(`Failed link ${linkId} (${h1} <-> ${h2}) is unexpectedly connected`);
          }
        } else {
          linkAvailability[linkId] = false;
        }
      }

      // 3. Verify RING Isolation: Non-neighbor direct link (host-1 to host-3) must be BLOCKED!
      const directBlocked = !(await this.testDirectConnection(containerIds['host-1'], 'host-3', 8000));
      if (!directBlocked) {
        errors.push('RING Isolation violation: host-1 has direct connection to non-neighbor host-3');
      }

      // 4. Verify RING Multi-hop Forwarding: host-1 reaches host-3 via neighbor host-2
      const forwardOk = await this.testRingForwarding('host-1', 'host-3');
      if (!forwardOk) {
        errors.push('RING Forwarding failed: host-1 could not forward traffic to host-3 along ring');
      }
    }

    return {
      hostAvailability,
      linkAvailability,
      dockerEnforcement: errors.length === 0 ? 'verified' : 'unavailable',
      errors,
      forwardingTested: true,
      isolationTested: true,
    };
  }

  private async checkHostHealth(host: string): Promise<boolean> {
    try {
      const resp = await axios.get(`http://${host}:8000/health`, { timeout: 1200 });
      return resp.data?.status === 'ok';
    } catch {
      return false;
    }
  }

  private async testDirectConnection(
    containerId: string | undefined,
    targetHost: string,
    port: number
  ): Promise<boolean> {
    if (!containerId) return false;
    try {
      // Run quick python socket check inside the container namespace
      const cmd = [
        'python',
        '-c',
        `import socket; s = socket.socket(); s.settimeout(0.5); s.connect(('${targetHost}', ${port})); s.close(); print('OK')`,
      ];
      const out = await this.docker.execInContainer(containerId, cmd);
      return out.includes('OK');
    } catch {
      return false;
    }
  }

  private async testStarForwarding(source: string, target: string): Promise<boolean> {
    try {
      const resp = await axios.post(
        'http://router-1:8000/forward',
        { source, target, payload: 'verify-star' },
        { timeout: 2000 }
      );
      return resp.data?.status === 'routed';
    } catch {
      return false;
    }
  }

  private async testRingForwarding(source: string, target: string): Promise<boolean> {
    try {
      const resp = await axios.post(
        `http://${source}:8000/send`,
        { source, target, topology: 'RING', payload: 'verify-ring' },
        { timeout: 2500 }
      );
      return resp.data?.status === 'delivered';
    } catch {
      return false;
    }
  }

  private emptyVerification(
    dockerEnforcement: 'unavailable' | 'not-configured' | 'verified',
    errors: string[]
  ): VerificationDetails {
    return {
      hostAvailability: {},
      linkAvailability: {},
      dockerEnforcement,
      errors,
    };
  }
}
