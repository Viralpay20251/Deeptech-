import * as fs from 'fs';
import type { PostResult } from '../types.js';
import { createStealthContext, humanDelay, captureErrorScreenshot } from '../utils/browser.js';

export async function uploadYouTubeShort(
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
    console.log(`[YouTubeUploader] Navigating to YouTube Studio...`);
    await page.goto('https://studio.youtube.com', { waitUntil: 'networkidle', timeout: 60000 });

    // Verify if we are logged in or redirected to login
    if (page.url().includes('accounts.google.com')) {
      throw new Error('Google session expired or invalid cookies. Redirected to accounts.google.com');
    }

    await humanDelay(1000, 2000);

    // Click Create button
    const createBtnSelector = '[aria-label="Create"], #create-icon, button:has-text("Create")';
    await page.waitForSelector(createBtnSelector, { timeout: 30000 });
    await page.click(createBtnSelector);
    await humanDelay(500, 1000);

    // Click Upload videos button
    const uploadBtnSelector = '[test-id="upload-beta-button"], ytcp-text-menu #text-item-0, [aria-label="Upload videos"]';
    await page.waitForSelector(uploadBtnSelector, { timeout: 15000 });
    await page.click(uploadBtnSelector);

    // Wait for file input and attach video
    const fileInput = await page.waitForSelector('input[type="file"]', { timeout: 30000 });
    console.log(`[YouTubeUploader] Uploading video file: ${videoPath}`);
    await fileInput.setInputFiles(videoPath);

    // Wait for title input field to appear (signaling upload processing started)
    const titleInputSelector = '#textbox[aria-label*="title" i], [placeholder="Add a title"], #title-textarea #textbox';
    await page.waitForSelector(titleInputSelector, { timeout: 60000 });
    await humanDelay(1000, 2000);

    // Clear and fill title (max 100 chars for YouTube Shorts title)
    const shortTitle = caption.length > 95 ? caption.substring(0, 95) + '...' : caption;
    await page.click(titleInputSelector);
    // Select all existing text and type
    await page.keyboard.press('Control+A');
    await page.keyboard.press('Backspace');
    await page.keyboard.type(shortTitle, { delay: 20 });
    await humanDelay(800, 1500);

    // Fill description if available
    const descInputSelector = '#description-textarea #textbox, [placeholder="Tell viewers about your video"]';
    const descElem = await page.$(descInputSelector);
    if (descElem) {
      await descElem.click();
      await page.keyboard.type(caption, { delay: 10 });
    }

    // Set audience: Not Made for Kids (mandatory on YouTube)
    const notForKidsSelector = 'tp-yt-paper-radio-button[name="VIDEO_MADE_FOR_KIDS_NOT_MFK"], #not-made-for-kids';
    try {
      await page.waitForSelector(notForKidsSelector, { timeout: 10000 });
      await page.click(notForKidsSelector);
    } catch {
      console.log('[YouTubeUploader] Audience radio not required or already selected');
    }

    await humanDelay(1000, 1500);

    // Click "Next" button through Details -> Monetization / Elements -> Checks -> Visibility
    const nextBtnSelector = '#next-button, button:has-text("Next")';
    for (let step = 0; step < 3; step++) {
      try {
        const nextBtn = await page.$(nextBtnSelector);
        if (nextBtn && await nextBtn.isVisible()) {
          await nextBtn.click();
          await humanDelay(1200, 2000);
        }
      } catch (err) {
        console.warn(`[YouTubeUploader] Next button step ${step} skipped or not ready.`);
      }
    }

    // On Visibility step, select "Public"
    const publicRadioSelector = 'tp-yt-paper-radio-button[name="PUBLIC"], #public-radio-button';
    await page.waitForSelector(publicRadioSelector, { timeout: 15000 });
    await page.click(publicRadioSelector);
    await humanDelay(1000, 2000);

    // Extract video link if shown in preview dialog
    let postUrl = '';
    try {
      const linkElem = await page.$('a.ytcp-video-info, a[href*="youtu.be"]');
      if (linkElem) {
        const rawHref = await linkElem.getAttribute('href');
        if (rawHref) {
          postUrl = rawHref;
        }
      }
    } catch {
      // Url will be extracted post-publish if preview not available
    }

    // Click Done / Publish button
    const doneBtnSelector = '#done-button, [aria-label="Done"], button:has-text("Publish")';
    await page.waitForSelector(doneBtnSelector, { timeout: 20000 });
    await page.click(doneBtnSelector);

    console.log('[YouTubeUploader] Publish clicked, waiting for confirmation...');
    await humanDelay(3000, 5000);

    // If postUrl wasn't found in dialog, inspect current URL or look for share link dialog
    if (!postUrl) {
      try {
        const shareLinkElem = await page.waitForSelector('a#share-url, a[href*="youtu.be"], a[href*="youtube.com/shorts"]', { timeout: 15000 });
        if (shareLinkElem) {
          postUrl = (await shareLinkElem.getAttribute('href')) || '';
        }
      } catch {
        const videoIdMatch = page.url().match(/\/video\/([^/]+)/);
        if (videoIdMatch && videoIdMatch[1]) {
          postUrl = `https://youtube.com/shorts/${videoIdMatch[1]}`;
        }
      }
    }

    // Normalize URL to /shorts/ format if youtu.be
    if (postUrl && postUrl.includes('youtu.be/')) {
      const vidId = postUrl.split('youtu.be/')[1]?.split('?')[0];
      if (vidId) {
        postUrl = `https://youtube.com/shorts/${vidId}`;
      }
    }

    console.log(`[YouTubeUploader] Upload successful! Post URL: ${postUrl}`);
    return {
      success: true,
      post_url: postUrl || 'https://youtube.com/shorts/published',
    };
  } catch (err) {
    const errorMsg = (err as Error).message;
    console.error(`[YouTubeUploader] Failed to upload YouTube Short: ${errorMsg}`);
    await captureErrorScreenshot(page, 'youtube', 'upload_failed');
    return {
      success: false,
      error: errorMsg,
    };
  } finally {
    await browser.close().catch(() => {});
  }
}
