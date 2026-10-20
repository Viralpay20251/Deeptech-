import crypto from 'node:crypto';

export interface VapidKeys {
  publicKey: string;  // Base64url-encoded uncompressed public key (65 bytes)
  privateKey: string; // Base64url-encoded private key (32 bytes)
}

export interface PushSubscriptionRecord {
  id?: string;
  endpoint: string;
  p256dhKey: string;
  authKey: string;
  hostname: string;
  brandCluster: 'talentxcel' | 'chatr' | 'nutytales';
  interestSlug?: string;
  userAgent?: string;
  isActive?: boolean;
}

export interface PushNotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  url: string;
  tag?: string;
  timestamp?: number;
}

/**
 * Base64url utility functions (RFC 7515 / RFC 8292)
 */
export function toBase64Url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromBase64Url(str: string): Buffer {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4 !== 0) {
    base64 += '=';
  }
  return Buffer.from(base64, 'base64');
}

/**
 * Generates a zero-cost NIST P-256 EC VAPID key pair for native browser Web Push
 */
export function generateVapidKeys(): VapidKeys {
  const ec = crypto.generateKeyPairSync('ec', {
    namedCurve: 'prime256v1',
  });

  const rawPublic = ec.publicKey.export({ format: 'der', type: 'spki' });
  // In SPKI DER format for prime256v1, the 65-byte uncompressed EC point starts at offset 26
  const uncompressedPublicPoint = rawPublic.subarray(rawPublic.length - 65);

  const rawPrivate = ec.privateKey.export({ format: 'der', type: 'pkcs8' });
  // In PKCS8 DER format for EC, the 32-byte private key scalar is at offset 36..68
  const privateKeyScalar = rawPrivate.subarray(36, 68);

  return {
    publicKey: toBase64Url(uncompressedPublicPoint),
    privateKey: toBase64Url(privateKeyScalar),
  };
}

/**
 * Creates an RFC 8292 compliant VAPID JWT token
 */
export function createVapidJwt(audience: string, subject: string, vapidKeys: VapidKeys, expirationSec: number = 86400): string {
  const header = {
    typ: 'JWT',
    alg: 'ES256',
  };

  const nowSec = Math.floor(Date.now() / 1000);
  const payload = {
    aud: audience,
    exp: nowSec + expirationSec,
    sub: subject, // e.g. 'mailto:growth@talentxcel.in'
  };

  const headerB64 = toBase64Url(Buffer.from(JSON.stringify(header)));
  const payloadB64 = toBase64Url(Buffer.from(JSON.stringify(payload)));
  const unsignedToken = `${headerB64}.${payloadB64}`;

  // Construct EC private key object from raw scalar
  // Standard PKCS8 header prefix for secp256r1/prime256v1
  const pkcs8Prefix = Buffer.from('308187020100301306072a8648ce3d020106082a8648ce3d030107046d306b0201010420', 'hex');
  const pkcs8Suffix = Buffer.from('a144034200', 'hex');
  const privateKeyBuf = fromBase64Url(vapidKeys.privateKey);
  const publicKeyBuf = fromBase64Url(vapidKeys.publicKey);
  const fullPkcs8 = Buffer.concat([pkcs8Prefix, privateKeyBuf, pkcs8Suffix, publicKeyBuf]);

  const privateKey = crypto.createPrivateKey({
    key: fullPkcs8,
    format: 'der',
    type: 'pkcs8',
  });

  const signer = crypto.createSign('SHA256');
  signer.update(unsignedToken);
  const derSignature = signer.sign(privateKey);

  // Convert ASN.1 DER signature to IEEE P1363 (64 bytes: r + s)
  const rLength = derSignature[3];
  const rStart = 4;
  let r = derSignature.subarray(rStart, rStart + rLength);
  if (r.length === 33 && r[0] === 0x00) r = r.subarray(1);

  const sStart = rStart + rLength + 2;
  const sLength = derSignature[sStart - 1];
  let s = derSignature.subarray(sStart, sStart + sLength);
  if (s.length === 33 && s[0] === 0x00) s = s.subarray(1);

  const rPadded = Buffer.alloc(32);
  r.copy(rPadded, 32 - r.length);
  const sPadded = Buffer.alloc(32);
  s.copy(sPadded, 32 - s.length);

  const rawSignature = Buffer.concat([rPadded, sPadded]);
  const signatureB64 = toBase64Url(rawSignature);

  return `${unsignedToken}.${signatureB64}`;
}

/**
 * Returns RFC 8292 Authorization Header string
 */
export function buildVapidAuthorizationHeader(
  endpoint: string,
  subject: string,
  vapidKeys: VapidKeys
): { Authorization: string; CryptoKey?: string } {
  const url = new URL(endpoint);
  const audience = `${url.protocol}//${url.host}`;
  const token = createVapidJwt(audience, subject, vapidKeys);

  return {
    Authorization: `vapid t=${token}, k=${vapidKeys.publicKey}`,
  };
}

/**
 * Client-Side registration helper script injected into web pages
 */
export function getClientPushRegistrationScript(applicationServerPublicKey: string): string {
  return `
  (function() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.log('[WebPush] Push messaging not supported in this browser environment');
      return;
    }

    function urlB64ToUint8Array(base64String) {
      var padding = '='.repeat((4 - base64String.length % 4) % 4);
      var base64 = (base64String + padding).replace(/\\-/g, '+').replace(/_/g, '/');
      var rawData = window.atob(base64);
      var outputArray = new Uint8Array(rawData.length);
      for (var i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
      }
      return outputArray;
    }

    window.subscribeWebPush = async function(brand, interestSlug) {
      try {
        var registration = await navigator.serviceWorker.register('/sw.js');
        await navigator.serviceWorker.ready;
        var permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          console.warn('[WebPush] Notification permission denied');
          return null;
        }

        var convertedVapidKey = urlB64ToUint8Array('${applicationServerPublicKey}');
        var subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: convertedVapidKey
        });

        var subData = subscription.toJSON();
        // Send to backend edge endpoint
        await fetch('/api/v1/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            endpoint: subData.endpoint,
            p256dhKey: subData.keys.p256dh,
            authKey: subData.keys.auth,
            hostname: window.location.hostname,
            brandCluster: brand || 'talentxcel',
            interestSlug: interestSlug || 'general',
            userAgent: navigator.userAgent
          })
        });
        console.log('[WebPush] Subscribed successfully to return-traffic loops');
        return subscription;
      } catch (err) {
        console.error('[WebPush] Subscription error:', err);
        return null;
      }
    };
  })();
  `;
}
