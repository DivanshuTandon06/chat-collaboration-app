
import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';

import { config } from './config/index.js';
import connectDB from './config/db.js';
import { seedInitialData } from './storage/seedData.js';

import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import conversationRoutes from './routes/conversationRoutes.js';
import messageRoutes from './routes/messageRoutes.js';
import { registerSocketHandlers } from './sockets/socketHandler.js';

const app = express();
const server = http.createServer(app);

// Configure Socket.IO
const io = new SocketIOServer(server, {
  cors: {
    origin: [
      config.clientOrigin,
      'http://localhost:5173',
      'http://127.0.0.1:5173'
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
  }
});

// Middleware
app.use(
  cors({
    origin: [
      config.clientOrigin,
      'http://localhost:5173',
      'http://127.0.0.1:5173'
    ],
    credentials: true
  })
);

app.use(express.json());

// Store Socket.IO reference
app.set('io', io);

// Health check
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/messages', messageRoutes);

// 404 handler
app.use('/api/*', (req, res) => {
  res.status(404).json({ message: 'API route not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err);
  res.status(500).json({
    message: 'An unexpected internal error occurred'
  });
});

// Register Socket.IO handlers
registerSocketHandlers(io);

// Start server after database connection
const startServer = async () => {
  await connectDB();
  await seedInitialData();

  server.listen(config.port, () => {
    console.log(`Chat Collaboration Backend running on port ${config.port}`);
  });
};

if (process.env.NODE_ENV !== 'test') {
  startServer().catch((error) => {
    console.error('Unable to start server:', error.message);
    process.exit(1);
  });
}

export { app, server, io };
