import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import path from 'path';
import { createServer } from 'http';
import { Server } from 'socket.io';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Create HTTP server for Socket.IO
const httpServer = createServer(app);

// Health Check (Top Level to avoid middleware interference)
app.get('/health', (req, res) => {
    res.status(200).send('OK');
});

// Static Files
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Middleware
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
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
      callback(null, origin || true);
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

// Socket.IO Setup
const io = new Server(httpServer, {
  cors: {
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin) || origin?.includes('vercel.app')) {
        callback(null, origin || true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST']
  }
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('✅ Client connected:', socket.id);

  // Join project room
  socket.on('join-project', (projectId: string) => {
    socket.join(`project:${projectId}`);
    console.log(`Socket ${socket.id} joined project:${projectId}`);
  });

  // Leave project room
  socket.on('leave-project', (projectId: string) => {
    socket.leave(`project:${projectId}`);
    console.log(`Socket ${socket.id} left project:${projectId}`);
  });

  socket.on('disconnect', () => {
    console.log('❌ Client disconnected:', socket.id);
  });
});

// Make io available to routes
export { io };

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
mongoose.set('bufferCommands', false);
mongoose.connect(MONGODB_URL, {
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
})
  .then(() => console.log('✅ MongoDB Connected'))
  .catch((err) => {
    console.error('❌ MongoDB Connection Error:', err);
    // Log more details for debugging buffering issues
    if (err.name === 'MongooseServerSelectionError') {
       console.error('Check if database IP is whitelisted and MONGODB_URI is correct.');
    }
  });

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

httpServer.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🔌 WebSocket server ready`);
});
