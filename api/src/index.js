import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import 'express-async-errors'; // lets async route handlers reject into the handler below
import express from 'express';
import cors from 'cors';

import { UPLOAD_DIR } from './upload.js';
import authRoutes from './routes/auth.js';
import reportRoutes from './routes/reports.js';
import pipeRoutes from './routes/pipes.js';
import pressureRoutes from './routes/pressure.js';
import statsRoutes from './routes/stats.js';
import userRoutes from './routes/users.js';
import mapRoutes from './routes/map.js';
import { toHttpError } from './errors.js';

const app = express();

app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use('/uploads', express.static(UPLOAD_DIR));

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'iyambere-api' }));

app.use('/api/auth', authRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/pipes', pipeRoutes);
app.use('/api/pressure', pressureRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/users', userRoutes);
app.use('/api/map', mapRoutes);

app.use('/api', (_req, res) => res.status(404).json({ error: 'Endpoint not found.' }));

// In production the same server also hosts the web app (the Expo web build),
// so the whole platform is one service at one address. WEB_DIR points at the
// exported build; any path that is not an API route gets index.html and the
// app's router takes it from there.
const webDir = path.resolve(process.env.WEB_DIR || '../app/dist');
if (fs.existsSync(path.join(webDir, 'index.html'))) {
  app.use(express.static(webDir, { index: false, maxAge: '1h' }));
  app.get('*', (_req, res) => res.sendFile(path.join(webDir, 'index.html')));
  console.log(`Serving the web app from ${webDir}`);
}

app.use((_req, res) => res.status(404).json({ error: 'Endpoint not found.' }));

// Anything a route throws — including from an async handler — ends up here
// rather than leaving the client waiting on a connection that never answers.
app.use((error, _req, res, _next) => {
  const known = toHttpError(error);
  if (known) return res.status(known.status).json({ error: known.message });
  console.error(error);
  res.status(500).json({ error: 'Something went wrong on our side.' });
});

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`Iyambere API listening on http://localhost:${port}`));
