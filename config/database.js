const mysql = require('mysql2/promise');
const config = require('./environment');

let pool = null;

/**
 * Initializes database connection pool and ensures the database exists.
 */
async function initDatabase() {
  try {
    // 1. First connect to MySQL server without database to ensure database exists
    const adminConnection = await mysql.createConnection({
      host: config.db.host,
      port: config.db.port,
      user: config.db.user,
      password: config.db.password,
    });

    await adminConnection.query(
      `CREATE DATABASE IF NOT EXISTS \`${config.db.name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`
    );
    await adminConnection.end();

    // 2. Initialize connection pool targeting the database
    pool = mysql.createPool({
      host: config.db.host,
      port: config.db.port,
      user: config.db.user,
      password: config.db.password,
      database: config.db.name,
      waitForConnections: true,
      connectionLimit: 15,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0,
      timezone: '+00:00', // UTC for database storage, converted per user's preference
      dateStrings: true,
    });

    // Test pool connection
    const [result] = await pool.query('SELECT 1 + 1 AS health_check');
    console.log(`[DB] Connected successfully to MySQL database "${config.db.name}" (Host: ${config.db.host}:${config.db.port})`);
    return pool;
  } catch (error) {
    console.error('[DB Error] Failed to connect to MySQL database:', error.message);
    throw error;
  }
}

/**
 * Helper to execute parameterized queries.
 * @param {string} sql 
 * @param {Array} params 
 * @returns {Promise<Array>}
 */
async function query(sql, params = []) {
  if (!pool) {
    throw new Error('Database pool has not been initialized. Call initDatabase() first.');
  }
  const [rows] = await pool.query(sql, params);
  return rows;
}

/**
 * Executes a callback within a managed database transaction.
 * Automatically commits on success and rolls back on error.
 * @param {Function} callback 
 * @returns {Promise<any>}
 */
async function transaction(callback) {
  if (!pool) {
    throw new Error('Database pool has not been initialized.');
  }
  const connection = await pool.getConnection();
  await connection.beginTransaction();
  try {
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

function getPool() {
  return pool;
}

module.exports = {
  initDatabase,
  query,
  transaction,
  getPool,
};
