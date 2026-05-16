import bcrypt from 'bcryptjs';
import { Db } from 'mongodb';
import { getDb } from '../../db/pool.js';

type ProdUserSeed = {
  first_name: string;
  last_name: string;
  email: string;
};

const PROD_USERS: ProdUserSeed[] = [
  { first_name: 'Amadou', last_name: 'Sambe', email: 'amadou.sambe@maconducoeur.local' },
  { first_name: 'Ronald', last_name: 'Rendon', email: 'ronald.rendon@maconducoeur.local' },
  { first_name: 'Kevin', last_name: 'Firaguay', email: 'kevin.firaguay@maconducoeur.local' },
  { first_name: 'Moheb', last_name: 'Jerbi', email: 'moheb.jerbi@maconducoeur.local' },
  { first_name: 'Diego', last_name: 'Patino', email: 'diego.patino@maconducoeur.local' }
];

export async function seedUsersProd(db: Db): Promise<void> {
  const users = db.collection('users');
  await users.createIndex({ email: 1 }, { unique: true });

  const passwordHash = await bcrypt.hash('pmllmp', 10);
  const now = new Date();

  for (const user of PROD_USERS) {
    await users.updateOne(
      { email: user.email },
      {
        $set: {
          first_name: user.first_name,
          last_name: user.last_name,
          email: user.email,
          password_hash: passwordHash,
          role: 'user',
          updated_at: now
        },
        $setOnInsert: { created_at: now }
      },
      { upsert: true }
    );
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  seedUsersProd(await getDb())
    .then(() => {
      console.log('Seed users prod termine');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Erreur seed users prod:', error);
      process.exit(1);
    });
}
