import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
const allowedOrigins = [
  'http://localhost:3000',
  'https://octo-ops.vercel.app',
  'https://octoops-phi.vercel.app',
  'https://octo-ops-backend.onrender.com',
  'https://octoops-backend.onrender.com'
];

// Diagnostic Logging for CORS
app.use((req, res, next) => {
  const origin = req.headers.origin;
  console.log(`Incoming request from origin: ${origin} | Method: ${req.method} | Path: ${req.path}`);
  next();
});

app.use(cors({
  origin: (origin, callback) => {
    // If no origin (like mobile apps or curl) or origin is in allowed list
    if (!origin || allowedOrigins.includes(origin) || origin.includes('vercel.app')) {
      callback(null, true);
    } else {
      console.warn(`CORS Blocked: Origin ${origin} not in allowed list`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With'],
  optionsSuccessStatus: 200
}));
app.use(express.json());

// Handle Preflight OPTIONS requests globally
app.options('*', cors());

// Diagnostic Logging for CORS (moved after options)
app.use((req, res, next) => {
  if (req.method !== 'OPTIONS') {
    const origin = req.headers.origin;
    console.log(`Incoming ${req.method} request from origin: ${origin} | Path: ${req.path}`);
  }
  next();
});

// Database Connection
const MONGODB_URL = process.env.MONGODB_URI || '';

// NOTE: Ensure you have a running MongoDB instance or valid URI in .env
mongoose.connect(MONGODB_URL)
  .then(() => console.log('✅ MongoDB Connected'))
  .catch((err) => console.error('❌ MongoDB Connection Error:', err));

// Routes
import apiRoutes from './routes';
app.use('/api', apiRoutes);

// Global Error Handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled Error:', err);
  res.status(500).json({ 
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined 
  });
});
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
