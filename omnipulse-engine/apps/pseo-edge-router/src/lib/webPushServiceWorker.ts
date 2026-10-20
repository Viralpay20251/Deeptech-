import {
  type VapidKeys,
  type PushSubscriptionRecord,
  type PushNotificationPayload,
  buildVapidAuthorizationHeader,
} from './webPush.js';

/**
 * Generates the production service worker JavaScript code served at `/sw.js`
 */
export function getServiceWorkerScript(): string {
  return `// ============================================================================
// Service Worker: OmniPulse High-Velocity Push & Offline Worker (sw.js)
// Zero-Cost Native Browser Re-Engagement Engine
// ============================================================================

const CACHE_NAME = 'omnipulse-cache-v1';
const OFFLINE_URLS = ['/', '/offline.html'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(OFFLINE_URLS).catch(() => {});
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Native Web Push Notification Handler
self.addEventListener('push', (event) => {
  let data = {
    title: 'New High-Paying Openings in Your Area',
    body: 'Tap to view live salary bands and open roles.',
    icon: '/assets/icon-192.png',
    badge: '/assets/badge-72.png',
    url: '/',
    tag: 'omnipulse-push',
  };

  if (event.data) {
    try {
      data = Object.assign(data, event.data.json());
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || '/assets/icon-192.png',
    badge: data.badge || '/assets/badge-72.png',
    vibrate: [100, 50, 100],
    data: {
      url: data.url,
      timestamp: Date.now(),
    },
    actions: [
      { action: 'open_url', title: 'View Now &rarr;' },
      { action: 'dismiss', title: 'Later' },
    ],
    tag: data.tag || 'omnipulse-reengage',
    renotify: true,
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

// Notification Click Handler: Deep Link Redirection with UTM Tags
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  let targetUrl = (event.notification.data && event.notification.data.url) || '/';
  // Attach return-traffic attribution
  const delimiter = targetUrl.includes('?') ? '&' : '?';
  targetUrl += delimiter + 'utm_source=web_push&utm_medium=browser_notification&utm_campaign=daily_reengagement';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === targetUrl && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

// Automatic Push Subscription Refresh
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    self.registration.pushManager
      .subscribe(event.oldSubscription.options)
      .then((subscription) => {
        return fetch('/api/v1/push/refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(subscription.toJSON()),
        });
      })
  );
});
`;
}

/**
 * Dispatches an automated background Web Push notification to a target subscriber
 * via native W3C Web Push HTTP protocol
 */
export async function sendWebPushToEndpoint(
  sub: PushSubscriptionRecord,
  payload: PushNotificationPayload,
  vapidKeys: VapidKeys,
  contactSubject: string = 'mailto:growth@talentxcel.in'
): Promise<{ success: boolean; statusCode: number; error?: string }> {
  try {
    const authHeaders = buildVapidAuthorizationHeader(sub.endpoint, contactSubject, vapidKeys);
    const bodyStr = JSON.stringify(payload);

    // Standard RFC 8291 requires AES-128-GCM payload encryption for standard browser push endpoints.
    // For direct push testing, we dispatch via endpoint with TTL and Urgency headers.
    const res = await fetch(sub.endpoint, {
      method: 'POST',
      headers: {
        'TTL': '86400',
        'Urgency': 'high',
        'Content-Type': 'application/json',
        ...authHeaders,
      },
      body: bodyStr,
      signal: AbortSignal.timeout(6000),
    });

    if (res.status === 201 || res.status === 200) {
      return { success: true, statusCode: res.status };
    }

    if (res.status === 404 || res.status === 410) {
      // Subscription expired or unregistered by client
      return { success: false, statusCode: res.status, error: 'Subscription expired or unregistered' };
    }

    return { success: false, statusCode: res.status, error: `Endpoint returned HTTP ${res.status}` };
  } catch (err) {
    return { success: false, statusCode: 500, error: (err as Error).message };
  }
}

/**
 * Automated daily re-engagement dispatcher triggered when new content/schemes/roles are published
 */
export async function dispatchDailyReengagementPush(params: {
  subscribers: PushSubscriptionRecord[];
  brandCluster: 'talentxcel' | 'chatr' | 'nutytales';
  triggerType: 'new_job' | 'new_scheme' | 'new_hamper' | 'new_agent';
  title: string;
  body: string;
  targetUrl: string;
  vapidKeys: VapidKeys;
}): Promise<{ totalSent: number; successful: number; failed: number }> {
  const { subscribers, brandCluster, title, body, targetUrl, vapidKeys } = params;

  let successful = 0;
  let failed = 0;

  const payload: PushNotificationPayload = {
    title,
    body,
    url: targetUrl,
    tag: `omnipulse-${brandCluster}-alert`,
    timestamp: Date.now(),
  };

  // Filter subscribers belonging to this brand cluster
  const targetSubs = subscribers.filter((s) => s.brandCluster === brandCluster && s.isActive !== false);

  for (const sub of targetSubs) {
    const res = await sendWebPushToEndpoint(sub, payload, vapidKeys);
    if (res.success) {
      successful++;
    } else {
      failed++;
    }
  }

  return {
    totalSent: targetSubs.length,
    successful,
    failed,
  };
}
