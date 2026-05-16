import bcrypt from 'bcryptjs';
import { ObjectId } from 'mongodb';
import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { getDb } from '../db/pool.js';
import { AuthenticatedRequest } from '../middlewares/auth.js';

type UserRole = 'admin' | 'user';

type DbUser = {
  _id: ObjectId;
  email: string;
  password_hash: string;
  role: UserRole;
};

function authLog(message: string): void {
  if (env.authVerboseLogs) {
    console.log(message);
  }
}

function authWarn(message: string): void {
  if (env.authVerboseLogs) {
    console.warn(message);
  }
}

export async function login(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body as { email?: string; password?: string };
  authLog(`[AUTH][LOGIN] Request received for email="${email ?? '-'}"`);

  if (!email || !password) {
    authWarn('[AUTH][LOGIN] Missing email or password');
    res.status(400).json({ message: 'Email et mot de passe requis' });
    return;
  }

  try {
    authLog('[AUTH][LOGIN] Loading users list for diagnostics');
    const db = await getDb();
    if (env.authVerboseLogs) {
      const availableUsers = await db
        .collection<DbUser>('users')
        .find({}, { projection: { email: 1, role: 1 } })
        .toArray();
      authLog(
        `[AUTH][LOGIN] Available users (${availableUsers.length}): ${availableUsers
          .map((u) => `${u.email}(${u.role})`)
          .join(', ')}`
      );
    }

    authLog(`[AUTH][LOGIN] Looking up user by email="${email}"`);
    const user = await db.collection<DbUser>('users').findOne({ email });

    if (!user) {
      authWarn(`[AUTH][LOGIN] User not found for email="${email}"`);
      res.status(401).json({ message: 'Identifiants invalides' });
      return;
    }

    authLog(`[AUTH][LOGIN] User found id=${user._id.toHexString()} role=${user.role}, checking password`);
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      authWarn(`[AUTH][LOGIN] Invalid password for email="${email}"`);
      res.status(401).json({ message: 'Identifiants invalides' });
      return;
    }

    authLog(`[AUTH][LOGIN] Password valid for email="${email}", generating JWT`);
    const token = jwt.sign(
      { sub: user._id.toHexString(), email: user.email, role: user.role },
      env.jwtSecret,
      { expiresIn: '8h' }
    );

    authLog(`[AUTH][LOGIN] Login successful for email="${email}"`);
    res.json({
      token,
      user: {
        id: user._id.toHexString(),
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('[AUTH][LOGIN] Unexpected error:', (error as Error).message);
    res.status(500).json({ message: 'Erreur serveur', error: (error as Error).message });
  }
}

export async function updateMyEmail(req: Request, res: Response): Promise<void> {
  const authReq = req as AuthenticatedRequest;
  const { email } = req.body as { email?: string };

  if (!email?.trim()) {
    res.status(400).json({ message: 'Email requis' });
    return;
  }

  try {
    const db = await getDb();
    const exists = await db.collection('users').findOne({ email: email.trim() });
    if (exists && exists._id.toHexString() !== authReq.auth?.sub) {
      res.status(409).json({ message: 'Email deja utilise' });
      return;
    }

    await db.collection('users').updateOne(
      { _id: new ObjectId(authReq.auth?.sub) },
      { $set: { email: email.trim() } }
    );

    res.json({ message: 'Email mis a jour' });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur', error: (error as Error).message });
  }
}

export async function updateMyPassword(req: Request, res: Response): Promise<void> {
  const authReq = req as AuthenticatedRequest;
  const { current_password, new_password } = req.body as {
    current_password?: string;
    new_password?: string;
  };

  if (!current_password || !new_password) {
    res.status(400).json({ message: 'current_password et new_password sont requis' });
    return;
  }

  if (new_password.length < 8) {
    res.status(400).json({ message: 'Le nouveau mot de passe doit faire au moins 8 caracteres' });
    return;
  }

  try {
    const db = await getDb();
    const user = await db.collection<DbUser>('users').findOne({ _id: new ObjectId(authReq.auth?.sub) });

    if (!user) {
      res.status(404).json({ message: 'Utilisateur introuvable' });
      return;
    }

    const ok = await bcrypt.compare(current_password, user.password_hash);
    if (!ok) {
      res.status(401).json({ message: 'Mot de passe actuel invalide' });
      return;
    }

    const hashed = await bcrypt.hash(new_password, 10);
    await db.collection('users').updateOne(
      { _id: user._id },
      { $set: { password_hash: hashed } }
    );

    res.json({ message: 'Mot de passe mis a jour' });
  } catch (error) {
    res.status(500).json({ message: 'Erreur serveur', error: (error as Error).message });
  }
}
