import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, Plugin} from 'vite';

function historyProxyPlugin(): Plugin {
  return {
    name: 'history-proxy-plugin',
    configureServer(server) {
      server.middlewares.use('/api/live-state', async (_req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.statusCode = 200;
        res.end(
          JSON.stringify({
            histories: { '30S': [], '1M': [], '3M': [], '5M': [] },
            signals: { '30S': null, '1M': null, '3M': null, '5M': null },
            endpoints: {
              '30S': 'https://draw.ar-lottery02.com/WinGo/WinGo_30S/GetHistoryIssuePage.json',
              '1M': 'https://draw.ar-lottery02.com/WinGo/WinGo_1M/GetHistoryIssuePage.json',
              '3M': 'https://draw.ar-lottery02.com/WinGo/WinGo_3M/GetHistoryIssuePage.json',
              '5M': 'https://draw.ar-lottery02.com/WinGo/WinGo_5M/GetHistoryIssuePage.json',
            },
            updatedAt: { '30S': null, '1M': null, '3M': null, '5M': null },
            serverTime: Date.now(),
            serverSynced: true,
          })
        );
      });

      server.middlewares.use('/api/history', async (req, res) => {
        try {
          const urlObj = new URL(req.url || '', 'http://localhost');
          const targetUrl = urlObj.searchParams.get('url');
          if (!targetUrl || !targetUrl.startsWith('https://')) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Valid HTTPS target URL is required' }));
            return;
          }

          // Build candidate URLs with active mirrors
          const candidateUrls: string[] = [];
          
          // If the target points to ar-lottery, prioritize working mirrors (02, 03, 04)
          if (targetUrl.includes('ar-lottery')) {
            candidateUrls.push(
              targetUrl.replace(/draw\.ar-lottery\d*\.com/g, 'draw.ar-lottery02.com'),
              targetUrl.replace(/draw\.ar-lottery\d*\.com/g, 'draw.ar-lottery03.com'),
              targetUrl.replace(/draw\.ar-lottery\d*\.com/g, 'draw.ar-lottery04.com'),
            );
          }
          candidateUrls.push(targetUrl);

          let lastResponse: Response | null = null;
          let bodyText = '';

          for (const cand of candidateUrls) {
            try {
              const fetchUrl = new URL(cand);
              fetchUrl.searchParams.set('ts', String(Date.now()));

              const response = await fetch(fetchUrl.toString(), {
                method: 'GET',
                headers: {
                  'Accept': 'application/json, text/plain, */*',
                  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                },
              });

              lastResponse = response;
              if (response.ok) {
                bodyText = await response.text();
                // Validate if it is valid JSON
                if (bodyText.trim().startsWith('{') || bodyText.trim().startsWith('[')) {
                  res.statusCode = 200;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(bodyText);
                  return;
                }
              }
            } catch {
              // Try next candidate mirror
            }
          }

          if (lastResponse) {
            res.statusCode = lastResponse.status;
            res.setHeader('Content-Type', lastResponse.headers.get('content-type') || 'application/json');
            res.end(bodyText || JSON.stringify({ error: `Feed returned status ${lastResponse.status}` }));
          } else {
            res.statusCode = 502;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'All mirrors failed to respond' }));
          }
        } catch (err: any) {
          res.statusCode = 502;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: err?.message || 'Proxy error' }));
        }
      });
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), historyProxyPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});

