// Roda as migrations no banco de dados
// Uso: node scripts/migrate.js
require('dotenv').config();
const pool = require('../src/db');

async function migrate() {
  console.log('⟳  Rodando migrations...');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id            SERIAL PRIMARY KEY,
      username      VARCHAR(50) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      last_login    TIMESTAMP WITH TIME ZONE
    );
  `);

  console.log('✓  Tabela users OK');
  console.log('✓  Migration concluída');
  await pool.end();
}

migrate().catch(err => {
  console.error('✗  Migration falhou:', err.message);
  process.exit(1);
});
