import express from 'express';
import { NetworkOrchestrator } from './orchestrator.js';

const app = express();
app.use(express.json());

const orchestrator = new NetworkOrchestrator();

app.get('/health', async (_req, res) => {
  const dockerAvailable = await orchestrator.isReady();
  res.json({
    status: 'ok',
    service: 'network-orchestrator',
    dockerAvailable,
  });
});

app.post('/topology/apply', async (req, res) => {
  const { type } = req.body;
  if (type !== 'STAR' && type !== 'RING') {
    res.status(400).json({ error: 'type must be STAR or RING' });
    return;
  }
  const result = await orchestrator.apply(type);
  if (result.status === 'verified') {
    res.json(result);
  } else {
    res.status(503).json(result);
  }
});

app.post('/topology/verify', async (_req, res) => {
  const result = await orchestrator.verifyCurrent();
  res.json(result);
});

app.post('/links/:id/state', async (req, res) => {
  const linkId = req.params.id;
  const { type, isActive } = req.body;
  if (typeof isActive !== 'boolean') {
    res.status(400).json({ error: 'isActive must be a boolean' });
    return;
  }
  const result = await orchestrator.setLinkState(type, linkId, isActive);
  if (result.status === 'verified') {
    res.json(result);
  } else {
    res.status(503).json(result);
  }
});

app.get('/topology/status', async (_req, res) => {
  const verification = await orchestrator.verifyCurrent();
  res.json({
    topology: orchestrator.getCurrentTopology(),
    linkStates: orchestrator.getLinkStates(),
    verification,
  });
});

const port = Number(process.env.PORT ?? 5000);
app.listen(port, '0.0.0.0', () => {
  console.log(`Network Orchestrator listening on port ${port}`);
});
