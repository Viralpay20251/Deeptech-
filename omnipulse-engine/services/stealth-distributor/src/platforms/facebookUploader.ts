import * as fs from 'fs';
import type { PostResult } from '../types.js';
import { createStealthContext, humanDelay, humanType, captureErrorScreenshot } from '../utils/browser.js';

export async function uploadFacebookReel(
  videoPath: string,
  caption: string,
  thumbnailPath: string,
  cookieFile: string
): Promise<PostResult> {
  if (!fs.existsSync(videoPath)) {
    return {
      success: false,
      error: `Video file does not exist at path: ${videoPath}`,
    };
  }

  const { browser, page } = await createStealthContext(cookieFile);

  try {
    console.log('[FacebookUploader] Navigating to Facebook Reels Creator...');
    // Direct link to create reels is the cleanest route
    await page.goto('https://www.facebook.com/reel/create', { waitUntil: 'networkidle', timeout: 45000 });

    // Check if session valid
    if (page.url().includes('login') || page.url().includes('checkpoint')) {
      throw new Error('Facebook session expired or checkpoint challenge triggered.');
    }

    // Dismiss cookie / notification dialogs if present
    const dismissButtons = [
      'button[data-cookiebanner="accept_button"]',
      'div[aria-label="Decline optional cookies"]',
      'div[aria-label="Allow essential cookies only"]',
      'button:has-text("Decline optional cookies")',
    ];
    for (const btnSel of dismissButtons) {
      try {
        const btn = await page.$(btnSel);
        if (btn && await btn.isVisible()) {
          await btn.click();
          await humanDelay(500, 1000);
        }
      } catch {
        // Optional
      }
    }

    await humanDelay(1500, 2500);

    // Locate video file input
    console.log(`[FacebookUploader] Uploading video: ${videoPath}`);
    const fileInput = await page.waitForSelector('input[type="file"]', { timeout: 30000 });
    await fileInput.setInputFiles(videoPath);

    // Wait for video preview/processing indicator
    await humanDelay(2000, 4000);

    // Describe reel / caption input
    console.log('[FacebookUploader] Setting caption/description...');
    const descSelector = 'div[aria-label*="Describe your reel" i], div[role="textbox"][contenteditable="true"], textarea[placeholder*="Describe" i]';
    try {
      await page.waitForSelector(descSelector, { timeout: 30000 });
      await humanType(page, descSelector, caption);
    } catch {
      // Fallback selector
      const genericTextbox = await page.$('div[role="textbox"]');
      if (genericTextbox) {
        await genericTextbox.click();
        await page.keyboard.type(caption, { delay: 20 });
      }
    }

    await humanDelay(1000, 2000);

    // Click "Next" button if step-by-step wizard is active
    const nextBtnSelector = 'div[role="button"]:has-text("Next"), button:has-text("Next")';
    for (let step = 0; step < 2; step++) {
      try {
        const nextBtn = await page.$(nextBtnSelector);
        if (nextBtn && await nextBtn.isVisible()) {
          await nextBtn.click();
          await humanDelay(1000, 2000);
        }
      } catch {
        // Wizard might only be 1 step depending on layout
      }
    }

    // Click "Publish" button
    console.log('[FacebookUploader] Clicking Publish...');
    const publishBtnSelector = 'div[role="button"]:has-text("Publish"), button:has-text("Publish"), div[aria-label="Publish"]';
    await page.waitForSelector(publishBtnSelector, { timeout: 30000 });
    await page.click(publishBtnSelector);

    // Wait for upload and processing completion
    console.log('[FacebookUploader] Waiting for publish processing...');
    await humanDelay(4000, 7000);

    let postUrl = '';
    // Look for link to view reel or grab from current page URL
    try {
      const reelLink = await page.$('a[href*="/reel/"], a[href*="/videos/"]');
      if (reelLink) {
        const href = await reelLink.getAttribute('href');
        if (href) {
          postUrl = href.startsWith('http') ? href : `https://www.facebook.com${href}`;
        }
      }
    } catch {
      // Fallback
    }

    if (!postUrl) {
      postUrl = page.url().includes('/reel/') ? page.url() : 'https://www.facebook.com/reels';
    }

    console.log(`[FacebookUploader] Facebook Reel successfully published! URL: ${postUrl}`);
    return {
      success: true,
      post_url: postUrl,
    };
  } catch (err) {
    const errorMsg = (err as Error).message;
    console.error(`[FacebookUploader] Facebook Reel upload failed: ${errorMsg}`);
    await captureErrorScreenshot(page, 'facebook', 'reel_failed');
    return {
      success: false,
      error: errorMsg,
    };
  } finally {
    await browser.close().catch(() => {});
  }
}
