require('dotenv').config();
const express   = require('express');
const cors      = require('cors');
const rateLimit = require('express-rate-limit');
const authRoutes= require('./routes/auth');
const aiRoutes  = require('./routes/ai');
const pdfRoutes = require('./routes/pdf');

const app  = express();
const PORT = process.env.PORT || 3000;

// Railway (e qualquer proxy reverso) envia X-Forwarded-For
app.set('trust proxy', 1);

// ── CORS ───────────────────────────────────────────────────────────────────
const allowedOrigins = [
  process.env.CORS_ORIGIN,
  'https://fillipeai.com',
  'https://www.fillipeai.com',
  // Permite preview deployments do Vercel
  /^https:\/\/fillipeai.*\.vercel\.app$/,
].filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    // Sem origin = curl, Postman, server-to-server — sempre permite
    if (!origin) return cb(null, true);
    const ok = allowedOrigins.some(o =>
      o instanceof RegExp ? o.test(origin) : o === origin
    );
    cb(ok ? null : new Error('Origem não permitida'), ok);
  },
  credentials: true,
}));

// ── Body parser ────────────────────────────────────────────────────────────
app.use(express.json({ limit: '500kb' }));

// ── Rate limiting ──────────────────────────────────────────────────────────
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10,                   // máx 10 tentativas por IP
  message: { error: 'Muitas tentativas. Aguarde 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ── Routes ─────────────────────────────────────────────────────────────────
app.use('/auth', loginLimiter, authRoutes);
app.use('/ai', aiRoutes);
app.use('/pdf', pdfRoutes);

app.get('/health', (_, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

// 404
app.use((_, res) => res.status(404).json({ error: 'Rota não encontrada.' }));

// Error handler
app.use((err, req, res, _next) => {
  console.error(err.message);
  res.status(500).json({ error: 'Erro interno.' });
});

// ── Start ──────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✓ API rodando na porta ${PORT}`);
  console.log(`  NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
});
