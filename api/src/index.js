import 'dotenv/config';
import 'express-async-errors'; // lets async route handlers reject into the handler below
import express from 'express';
import cors from 'cors';

import { UPLOAD_DIR } from './upload.js';
import authRoutes from './routes/auth.js';
import reportRoutes from './routes/reports.js';
import pipeRoutes from './routes/pipes.js';
import pressureRoutes from './routes/pressure.js';
import statsRoutes from './routes/stats.js';

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

app.use((_req, res) => res.status(404).json({ error: 'Endpoint not found.' }));

// Anything a route throws — including from an async handler — ends up here
// rather than leaving the client waiting on a connection that never answers.
app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ error: 'Something went wrong on our side.' });
});

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`Iyambere API listening on http://localhost:${port}`));
