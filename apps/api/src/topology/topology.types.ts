export type TopologyType = 'STAR' | 'RING';
export type NodeType = 'HOST' | 'ROUTER';

export interface NetworkNode {
  id: string;
  label: string;
  type: NodeType;
  priority?: 'URGENT' | 'MEDIUM' | 'LOW';
}

export interface NetworkLink {
  id: string;
  source: string;
  target: string;
  capacity: number;
  latency: number;
  isActive: boolean;
}

export interface NetworkTopology {
  status: 'configured' | 'unconfigured' | 'failed';
  type: TopologyType | null;
  nodes: NetworkNode[];
  links: NetworkLink[];
  verified: boolean;
  configuredAt: string | null;
  verification: VerificationResult;
}

export interface VerificationResult {
  hostAvailability: Record<string, 'online' | 'offline'>;
  linkAvailability: Record<string, boolean>;
  dockerEnforcement: 'unavailable' | 'not-configured' | 'verified';
  errors: string[];
}

export interface TopologyRequest {
  type: unknown;
}
