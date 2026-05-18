import { Router } from 'express';
import { ObjectId } from 'mongodb';
import { getDb } from '../db/pool.js';
import { AuthenticatedRequest, requireAuth } from '../middlewares/auth.js';
import { emitAppEvent } from '../realtime/events.js';
import { BorrowingDocument, BorrowingStatus } from '../types/borrowing.js';
import { ToolDocument } from '../types/tool.js';

const router = Router();

function mapBorrowing(row: BorrowingDocument) {
  return {
    id: row._id.toHexString(),
    tool_id: row.tool_id.toHexString(),
    start_date: row.start_date,
    end_date: row.end_date,
    borrower_user_id: row.borrower_user_id.toHexString(),
    owner_user_id: row.owner_user_id.toHexString(),
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

router.post('/borrowings', requireAuth, async (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const { tool_id, start_date, end_date } = req.body as {
    tool_id?: string;
    start_date?: string;
    end_date?: string;
  };

  if (!tool_id || !ObjectId.isValid(tool_id)) {
    res.status(400).json({ message: 'tool_id invalide' });
    return;
  }

  if (!start_date || !end_date) {
    res.status(400).json({ message: 'start_date et end_date sont requis' });
    return;
  }

  const start = new Date(start_date);
  const end = new Date(end_date);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    res.status(400).json({ message: 'Dates invalides' });
    return;
  }

  if (end <= start) {
    res.status(400).json({ message: 'end_date doit etre apres start_date' });
    return;
  }

  try {
    const db = await getDb();
    const tool = await db.collection<ToolDocument>('utils').findOne({ _id: new ObjectId(tool_id) });

    if (!tool) {
      res.status(404).json({ message: 'Outil introuvable' });
      return;
    }

    if (!tool.disponible || tool.borrowed_by_user_id) {
      res.status(409).json({ message: 'Outil non disponible a l\'emprunt' });
      return;
    }

    const borrowerId = new ObjectId(authReq.auth?.sub);
    if (tool.owner_user_id.toHexString() === borrowerId.toHexString()) {
      res.status(400).json({ message: 'Le proprietaire ne peut pas emprunter son propre outil' });
      return;
    }

    const hasPending = await db.collection<BorrowingDocument>('borrowings').findOne({
      tool_id: tool._id,
      borrower_user_id: borrowerId,
      status: 'pending'
    });

    if (hasPending) {
      res.status(409).json({ message: 'Une demande d\'emprunt en attente existe deja pour cet outil' });
      return;
    }

    const now = new Date();
    const doc: Omit<BorrowingDocument, '_id'> = {
      tool_id: tool._id,
      start_date: start,
      end_date: end,
      borrower_user_id: borrowerId,
      owner_user_id: tool.owner_user_id,
      status: 'pending',
      created_at: now,
      updated_at: now
    };

    const result = await db.collection<Omit<BorrowingDocument, '_id'>>('borrowings').insertOne(doc);
    const created: BorrowingDocument = { _id: result.insertedId, ...doc };

    emitAppEvent({
      type: 'borrowing.requested',
      actor_user_id: authReq.auth?.sub ?? null,
      entity_id: created._id.toHexString(),
      payload: {
        tool_id: created.tool_id.toHexString(),
        owner_user_id: created.owner_user_id.toHexString(),
        borrower_user_id: created.borrower_user_id.toHexString()
      }
    });

    res.status(201).json(mapBorrowing(created));
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur', error: (error as Error).message });
  }
});

router.get('/borrowings', requireAuth, async (req, res) => {
  const authReq = req as AuthenticatedRequest;

  try {
    const db = await getDb();
    const userId = new ObjectId(authReq.auth?.sub);
    const rows = await db
      .collection<BorrowingDocument>('borrowings')
      .find({
        $or: [{ borrower_user_id: userId }, { owner_user_id: userId }]
      })
      .sort({ created_at: -1 })
      .toArray();

    res.json(rows.map((row) => mapBorrowing(row)));
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur', error: (error as Error).message });
  }
});

router.put('/borrowings/:id/status', requireAuth, async (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const borrowingId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { status } = req.body as { status?: BorrowingStatus };

  if (!ObjectId.isValid(borrowingId)) {
    res.status(400).json({ message: 'ID emprunt invalide' });
    return;
  }

  if (!status || !['active', 'finished', 'rejected'].includes(status)) {
    res.status(400).json({ message: 'status invalide (active, finished, rejected)' });
    return;
  }

  try {
    const db = await getDb();
    const borrowing = await db.collection<BorrowingDocument>('borrowings').findOne({ _id: new ObjectId(borrowingId) });

    if (!borrowing) {
      res.status(404).json({ message: 'Emprunt introuvable' });
      return;
    }

    if (borrowing.owner_user_id.toHexString() !== authReq.auth?.sub) {
      res.status(403).json({ message: 'Seul le proprietaire de l\'outil peut valider cet emprunt' });
      return;
    }

    if (['finished', 'rejected'].includes(borrowing.status)) {
      res.status(409).json({ message: 'Emprunt deja cloture' });
      return;
    }
    if (status === 'active' && borrowing.status !== 'pending') {
      res.status(409).json({ message: 'Transition invalide: seul pending -> active est autorise' });
      return;
    }
    if (status === 'finished' && borrowing.status !== 'active') {
      res.status(409).json({ message: 'Transition invalide: seul active -> finished est autorise' });
      return;
    }
    if (status === 'rejected' && borrowing.status !== 'pending') {
      res.status(409).json({ message: 'Transition invalide: seul pending -> rejected est autorise' });
      return;
    }

    const now = new Date();
    const result = await db
      .collection<BorrowingDocument>('borrowings')
      .findOneAndUpdate(
        { _id: borrowing._id },
        {
          $set: {
            status,
            updated_at: now
          }
        },
        { returnDocument: 'after' }
      );

    if (!result) {
      res.status(404).json({ message: 'Emprunt introuvable' });
      return;
    }

    if (status === 'active') {
      await db.collection<ToolDocument>('utils').updateOne(
        { _id: borrowing.tool_id, owner_user_id: borrowing.owner_user_id },
        {
          $set: {
            borrowed_by_user_id: borrowing.borrower_user_id,
            disponible: false,
            updated_at: now
          }
        }
      );
    }

    if (status === 'finished') {
      await db.collection<ToolDocument>('utils').updateOne(
        { _id: borrowing.tool_id, owner_user_id: borrowing.owner_user_id },
        {
          $set: {
            disponible: true,
            updated_at: now
          },
          $unset: {
            borrowed_by_user_id: ''
          }
        }
      );
    }

    emitAppEvent({
      type: 'borrowing.status_changed',
      actor_user_id: authReq.auth?.sub ?? null,
      entity_id: result._id.toHexString(),
      payload: {
        status,
        tool_id: result.tool_id.toHexString(),
        owner_user_id: result.owner_user_id.toHexString(),
        borrower_user_id: result.borrower_user_id.toHexString()
      }
    });

    res.json(mapBorrowing(result));
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur', error: (error as Error).message });
  }
});

export default router;
