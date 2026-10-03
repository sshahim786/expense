const app = require('./src/app');
const config = require('./src/config/environment');
const { initDatabase, getPool } = require('./src/config/database');
const { createAuthTables } = require('./src/database/initAuthTables');

async function startServer() {
  try {
    console.log('--------------------------------------------------');
    console.log(`Starting MyFinance Server in [${config.nodeEnv.toUpperCase()}] mode...`);
    console.log('--------------------------------------------------');

    // Initialize Database Connection Pool
    await initDatabase();

    // Ensure Auth & User Schema Exists
    await createAuthTables();

    // Start Listening
    const server = app.listen(config.port, () => {
      console.log(`[HTTP] Server listening on port ${config.port}`);
      console.log(`[API]  Base URL: http://localhost:${config.port}/api/v1`);
      console.log(`[API]  Health Check: http://localhost:${config.port}/api/v1/health`);
    });

    // Graceful Shutdown Handler
    const shutdown = async (signal) => {
      console.log(`\nReceived ${signal}. Gracefully shutting down...`);
      server.close(async () => {
        console.log('[HTTP] Closed HTTP server.');
        const pool = getPool();
        if (pool) {
          await pool.end();
          console.log('[DB] Closed MySQL connection pool.');
        }
        process.exit(0);
      });

      // Force exit after 10 seconds if graceful shutdown hangs
      setTimeout(() => {
        console.error('Forcefully terminating process after timeout.');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

  } catch (error) {
    console.error('Fatal: Failed to start MyFinance backend server:', error);
    process.exit(1);
  }
}

startServer();
