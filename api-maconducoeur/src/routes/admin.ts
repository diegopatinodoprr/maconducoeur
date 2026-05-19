import { Router } from 'express';
import { ObjectId } from 'mongodb';
import { getDb } from '../db/pool.js';
import { AuthenticatedRequest, requireAdmin } from '../middlewares/auth.js';
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

type DbMigration = {
  _id?: ObjectId;
  key: string;
  executed_at: Date;
  executed_by_user_id: ObjectId | null;
  summary: Record<string, unknown>;
};

type DbUser = {
  _id: ObjectId;
  credits?: number | null;
};

type DbBorrowing = {
  _id?: ObjectId;
  tool_id?: ObjectId;
  borrower_user_id?: ObjectId;
  owner_user_id?: ObjectId;
  status?: 'pending' | 'active' | 'finished' | 'rejected';
  created_at?: Date;
  updated_at?: Date;
  start_date: Date;
  end_date: Date;
  mousse_cost?: number | null;
};

type DbMousseLedger = {
  _id?: ObjectId;
  borrowing_id: ObjectId;
  tool_id: ObjectId;
  from_user_id: ObjectId;
  to_user_id: ObjectId;
  mousse_amount: number;
  status: 'pending' | 'settled' | 'canceled';
  created_at: Date;
  updated_at: Date;
  settled_at?: Date;
  canceled_at?: Date;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function computeMousseCost(start: Date, end: Date): number {
  const durationMs = end.getTime() - start.getTime();
  const days = Math.max(1, Math.ceil(durationMs / MS_PER_DAY));
  return Math.max(1, Math.ceil(days / 7));
}

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

router.get('/admin/migrations', requireAdmin, async (_req, res) => {
  try {
    const db = await getDb();
    const rows = await db
      .collection<DbMigration>('admin_migrations')
      .find({}, { sort: { executed_at: -1 } })
      .toArray();

    res.json(
      rows.map((row) => ({
        id: row._id.toHexString(),
        key: row.key,
        executed_at: row.executed_at,
        executed_by_user_id: row.executed_by_user_id?.toHexString?.() ?? null,
        summary: row.summary
      }))
    );
  } catch (error) {
    res.status(500).json({ message: 'Erreur lecture migrations', error: (error as Error).message });
  }
});

router.post('/admin/migrations/run', requireAdmin, async (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const { key } = req.body as { key?: string };
  const migrationKey = key?.trim();

  if (!migrationKey) {
    res.status(400).json({ message: 'key migration requis' });
    return;
  }

  try {
    const db = await getDb();
    const migrations = db.collection<DbMigration>('admin_migrations');
    await migrations.createIndex({ key: 1 }, { unique: true });

    const existing = await migrations.findOne({ key: migrationKey });
    if (existing) {
      res.status(409).json({
        message: 'Migration deja executee',
        key: migrationKey,
        executed_at: existing.executed_at
      });
      return;
    }

    let summary: Record<string, unknown>;

    if (migrationKey === 'users_credits_default_10_v1') {
      const users = db.collection<DbUser>('users');
      const result = await users.updateMany(
        {
          $or: [
            { credits: { $exists: false } },
            { credits: null }
          ]
        },
        { $set: { credits: 10 } }
      );
      summary = {
        matched_count: result.matchedCount,
        modified_count: result.modifiedCount,
        default_credits: 10
      };
    } else if (migrationKey === 'borrowings_backfill_mousse_cost_v1') {
      const borrowings = db.collection<DbBorrowing>('borrowings');
      const rows = await borrowings
        .find({
          $or: [
            { mousse_cost: { $exists: false } },
            { mousse_cost: null }
          ]
        })
        .toArray();

      if (rows.length === 0) {
        summary = { scanned_count: 0, modified_count: 0 };
      } else {
        const ops = rows
          .filter((row) => row._id)
          .map((row) => ({
            updateOne: {
              filter: { _id: row._id },
              update: {
                $set: {
                  mousse_cost: computeMousseCost(new Date(row.start_date), new Date(row.end_date))
                }
              }
            }
          }));
        const bulk = ops.length ? await borrowings.bulkWrite(ops) : { modifiedCount: 0 };
        summary = {
          scanned_count: rows.length,
          modified_count: bulk.modifiedCount
        };
      }
    } else if (migrationKey === 'borrowings_backfill_pending_ledger_v1') {
      const borrowings = db.collection<DbBorrowing>('borrowings');
      const ledger = db.collection<DbMousseLedger>('mousse_ledger');
      await ledger.createIndex({ borrowing_id: 1 }, { unique: true });

      const pendingBorrowings = await borrowings
        .find({
          status: 'pending',
          tool_id: { $exists: true },
          borrower_user_id: { $exists: true },
          owner_user_id: { $exists: true }
        })
        .toArray();

      const pendingIds = pendingBorrowings
        .map((row) => row._id)
        .filter((id): id is ObjectId => Boolean(id));

      const existingLedgerRows = pendingIds.length
        ? await ledger.find({ borrowing_id: { $in: pendingIds } }, { projection: { borrowing_id: 1 } }).toArray()
        : [];
      const existingBorrowingIdSet = new Set(existingLedgerRows.map((row) => row.borrowing_id.toHexString()));

      const docsToInsert = pendingBorrowings
        .filter((row) => row._id && row.tool_id && row.borrower_user_id && row.owner_user_id)
        .filter((row) => !existingBorrowingIdSet.has(row._id!.toHexString()))
        .map((row) => {
          const mousseAmount = row.mousse_cost ?? computeMousseCost(new Date(row.start_date), new Date(row.end_date));
          const nowRef = row.updated_at ?? row.created_at ?? new Date();
          return {
            borrowing_id: row._id!,
            tool_id: row.tool_id!,
            from_user_id: row.borrower_user_id!,
            to_user_id: row.owner_user_id!,
            mousse_amount: mousseAmount,
            status: 'pending' as const,
            created_at: row.created_at ?? nowRef,
            updated_at: nowRef
          };
        });

      if (docsToInsert.length > 0) {
        await ledger.insertMany(docsToInsert);
      }

      summary = {
        scanned_pending_borrowings: pendingBorrowings.length,
        existing_ledger_entries: existingBorrowingIdSet.size,
        inserted_ledger_entries: docsToInsert.length
      };
    } else {
      res.status(400).json({ message: 'Migration inconnue', key: migrationKey });
      return;
    }

    const now = new Date();

    await migrations.insertOne({
      key: migrationKey,
      executed_at: now,
      executed_by_user_id: authReq.auth?.sub ? new ObjectId(authReq.auth.sub) : null,
      summary
    } as Omit<DbMigration, '_id'>);

    res.json({
      message: 'Migration executee',
      key: migrationKey,
      summary
    });
  } catch (error) {
    res.status(500).json({ message: 'Erreur execution migration', error: (error as Error).message });
  }
});

export default router;
