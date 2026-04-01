'use strict';

const http = require('http');
const { Server: SocketServer } = require('socket.io');

const app = require('./app');
const config = require('./config');
const logger = require('./utils/logger');
const { connectDB } = require('./config/database');
const { setSocketIO } = require('./services/alertService');
const { startScheduler } = require('./services/scheduler');

const server = http.createServer(app);

// ── Socket.io setup ───────────────────────────────────────────────────────────
const io = new SocketServer(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

io.on('connection', (socket) => {
  logger.info(`Socket connected: ${socket.id}`);

  // Client must authenticate by emitting 'auth' with their JWT
  socket.on('auth', async (token) => {
    try {
      const jwt = require('jsonwebtoken');
      const User = require('./models/User');
      const decoded = jwt.verify(token, config.jwt.secret);
      const user = await User.findById(decoded.id);
      if (user && user.isActive) {
        socket.join(`user:${user._id}`);
        socket.emit('authenticated', { userId: user._id });
        logger.info(`Socket authenticated for user ${user._id}`);
      } else {
        socket.emit('error', { message: 'Authentication failed' });
      }
    } catch (err) {
      socket.emit('error', { message: 'Invalid token' });
    }
  });

  socket.on('disconnect', () => {
    logger.info(`Socket disconnected: ${socket.id}`);
  });
});

// Provide Socket.io to the alert service
setSocketIO(io);

// ── Start server ──────────────────────────────────────────────────────────────
async function start() {
  await connectDB();
  server.listen(config.port, () => {
    logger.info(`Flipper AI API running on port ${config.port} [${config.env}]`);
    if (config.env !== 'test') {
      startScheduler();
    }
  });
}

start().catch((err) => {
  logger.error('Failed to start server:', err);
  process.exit(1);
});

module.exports = { app, server, io };
