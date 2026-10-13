import fs from 'fs';
import path from 'path';

const src = path.resolve('apps/web/dist');
const dest = path.resolve('dist');

if (fs.existsSync(src)) {
  fs.mkdirSync(dest, { recursive: true });
  fs.cpSync(src, dest, { recursive: true });
  console.log('✅ Copied apps/web/dist to ./dist for Vercel deployment');
} else {
  console.warn('⚠️ apps/web/dist not found to copy');
}
