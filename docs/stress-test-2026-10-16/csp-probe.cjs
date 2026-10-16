// Independent Chromium diagnostic; synthetic loopback HTTP, no application secrets.
const http = require('node:http');
const { randomBytes } = require('node:crypto');
const { chromium } = require('../../web/node_modules/@playwright/test');

(async () => {
  const nonce = randomBytes(32).toString('base64');
  const server = http.createServer((req, res) => {
    res.writeHead(200, {
      'Content-Type': 'text/html',
      'Content-Security-Policy': `default-src 'self'; script-src 'nonce-${nonce}' 'strict-dynamic'; object-src 'none'; base-uri 'none'`,
    });
    res.end(`<!doctype html><html><body>
      <script>window.parserUnnonced = true</script>
      <script nonce="wrong">window.parserWrongNonce = true</script>
      <script nonce="${nonce}">window.parserTrusted = true</script>
      </body></html>`);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch();
    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    const result = await page.evaluate(() => {
      const script = document.createElement('script');
      script.textContent = 'window.dynamicUnnonced = true';
      document.head.append(script);
      return {
        parser_unnonced_executed: Boolean(window.parserUnnonced),
        parser_wrong_nonce_executed: Boolean(window.parserWrongNonce),
        parser_matching_nonce_executed: Boolean(window.parserTrusted),
        dynamic_unnonced_executed: Boolean(window.dynamicUnnonced),
      };
    });
    console.log(JSON.stringify(result, null, 2));
    if (result.parser_unnonced_executed || result.parser_wrong_nonce_executed ||
        !result.parser_matching_nonce_executed || !result.dynamic_unnonced_executed) process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
