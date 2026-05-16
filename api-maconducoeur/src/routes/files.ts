import fs from 'node:fs';
import path from 'node:path';
import { Router } from 'express';
import multer from 'multer';
import { ObjectId } from 'mongodb';
import { getDb } from '../db/pool.js';
import { AuthenticatedRequest, requireAuth } from '../middlewares/auth.js';

const router = Router();
const uploadsDir = path.resolve(process.cwd(), 'uploads');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '';
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    cb(null, allowed.includes(file.mimetype));
  }
});

router.post('/files', requireAuth, upload.single('file'), async (req, res) => {
  const authReq = req as AuthenticatedRequest;
  const file = req.file;

  if (!file) {
    res.status(400).json({ message: 'Fichier image requis (field: file)' });
    return;
  }

  try {
    const db = await getDb();
    const doc = {
      original_name: file.originalname,
      filename: file.filename,
      mime_type: file.mimetype,
      size: file.size,
      url: `/uploads/${file.filename}`,
      owner_user_id: new ObjectId(authReq.auth?.sub),
      created_at: new Date()
    };

    const result = await db.collection('files').insertOne(doc);
    res.status(201).json({ id: result.insertedId.toHexString(), ...doc, owner_user_id: doc.owner_user_id.toHexString() });
  } catch (error) {
    res.status(500).json({ message: 'Erreur upload fichier', error: (error as Error).message });
  }
});

router.get('/files', requireAuth, async (_req, res) => {
  try {
    const db = await getDb();
    const rows = await db.collection('files').find().sort({ created_at: -1 }).toArray();
    res.json(
      rows.map((f) => ({
        id: f._id.toHexString(),
        original_name: f.original_name,
        filename: f.filename,
        mime_type: f.mime_type,
        size: f.size,
        url: f.url,
        owner_user_id: f.owner_user_id?.toHexString?.() ?? null,
        created_at: f.created_at
      }))
    );
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur', error: (error as Error).message });
  }
});

export default router;
