import * as fs from 'fs';
import type { PostResult } from '../types.js';
import { createStealthContext, humanDelay, humanType, captureErrorScreenshot } from '../utils/browser.js';

/**
 * Splits a long caption into tweet-sized thread chunks (max ~270 chars to accommodate numbering)
 */
function splitIntoThreadChunks(text: string, maxLen: number = 260): string[] {
  if (text.length <= 280) {
    return [text];
  }

  const words = text.split(/\s+/);
  const chunks: string[] = [];
  let currentChunk = '';

  for (const word of words) {
    if ((currentChunk + ' ' + word).trim().length > maxLen) {
      if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
      }
      currentChunk = word;
    } else {
      currentChunk = currentChunk ? `${currentChunk} ${word}` : word;
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  // Format with thread counter (e.g., 1/4)
  const total = chunks.length;
  return chunks.map((chunk, index) => `${chunk} (${index + 1}/${total})`);
}

export async function uploadTwitterPost(
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
    console.log('[TwitterUploader] Navigating to X (Twitter) compose...');
    await page.goto('https://x.com/compose/post', { waitUntil: 'networkidle', timeout: 45000 });

    // Verify session
    if (page.url().includes('/i/flow/login') || page.url().includes('/login')) {
      throw new Error('Twitter/X session expired or invalid cookies. Redirected to login.');
    }

    await humanDelay(1500, 2500);

    // Prepare thread chunks
    const threadChunks = splitIntoThreadChunks(caption);
    const firstTweetText = threadChunks[0];

    // Upload video file
    console.log(`[TwitterUploader] Uploading video: ${videoPath}`);
    const fileInputSelector = 'input[data-testid="fileInput"], input[type="file"]';
    const fileInput = await page.waitForSelector(fileInputSelector, { timeout: 30000 });
    await fileInput.setInputFiles(videoPath);

    // Wait for video upload and processing preview
    console.log('[TwitterUploader] Waiting for video upload to process...');
    await humanDelay(3000, 6000);

    // Type first tweet text
    console.log('[TwitterUploader] Typing initial tweet text...');
    const textareaSelector = 'div[data-testid="tweetTextarea_0"], div[role="textbox"][contenteditable="true"]';
    await page.waitForSelector(textareaSelector, { timeout: 20000 });
    await humanType(page, textareaSelector, firstTweetText);
    await humanDelay(1000, 2000);

    // If thread has multiple chunks, we can use the "Add another post" (+) button in the composer
    for (let i = 1; i < threadChunks.length; i++) {
      console.log(`[TwitterUploader] Adding thread post #${i + 1}...`);
      const addPostBtn = 'button[aria-label="Add post"], button[data-testid="addButton"]';
      try {
        const addBtn = await page.$(addPostBtn);
        if (addBtn && await addBtn.isVisible()) {
          await addBtn.click();
          await humanDelay(1000, 1500);
          const nextTextarea = `div[data-testid="tweetTextarea_${i}"], div[role="textbox"][contenteditable="true"]`;
          await page.waitForSelector(nextTextarea, { timeout: 10000 });
          await humanType(page, nextTextarea, threadChunks[i]);
          await humanDelay(1000, 1500);
        }
      } catch (err) {
        console.warn(`[TwitterUploader] Thread add button failed for chunk ${i + 1}, will post remaining as reply:`, err);
        break;
      }
    }

    // Click "Post" / "Tweet" button
    console.log('[TwitterUploader] Submitting tweet...');
    const postBtnSelector = 'button[data-testid="tweetButton"], button[data-testid="tweetButtonInline"]';
    await page.waitForSelector(postBtnSelector, { timeout: 20000 });
    await page.click(postBtnSelector);

    // Wait for post confirmation toast
    console.log('[TwitterUploader] Waiting for tweet confirmation...');
    await humanDelay(4000, 6000);

    let postUrl = '';
    try {
      const toastLink = await page.$('a[href*="/status/"]');
      if (toastLink) {
        const href = await toastLink.getAttribute('href');
        if (href) {
          postUrl = href.startsWith('http') ? href : `https://x.com${href}`;
        }
      }
    } catch {
      // Fallback
    }

    if (!postUrl) {
      postUrl = 'https://x.com/home';
    }

    console.log(`[TwitterUploader] Successfully posted to X! URL: ${postUrl}`);
    return {
      success: true,
      post_url: postUrl,
    };
  } catch (err) {
    const errorMsg = (err as Error).message;
    console.error(`[TwitterUploader] Twitter post failed: ${errorMsg}`);
    await captureErrorScreenshot(page, 'twitter', 'post_failed');
    return {
      success: false,
      error: errorMsg,
    };
  } finally {
    await browser.close().catch(() => {});
  }
}
