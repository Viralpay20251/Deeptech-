import * as fs from 'fs';
import type { PostResult } from '../types.js';
import { createStealthContext, humanDelay, humanType, captureErrorScreenshot } from '../utils/browser.js';

export async function uploadInstagramReel(
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
    console.log('[InstagramUploader] Navigating to Instagram...');
    await page.goto('https://www.instagram.com/', { waitUntil: 'networkidle', timeout: 45000 });

    // Handle common dismissal popups (notifications, cookies)
    const dismissSelectors = [
      'button:has-text("Not Now")',
      'button:has-text("Decline optional cookies")',
      'button:has-text("Only allow essential cookies")',
      'button:has-text("Cancel")',
    ];

    for (const sel of dismissSelectors) {
      try {
        const btn = await page.$(sel);
        if (btn && await btn.isVisible()) {
          await btn.click();
          await humanDelay(500, 1000);
        }
      } catch {
        // Popups are optional
      }
    }

    // Verify session
    if (page.url().includes('/accounts/login')) {
      throw new Error('Instagram session expired or invalid cookies. Redirected to login page.');
    }

    await humanDelay(1500, 2500);

    // Click "Create" or "+" icon in side navigation
    console.log('[InstagramUploader] Looking for Create button...');
    const createSelector = 'svg[aria-label="New post"], svg[aria-label="Create"], [aria-label="New Post"], a[href="#"]:has-text("Create")';
    await page.waitForSelector(createSelector, { timeout: 30000 });
    await page.click(createSelector);
    await humanDelay(1000, 2000);

    // If sub-menu appears (Post vs Reel), select "Post" or "Reel"
    try {
      const reelOption = await page.$('span:has-text("Reel"), span:has-text("Post")');
      if (reelOption && await reelOption.isVisible()) {
        await reelOption.click();
        await humanDelay(500, 1000);
      }
    } catch {
      // Sub-menu might not exist in all web layouts
    }

    // Upload video via file input
    console.log(`[InstagramUploader] Uploading video: ${videoPath}`);
    const fileInput = await page.waitForSelector('input[type="file"]', { timeout: 30000 });
    await fileInput.setInputFiles(videoPath);

    // Handle "Video posts are now shared as reels" OK prompt if it appears
    try {
      const okButton = await page.waitForSelector('button:has-text("OK"), div[role="button"]:has-text("OK")', { timeout: 5000 });
      if (okButton) {
        await okButton.click();
        await humanDelay(500, 1000);
      }
    } catch {
      // Prompt does not always appear
    }

    // Wait for Next button after video loads
    console.log('[InstagramUploader] Video loaded. Navigating through editing steps...');
    const nextBtnSelector = 'div[role="button"]:has-text("Next"), button:has-text("Next")';
    await page.waitForSelector(nextBtnSelector, { timeout: 30000 });
    await page.click(nextBtnSelector);
    await humanDelay(1500, 2500);

    // Second Next (Filters / Trim screen)
    await page.waitForSelector(nextBtnSelector, { timeout: 30000 });
    await page.click(nextBtnSelector);
    await humanDelay(1500, 2500);

    // Cover photo upload if provided
    if (thumbnailPath && fs.existsSync(thumbnailPath)) {
      try {
        console.log(`[InstagramUploader] Setting cover photo from: ${thumbnailPath}`);
        const coverTab = await page.$('div:has-text("Cover photo")');
        if (coverTab) {
          await coverTab.click();
          await humanDelay(500, 1000);
          const coverFileInput = await page.$('input[type="file"][accept*="image"]');
          if (coverFileInput) {
            await coverFileInput.setInputFiles(thumbnailPath);
            await humanDelay(1000, 1500);
          }
        }
      } catch (covErr) {
        console.warn('[InstagramUploader] Optional cover photo setting skipped:', covErr);
      }
    }

    // Fill caption (Instagram limit: 2200 characters)
    console.log('[InstagramUploader] Filling caption...');
    const trimmedCaption = caption.substring(0, 2200);
    const captionSelector = 'div[aria-label="Write a caption..."], div[role="textbox"][contenteditable="true"]';
    await page.waitForSelector(captionSelector, { timeout: 30000 });
    await humanType(page, captionSelector, trimmedCaption);
    await humanDelay(1000, 2000);

    // Click "Share" button
    console.log('[InstagramUploader] Clicking Share...');
    const shareBtnSelector = 'div[role="button"]:has-text("Share"), button:has-text("Share")';
    await page.waitForSelector(shareBtnSelector, { timeout: 30000 });
    await page.click(shareBtnSelector);

    // Wait for upload completion confirmation
    console.log('[InstagramUploader] Waiting for upload completion...');
    const completionSelector = 'span:has-text("Your reel has been shared."), span:has-text("Your post has been shared."), img[alt*="Animated checkmark"]';
    await page.waitForSelector(completionSelector, { timeout: 60000 });

    let postUrl = '';
    // Look for link to view post
    try {
      const viewPostLink = await page.$('a:has-text("View post"), a[href*="/reel/"], a[href*="/p/"]');
      if (viewPostLink) {
        const href = await viewPostLink.getAttribute('href');
        if (href) {
          postUrl = href.startsWith('http') ? href : `https://www.instagram.com${href}`;
        }
      }
    } catch {
      // Fallback below
    }

    if (!postUrl) {
      postUrl = 'https://www.instagram.com/reels/';
    }

    console.log(`[InstagramUploader] Successfully uploaded Instagram Reel! URL: ${postUrl}`);
    return {
      success: true,
      post_url: postUrl,
    };
  } catch (err) {
    const errorMsg = (err as Error).message;
    console.error(`[InstagramUploader] Error uploading Instagram Reel: ${errorMsg}`);
    await captureErrorScreenshot(page, 'instagram', 'reel_failed');
    return {
      success: false,
      error: errorMsg,
    };
  } finally {
    await browser.close().catch(() => {});
  }
}
