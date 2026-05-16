import { Db, MongoClient } from 'mongodb';
import { env } from '../config/env.js';

let client: MongoClient | null = null;
let db: Db | null = null;

export async function getDb(): Promise<Db> {
  if (db) return db;

  client = new MongoClient(env.mongo.uri);
  await client.connect();
  db = client.db(env.mongo.dbName);
  return db;
}

export async function pingDatabase(): Promise<boolean> {
  try {
    const database = await getDb();
    await database.command({ ping: 1 });
    return true;
  } catch {
    return false;
  }
}
