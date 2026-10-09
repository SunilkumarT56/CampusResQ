import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export interface ContainerNetworkInfo {
  networkName: string;
  ipAddress: string;
  aliases: string[];
}

export class DockerClient {
  async runDocker(args: string[]): Promise<string> {
    try {
      const { stdout } = await execFileAsync('docker', args);
      return stdout.trim();
    } catch (error: any) {
      const stderr = error.stderr?.trim() || error.message;
      throw new Error(`docker ${args.join(' ')} failed: ${stderr}`);
    }
  }

  async isDockerAvailable(): Promise<boolean> {
    try {
      await this.runDocker(['info', '--format', '{{.ServerVersion}}']);
      return true;
    } catch {
      return false;
    }
  }

  async findContainerId(serviceName: string): Promise<string | null> {
    try {
      // First try by compose label
      const out = await this.runDocker([
        'ps',
        '-q',
        '--filter',
        `label=com.docker.compose.service=${serviceName}`,
      ]);
      if (out) {
        const id = out.split('\n')[0].trim();
        if (id) return id;
      }
      // Fallback: try by container name prefix/suffix
      const outByName = await this.runDocker([
        'ps',
        '-q',
        '--filter',
        `name=${serviceName}`,
      ]);
      if (outByName) {
        const id = outByName.split('\n')[0].trim();
        if (id) return id;
      }
      return null;
    } catch {
      return null;
    }
  }

  async getContainerNetworks(containerId: string): Promise<Record<string, any>> {
    try {
      const jsonStr = await this.runDocker([
        'inspect',
        containerId,
        '--format',
        '{{json .NetworkSettings.Networks}}',
      ]);
      return JSON.parse(jsonStr || '{}');
    } catch {
      return {};
    }
  }

  async networkExists(networkName: string): Promise<boolean> {
    try {
      await this.runDocker(['network', 'inspect', networkName]);
      return true;
    } catch {
      return false;
    }
  }

  async createNetwork(networkName: string, subnet?: string): Promise<void> {
    if (await this.networkExists(networkName)) return;
    const args = ['network', 'create', '--label', 'campusresq.topology=true', '--driver', 'bridge'];
    if (subnet) {
      args.push('--subnet', subnet);
    }
    args.push(networkName);
    await this.runDocker(args);
  }

  async removeNetwork(networkName: string): Promise<void> {
    try {
      if (await this.networkExists(networkName)) {
        await this.runDocker(['network', 'rm', networkName]);
      }
    } catch (err: any) {
      // Ignore if in use or already gone
      console.warn(`Could not remove network ${networkName}:`, err.message);
    }
  }

  async connect(networkName: string, containerId: string, alias?: string): Promise<void> {
    const nets = await this.getContainerNetworks(containerId);
    if (nets[networkName]) {
      // Already connected
      return;
    }
    const args = ['network', 'connect'];
    if (alias) {
      args.push('--alias', alias);
    }
    args.push(networkName, containerId);
    try {
      await this.runDocker(args);
    } catch (err: any) {
      if (!err.message.includes('already exists in network')) {
        throw err;
      }
    }
  }

  async disconnect(networkName: string, containerId: string): Promise<void> {
    const nets = await this.getContainerNetworks(containerId);
    if (!nets[networkName]) {
      // Not connected
      return;
    }
    try {
      await this.runDocker(['network', 'disconnect', networkName, containerId]);
    } catch (err: any) {
      if (!err.message.includes('is not connected')) {
        throw err;
      }
    }
  }

  async execInContainer(containerId: string, cmd: string[]): Promise<string> {
    return this.runDocker(['exec', containerId, ...cmd]);
  }

  async listTopologyNetworks(): Promise<string[]> {
    try {
      const out = await this.runDocker([
        'network',
        'ls',
        '--filter',
        'label=campusresq.topology=true',
        '--format',
        '{{.Name}}',
      ]);
      return out.split('\n').map((n) => n.trim()).filter(Boolean);
    } catch {
      return [];
    }
  }
}
