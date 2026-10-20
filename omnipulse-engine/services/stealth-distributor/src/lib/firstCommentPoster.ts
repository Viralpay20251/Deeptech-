import type { Page } from 'patchright';
import { createStealthContext, humanDelay, humanType, captureErrorScreenshot } from '../utils/browser.js';

/**
 * Handles commenting on YouTube video / Short
 */
async function commentOnYouTube(page: Page, postUrl: string, commentText: string): Promise<boolean> {
  console.log(`[FirstComment] Navigating to YouTube: ${postUrl}`);
  await page.goto(postUrl, { waitUntil: 'networkidle', timeout: 45000 });
  await humanDelay(2000, 3000);

  // Scroll down to load comments section
  await page.evaluate(() => window.scrollBy(0, 500));
  await humanDelay(1500, 2500);

  // Focus comment box
  const commentBoxPlaceholder = '#simplebox-placeholder, #placeholder-area, ytd-comment-simplebox-renderer';
  await page.waitForSelector(commentBoxPlaceholder, { timeout: 20000 });
  await page.click(commentBoxPlaceholder);
  await humanDelay(500, 1000);

  // Type comment in active contenteditable root
  const activeInput = '#contenteditable-root, div#contenteditable-textarea[contenteditable="true"]';
  await page.waitForSelector(activeInput, { timeout: 10000 });
  await humanType(page, activeInput, commentText);
  await humanDelay(1000, 1500);

  // Click Submit / Comment button
  const submitBtn = '#submit-button, ytd-button-renderer#submit-button button, button[aria-label="Comment"]';
  await page.waitForSelector(submitBtn, { timeout: 10000 });
  await page.click(submitBtn);
  await humanDelay(2000, 4000);

  return true;
}

/**
 * Handles commenting on Instagram Reel / Post
 */
async function commentOnInstagram(page: Page, postUrl: string, commentText: string): Promise<boolean> {
  console.log(`[FirstComment] Navigating to Instagram: ${postUrl}`);
  await page.goto(postUrl, { waitUntil: 'networkidle', timeout: 45000 });
  await humanDelay(2000, 3000);

  // Look for comment textarea
  const commentInputSelector = 'textarea[aria-label*="Add a comment" i], form textarea, div[role="textbox"]';
  await page.waitForSelector(commentInputSelector, { timeout: 25000 });
  await humanType(page, commentInputSelector, commentText);
  await humanDelay(1000, 1500);

  // Click Post button
  const postBtnSelector = 'div[role="button"]:has-text("Post"), button:has-text("Post"), form button[type="submit"]';
  const postBtn = await page.$(postBtnSelector);
  if (postBtn) {
    await postBtn.click();
  } else {
    await page.keyboard.press('Enter');
  }
  await humanDelay(2000, 4000);

  return true;
}

/**
 * Handles commenting on Facebook Reel / Post
 */
async function commentOnFacebook(page: Page, postUrl: string, commentText: string): Promise<boolean> {
  console.log(`[FirstComment] Navigating to Facebook: ${postUrl}`);
  await page.goto(postUrl, { waitUntil: 'networkidle', timeout: 45000 });
  await humanDelay(2000, 3000);

  const commentBox = 'div[aria-label*="Write a comment" i], div[role="textbox"][contenteditable="true"], textarea';
  await page.waitForSelector(commentBox, { timeout: 25000 });
  await humanType(page, commentBox, commentText);
  await humanDelay(1000, 1500);

  // Press Enter to post comment
  await page.keyboard.press('Enter');
  await humanDelay(2000, 4000);

  return true;
}

/**
 * Handles commenting on LinkedIn post
 */
async function commentOnLinkedIn(page: Page, postUrl: string, commentText: string): Promise<boolean> {
  console.log(`[FirstComment] Navigating to LinkedIn: ${postUrl}`);
  await page.goto(postUrl, { waitUntil: 'networkidle', timeout: 45000 });
  await humanDelay(2000, 3000);

  // If comment box is collapsed, click Comment button first
  const expandCommentBtn = 'button[aria-label*="Comment" i], button:has-text("Comment")';
  try {
    const expandBtn = await page.$(expandCommentBtn);
    if (expandBtn && await expandBtn.isVisible()) {
      await expandBtn.click();
      await humanDelay(1000, 1500);
    }
  } catch {
    // Might already be open
  }

  // Type comment
  const editorSelector = 'div.ql-editor[role="textbox"], div[aria-label*="Add a comment" i], div[role="textbox"][contenteditable="true"]';
  await page.waitForSelector(editorSelector, { timeout: 20000 });
  await humanType(page, editorSelector, commentText);
  await humanDelay(1000, 1500);

  // Click Submit / Post comment button
  const submitBtnSelector = 'button.comments-comment-box__submit-button, button:has-text("Post"), button:has-text("Comment")';
  await page.waitForSelector(submitBtnSelector, { timeout: 15000 });
  await page.click(submitBtnSelector);
  await humanDelay(2000, 4000);

  return true;
}

/**
 * Handles commenting on Twitter / X tweet
 */
async function commentOnTwitter(page: Page, postUrl: string, commentText: string): Promise<boolean> {
  console.log(`[FirstComment] Navigating to Twitter/X: ${postUrl}`);
  await page.goto(postUrl, { waitUntil: 'networkidle', timeout: 45000 });
  await humanDelay(2000, 3000);

  // Locate inline reply box or reply trigger
  const replyBoxSelector = 'div[data-testid="tweetTextarea_0"], div[role="textbox"][contenteditable="true"]';
  try {
    await page.waitForSelector(replyBoxSelector, { timeout: 20000 });
    await humanType(page, replyBoxSelector, commentText);
  } catch {
    // Click reply button first
    const replyBtn = await page.waitForSelector('button[data-testid="reply"]', { timeout: 10000 });
    await replyBtn.click();
    await humanDelay(1000, 1500);
    await page.waitForSelector(replyBoxSelector, { timeout: 15000 });
    await humanType(page, replyBoxSelector, commentText);
  }

  await humanDelay(1000, 1500);

  // Click Reply / Post
  const submitReplyBtn = 'button[data-testid="tweetButtonInline"], button[data-testid="tweetButton"]';
  await page.waitForSelector(submitReplyBtn, { timeout: 15000 });
  await page.click(submitReplyBtn);
  await humanDelay(2000, 4000);

  return true;
}

/**
 * Executes a 60-second delayed first comment on the published post.
 */
export async function postDelayedFirstComment(
  platform: string,
  postUrl: string,
  commentText: string,
  cookieFile: string,
  delayMs: number = 60000
): Promise<boolean> {
  if (!commentText || commentText.trim() === '') {
    console.log('[FirstComment] No comment text provided. Skipping.');
    return false;
  }

  if (!postUrl || !postUrl.startsWith('http')) {
    console.warn(`[FirstComment] Invalid post URL '${postUrl}'. Skipping comment.`);
    return false;
  }

  console.log(`[FirstComment] Waiting ${delayMs / 1000}s before posting first comment on ${platform}...`);
  await new Promise((resolve) => setTimeout(resolve, delayMs));

  const { browser, page } = await createStealthContext(cookieFile);

  try {
    const normalizedPlatform = platform.toLowerCase();
    let success = false;

    switch (normalizedPlatform) {
      case 'youtube':
        success = await commentOnYouTube(page, postUrl, commentText);
        break;
      case 'instagram':
        success = await commentOnInstagram(page, postUrl, commentText);
        break;
      case 'facebook':
        success = await commentOnFacebook(page, postUrl, commentText);
        break;
      case 'linkedin':
        success = await commentOnLinkedIn(page, postUrl, commentText);
        break;
      case 'twitter':
      case 'x':
        success = await commentOnTwitter(page, postUrl, commentText);
        break;
      default:
        console.warn(`[FirstComment] Unsupported platform for first comment: ${platform}`);
        return false;
    }

    console.log(`[FirstComment] Comment successfully posted on ${platform} (${postUrl})`);
    return success;
  } catch (err) {
    const errorMsg = (err as Error).message;
    console.error(`[FirstComment] Error posting first comment on ${platform}: ${errorMsg}`);
    await captureErrorScreenshot(page, platform, 'first_comment_failed');
    return false;
  } finally {
    await browser.close().catch(() => {});
  }
}
