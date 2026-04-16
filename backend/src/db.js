const { Pool } = require('pg');

// URLs externas (rlwy.net) precisam de SSL; URLs internas (.railway.internal) não
const isExternalUrl = process.env.DATABASE_URL?.includes('rlwy.net');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isExternalUrl ? { rejectUnauthorized: false } : false,
});

pool.on('error', (err) => {
  console.error('PostgreSQL pool error:', err.message);
});

module.exports = pool;
