import axios from 'axios';
import type { TopologyType } from './topology.types';

export interface DockerEnforcementResult {
  status: 'unavailable' | 'not-configured' | 'verified';
  error?: string;
  errors?: string[];
  linkStatus?: Record<string, boolean>;
  details?: Record<string, any>;
}

/**
 * Communicates with the external privileged Docker Network Orchestrator service.
 * The API container itself runs unprivileged without mounting the Docker socket,
 * isolating privileged Docker operations within the dedicated orchestrator.
 */
export class DockerNetworkService {
  private readonly orchestratorUrl: string;

  constructor() {
    this.orchestratorUrl = process.env.ORCHESTRATOR_URL ?? 'http://orchestrator:5000';
  }

  async apply(type: TopologyType): Promise<DockerEnforcementResult> {
    try {
      const response = await axios.post<DockerEnforcementResult>(
        `${this.orchestratorUrl}/topology/apply`,
        { type },
        { timeout: 25000 }
      );
      return {
        status: response.data.status ?? 'verified',
        errors: response.data.errors ?? [],
        linkStatus: response.data.linkStatus,
        details: response.data.details,
      };
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.error ||
        error.response?.data?.message ||
        error.message ||
        'Failed to connect to Docker orchestrator';
      return {
        status: 'unavailable',
        error: `Physical Docker topology enforcement failed: ${errorMessage}`,
        errors: [errorMessage],
      };
    }
  }

  async setLinkState(type: TopologyType, linkId: string, isActive: boolean): Promise<DockerEnforcementResult> {
    try {
      const response = await axios.post<DockerEnforcementResult>(
        `${this.orchestratorUrl}/links/${linkId}/state`,
        { type, isActive },
        { timeout: 15000 }
      );
      return {
        status: response.data.status ?? 'verified',
        errors: response.data.errors ?? [],
        linkStatus: response.data.linkStatus,
      };
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.error ||
        error.response?.data?.message ||
        error.message ||
        'Failed to update link state via orchestrator';
      return {
        status: 'unavailable',
        error: errorMessage,
        errors: [errorMessage],
      };
    }
  }

  async checkStatus(): Promise<DockerEnforcementResult> {
    try {
      const response = await axios.get<{ verification?: DockerEnforcementResult }>(
        `${this.orchestratorUrl}/topology/status`,
        { timeout: 5000 }
      );
      return {
        status: response.data.verification?.status ?? 'verified',
        linkStatus: response.data.verification?.linkStatus,
      };
    } catch {
      return {
        status: 'unavailable',
        error: 'Physical Docker topology enforcement requires an external privileged orchestrator; the orchestrator is unreachable.',
      };
    }
  }
}
