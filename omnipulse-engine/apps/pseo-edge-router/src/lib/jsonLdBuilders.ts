import type { BrandCluster, DomainConfig, JsonLdType } from '../config/domains.js';

export interface BaseSchemaParams {
  title: string;
  description: string;
  canonicalUrl: string;
  brand: BrandCluster;
  datePublished?: string;
  dateModified?: string;
}

export interface JobPostingParams extends BaseSchemaParams {
  role?: string;
  city?: string;
  skill?: string;
  minSalary?: number;
  maxSalary?: number;
  currency?: string;
}

export interface CourseParams extends BaseSchemaParams {
  skillOrTopic?: string;
  level?: string;
  certification?: string;
  mode?: string;
}

export interface ArticleParams extends BaseSchemaParams {
  headline?: string;
  authorName?: string;
  imageUrl?: string;
  keywords?: string[];
}

export interface SoftwareAppParams extends BaseSchemaParams {
  applicationCategory?: string;
  operatingSystem?: string;
  features?: string[];
  integration?: string;
  intent?: string;
}

export function buildOrganizationSchema(brand: BrandCluster): Record<string, unknown> {
  switch (brand) {
    case 'chatr':
      return {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: 'Chatr',
        url: 'https://chatr.chat',
        logo: 'https://chatr.chat/assets/logo.png',
        sameAs: ['https://twitter.com/chatrchat', 'https://linkedin.com/company/chatrchat'],
        description:
          'Autonomous conversational AI agent platform for enterprise workflows, instant CRM actions, and omnichannel engagement.',
      };
    case 'nutytales':
      return {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: 'NutyTales',
        url: 'https://nutytales.com',
        logo: 'https://nutytales.com/assets/logo.png',
        sameAs: ['https://instagram.com/nutytales', 'https://facebook.com/nutytales'],
        description:
          'Finest GI-tagged Kashmiri dry fruits, organic saffron, artisan walnut-wood crafts, and luxury Himalayan homestay itineraries.',
      };
    case 'talentxcel':
    default:
      return {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: 'TalentXcel',
        url: 'https://talentxcel.in',
        logo: 'https://talentxcel.in/assets/logo.png',
        sameAs: ['https://twitter.com/talentxcel', 'https://linkedin.com/company/talentxcel'],
        description:
          'Next-generation career acceleration platform, skill verification protocols, and technical recruitment engine across India.',
      };
  }
}

export function buildJobPostingSchema(params: JobPostingParams): Record<string, unknown> {
  const org = buildOrganizationSchema(params.brand);
  const now = new Date();
  const datePosted = params.datePublished || now.toISOString().split('T')[0];
  const validThroughDate = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const city = params.city || 'India';
  const role = params.role || 'Specialist';
  const skill = params.skill || 'Technology';

  return {
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    title: params.title || `${role} in ${city} with ${skill}`,
    description: params.description,
    datePosted,
    validThrough: validThroughDate,
    employmentType: ['FULL_TIME', 'PERMANENT'],
    hiringOrganization: org,
    jobLocation: {
      '@type': 'Place',
      address: {
        '@type': 'PostalAddress',
        addressLocality: city,
        addressCountry: 'IN',
      },
    },
    baseSalary: {
      '@type': 'MonetaryAmount',
      currency: params.currency || 'INR',
      value: {
        '@type': 'QuantitativeValue',
        minValue: params.minSalary || 600000,
        maxValue: params.maxSalary || 1800000,
        unitText: 'YEAR',
      },
    },
    skills: skill,
    occupationalCategory: role,
    applicantLocationRequirements: {
      '@type': 'Country',
      name: 'India',
    },
    directApply: true,
    url: params.canonicalUrl,
  };
}

export function buildCourseSchema(params: CourseParams): Record<string, unknown> {
  const org = buildOrganizationSchema(params.brand);
  return {
    '@context': 'https://schema.org',
    '@type': 'Course',
    name: params.title,
    description: params.description,
    provider: org,
    educationalLevel: params.level || 'Intermediate',
    courseCode: (params.skillOrTopic || 'MOD-01').toUpperCase(),
    hasCourseInstance: {
      '@type': 'CourseInstance',
      courseMode: params.mode || 'online',
      inLanguage: 'en',
      courseSchedule: {
        '@type': 'Schedule',
        duration: 'PT8H',
        repeatFrequency: 'P1D',
      },
    },
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'INR',
      category: 'Free Self-Paced Training',
      availability: 'https://schema.org/InStock',
      url: params.canonicalUrl,
    },
    url: params.canonicalUrl,
  };
}

export function buildArticleSchema(params: ArticleParams): Record<string, unknown> {
  const org = buildOrganizationSchema(params.brand);
  const now = new Date().toISOString();
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': params.canonicalUrl,
    },
    headline: params.headline || params.title,
    description: params.description,
    image: params.imageUrl || `${params.canonicalUrl}/banner.png`,
    author: {
      '@type': 'Organization',
      name: org['name'],
      url: org['url'],
    },
    publisher: org,
    datePublished: params.datePublished || now,
    dateModified: params.dateModified || now,
    keywords: (params.keywords || []).join(', '),
  };
}

export function buildSoftwareApplicationSchema(params: SoftwareAppParams): Record<string, unknown> {
  const org = buildOrganizationSchema(params.brand);
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: params.title,
    headline: params.title,
    description: params.description,
    operatingSystem: params.operatingSystem || 'Web, Cloud, All Modern Browsers',
    applicationCategory: params.applicationCategory || 'BusinessApplication',
    publisher: org,
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock',
    },
    featureList: params.features || [
      'Automated API orchestration',
      'Instant real-time sync',
      'Deterministic edge delivery',
      'Zero latency response',
    ],
    url: params.canonicalUrl,
  };
}

export function buildJsonLdForDomain(
  config: DomainConfig,
  params: {
    title: string;
    description: string;
    canonicalUrl: string;
    dimensionValues: Record<string, { slug: string; display_value: string; metadata?: Record<string, unknown> }>;
  }
): Record<string, unknown> {
  const dimValues = params.dimensionValues;
  const firstValues = Object.values(dimValues).map((d) => d.display_value);

  switch (config.jsonLdType) {
    case 'JobPosting': {
      return buildJobPostingSchema({
        title: params.title,
        description: params.description,
        canonicalUrl: params.canonicalUrl,
        brand: config.brand,
        role: dimValues['role']?.display_value || firstValues[0],
        city: dimValues['city']?.display_value || firstValues[1],
        skill: dimValues['skill']?.display_value || firstValues[2],
      });
    }
    case 'Course': {
      return buildCourseSchema({
        title: params.title,
        description: params.description,
        canonicalUrl: params.canonicalUrl,
        brand: config.brand,
        skillOrTopic: dimValues['skill']?.display_value || dimValues['topic']?.display_value || dimValues['certification']?.display_value || firstValues[0],
        level: dimValues['level']?.display_value,
        mode: dimValues['mode']?.display_value,
      });
    }
    case 'SoftwareApplication': {
      return buildSoftwareApplicationSchema({
        title: params.title,
        description: params.description,
        canonicalUrl: params.canonicalUrl,
        brand: config.brand,
        intent: dimValues['intent']?.display_value || dimValues['utility']?.display_value || firstValues[0],
        integration: dimValues['integration']?.display_value || dimValues['usecase']?.display_value || firstValues[1],
      });
    }
    case 'Article':
    default: {
      return buildArticleSchema({
        title: params.title,
        description: params.description,
        canonicalUrl: params.canonicalUrl,
        brand: config.brand,
        keywords: firstValues,
      });
    }
  }
}
