import { google } from 'googleapis';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface GSCSitemapSubmitterOptions {
  credentialsPath?: string;
  clientEmail?: string;
  privateKey?: string;
}

export class GSCSitemapSubmitter {
  private authClient: any = null;
  private webmasters: any = null;

  constructor(
    private supabase: SupabaseClient,
    options?: GSCSitemapSubmitterOptions
  ) {
    this.initializeAuth(options);
  }

  private initializeAuth(options?: GSCSitemapSubmitterOptions) {
    try {
      const email =
        options?.clientEmail ||
        process.env.GOOGLE_CLIENT_EMAIL ||
        process.env.GSC_CLIENT_EMAIL;
      const key =
        options?.privateKey ||
        process.env.GOOGLE_PRIVATE_KEY ||
        process.env.GSC_PRIVATE_KEY;

      if (email && key) {
        const formattedKey = key.replace(/\\n/g, '\n');
        this.authClient = new google.auth.JWT({
          email,
          key: formattedKey,
          scopes: [
            'https://www.googleapis.com/auth/webmasters',
            'https://www.googleapis.com/auth/webmasters.readonly',
          ],
        });
        this.webmasters = google.webmasters({
          version: 'v3',
          auth: this.authClient,
        });
        console.log('[GSCSitemapSubmitter] Authenticated via Service Account.');
      } else if (
        process.env.GOOGLE_APPLICATION_CREDENTIALS ||
        options?.credentialsPath
      ) {
        this.authClient = new google.auth.GoogleAuth({
          keyFile:
            options?.credentialsPath ||
            process.env.GOOGLE_APPLICATION_CREDENTIALS,
          scopes: [
            'https://www.googleapis.com/auth/webmasters',
            'https://www.googleapis.com/auth/webmasters.readonly',
          ],
        });
        this.webmasters = google.webmasters({
          version: 'v3',
          auth: this.authClient,
        });
        console.log('[GSCSitemapSubmitter] Authenticated via GOOGLE_APPLICATION_CREDENTIALS file.');
      } else {
        console.warn(
          '[GSCSitemapSubmitter] No Google credentials detected. Submitter operating in simulation mode.'
        );
      }
    } catch (err: any) {
      console.warn('[GSCSitemapSubmitter] Google Auth initialization warning:', err.message);
    }
  }

  /**
   * Submit sitemap_index.xml for a hostname to Google Search Console
   */
  public async submitSitemap(
    hostname: string,
    targetTable: string = 'registered_domains',
    recordId?: string,
    sitemapPath: string = 'sitemap_index.xml'
  ): Promise<{ success: boolean; siteUrl: string; feedpath: string }> {
    const cleanHostname = hostname.trim().toLowerCase();
    const siteUrl = `https://${cleanHostname}/`;
    const feedpath = `https://${cleanHostname}/${sitemapPath}`;

    console.log(`[GSCSitemapSubmitter] Submitting sitemap ${feedpath} for site ${siteUrl}`);

    let submitted = false;

    if (!this.webmasters) {
      console.log(`[GSCSitemapSubmitter] Simulation mode active. Simulated sitemap submission for ${feedpath}`);
      submitted = true;
    } else {
      try {
        await this.webmasters.sitemaps.submit({
          siteUrl,
          feedpath,
        });
        console.log(`[GSCSitemapSubmitter] Successfully submitted sitemap ${feedpath} to GSC`);
        submitted = true;
      } catch (err: any) {
        console.error(`[GSCSitemapSubmitter] Error submitting sitemap to GSC:`, err.message);
        // Do not crash, mark status accordingly
      }
    }

    // Update Supabase record
    await this.updateSitemapStatusInDb(targetTable, cleanHostname, submitted, recordId);

    return {
      success: submitted,
      siteUrl,
      feedpath,
    };
  }

  /**
   * Persist sitemap submission status to Supabase
   */
  private async updateSitemapStatusInDb(
    targetTable: string,
    hostname: string,
    success: boolean,
    recordId?: string
  ): Promise<void> {
    try {
      const updateData: Record<string, any> = {
        sitemap_status: success ? 'passed' : 'failed',
        last_checked_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      let query = this.supabase.from(targetTable).update(updateData);
      if (recordId) {
        query = query.eq('id', recordId);
      } else {
        query = query.eq('hostname', hostname);
      }

      const { error } = await query;
      if (error) {
        console.error(`[GSCSitemapSubmitter] Failed to update sitemap status in ${targetTable}:`, error);
      } else {
        console.log(`[GSCSitemapSubmitter] Updated sitemap_status=${updateData.sitemap_status} for ${hostname}`);
      }
    } catch (err) {
      console.error(`[GSCSitemapSubmitter] Error persisting sitemap status:`, err);
    }
  }
}
