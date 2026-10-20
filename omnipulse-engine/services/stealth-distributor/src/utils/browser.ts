import { chromium, Browser, BrowserContext, Page } from 'patchright';
import * as fs from 'fs';
import * as path from 'path';

export interface StealthContextResult {
  browser: Browser;
  context: BrowserContext;
  page: Page;
}

const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

/**
 * Creates a stealth browser session with realistic viewport, anti-detect flags, and loaded storageState.
 */
export async function createStealthContext(
  cookieFile?: string,
  headless: boolean = process.env.PATCHRIGHT_HEADLESS !== 'false'
): Promise<StealthContextResult> {
  const browser = await chromium.launch({
    headless,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu',
      '--hide-scrollbars',
      '--mute-audio',
      '--disable-background-networking',
      '--disable-blink-features=AutomationControlled',
    ],
  });

  const contextOptions: Record<string, any> = {
    viewport: { width: 1280, height: 800 },
    userAgent: DEFAULT_USER_AGENT,
    deviceScaleFactor: 1,
    locale: 'en-US',
    timezoneId: 'Asia/Kolkata',
    permissions: ['geolocation', 'notifications'],
  };

  // If cookie file exists and is valid, load storageState
  if (cookieFile && fs.existsSync(cookieFile)) {
    try {
      contextOptions.storageState = cookieFile;
    } catch (err) {
      console.warn(`[StealthBrowser] Warning: could not parse cookie file ${cookieFile}:`, err);
    }
  } else if (cookieFile) {
    console.warn(`[StealthBrowser] Cookie file not found at ${cookieFile}. Launching clean context.`);
  }

  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();

  // Add realistic navigator overrides
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', {
      get: () => undefined,
    });
    // Chrome runtime emulation
    (window as any).chrome = {
      runtime: {},
      loadTimes: () => {},
      csi: () => {},
      app: {},
    };
  });

  return { browser, context, page };
}

/**
 * Humanized typing simulation with random delays between key presses.
 */
export async function humanType(page: Page, selector: string, text: string): Promise<void> {
  await page.waitForSelector(selector, { state: 'visible', timeout: 15000 });
  await page.click(selector);
  // Add small pause before typing
  await humanDelay(200, 400);

  for (const char of text) {
    await page.keyboard.type(char, { delay: Math.floor(Math.random() * 50) + 30 });
    // Occasional tiny pauses between sentences/words
    if (char === ' ' && Math.random() > 0.8) {
      await humanDelay(50, 150);
    }
  }
}

/**
 * Random human delay helper
 */
export function humanDelay(minMs: number = 500, maxMs: number = 1500): Promise<void> {
  const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  return new Promise((resolve) => setTimeout(resolve, delay));
}

/**
 * Captures screenshot on failure for debugging and analysis
 */
export async function captureErrorScreenshot(
  page: Page | null,
  platform: string,
  label: string
): Promise<string | null> {
  if (!page) return null;

  try {
    const dir = path.resolve(process.cwd(), 'screenshots');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${platform}_${label}_${timestamp}.png`;
    const filepath = path.join(dir, filename);
    await page.screenshot({ path: filepath, fullPage: true });
    console.error(`[StealthBrowser] Failure screenshot saved: ${filepath}`);
    return filepath;
  } catch (err) {
    console.error(`[StealthBrowser] Could not capture screenshot:`, err);
    return null;
  }
}
