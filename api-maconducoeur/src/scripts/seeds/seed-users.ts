import bcrypt from 'bcryptjs';
import { Db } from 'mongodb';
import { getDb } from '../../db/pool.js';

export async function seedUsers(db: Db): Promise<void> {
  const users = db.collection('users');
  await users.createIndex({ email: 1 }, { unique: true });

  const adminHash = await bcrypt.hash('Admin@123', 10);
  const userHash = await bcrypt.hash('User@123', 10);

  await users.updateOne(
    { email: 'admin@maconducoeur.local' },
    {
      $set: {
        first_name: 'Admin',
        last_name: 'Principal',
        email: 'admin@maconducoeur.local',
        password_hash: adminHash,
        role: 'admin',
        credits: 0,
        created_at: new Date()
      }
    },
    { upsert: true }
  );

  await users.updateOne(
    { email: 'user@maconducoeur.local' },
    {
      $set: {
        first_name: 'Jean',
        last_name: 'Utilisateur',
        email: 'user@maconducoeur.local',
        password_hash: userHash,
        role: 'user',
        credits: 0,
        created_at: new Date()
      }
    },
    { upsert: true }
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  seedUsers(await getDb())
    .then(() => {
      console.log('Seed users termine');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Erreur seed users:', error);
      process.exit(1);
    });
}
