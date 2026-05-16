import { Router } from 'express';
import { pingDatabase } from '../db/pool.js';

const router = Router();

router.get('/health', async (_req, res) => {
  const dbOk = await pingDatabase();
  res.status(dbOk ? 200 : 503).json({
    service: 'maconducoeur-backend',
    status: dbOk ? 'ok' : 'degraded',
    database: dbOk ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString()
  });
});

export default router;
