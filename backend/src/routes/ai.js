const express = require('express');
const jwt     = require('jsonwebtoken');

const router = express.Router();

// Middleware — verifica JWT
function requireAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Não autorizado.' });
  }
  try {
    req.user = jwt.verify(auth.slice(7), process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Token inválido ou expirado.' });
  }
}

// POST /ai/generate  — proxy para Anthropic com streaming SSE
router.post('/generate', requireAuth, async (req, res) => {
  const { model, prompt, system } = req.body;

  if (!prompt) return res.status(400).json({ error: 'prompt é obrigatório.' });
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY não configurada no servidor.' });
  }

  const VALID_MODELS = [
    'claude-haiku-4-5-20251001',
    'claude-sonnet-4-6',
    'claude-opus-4-6',
  ];
  const selectedModel = VALID_MODELS.includes(model) ? model : 'claude-sonnet-4-6';

  // Headers SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  try {
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: selectedModel,
        max_tokens: 32000,
        stream: true,
        system: system || 'Você é um assistente especializado em criar ebooks HTML profissionais.',
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!anthropicRes.ok) {
      const err = await anthropicRes.json().catch(() => ({}));
      res.write(`data: ${JSON.stringify({ type: 'error', error: err?.error?.message || 'Erro na API Anthropic' })}\n\n`);
      return res.end();
    }

    // Repassa o stream da Anthropic para o cliente
    const reader = anthropicRes.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      res.write(chunk);
    }

    res.end();
  } catch (err) {
    console.error('AI proxy error:', err.message);
    res.write(`data: ${JSON.stringify({ type: 'error', error: err.message })}\n\n`);
    res.end();
  }
});

module.exports = router;
