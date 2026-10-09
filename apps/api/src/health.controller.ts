import type { Request, Response, Router } from 'express';
import express from 'express';

export function createHealthRouter(): Router {
  const router = express.Router();
  
  router.get('/', (_request: Request, response: Response) => {
    response.json({ status: 'ok', service: 'network-router-api', timestamp: new Date().toISOString() });
  });
  return router;
}
