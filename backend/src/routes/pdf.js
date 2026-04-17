const express  = require('express');
const jwt      = require('jsonwebtoken');

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

// POST /pdf/generate — converte HTML em PDF via Puppeteer + @sparticuz/chromium
router.post('/generate', requireAuth, async (req, res) => {
  const { html, filename = 'ebook' } = req.body;
  if (!html) return res.status(400).json({ error: 'html é obrigatório.' });

  const chromium  = require('@sparticuz/chromium');
  const puppeteer = require('puppeteer-core');

  let browser;
  try {
    browser = await puppeteer.launch({
      args:            chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath:  await chromium.executablePath(),
      headless:        chromium.headless,
    });

    const page = await browser.newPage();

    // Renderiza como 'screen' para preservar visual original (gradientes, cores)
    await page.emulateMediaType('screen');

    // Carrega o HTML e aguarda recursos externos (fonts, imagens)
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 });

    // Pausa para fontes renderizarem
    await new Promise(r => setTimeout(r, 800));

    const pdfBytes = await page.pdf({
      format:          'A4',
      printBackground: true,
      margin: { top: '15mm', right: '15mm', bottom: '15mm', left: '15mm' },
    });

    // Puppeteer v22+ retorna Uint8Array — converter para Buffer
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
