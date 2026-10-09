import type { NetworkNode } from './topology.types';

export const HOST_NODES: NetworkNode[] = [
  { id: 'host-1', label: 'Emergency Service', type: 'HOST', priority: 'URGENT' },
  { id: 'host-2', label: 'Authentication Service', type: 'HOST', priority: 'URGENT' },
  { id: 'host-3', label: 'Academic Platform', type: 'HOST', priority: 'MEDIUM' },
  { id: 'host-4', label: 'File Transfer', type: 'HOST', priority: 'LOW' },
  { id: 'host-5', label: 'Background Processing', type: 'HOST', priority: 'LOW' },
];

export const DEFAULT_CAPACITY = 100;
export const DEFAULT_LATENCY = 10;
