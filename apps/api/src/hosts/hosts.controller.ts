import type { Request, Response, Router } from 'express';
import express from 'express';
import { HostsService } from './hosts.service';

export function createHostsRouter(service: HostsService): Router {
  const router = express.Router();
  router.get('/', async (_request: Request, response: Response) => {
    response.json(await service.findAll());
  });
  router.get('/:id', async (request: Request, response: Response) => {
    const id = Array.isArray(request.params.id) ? request.params.id[0] : request.params.id;
    const host = await service.findOne(id);
    if (!host) {
      response.status(404).json({ statusCode: 404, message: `Unknown host: ${id}` });
      return;
    }
    response.json(host);
  });
  return router;
}
