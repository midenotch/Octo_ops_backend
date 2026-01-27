"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.io = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const mongoose_1 = __importDefault(require("mongoose"));
const path_1 = __importDefault(require("path"));
const http_1 = require("http");
const socket_io_1 = require("socket.io");
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 5000;
// Create HTTP server for Socket.IO
const httpServer = (0, http_1.createServer)(app);
// Health Check (Top Level to avoid middleware interference)
app.get('/health', (req, res) => {
    res.status(200).send('OK');
});
// Static Files
app.use('/uploads', express_1.default.static(path_1.default.join(process.cwd(), 'uploads')));
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
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        // If no origin (like mobile apps or curl) or origin is in allowed list
        if (!origin || allowedOrigins.includes(origin) || origin.includes('vercel.app')) {
            callback(null, true);
        }
        else {
            console.warn(`CORS Blocked: Origin ${origin} not in allowed list`);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With'],
    optionsSuccessStatus: 200
}));
app.use(express_1.default.json());
// Socket.IO Setup
const io = new socket_io_1.Server(httpServer, {
    cors: {
        origin: (origin, callback) => {
            if (!origin || allowedOrigins.includes(origin) || (origin === null || origin === void 0 ? void 0 : origin.includes('vercel.app'))) {
                callback(null, true);
            }
            else {
                callback(new Error('Not allowed by CORS'));
            }
        },
        credentials: true,
        methods: ['GET', 'POST']
    }
});
exports.io = io;
// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log('✅ Client connected:', socket.id);
    // Join project room
    socket.on('join-project', (projectId) => {
        socket.join(`project:${projectId}`);
        console.log(`Socket ${socket.id} joined project:${projectId}`);
    });
    // Leave project room
    socket.on('leave-project', (projectId) => {
        socket.leave(`project:${projectId}`);
        console.log(`Socket ${socket.id} left project:${projectId}`);
    });
    socket.on('disconnect', () => {
        console.log('❌ Client disconnected:', socket.id);
    });
});
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
mongoose_1.default.set('bufferCommands', false);
mongoose_1.default.connect(MONGODB_URL, {
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
const routes_1 = __importDefault(require("./routes"));
app.use('/api', routes_1.default);
// Global Error Handler
app.use((err, req, res, next) => {
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
