import { Router } from 'express';
import { login, updateMyEmail, updateMyPassword } from '../controllers/auth.controller.js';
import { requireAuth } from '../middlewares/auth.js';

const router = Router();

router.post('/login', login);
router.put('/me/email', requireAuth, updateMyEmail);
router.put('/me/password', requireAuth, updateMyPassword);

export default router;
