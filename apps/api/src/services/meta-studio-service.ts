/**
 * Autonomous Growth OS — Meta Tags Maker & Preview Studio Service
 *
 * Implements P3 Specification:
 * - Generates standards-compliant meta tags, Open Graph, and Twitter Cards.
 * - Generates Schema.org JSON-LD templates (Organization, WebSite, Article, Product, Breadcrumbs, FAQPage).
 * - Provides search and social preview simulations (Google SERP, Twitter Large Card, LinkedIn/Meta OG).
 * - Exports formatted HTML snippets and manages approval queues via metadata_proposals table.
 */

import { query } from '../lib/db.js';

export interface MetaGenerationInput {
  brandName: string;
  brandDomain: string;
  pageUrl: string;
  pageTitle: string;
  pageDescription: string;
  targetKeyword?: string;
  schemaType?: 'Organization' | 'WebSite' | 'Article' | 'Product' | 'BreadcrumbList' | 'FAQPage';
  imageUrl?: string;
}

export interface MetaGenerationResult {
  metaTags: {
    title: string;
    description: string;
    canonical: string;
    robots: string;
  };
  openGraph: {
    'og:title': string;
    'og:description': string;
    'og:url': string;
    'og:type': string;
    'og:site_name': string;
    'og:image': string;
  };
  twitterCard: {
    'twitter:card': string;
    'twitter:title': string;
    'twitter:description': string;
    'twitter:image': string;
  };
  jsonLd: Record<string, unknown>;
  previews: {
    googleSerp: {
      displayUrl: string;
      title: string;
      snippet: string;
    };
    twitter: {
      cardType: string;
      title: string;
      description: string;
      domain: string;
      image: string;
    };
    socialOg: {
      siteName: string;
      title: string;
      description: string;
      image: string;
    };
  };
  htmlSnippet: string;
}

export class MetaStudioService {
  /**
   * Synthesize standards-compliant meta tags and Schema.org JSON-LD
   */
  public static generate(input: MetaGenerationInput): MetaGenerationResult {
    const brand = input.brandName.trim();
    const rawTitle = input.pageTitle.trim();
    const rawDesc = input.pageDescription.trim();
    const url = input.pageUrl.trim();
    const defaultImage = input.imageUrl || `${input.brandDomain}/assets/og-cover.png`;

    // 1. Optimize Title (Ideal: 50-60 characters)
    let optimizedTitle = rawTitle;
    if (!optimizedTitle.toLowerCase().includes(brand.toLowerCase())) {
      optimizedTitle = `${rawTitle} | ${brand}`;
    }
    if (optimizedTitle.length > 60) {
      optimizedTitle = optimizedTitle.substring(0, 57) + '...';
    }

    // 2. Optimize Meta Description (Ideal: 120-155 characters)
    let optimizedDesc = rawDesc;
    if (optimizedDesc.length > 155) {
      optimizedDesc = optimizedDesc.substring(0, 152) + '...';
    }

    // 3. Open Graph
    const openGraph = {
      'og:title': optimizedTitle,
      'og:description': optimizedDesc,
      'og:url': url,
      'og:type': input.schemaType === 'Article' ? 'article' : 'website',
      'og:site_name': brand,
      'og:image': defaultImage,
    };

    // 4. Twitter Card
    const twitterCard = {
      'twitter:card': 'summary_large_image',
      'twitter:title': optimizedTitle,
      'twitter:description': optimizedDesc,
      'twitter:image': defaultImage,
    };

    // 5. Schema.org JSON-LD Template
    const jsonLd = this.buildSchema(input, optimizedTitle, optimizedDesc, defaultImage);

    // 6. Previews
    let domainHost = '';
    try {
      domainHost = new URL(url).hostname;
    } catch {
      domainHost = input.brandDomain.replace(/^https?:\/\//, '');
    }

    const previews = {
      googleSerp: {
        displayUrl: url,
        title: optimizedTitle,
        snippet: optimizedDesc,
      },
      twitter: {
        cardType: 'summary_large_image',
        title: optimizedTitle,
        description: optimizedDesc,
        domain: domainHost,
        image: defaultImage,
      },
      socialOg: {
        siteName: brand,
        title: optimizedTitle,
        description: optimizedDesc,
        image: defaultImage,
      },
    };

    // 7. Full HTML Snippet
    const htmlSnippet = [
      `<!-- Standard Meta Tags -->`,
      `<title>${optimizedTitle}</title>`,
      `<meta name="description" content="${optimizedDesc}" />`,
      `<link rel="canonical" href="${url}" />`,
      `<meta name="robots" content="index, follow, max-image-preview:large" />`,
      ``,
      `<!-- Open Graph / Facebook / LinkedIn -->`,
      `<meta property="og:type" content="${openGraph['og:type']}" />`,
      `<meta property="og:title" content="${openGraph['og:title']}" />`,
      `<meta property="og:description" content="${openGraph['og:description']}" />`,
      `<meta property="og:url" content="${openGraph['og:url']}" />`,
      `<meta property="og:site_name" content="${openGraph['og:site_name']}" />`,
      `<meta property="og:image" content="${openGraph['og:image']}" />`,
      ``,
      `<!-- Twitter / X Cards -->`,
      `<meta name="twitter:card" content="${twitterCard['twitter:card']}" />`,
      `<meta name="twitter:title" content="${twitterCard['twitter:title']}" />`,
      `<meta name="twitter:description" content="${twitterCard['twitter:description']}" />`,
      `<meta name="twitter:image" content="${twitterCard['twitter:image']}" />`,
      ``,
      `<!-- Schema.org JSON-LD -->`,
      `<script type="application/ld+json">`,
      JSON.stringify(jsonLd, null, 2),
      `</script>`,
    ].join('\n');

    return {
      metaTags: {
        title: optimizedTitle,
        description: optimizedDesc,
        canonical: url,
        robots: 'index, follow, max-image-preview:large',
      },
      openGraph,
      twitterCard,
      jsonLd,
      previews,
      htmlSnippet,
    };
  }

  /**
   * Save a proposal to the metadata_proposals queue
   */
  public static async createProposal(
    brandId: string | null,
    url: string,
    proposalType: 'meta_tags' | 'json_ld' | 'open_graph' | 'twitter_card',
    payload: Record<string, unknown>,
    notes?: string
  ): Promise<{ id: string }> {
    const res = await query<{ id: string }>(
      `INSERT INTO metadata_proposals (brand_id, url, proposal_type, payload, status, notes)
       VALUES ($1, $2, $3, $4, 'draft', $5)
       RETURNING id`,
      [brandId, url, proposalType, JSON.stringify(payload), notes || 'Generated by Meta Tags Studio']
    );
    return res.rows[0]!;
  }

  /**
   * List metadata proposals
   */
  public static async listProposals(brandId?: string | null) {
    let sql = `SELECT id, brand_id, url, proposal_type, payload, status, notes, created_at, updated_at
               FROM metadata_proposals`;
    const params: unknown[] = [];
    if (brandId) {
      sql += ` WHERE brand_id = $1`;
      params.push(brandId);
    }
    sql += ` ORDER BY created_at DESC LIMIT 50`;

    const res = await query(sql, params);
    return res.rows;
  }

  private static buildSchema(
    input: MetaGenerationInput,
    title: string,
    desc: string,
    image: string
  ): Record<string, unknown> {
    const type = input.schemaType || 'WebSite';

    switch (type) {
      case 'Article':
        return {
          '@context': 'https://schema.org',
          '@type': 'Article',
          headline: title,
          description: desc,
          image: [image],
          datePublished: new Date().toISOString(),
          dateModified: new Date().toISOString(),
          author: {
            '@type': 'Organization',
            name: input.brandName,
            url: input.brandDomain,
          },
          publisher: {
            '@type': 'Organization',
            name: input.brandName,
            logo: {
              '@type': 'ImageObject',
              url: `${input.brandDomain}/assets/logo.png`,
            },
          },
          mainEntityOfPage: {
            '@type': 'WebPage',
            '@id': input.pageUrl,
          },
        };

      case 'Organization':
        return {
          '@context': 'https://schema.org',
          '@type': 'Organization',
          name: input.brandName,
          url: input.brandDomain,
          logo: `${input.brandDomain}/assets/logo.png`,
          description: desc,
        };

      case 'Product':
        return {
          '@context': 'https://schema.org',
          '@type': 'Product',
          name: title,
          description: desc,
          image: [image],
          brand: {
            '@type': 'Brand',
            name: input.brandName,
          },
          offers: {
            '@type': 'Offer',
            url: input.pageUrl,
            priceCurrency: 'USD',
            availability: 'https://schema.org/InStock',
          },
        };

      case 'FAQPage':
        return {
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: [
            {
              '@type': 'Question',
              name: `What is ${input.brandName}?`,
              acceptedAnswer: {
                '@type': 'Answer',
                text: desc,
              },
            },
          ],
        };

      case 'BreadcrumbList':
        return {
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            {
              '@type': 'ListItem',
              position: 1,
              name: 'Home',
              item: input.brandDomain,
            },
            {
              '@type': 'ListItem',
              position: 2,
              name: title,
              item: input.pageUrl,
            },
          ],
        };

      case 'WebSite':
      default:
        return {
          '@context': 'https://schema.org',
          '@type': 'WebSite',
          name: input.brandName,
          url: input.brandDomain,
          description: desc,
        };
    }
  }
}
