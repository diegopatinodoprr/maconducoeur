import { Router } from 'express';
import { ObjectId } from 'mongodb';
import { getDb } from '../db/pool.js';
import { requireAdmin } from '../middlewares/auth.js';
import { seedManufacturers } from '../scripts/seeds/seed-manufacturers.js';
import { seedUsersProd } from '../scripts/seeds/seed-users-prod.js';

const router = Router();

type DbConnection = {
  _id: ObjectId;
  user_id: ObjectId;
  email: string;
  role: 'admin' | 'user';
  connected_at: Date;
  ip?: string | null;
  user_agent?: string | null;
};

router.get('/admin/metrics/connections', requireAdmin, async (req, res) => {
  const rawLimit = Array.isArray(req.query.limit) ? req.query.limit[0] : req.query.limit;
  const limit = Math.min(Math.max(Number(rawLimit ?? 100) || 100, 1), 500);

  try {
    const db = await getDb();
    const rows = await db
      .collection<DbConnection>('connections')
      .find({}, { sort: { connected_at: -1 }, limit })
      .toArray();

    res.json(
      rows.map((row) => ({
        id: row._id.toHexString(),
        user_id: row.user_id.toHexString(),
        email: row.email,
        role: row.role,
        connected_at: row.connected_at,
        ip: row.ip ?? null,
        user_agent: row.user_agent ?? null
      }))
    );
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur', error: (error as Error).message });
  }
});

router.post('/admin/seedprod', requireAdmin, async (_req, res) => {
  try {
    const db = await getDb();

    await seedUsersProd(db);
    await seedManufacturers(db);

    res.json({
      message: 'Seed prod execute avec success',
      executed: ['seedUsersProd', 'seedManufacturers']
    });
  } catch (error) {
    res.status(500).json({ message: 'Erreur seed prod', error: (error as Error).message });
  }
});

export default router;
