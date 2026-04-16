const express  = require('express');
const bcrypt   = require('bcrypt');
const jwt      = require('jsonwebtoken');
const pool     = require('../db');

const router = express.Router();

// POST /auth/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Usuário e senha obrigatórios.' });
    }

    // Busca o usuário no banco
    const { rows } = await pool.query(
      'SELECT id, username, password_hash FROM users WHERE username = $1',
      [username.toLowerCase().trim()]
    );

    if (rows.length === 0) {
      // Tempo constante para não revelar se o usuário existe
      await bcrypt.compare(password, '$2b$12$invalidhashtopreventtiming000000000000000000000');
      return res.status(401).json({ error: 'Usuário ou senha incorretos.' });
    }

    const user = rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);

    if (!valid) {
      return res.status(401).json({ error: 'Usuário ou senha incorretos.' });
    }

    // Gera JWT
    const token = jwt.sign(
      { sub: user.id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    // Atualiza last_login
    await pool.query(
      'UPDATE users SET last_login = NOW() WHERE id = $1',
      [user.id]
    );

    return res.json({
      token,
      username: user.username,
      message: 'Login realizado com sucesso.',
    });
  } catch (err) {
    console.error('Login error:', err.message, err.stack);
    return res.status(500).json({ error: 'Erro interno. Tente novamente.', detail: err.message });
  }
});

// GET /auth/verify  — valida token
router.get('/verify', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ valid: false, error: 'Token não fornecido.' });
  }

  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    return res.json({ valid: true, username: payload.username });
  } catch {
    return res.status(401).json({ valid: false, error: 'Token inválido ou expirado.' });
  }
});

module.exports = router;
