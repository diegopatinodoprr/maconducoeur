import { getDb } from '../db/pool.js';
import { seedManufacturers } from './seeds/seed-manufacturers.js';
import { seedTools } from './seeds/seed-tools.js';
import { seedUsers } from './seeds/seed-users.js';

async function seed(): Promise<void> {
  const db = await getDb();

  await seedUsers(db);
  await seedManufacturers(db);
  await seedTools(db);

  console.log('MongoDB seed termine');
  process.exit(0);
}

seed().catch((error) => {
  console.error('Erreur seed MongoDB:', error);
  process.exit(1);
});
