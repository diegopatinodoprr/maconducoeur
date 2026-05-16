import { Router } from 'express';
import { getDb } from '../db/pool.js';
import { requireAdmin } from '../middlewares/auth.js';
import { seedManufacturers } from '../scripts/seeds/seed-manufacturers.js';
import { seedUsersProd } from '../scripts/seeds/seed-users-prod.js';

const router = Router();

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
