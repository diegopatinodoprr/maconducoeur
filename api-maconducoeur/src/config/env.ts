import dotenv from 'dotenv';

dotenv.config();

const required = ['MONGODB_URI', 'MONGODB_DB_NAME', 'JWT_SECRET'];
for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing env var: ${key}`);
  }
}

export const env = {
  port: Number(process.env.PORT ?? 3000),
  jwtSecret: process.env.JWT_SECRET as string,
  mongo: {
    uri: process.env.MONGODB_URI as string,
    dbName: process.env.MONGODB_DB_NAME as string
  }
};
