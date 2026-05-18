import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import type { NextFunction, Request, Response } from 'express';
import { createServer } from 'http';
import WebSocket, { WebSocketServer } from 'ws';
import authRoutes from './routes/auth.js';
import adminRoutes from './routes/admin.js';
import borrowingRoutes from './routes/borrowings.js';
import fileRoutes from './routes/files.js';
import healthRoutes from './routes/health.js';
import toolRoutes from './routes/tools.js';
import userRoutes from './routes/users.js';
import { env } from './config/env.js';
import { AppEvent, setEventBroadcaster } from './realtime/events.js';

const app = express();
const httpServer = createServer(app);

function maskSensitiveBody(body: unknown): unknown {
  if (!body || typeof body !== 'object') return body;
  const clone = { ...(body as Record<string, unknown>) };
  const sensitiveKeys = ['password', 'current_password', 'new_password', 'token'];
  for (const key of sensitiveKeys) {
    if (key in clone) clone[key] = '***';
  }
  return clone;
}

app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  const requestId = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;

  const bodyPreview =
    req.method === 'GET' || req.method === 'HEAD' ? null : maskSensitiveBody(req.body);
  const authState = req.headers.authorization ? 'auth:yes' : 'auth:no';

  console.log(
    `[REQ ${requestId}] ${req.method} ${req.originalUrl} ip=${req.ip ?? '-'} ${authState} ua="${req.get('user-agent') ?? '-'}"${
      bodyPreview ? ` body=${JSON.stringify(bodyPreview)}` : ''
    }`
  );

  res.on('finish', () => {
    const durationMs = Date.now() - start;
    console.log(
      `[RES ${requestId}] ${req.method} ${req.originalUrl} status=${res.statusCode} duration=${durationMs}ms`
    );
  });

  next();
});

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' }
  })
);
app.use(cors({ origin: 'http://localhost:4200' }));
app.use(express.json());
app.use('/uploads', express.static('uploads'));

app.use('/api', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api', fileRoutes);
app.use('/api', userRoutes);
app.use('/api', toolRoutes);
app.use('/api', borrowingRoutes);
app.use('/api', adminRoutes);

const wsServer = new WebSocketServer({ server: httpServer, path: '/ws' });

setEventBroadcaster((event: AppEvent) => {
  const message = JSON.stringify({ kind: 'app.event', event });
  for (const client of wsServer.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }
});

httpServer.listen(env.port, () => {
  console.log(`[BOOT] Backend running on http://localhost:${env.port}`);
  console.log(`[BOOT] Environment loaded (db="${env.mongo.dbName}")`);
});
