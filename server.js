import express from 'express';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { getConfig, assertDatabaseConfig } from './config.js';
import { createDriver, GraphRepository } from './graph/repository.js';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const config = getConfig();
const app = express();
app.disable('x-powered-by');
app.use(express.json());
app.use(express.static(join(root, 'public')));

let repository;
let startupError;
try {
  assertDatabaseConfig(config.database);
  repository = new GraphRepository(createDriver(config.database));
} catch (error) {
  startupError = error;
}

function unavailable(res, error = startupError) {
  console.error('[database]', error?.message);
  return res.status(503).json({
    error: 'CarePath cannot reach the referral network right now.',
    detail: 'Check the CognoDB connection settings and try again.',
    code: 'DATABASE_UNAVAILABLE',
  });
}

function route(handler) {
  return async (req, res) => {
    if (!repository) return unavailable(res);
    try { return await handler(req, res); }
    catch (error) { return unavailable(res, error); }
  };
}

app.get('/api/health', route(async (_req, res) => res.json({ ok: await repository.health() })));
app.get('/api/overview', route(async (_req, res) => res.json(await repository.overview())));
app.get('/api/specialties', route(async (_req, res) => res.json(await repository.specialties())));
app.get('/api/clinicians', route(async (_req, res) => res.json(await repository.clinicians())));
app.get('/api/recommendations', route(async (req, res) => {
  const sourceId = String(req.query.source || '').trim();
  const specialty = String(req.query.specialty || '').trim();
  const insurance = String(req.query.insurance || '').trim();
  if (!sourceId || !specialty) return res.status(400).json({ error: 'Source clinician and specialty are required.' });
  return res.json(await repository.recommendations({ sourceId, specialty, insurance }));
}));
app.get('/api/network/:id', route(async (req, res) => res.json(await repository.network(req.params.id))));

app.get('*', (_req, res) => res.sendFile(join(root, 'public', 'index.html')));

const server = app.listen(config.port, () => console.log(`CarePath is running on http://localhost:${config.port}`));
const shutdown = async () => {
  server.close();
  if (repository?.driver) await repository.driver.close();
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
