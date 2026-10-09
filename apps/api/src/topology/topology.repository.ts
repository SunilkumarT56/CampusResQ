import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { NetworkTopology } from './topology.types';

const statePath = process.env.TOPOLOGY_STATE_PATH ?? path.join(process.cwd(), '.data', 'topology.json');

export class TopologyRepository {
  async load(): Promise<NetworkTopology | null> {
    try {
      return JSON.parse(await readFile(statePath, 'utf8')) as NetworkTopology;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw error;
    }
  }

  async save(topology: NetworkTopology): Promise<void> {
    await mkdir(path.dirname(statePath), { recursive: true });
    const temporaryPath = `${statePath}.tmp`;
    await writeFile(temporaryPath, `${JSON.stringify(topology, null, 2)}\n`, 'utf8');
    await rename(temporaryPath, statePath);
  }
}
