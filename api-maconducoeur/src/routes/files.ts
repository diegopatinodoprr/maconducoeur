import fs from 'node:fs';
import path from 'node:path';
import { Router } from 'express';
import multer from 'multer';
import { ObjectId } from 'mongodb';
import sharp from 'sharp';
import { getDb } from '../db/pool.js';
import { AuthenticatedRequest, requireAuth } from '../middlewares/auth.js';

const router = Router();
const uploadsDir = path.resolve(process.cwd(), 'uploads');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 30 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    cb(null, allowed.includes(file.mimetype));
  }
});

router.post('/files', requireAuth, (req, res) => {
  upload.single('file')(req, res, async (error) => {
    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        res.status(413).json({ message: 'Image trop lourde (max 30MB avant optimisation)' });
        return;
      }
      res.status(400).json({ message: 'Upload invalide', error: error.message });
      return;
    }

    if (error) {
      res.status(400).json({ message: 'Erreur upload', error: (error as Error).message });
      return;
    }

    const authReq = req as AuthenticatedRequest;
    const file = req.file;

    if (!file) {
      res.status(400).json({ message: 'Fichier image requis (field: file)' });
      return;
    }

    try {
      const optimizedBuffer = await sharp(file.buffer)
        .rotate()
        .resize({ width: 1400, height: 1400, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 82 })
        .toBuffer();

      const optimizedName = `${Date.now()}-${Math.round(Math.random() * 1e9)}.webp`;
      const outputPath = path.join(uploadsDir, optimizedName);
      await fs.promises.writeFile(outputPath, optimizedBuffer);

      const db = await getDb();
      const doc = {
        original_name: file.originalname,
        filename: optimizedName,
        mime_type: 'image/webp',
        original_mime_type: file.mimetype,
        original_size: file.size,
        size: optimizedBuffer.length,
        url: `/uploads/${optimizedName}`,
        owner_user_id: new ObjectId(authReq.auth?.sub),
        created_at: new Date()
      };

      const result = await db.collection('files').insertOne(doc);
      res.status(201).json({ id: result.insertedId.toHexString(), ...doc, owner_user_id: doc.owner_user_id.toHexString() });
    } catch (err) {
      res.status(500).json({ message: 'Erreur upload fichier', error: (err as Error).message });
    }
  });
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
