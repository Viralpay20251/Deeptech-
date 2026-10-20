import * as fs from 'fs';
import type { PostResult } from '../types.js';
import { createStealthContext, humanDelay, humanType, captureErrorScreenshot } from '../utils/browser.js';

export async function uploadLinkedInVideo(
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
    console.log('[LinkedInUploader] Navigating to LinkedIn Feed...');
    await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'networkidle', timeout: 45000 });

    // Verify session
    if (page.url().includes('/login') || page.url().includes('/checkpoint')) {
      throw new Error('LinkedIn session expired or auth challenge triggered.');
    }

    await humanDelay(1500, 2500);

    // Click "Start a post" button
    console.log('[LinkedInUploader] Clicking Start a Post...');
    const startPostSelector = 'button:has-text("Start a post"), div.share-box-feed-entry__top-bar button, button#ember-share-box-trigger';
    await page.waitForSelector(startPostSelector, { timeout: 30000 });
    await page.click(startPostSelector);
    await humanDelay(1000, 2000);

    // Locate media upload button or file input
    console.log(`[LinkedInUploader] Attaching video file: ${videoPath}`);
    const mediaBtnSelector = 'button[aria-label*="Add media" i], button[aria-label*="video" i], button[aria-label*="Photo" i]';
    
    // Try to set input files directly if hidden input exists, or click media button
    let fileInput = await page.$('input[type="file"]');
    if (!fileInput) {
      const mediaBtn = await page.$(mediaBtnSelector);
      if (mediaBtn) {
        await mediaBtn.click();
        await humanDelay(500, 1000);
      }
      fileInput = await page.waitForSelector('input[type="file"]', { timeout: 15000 });
    }

    if (!fileInput) {
      throw new Error('Could not find file input for LinkedIn video upload');
    }

    await fileInput.setInputFiles(videoPath);
    console.log('[LinkedInUploader] Video file attached, waiting for preview/editor dialog...');
    await humanDelay(3000, 5000);

    // Media preview dialog: Click "Next" or "Done" button to proceed to caption
    const mediaDoneBtn = 'div.share-box-footer button:has-text("Next"), button:has-text("Next"), button:has-text("Done")';
    try {
      await page.waitForSelector(mediaDoneBtn, { timeout: 20000 });
      await page.click(mediaDoneBtn);
      await humanDelay(1000, 2000);
    } catch {
      console.log('[LinkedInUploader] Video editor Next button not prompted or auto-advanced');
    }

    // Enter caption
    console.log('[LinkedInUploader] Typing post caption...');
    const editorSelector = 'div.ql-editor[contenteditable="true"], div[role="textbox"][aria-label*="post" i], div[data-placeholder*="talk about" i]';
    await page.waitForSelector(editorSelector, { timeout: 20000 });
    await humanType(page, editorSelector, caption);
    await humanDelay(1000, 2000);

    // Click "Post" button
    console.log('[LinkedInUploader] Clicking Post button...');
    const postBtnSelector = 'button.share-actions__primary-action, button:has-text("Post")';
    await page.waitForSelector(postBtnSelector, { timeout: 20000 });
    await page.click(postBtnSelector);

    // Wait for post to submit
    console.log('[LinkedInUploader] Waiting for post confirmation...');
    await humanDelay(4000, 6000);

    // Look for link to view post (toast or top feed item)
    let postUrl = '';
    try {
      const viewPostToast = await page.$('a:has-text("View post"), div.artdeco-toast-item a');
      if (viewPostToast) {
        const href = await viewPostToast.getAttribute('href');
        if (href) {
          postUrl = href.startsWith('http') ? href : `https://www.linkedin.com${href}`;
        }
      }
    } catch {
      // Fallback
    }

    if (!postUrl) {
      postUrl = 'https://www.linkedin.com/feed/';
    }

    console.log(`[LinkedInUploader] Successfully posted to LinkedIn! URL: ${postUrl}`);
    return {
      success: true,
      post_url: postUrl,
    };
  } catch (err) {
    const errorMsg = (err as Error).message;
    console.error(`[LinkedInUploader] LinkedIn video post failed: ${errorMsg}`);
    await captureErrorScreenshot(page, 'linkedin', 'post_failed');
    return {
      success: false,
      error: errorMsg,
    };
  } finally {
    await browser.close().catch(() => {});
  }
}
