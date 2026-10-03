const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const config = require('./config/environment');
const { query } = require('./config/database');
const ApiResponse = require('./utils/apiResponse');
const { notFoundHandler, globalErrorHandler } = require('./middleware/error.middleware');

const app = express();

// Security HTTP headers
app.use(helmet());

// CORS configuration
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, postman)
      if (!origin) return callback(null, true);
      if (
        origin === config.clientUrl ||
        /^http:\/\/localhost:(5173|5174|5175|3000)$/.test(origin)
      ) {
        return callback(null, true);
      }
      return callback(null, true); // Permissive in development
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// Logging
if (config.nodeEnv !== 'test') {
  app.use(morgan(config.isProduction ? 'combined' : 'dev'));
}

// Request parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Disable ETag caching for real-time financial accuracy
app.set('etag', false);

// Prevent browser caching on dynamic API routes
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});

// Basic rate limiting
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // Limit each IP to 300 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again after 15 minutes.',
    errors: [],
  },
});
app.use('/api/', generalLimiter);

// API v1 Router
const apiRouter = express.Router();

// Health Check Endpoint
apiRouter.get('/health', async (req, res, next) => {
  try {
    const dbCheck = await query('SELECT 1 + 1 AS health');
    const dbStatus = dbCheck && dbCheck[0].health === 2 ? 'connected' : 'unhealthy';

    return ApiResponse.success(res, 'MyFinance API is operational', {
      status: 'UP',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      database: dbStatus,
      environment: config.nodeEnv,
      version: '1.0.0',
    });
  } catch (error) {
    return ApiResponse.error(res, 'Health check failed: database unreachable', [error.message], 503);
  }
});

// Mount Sub-routers
const authRoutes = require('./modules/auth/auth.routes');
const userRoutes = require('./modules/users/users.routes');
const categoriesRoutes = require('./modules/categories/categories.routes');
const accountsRoutes = require('./modules/accounts/accounts.routes');
const incomeRoutes = require('./modules/income/income.routes');
const expensesRoutes = require('./modules/expenses/expenses.routes');
const transactionsRoutes = require('./modules/transactions/transactions.routes');
const dashboardRoutes = require('./modules/dashboard/dashboard.routes');

apiRouter.use('/auth', authRoutes);
apiRouter.use('/users', userRoutes);
apiRouter.use('/categories', categoriesRoutes);
apiRouter.use('/accounts', accountsRoutes);
apiRouter.use('/income', incomeRoutes);
apiRouter.use('/expenses', expensesRoutes);
apiRouter.use('/transactions', transactionsRoutes);
apiRouter.use('/dashboard', dashboardRoutes);

// Mount /api/v1
app.use('/api/v1', apiRouter);

// Undefined routes 404 handler
app.use(notFoundHandler);

// Global Error Handler
app.use(globalErrorHandler);

module.exports = app;
