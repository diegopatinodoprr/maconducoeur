import { Db, ObjectId } from 'mongodb';
import { getDb } from '../../db/pool.js';

type ManufacturerDoc = {
  _id: ObjectId;
  nom: string;
};

type UserDoc = {
  _id: ObjectId;
  email: string;
};

async function findManufacturerId(db: Db, nom: string): Promise<ObjectId> {
  const manufacturer = await db.collection<ManufacturerDoc>('manufacturers').findOne({ nom });
  if (!manufacturer) {
    throw new Error(`Manufacturer introuvable pour le seed tools: ${nom}`);
  }
  return manufacturer._id;
}

async function findUserIdByEmail(db: Db, email: string): Promise<ObjectId> {
  const user = await db.collection<UserDoc>('users').findOne({ email });
  if (!user) {
    throw new Error(`User introuvable pour le seed tools: ${email}`);
  }
  return user._id;
}

export async function seedTools(db: Db): Promise<void> {
  const tools = db.collection('utils');

  await tools.createIndex({ categorie: 1 });
  await tools.createIndex({ nom: 1 });
  await tools.createIndex({ marque: 1 });
  await tools.createIndex({ owner_user_id: 1 });
  await tools.createIndex({ borrowed_by_user_id: 1 });

  const [boschId, ryobiId, makitaId, adminUserId, normalUserId] = await Promise.all([
    findManufacturerId(db, 'Bosch'),
    findManufacturerId(db, 'Ryobi'),
    findManufacturerId(db, 'Makita'),
    findUserIdByEmail(db, 'admin@maconducoeur.local'),
    findUserIdByEmail(db, 'user@maconducoeur.local')
  ]);

  const now = new Date();
  await tools.updateOne(
    { nom: 'Perceuse visseuse 18V' },
    {
      $set: {
        nom: 'Perceuse visseuse 18V',
        categorie: 'bois',
        description: 'Perceuse sans fil avec 2 batteries',
        marque: boschId,
        owner_user_id: adminUserId,
        borrowed_by_user_id: normalUserId,
        etat: 'bon',
        disponible: false,
        updated_at: now
      },
      $setOnInsert: { created_at: now }
    },
    { upsert: true }
  );

  await tools.updateOne(
    { nom: 'Tondeuse electrique' },
    {
      $set: {
        nom: 'Tondeuse electrique',
        categorie: 'jardin',
        description: 'Tondeuse filaire pour petit jardin',
        marque: ryobiId,
        owner_user_id: normalUserId,
        borrowed_by_user_id: null,
        etat: 'bon',
        disponible: true,
        updated_at: now
      },
      $setOnInsert: { created_at: now }
    },
    { upsert: true }
  );

  await tools.updateOne(
    { nom: 'Multimetre numerique' },
    {
      $set: {
        nom: 'Multimetre numerique',
        categorie: 'electricite',
        description: 'Mesure tension, resistance, continuite',
        marque: makitaId,
        owner_user_id: adminUserId,
        borrowed_by_user_id: null,
        etat: 'neuf',
        disponible: true,
        updated_at: now
      },
      $setOnInsert: { created_at: now }
    },
    { upsert: true }
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  seedTools(await getDb())
    .then(() => {
      console.log('Seed tools termine');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Erreur seed tools:', error);
      process.exit(1);
    });
}
