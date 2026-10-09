import express, { type Request, type Response, type Router } from 'express';
import { TopologyService } from './topology.service';

export function createTopologyRouter(service: TopologyService): Router {
  const router = express.Router();
  router.post('/', async (request: Request, response: Response) => {
    const type = request.body?.type;
    if (type !== 'STAR' && type !== 'RING') {
      response.status(400).json({ statusCode: 400, message: 'type must be STAR or RING' });
      return;
    }
    try {
      response.status(201).json(await service.configure(type));
    } catch (error) {
      response
        .status(503)
        .json({ statusCode: 503, message: error instanceof Error ? error.message : 'Topology configuration failed' });
    }
  });
  router.get('/', (_request, response) => response.json(service.get()));
  router.get('/status', async (_request, response) => response.json(await service.status()));
  router.get('/links', (_request, response) => response.json(service.get().links));
  router.post('/links/:id/fail', updateLink(service, false));
  router.post('/links/:id/restore', updateLink(service, true));
  return router;
}

function updateLink(service: TopologyService, isActive: boolean) {
  return async (request: Request, response: Response) => {
    const id = Array.isArray(request.params.id) ? request.params.id[0] : request.params.id;
    try {
      response.json(await service.setLinkState(id, isActive));
    } catch (error) {
      const isNotFound = error instanceof Error && error.message.startsWith('Unknown link');
      const statusCode = isNotFound ? 404 : 409;
      response
        .status(statusCode)
        .json({ statusCode, message: error instanceof Error ? error.message : 'Link update failed' });
    }
  };
}
