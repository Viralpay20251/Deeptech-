const crypto = require('crypto');

function toBase64Url(buf) {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function generateVapidKeys() {
  const ec = crypto.generateKeyPairSync('ec', {
    namedCurve: 'prime256v1',
  });

  const rawPublic = ec.publicKey.export({ format: 'der', type: 'spki' });
  const uncompressedPublicPoint = rawPublic.subarray(rawPublic.length - 65);

  const rawPrivate = ec.privateKey.export({ format: 'der', type: 'pkcs8' });
  const privateKeyScalar = rawPrivate.subarray(36, 68);

  return {
    publicKey: toBase64Url(uncompressedPublicPoint),
    privateKey: toBase64Url(privateKeyScalar),
  };
}

const keys = generateVapidKeys();
console.log('--- PRODUCTION VAPID CONFIGURATION ---');
console.log(`VAPID_PUBLIC_KEY=${keys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`);
console.log('VAPID_SUBJECT=mailto:admin@talentxcel.in');
console.log('--------------------------------------');
