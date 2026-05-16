import { getDb } from '../db/pool.js';
import { seedManufacturers } from './seeds/seed-manufacturers.js';
import { seedUsersProd } from './seeds/seed-users-prod.js';

async function seedProd(): Promise<void> {
  const db = await getDb();

  await seedUsersProd(db);
  await seedManufacturers(db);

  console.log('MongoDB seed prod termine');
  process.exit(0);
}

seedProd().catch((error) => {
  console.error('Erreur seed MongoDB prod:', error);
  process.exit(1);
});
