const express       = require('express');
const jwt           = require('jsonwebtoken');
const { execSync }  = require('child_process');

const router = express.Router();

function requireAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'Não autorizado.' });
  try {
    req.user = jwt.verify(auth.slice(7), process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Token inválido ou expirado.' });
  }
}

// Localiza o executável do Chromium no container
function findChromium() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  const candidates = [
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
  ];
  for (const p of candidates) {
    try { execSync(`test -f "${p}"`); return p; } catch {}
  }
  try { return execSync('which chromium 2>/dev/null || which chromium-browser 2>/dev/null').toString().trim(); } catch {}
  return null;
}

// POST /pdf/generate — converte HTML em PDF via Puppeteer (Chrome headless)
router.post('/generate', requireAuth, async (req, res) => {
  const { html, filename = 'ebook' } = req.body;
  if (!html) return res.status(400).json({ error: 'html é obrigatório.' });

  const puppeteer = require('puppeteer-core');
  const executablePath = findChromium();
  if (!executablePath) {
    return res.status(500).json({ error: 'Chromium não encontrado no servidor.' });
  }

  let browser;
  try {
    browser = await puppeteer.launch({
      executablePath,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-zygote',
      ],
      headless: true,
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 900 });

    // Renderiza como 'screen' para preservar o visual original (dark theme, gradientes)
    // O padrão seria 'print', que remove backgrounds e cores
    await page.emulateMediaType('screen');

    // Carrega o HTML e aguarda recursos externos (fonts, imagens)
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 });

    // Pequena pausa para fontes renderizarem
    await new Promise(r => setTimeout(r, 500));

    const pdfBytes = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '15mm', right: '15mm', bottom: '15mm', left: '15mm' },
    });

    // Puppeteer v22+ retorna Uint8Array — converter para Buffer antes de enviar
    const pdfBuffer = Buffer.from(pdfBytes);
    const safeName  = filename.replace(/[^a-z0-9_\-]/gi, '-');

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}.pdf"`);
    res.end(pdfBuffer);

  } catch (err) {
    console.error('PDF generation error:', err.message);
    res.status(500).json({ error: 'Erro ao gerar PDF: ' + err.message });
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
});

module.exports = router;
