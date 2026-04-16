// Cria ou atualiza o usuário admin
// Uso: node scripts/create-user.js
// Defina as variáveis de ambiente antes de rodar:
//   ADMIN_USERNAME=fillipe ADMIN_PASSWORD=suasenha node scripts/create-user.js
require('dotenv').config();
const bcrypt = require('bcrypt');
const pool   = require('../src/db');
const readline = require('readline');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise(r => rl.question(q, r));

async function main() {
  const username = process.env.ADMIN_USERNAME || await ask('Usuário: ');
  const password = process.env.ADMIN_PASSWORD || await ask('Senha: ');
  rl.close();

  if (!username || !password) {
    console.error('✗  Usuário e senha são obrigatórios.');
    process.exit(1);
  }
  if (password.length < 8) {
    console.error('✗  Senha deve ter pelo menos 8 caracteres.');
    process.exit(1);
  }

  const hash = await bcrypt.hash(password, 12);

  await pool.query(`
    INSERT INTO users (username, password_hash)
    VALUES ($1, $2)
    ON CONFLICT (username) DO UPDATE SET password_hash = $2
  `, [username.toLowerCase().trim(), hash]);

  console.log(`✓  Usuário "${username}" criado/atualizado com sucesso.`);
  await pool.end();
}

main().catch(err => {
  console.error('✗  Erro:', err.message);
  process.exit(1);
});
