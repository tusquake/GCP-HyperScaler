import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

import authRoutes from './routes/auth.routes.js';
import adminRoutes from './routes/admin.routes.js';
import filesRoutes from './routes/files.routes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;

// Security Middlewares
app.use(helmet());
app.use(cors({
  origin: '*', // Configurable in production to React Frontend domain
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Security Rate Limiting (Prevents DDoS and brute-force attacks)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // Limit each IP to 300 requests per window
  message: { error: 'Too many requests from this IP, please try again later.' }
});
app.use('/api/', limiter);

// API Route Registration
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/files', filesRoutes);

// Healthcheck & Security Metadata endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'HEALTHY',
    service: 'secure-file-vault-backend',
    version: '1.0.0',
    gcpMetadata: {
      authMode: 'GCP Service Account / IAM Workload Identity',
      cloudSqlNetwork: 'Private IP Only (No Public Access)',
      subnets: {
        backendCloudRun: 'Serverless VPC Access Connector (10.0.2.0/28)',
        databaseSubnet: 'Private Service Access (10.0.1.0/24)'
      },
      directStorageUpload: 'Enabled (GCS Resumable Signed URLs for 1.5GB+ files)'
    },
    timestamp: new Date().toISOString()
  });
});

// Root Route
app.get('/', (req, res) => {
  res.send('Secure Enterprise File Vault API (GCP IAM & Private Subnet Enabled)');
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled Application Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(` Secure Enterprise File Vault Backend Server Running   `);
  console.log(` Port: ${PORT}                                          `);
  console.log(` Security Mode: GCP Managed Identity (IAM Service Acc)`);
  console.log(` Network Isolation: Private Cloud SQL Subnet           `);
  console.log(`=======================================================`);
});
