import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

import { initDb } from './db/connection.js';
import authRoutes from './routes/auth.routes.js';
import adminRoutes from './routes/admin.routes.js';
import filesRoutes from './routes/files.routes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;

// Security Middlewares
app.use(helmet());
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Rate Limiter
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  message: { error: 'Too many requests from this IP, please try again later.' }
});
app.use('/api/', limiter);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/files', filesRoutes);

// Health Check
app.get('/health', (req, res) => {
  res.json({
    status: 'HEALTHY',
    service: 'secure-file-vault-backend',
    version: '1.0.0',
    gcpMetadata: {
      cloudSqlInstance: process.env.CLOUD_SQL_CONNECTION_NAME || 'secure-app-db',
      bucket: process.env.GCS_BUCKET_NAME || 'secure-file-vault-bucket'
    },
    timestamp: new Date().toISOString()
  });
});

app.get('/', (req, res) => {
  res.send('Secure Enterprise File Vault API (Cloud SQL & GCS Enabled)');
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled Application Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, async () => {
  console.log(`=======================================================`);
  console.log(` Secure Enterprise File Vault Backend Running on ${PORT} `);
  console.log(`=======================================================`);
  // Initialize Cloud SQL PostgreSQL DDL schema automatically
  await initDb();
});
