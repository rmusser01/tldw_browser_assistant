  const { chromium } = require('@playwright/test');
  const fs = require('node:fs');
  const path = require('node:path');

  const SERVER_URL = 'http://127.0.0.1:8000';
  const API_KEY = 'THIS-IS-A-SECURE-KEY-123-FAKE-KEY';

  async function resolveExtensionId(context) {
    let targetUrl =
      (context.backgroundPages()[0] && context.backgroundPages()[0].url()) ||
      (context.serviceWorkers()[0] && context.serviceWorkers()[0].url()) ||
      '';
    if (!targetUrl) {
      const page =
        context.backgroundPages()[0] ||
        context.pages()[0] ||
        (await context.newPage());
      const session = await context.newCDPSession(page);
      const { targetInfos } = await session.send('Target.getTargets');
      const extTarget =
        targetInfos.find(
          (t) =>
            typeof t.url === 'string' &&
            t.url.startsWith('chrome-extension://') &&
            (t.type === 'background_page' || t.type === 'service_worker')
        ) ||
        targetInfos.find(
          (t) => typeof t.url === 'string' && t.url.startsWith('chrome-extension://')
        );
      if (extTarget?.url) targetUrl = extTarget.url;
    }
    const match = targetUrl.match(/chrome-extension:\/\/([a-p]{32})/);
    if (!match) throw new Error(`Could not determine extension id from ${targetUrl || '[no extension targets]'}`);
    return match[1];
  }

  (async () => {
    const extensionPath = path.resolve('build/chrome-mv3');
    const tmpRoot = path.resolve('tmp-playwright-profile');
    fs.mkdirSync(tmpRoot, { recursive: true });
    const userDataDir = fs.mkdtempSync(path.join(tmpRoot, 'user-data-'));

    const context = await chromium.launchPersistentContext(userDataDir, {
      headless: false,
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
        '--disable-crash-reporter',
        '--crash-dumps-dir=/tmp'
      ]
    });

    const waitForTargets = async () => {
      if (context.serviceWorkers().length || context.backgroundPages().length) return;
      await Promise.race([
        context.waitForEvent('serviceworker').catch(() => null),
        context.waitForEvent('backgroundpage').catch(() => null),
        new Promise((r) => setTimeout(r, 15000))
      ]);
    };
    await waitForTargets();

    const extensionId = await resolveExtensionId(context);
    const optionsUrl = `chrome-extension://${extensionId}/options.html`;

    const page = await context.newPage();
    page.on('console', (msg) => {
      const loc = msg.location();
      const location = loc.url ? ` (${loc.url}:${loc.lineNumber}:${loc.columnNumber})` : '';
      console.log(`[console:${msg.type()}] ${msg.text()}${location}`);
    });
    page.on('pageerror', (err) => console.log(`[pageerror] ${err.stack || err.message}`));

    await page.goto(`${optionsUrl}#/`, { waitUntil: 'domcontentloaded' });

    await page.evaluate(
      ({ serverUrl, apiKey }) =>
        new Promise((resolve) => {
          const payload = {
            tldwConfig: { serverUrl, authMode: 'single-user', apiKey },
            __tldw_first_run_complete: true
          };
          chrome.storage.local.set(payload, () => resolve(true));
        }),
      { serverUrl: SERVER_URL, apiKey: API_KEY }
    );

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__tldw_useConnectionStore, { timeout: 15000 }).catch(() => null);
  await page.waitForTimeout(1000);

  const openSidebar = page.getByRole('button', { name: /Open sidebar/i });
  if (await openSidebar.count()) await openSidebar.first().click();

  const serverTab = page.getByRole('radio', { name: /Server/i });
  if (await serverTab.count()) await serverTab.first().click();

  const debug = await page.evaluate(async () => {
    const store = window.__tldw_useConnectionStore;
    if (store?.getState?.().markFirstRunComplete) {
      await store.getState().markFirstRunComplete();
    }
    if (store?.getState?.().checkOnce) {
      await store.getState().checkOnce();
    }

    let config = null;
    try {
      config = await new Promise((resolve) => {
        chrome.storage.local.get('tldwConfig', (res) => resolve(res?.tldwConfig || null));
      });
    } catch {
      config = null;
    }

    let serverChat = null;
    if (config?.serverUrl) {
      try {
        const headers = {};
        if (config.authMode === 'single-user' && config.apiKey) {
          headers['X-API-KEY'] = String(config.apiKey);
        }
        const base = String(config.serverUrl).replace(/\/$/, '');
        const resp = await fetch(`${base}/api/v1/chats/?limit=5&ordering=-updated_at`, { headers });
        const data = await resp.json().catch(() => null);
        const first =
          Array.isArray(data)
            ? data[0]
            : data?.chats?.[0] || data?.items?.[0] || data?.results?.[0] || data?.data?.[0] || null;
        serverChat = {
          status: resp.status,
          firstTitle: first?.title || first?.name || null
        };
      } catch (err) {
        serverChat = { error: String(err) };
      }
    }

    return {
      connectionState: store?.getState?.().state || null,
      serverChat
    };
  });

  console.log('[playwright] debug:', JSON.stringify(debug, null, 2));

  const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const targetTitle = debug?.serverChat?.firstTitle;
  if (targetTitle) {
    const byTitle = page.getByRole('button', { name: new RegExp(escapeRegExp(targetTitle)) });
    if (await byTitle.count()) {
      await byTitle.first().click();
      console.log(`[playwright] clicked server chat: ${targetTitle}`);
    }
  } else {
    const chatButtons = page.locator('button.flex.flex-col.overflow-hidden');
    const count = await chatButtons.count();
    console.log(`[playwright] fallback chat buttons found: ${count}`);
    if (count) await chatButtons.first().click();
  }

  await page.waitForTimeout(10000);
    await context.close();
  })();
