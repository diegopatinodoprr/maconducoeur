import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import authRoutes from './routes/auth.js';
import borrowingRoutes from './routes/borrowings.js';
import fileRoutes from './routes/files.js';
import healthRoutes from './routes/health.js';
import toolRoutes from './routes/tools.js';
import userRoutes from './routes/users.js';
import { env } from './config/env.js';

const app = express();

app.use(helmet());
app.use(cors({ origin: 'http://localhost:4200' }));
app.use(express.json());
app.use('/uploads', express.static('uploads'));

app.use('/api', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api', fileRoutes);
app.use('/api', userRoutes);
app.use('/api', toolRoutes);
app.use('/api', borrowingRoutes);

app.listen(env.port, () => {
  console.log(`Backend running on http://localhost:${env.port}`);
});
