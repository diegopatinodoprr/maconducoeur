import { Router } from 'express';
import { ObjectId } from 'mongodb';
import { getDb } from '../db/pool.js';
import { AuthenticatedRequest, requireAuth } from '../middlewares/auth.js';

const router = Router();

type DbUser = {
  _id: ObjectId;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  role: 'admin' | 'user';
  avatar_file_id?: ObjectId;
  created_at?: Date;
};

type AddressDocument = {
  _id: ObjectId;
  user_id: ObjectId;
  label: string;
  rue: string;
  ville: string;
  code_postal: string;
  image_file_id?: ObjectId;
  created_at: Date;
  updated_at: Date;
};

function mapUser(u: DbUser & { avatar_file?: { _id: ObjectId; url: string }[] }) {
  return {
    id: u._id.toHexString(),
    first_name: u.first_name,
    last_name: u.last_name,
    email: u.email,
    phone: u.phone ?? null,
    role: u.role,
    avatar_file_id: u.avatar_file_id?.toHexString?.() ?? null,
    avatar_url: u.avatar_file?.[0]?.url ?? null,
    created_at: u.created_at ?? null
  };
}

function mapAddress(a: AddressDocument & { image_file?: { _id: ObjectId; url: string }[] }) {
  return {
    id: a._id.toHexString(),
    user_id: a.user_id.toHexString(),
    label: a.label,
    rue: a.rue,
    ville: a.ville,
    code_postal: a.code_postal,
    image_file_id: a.image_file_id?.toHexString?.() ?? null,
    image_url: a.image_file?.[0]?.url ?? null,
    created_at: a.created_at,
    updated_at: a.updated_at
  };
}

router.get('/users/addresses', requireAuth, async (_req, res) => {
  try {
    const db = await getDb();
    const rows = await db
      .collection<AddressDocument>('addresses')
      .aggregate<AddressDocument & { image_file?: { _id: ObjectId; url: string }[] }>([
        { $sort: { created_at: -1 } },
        {
          $lookup: {
            from: 'files',
            localField: 'image_file_id',
            foreignField: '_id',
            as: 'image_file'
          }
        }
      ])
      .toArray();

    res.json(rows.map((a) => mapAddress(a)));
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur', error: (error as Error).message });
  }
});

router.get('/users', async (_req, res) => {
  try {
    const db = await getDb();
    const rows = await db
      .collection<DbUser>('users')
      .aggregate<DbUser & { avatar_file?: { _id: ObjectId; url: string }[] }>([
        { $project: { first_name: 1, last_name: 1, email: 1, phone: 1, role: 1, created_at: 1, avatar_file_id: 1 } },
        {
          $lookup: {
            from: 'files',
            localField: 'avatar_file_id',
            foreignField: '_id',
            as: 'avatar_file'
          }
        }
      ])
      .toArray();

    res.json(rows.map((u) => mapUser(u)));
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur', error: (error as Error).message });
  }
});

router.get('/users/me', requireAuth, async (req, res) => {
  const authReq = req as AuthenticatedRequest;

  try {
    const db = await getDb();
    const rows = await db
      .collection<DbUser>('users')
      .aggregate<DbUser & { avatar_file?: { _id: ObjectId; url: string }[] }>([
        { $match: { _id: new ObjectId(authReq.auth?.sub) } },
        { $project: { first_name: 1, last_name: 1, email: 1, phone: 1, role: 1, created_at: 1, avatar_file_id: 1 } },
        {
          $lookup: {
            from: 'files',
            localField: 'avatar_file_id',
            foreignField: '_id',
            as: 'avatar_file'
          }
        }
      ])
      .toArray();

    const user = rows[0];
    if (!user) {
      res.status(404).json({ message: 'Utilisateur introuvable' });
      return;
    }

    res.json(mapUser(user));
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur', error: (error as Error).message });
  }
});

router.put('/users/me', requireAuth, async (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const { first_name, last_name, phone } = req.body as { first_name?: string; last_name?: string; phone?: string };

  if (!first_name?.trim() || !last_name?.trim()) {
    res.status(400).json({ message: 'first_name et last_name sont requis' });
    return;
  }

  try {
    const db = await getDb();
    await db.collection('users').updateOne(
      { _id: new ObjectId(authReq.auth?.sub) },
      {
        $set: {
          first_name: first_name.trim(),
          last_name: last_name.trim(),
          phone: phone?.trim() || null
        }
      }
    );

    res.json({ message: 'Profil mis a jour' });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur', error: (error as Error).message });
  }
});

router.put('/users/me/avatar', requireAuth, async (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const { file_id } = req.body as { file_id?: string };

  if (!file_id || !ObjectId.isValid(file_id)) {
    res.status(400).json({ message: 'file_id invalide' });
    return;
  }

  try {
    const db = await getDb();
    const fileObjectId = new ObjectId(file_id);
    const file = await db.collection('files').findOne({ _id: fileObjectId });

    if (!file) {
      res.status(404).json({ message: 'Fichier introuvable' });
      return;
    }

    await db.collection('users').updateOne(
      { _id: new ObjectId(authReq.auth?.sub) },
      { $set: { avatar_file_id: fileObjectId } }
    );

    res.json({ message: 'Avatar utilisateur mis a jour', avatar_file_id: file_id, avatar_url: file.url });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur', error: (error as Error).message });
  }
});

router.get('/users/me/addresses', requireAuth, async (req, res) => {
  const authReq = req as AuthenticatedRequest;

  try {
    const db = await getDb();
    const rows = await db
      .collection<AddressDocument>('addresses')
      .aggregate<AddressDocument & { image_file?: { _id: ObjectId; url: string }[] }>([
        { $match: { user_id: new ObjectId(authReq.auth?.sub) } },
        { $sort: { created_at: -1 } },
        {
          $lookup: {
            from: 'files',
            localField: 'image_file_id',
            foreignField: '_id',
            as: 'image_file'
          }
        }
      ])
      .toArray();

    res.json(rows.map((a) => mapAddress(a)));
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur', error: (error as Error).message });
  }
});

router.post('/users/me/addresses', requireAuth, async (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const { label, rue, ville, code_postal, image_file_id } = req.body as {
    label?: string;
    rue?: string;
    ville?: string;
    code_postal?: string;
    image_file_id?: string;
  };

  if (!label?.trim() || !rue?.trim() || !ville?.trim() || !code_postal?.trim()) {
    res.status(400).json({ message: 'label, rue, ville, code_postal sont requis' });
    return;
  }

  if (image_file_id && !ObjectId.isValid(image_file_id)) {
    res.status(400).json({ message: 'image_file_id invalide' });
    return;
  }

  try {
    const db = await getDb();
    let imageObjectId: ObjectId | undefined;

    if (image_file_id) {
      imageObjectId = new ObjectId(image_file_id);
      const file = await db.collection('files').findOne({ _id: imageObjectId });
      if (!file) {
        res.status(404).json({ message: 'Image introuvable' });
        return;
      }
    }

    const now = new Date();
    const doc: Omit<AddressDocument, '_id'> = {
      user_id: new ObjectId(authReq.auth?.sub),
      label: label.trim(),
      rue: rue.trim(),
      ville: ville.trim(),
      code_postal: code_postal.trim(),
      image_file_id: imageObjectId,
      created_at: now,
      updated_at: now
    };

    const result = await db.collection('addresses').insertOne(doc);
    res.status(201).json({ id: result.insertedId.toHexString(), ...doc, user_id: doc.user_id.toHexString() });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur', error: (error as Error).message });
  }
});

router.put('/users/me/addresses/:id/photo', requireAuth, async (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { image_file_id } = req.body as {
    image_file_id?: string;
  };

  if (!ObjectId.isValid(id)) {
    res.status(400).json({ message: 'ID adresse invalide' });
    return;
  }

  if (!image_file_id || !ObjectId.isValid(image_file_id)) {
    res.status(400).json({ message: 'image_file_id invalide' });
    return;
  }

  try {
    const db = await getDb();
    const imageObjectId = new ObjectId(image_file_id);
    const file = await db.collection('files').findOne({ _id: imageObjectId });
    if (!file) {
      res.status(404).json({ message: 'Image introuvable' });
      return;
    }

    const result = await db.collection('addresses').findOneAndUpdate(
      { _id: new ObjectId(id), user_id: new ObjectId(authReq.auth?.sub) },
      {
        $set: {
          image_file_id: imageObjectId,
          updated_at: new Date()
        }
      },
      { returnDocument: 'after' }
    );

    if (!result) {
      res.status(404).json({ message: 'Adresse introuvable' });
      return;
    }

    res.json({ message: 'Photo adresse mise a jour', id: result._id.toHexString(), image_url: file.url });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur', error: (error as Error).message });
  }
});

router.put('/users/me/addresses/:id', requireAuth, async (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { label, rue, ville, code_postal } = req.body as {
    label?: string;
    rue?: string;
    ville?: string;
    code_postal?: string;
  };

  if (!ObjectId.isValid(id)) {
    res.status(400).json({ message: 'ID adresse invalide' });
    return;
  }

  if (!label?.trim() || !rue?.trim() || !ville?.trim() || !code_postal?.trim()) {
    res.status(400).json({ message: 'label, rue, ville, code_postal sont requis' });
    return;
  }

  try {
    const db = await getDb();
    const result = await db.collection('addresses').findOneAndUpdate(
      { _id: new ObjectId(id), user_id: new ObjectId(authReq.auth?.sub) },
      {
        $set: {
          label: label.trim(),
          rue: rue.trim(),
          ville: ville.trim(),
          code_postal: code_postal.trim(),
          updated_at: new Date()
        }
      },
      { returnDocument: 'after' }
    );

    if (!result) {
      res.status(404).json({ message: 'Adresse introuvable' });
      return;
    }

    res.json(mapAddress(result as AddressDocument & { image_file?: { _id: ObjectId; url: string }[] }));
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur', error: (error as Error).message });
  }
});

router.delete('/users/me/addresses/:id', requireAuth, async (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  if (!ObjectId.isValid(id)) {
    res.status(400).json({ message: 'ID adresse invalide' });
    return;
  }

  try {
    const db = await getDb();
    const result = await db.collection('addresses').deleteOne({
      _id: new ObjectId(id),
      user_id: new ObjectId(authReq.auth?.sub)
    });

    if (!result.deletedCount) {
      res.status(404).json({ message: 'Adresse introuvable' });
      return;
    }

    res.status(204).send();
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur', error: (error as Error).message });
  }
});

export default router;
