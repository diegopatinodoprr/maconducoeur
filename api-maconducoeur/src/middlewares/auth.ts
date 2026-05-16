import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export type JwtPayload = {
  sub: string;
  email: string;
  role: 'admin' | 'user';
  iat: number;
  exp: number;
};

export type AuthenticatedRequest = Request & { auth?: JwtPayload };

function verifyToken(req: Request): JwtPayload | null {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.slice('Bearer '.length);
  try {
    return jwt.verify(token, env.jwtSecret) as JwtPayload;
  } catch {
    return null;
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const payload = verifyToken(req);
  if (!payload) {
    res.status(401).json({ message: 'Token invalide ou manquant' });
    return;
  }

  (req as AuthenticatedRequest).auth = payload;
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const payload = verifyToken(req);

  if (!payload) {
    res.status(401).json({ message: 'Token invalide ou manquant' });
    return;
  }

  if (payload.role !== 'admin') {
    res.status(403).json({ message: 'Acces reserve aux admins' });
    return;
  }

  (req as AuthenticatedRequest).auth = payload;
  next();
}
