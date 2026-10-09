import express from 'express';
import cors from 'cors';
import { createHealthRouter } from './health.controller';
import { createHostsRouter } from './hosts/hosts.controller';
import { HostsService } from './hosts/hosts.service';
import { createTopologyRouter } from './topology/topology.controller';
import { TopologyService } from './topology/topology.service';

const app = express();
const hosts = new HostsService();
const topology = new TopologyService(hosts);
app.use(cors());
app.use(express.json());
app.use('/api/health', createHealthRouter());
app.use('/api/hosts', createHostsRouter(hosts));
app.use('/api/topology', createTopologyRouter(topology));

app.use((_request, response) => {
  response.status(404).json({ statusCode: 404, message: 'Route not found' });
});

const port = Number(process.env.API_PORT ?? 3001);
app.listen(port, '0.0.0.0', () => {
  console.log(`Network Router API listening on port ${port}`);
});
