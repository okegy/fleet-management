import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import dns from 'dns';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import User from './models/User.js';
import mongoSanitize from 'express-mongo-sanitize';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { connectDB } from './config/database.js';
import logger, { logSecurityEvent } from './config/logger.js';
import authRoutes from './routes/auth.js';
import vehicleRoutes from './routes/vehicles.js';
import driverRoutes from './routes/drivers.js';
import tripRoutes from './routes/trips.js';
import maintenanceRoutes from './routes/maintenance.js';
import expenseRoutes from './routes/expenses.js';
import analyticsRoutes from './routes/analytics.js';
import Trip from './models/Trip.js';

dns.setServers(['1.1.1.1', '8.8.8.8']);
dotenv.config();

// Validate required environment variables
const requiredEnvVars = ['MONGODB_URI', 'JWT_SECRET', 'FRONTEND_URL', 'NODE_ENV'];
const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingEnvVars.length > 0) {
  console.error(`❌ Missing required environment variables: ${missingEnvVars.join(', ')}`);
  process.exit(1);
}

const app = express();
const httpServer = createServer(app);

// Trust proxy (for rate limiting behind reverse proxy)
app.set('trust proxy', 1);

// Production Hardening Middleware
// The built SPA is served from this same origin in production, so the CSP must
// allow the assets it loads: Google Fonts and Clerk's frontend SDK / bot check.
const clerkOrigins = [
  'https://*.clerk.accounts.dev',
  'https://*.clerk.com',
  'https://clerk-telemetry.com'
];
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", ...clerkOrigins, 'https://challenges.cloudflare.com'],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      imgSrc: ["'self'", "data:", "https:", 'blob:'],
      connectSrc: [
        "'self'",
        'wss:',
        'ws:',
        ...clerkOrigins,
        ...(process.env.FRONTEND_URL || '').split(',')
      ],
      fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: [...clerkOrigins, 'https://challenges.cloudflare.com'],
      workerSrc: ["'self'", 'blob:']
    }
  },
  // Clerk's OAuth flow can hand off through a popup; strict "same-origin" here
  // would sever the handle it uses to return to the app.
  crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

app.use(compression()); // Compress responses

// Logging with winston
app.use(morgan('combined', {
  stream: {
    write: (message) => logger.info(message.trim())
  }
}));

// ✅ SECURITY FIX: Comprehensive Rate Limiting
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per 15 minutes
  skipSuccessfulRequests: true,
  keyGenerator: ipKeyGenerator,
  message: 'Too many authentication attempts, please try again after 15 minutes',
  handler: (req, res) => {
    logSecurityEvent('RATE_LIMIT_EXCEEDED', {
      ip: req.ip,
      path: req.path,
      userAgent: req.headers['user-agent']
    });
    res.status(429).json({
      error: 'Too many authentication attempts, please try again after 15 minutes'
    });
  }
});

// Read operations (GET) - generous limit
const readLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // 200 reads per 15 minutes
  skip: (req) => req.method !== 'GET',
  message: 'Too many read requests, please try again later'
});

// Write operations (POST, PUT, DELETE, PATCH) - stricter limit
const writeLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 write operations per minute
  skip: (req) => ['GET', 'HEAD', 'OPTIONS'].includes(req.method),
  message: 'Too many write operations, please slow down'
});

// Apply rate limiters
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api', readLimiter); // Read limiter for all GET requests
app.use('/api', writeLimiter); // Write limiter for all POST/PUT/DELETE

// SECURITY: Strict CORS configuration with allowlist
const allowedOrigins = (process.env.FRONTEND_URL || '').split(',').map(s => s.trim()).filter(Boolean);

const io = new Server(httpServer, {
  cors: {
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, Postman, etc.)
      if (!origin) return callback(null, true);
      
      if (allowedOrigins.length === 0) {
        // Fail-closed: no origins configured
        return callback(new Error('CORS: No allowed origins configured'));
      }
      
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('CORS: Origin not allowed'));
      }
    },
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Attach io to app to use in controllers
app.set('io', io);

// Middleware - Strict CORS with credentials
app.use(cors({
  origin: (origin, callback) => {
    // A missing Origin header is not a cross-origin browser request: it is a
    // same-origin call from the served SPA, a health probe, or a plain
    // navigation. Those are handled by the allowlist below only when an
    // Origin is actually present, so allow the header-less case everywhere.
    if (!origin) {
      return callback(null, true);
    }
    
    if (allowedOrigins.length === 0) {
      logger.error('CORS: No allowed origins configured');
      return callback(new Error('CORS: No allowed origins configured'));
    }
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      logSecurityEvent('CORS_VIOLATION', { origin, ip: 'unknown' });
      callback(new Error('CORS: Origin not allowed'));
    }
  },
  credentials: true
}));

// Body parsing with size limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ✅ SECURITY FIX: Parse HTTPOnly cookies for JWT validation
app.use(cookieParser());

// Sanitize data to prevent NoSQL injection
app.use(mongoSanitize({
  replaceWith: '_',
  onSanitize: ({ req, key }) => {
    logSecurityEvent('NOSQL_INJECTION_ATTEMPT', {
      ip: req.ip,
      path: req.path,
      key
    });
  }
}));

// Connect to Database
connectDB();

// SECURITY: Socket.io authentication middleware
io.use(async (socket, next) => {
  try {
    // ✅ SECURITY FIX: Check HTTPOnly cookie first (preferred), fall back to auth token
    let token = socket.handshake.headers.cookie
      ?.split('; ')
      .find(c => c.startsWith('fleetflow_token='))
      ?.split('=')?.[1];
    
    // Fallback to auth header for backward compatibility
    if (!token) {
      token = socket.handshake.auth?.token;
    }
    
    if (!token) {
      logSecurityEvent('SOCKET_AUTH_FAILED', {
        reason: 'No token provided',
        socketId: socket.id
      });
      return next(new Error('Authentication required'));
    }
    
    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('tokenVersion active organizationId role');

    if (!user || !user.active || decoded.tokenVersion !== user.tokenVersion) {
      return next(new Error('Invalid or expired token'));
    }

    socket.user = {
      userId: String(user._id),
      role: user.role,
      organizationId: String(user.organizationId)
    };
    logger.info('Socket authenticated', { userId: socket.user.userId, organizationId: socket.user.organizationId, socketId: socket.id });
    next();
  } catch (error) {
    logSecurityEvent('SOCKET_AUTH_FAILED', {
      reason: error.message,
      socketId: socket.id
    });
    next(new Error('Invalid or expired token'));
  }
});

// Socket.io connection logic
io.on('connection', (socket) => {
  logger.info('Socket connected', { 
    socketId: socket.id, 
    userId: socket.user.userId,
    organizationId: socket.user.organizationId 
  });

  socket.on('join_trip', async (tripId) => {
    try {
      // ✅ SECURITY FIX: Verify user has access to this trip
      const trip = await Trip.findOne({
        _id: tripId,
        organizationId: socket.user.organizationId
      });
      
      if (!trip) {
        logSecurityEvent('UNAUTHORIZED_TRIP_ACCESS', {
          userId: socket.user.userId,
          tripId,
          organizationId: socket.user.organizationId
        });
        socket.emit('error', { message: 'Trip not found or access denied' });
        return;
      }
      
      socket.join(`trip_${tripId}`);
      socket.emit('joined_trip', { tripId });
      logger.info('Socket joined trip', { 
        socketId: socket.id, 
        userId: socket.user.userId, 
        tripId 
      });
    } catch (error) {
      logger.error('Error joining trip', { error: error.message, tripId });
      socket.emit('error', { message: 'Failed to join trip' });
    }
  });

  socket.on('leave_trip', (tripId) => {
    socket.leave(`trip_${tripId}`);
    logger.info('Socket left trip', { socketId: socket.id, tripId });
  });

  socket.on('disconnect', () => {
    logger.info('Socket disconnected', { socketId: socket.id, userId: socket.user.userId });
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/vehicles', writeLimiter, vehicleRoutes);
app.use('/api/drivers', writeLimiter, driverRoutes);
app.use('/api/trips', writeLimiter, tripRoutes);
app.use('/api/maintenance', writeLimiter, maintenanceRoutes);
app.use('/api/expenses', writeLimiter, expenseRoutes);
app.use('/api/analytics', analyticsRoutes);

// Enhanced Health Check
app.get('/health', async (req, res) => {
  const dbStates = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  const health = {
    status: 'healthy',
    timestamp: new Date(),
    uptime: process.uptime(),
    checks: {}
  };

  // Database check
  try {
    await mongoose.connection.db.admin().ping();
    health.checks.database = {
      status: 'healthy',
      state: dbStates[mongoose.connection.readyState] || 'unknown'
    };
  } catch (error) {
    health.checks.database = {
      status: 'unhealthy',
      error: error.message
    };
    health.status = 'degraded';
  }

  // Memory check
  const memUsage = process.memoryUsage();
  health.checks.memory = {
    heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
    heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
    rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`
  };

  const statusCode = health.status === 'healthy' ? 200 : 503;
  res.status(statusCode).json(health);
});

// SECURITY: Debug endpoint removed in production to prevent information disclosure
// If needed for diagnostics, protect with admin authentication and IP restrictions
if (process.env.NODE_ENV === 'development') {
  app.get('/debug', (req, res) => {
    const dbStates = ['disconnected', 'connected', 'connecting', 'disconnecting'];
    res.status(200).json({
      hasMongoURI: !!process.env.MONGODB_URI,
      hasJwtSecret: !!process.env.JWT_SECRET,
      hasFrontendUrl: !!process.env.FRONTEND_URL,
      nodeEnv: process.env.NODE_ENV,
      dbReadyState: dbStates[mongoose.connection.readyState] || 'unknown',
    });
  });
}

// Serve the built frontend from the same origin (single deployable unit).
// Missing build is fine in development, where Vite serves the SPA instead.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDist = path.resolve(__dirname, '../frontend/dist');
const indexHtml = path.join(clientDist, 'index.html');

if (fs.existsSync(indexHtml)) {
  app.use(
    express.static(clientDist, {
      index: false,
      setHeaders: (res, filePath) => {
        if (filePath.includes(`${path.sep}assets${path.sep}`)) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
      }
    })
  );

  // Client-side routing: any non-API GET returns the SPA shell.
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path === '/health') return next();
    res.sendFile(indexHtml);
  });

  console.log(`📦 Serving frontend build from ${clientDist}`);
}

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  // Log error
  logger.error('Request error', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    ip: req.ip,
    userId: req.user?.userId
  });

  // Don't expose internal errors in production
  const message = process.env.NODE_ENV === 'production' 
    ? 'Internal server error' 
    : err.message || 'Something went wrong!';

  res.status(err.status || 500).json({
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
  logger.info(`🚀 Server running on port ${PORT} in ${process.env.NODE_ENV} mode`);
  console.log(`🚀 Server running on port ${PORT}`);
});

// Graceful shutdown
const gracefulShutdown = async (signal) => {
  logger.info(`${signal} received, shutting down gracefully`);
  
  httpServer.close(() => {
    logger.info('HTTP server closed');
  });
  
  try {
    await mongoose.connection.close();
    logger.info('MongoDB connection closed');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown', { error: error.message });
    process.exit(1);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', { reason, promise });
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', { error: error.message, stack: error.stack });
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});
