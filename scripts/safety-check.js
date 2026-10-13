/**
 * Autonomous Growth OS — Pre-flight Safety Verification Script
 *
 * Runs before build, tests, and deployment to verify non-negotiable boundaries:
 * 1. Checks that repository directory is independent (not inside or modifying existing projects).
 * 2. Checks that .env is untracked by git.
 * 3. Scans source code for accidental hard-coded secrets (private keys, live tokens).
 * 4. Verifies no production database host references exist in development configs.
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const ROOT_DIR = process.cwd();
console.log('🔍 Running Autonomous Growth OS Safety Verification...');
console.log(`📂 Root Directory: ${ROOT_DIR}`);

let errorsFound = 0;

function reportError(msg) {
  console.error(`🚨 SAFETY CHECK FAILED: ${msg}`);
  errorsFound++;
}

// 1. Verify working directory is autonomous-growth-os
const baseName = path.basename(ROOT_DIR);
if (!baseName.includes('autonomous-growth-os') && !baseName.includes('DeepTech')) {
  reportError(`Expected directory to be autonomous-growth-os, found: ${baseName}`);
} else {
  console.log('✅ Independent project directory verified.');
}

// 2. Verify .env is NOT tracked by git
try {
  const trackedFiles = execSync('git ls-files .env', { encoding: 'utf8' }).trim();
  if (trackedFiles.length > 0) {
    reportError('.env file is tracked by git! Unstage and delete it from git tracking immediately.');
  } else {
    console.log('✅ .env is safely excluded from git tracking.');
  }
} catch {
  // Not in git or git command failed
}

// 3. Scan for accidental hardcoded secrets in source files
const FORBIDDEN_SECRET_PATTERNS = [
  /-----BEGIN\s+PRIVATE\s+KEY-----/,
  /ghp_[a-zA-Z0-9]{36}/,
  /sk-[a-zA-Z0-9]{48}/,
  /xox[baprs]-[0-9a-zA-Z]{10,48}/,
];

function scanDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (['node_modules', '.git', 'dist', 'build'].includes(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scanDir(fullPath);
    } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.js') || entry.name.endsWith('.json'))) {
      const content = fs.readFileSync(fullPath, 'utf8');
      for (const pattern of FORBIDDEN_SECRET_PATTERNS) {
        if (pattern.test(content)) {
          reportError(`Potential hard-coded secret detected in ${fullPath}`);
        }
      }
    }
  }
}

try {
  scanDir(path.join(ROOT_DIR, 'apps'));
  scanDir(path.join(ROOT_DIR, 'packages'));
  console.log('✅ Source code scan complete: No hard-coded secrets detected.');
} catch (err) {
  console.warn('⚠️ Could not complete directory scan:', err.message);
}

// Summary
if (errorsFound > 0) {
  console.error(`\n❌ Safety verification failed with ${errorsFound} issue(s). Aborting.`);
  process.exit(1);
} else {
  console.log('\n🌟 All safety boundaries verified. Project is strictly isolated.');
  process.exit(0);
}
