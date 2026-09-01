/**
 * Opens Prisma Studio against the same database the API uses.
 *
 *   npm run studio
 *
 * Prisma looks for DATABASE_URL in a .env beside prisma/, but the connection
 * string lives in api/.env so the server and the browser cannot drift apart.
 * This script bridges the two rather than asking you to maintain both.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const envPath = path.join(root, 'api', '.env');

if (!fs.existsSync(envPath)) {
  console.error('api/.env not found. Copy api/.env.example to api/.env first.');
  process.exit(1);
}

// A deliberately small parser: KEY=value, ignoring blanks and # comments. The
// connection string can contain '=' inside query parameters, so split once only.
const env = { ...process.env };
for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const separator = trimmed.indexOf('=');
  if (separator === -1) continue;
  env[trimmed.slice(0, separator).trim()] = trimmed
    .slice(separator + 1)
    .trim()
    .replace(/^["']|["']$/g, '');
}

if (!env.DATABASE_URL) {
  console.error('DATABASE_URL is not set in api/.env.');
  process.exit(1);
}

console.log('Opening Prisma Studio — read-only browsing of the live database.\n');

spawn('npx', ['prisma', 'studio', '--schema', path.join(root, 'prisma', 'schema.prisma')], {
  stdio: 'inherit',
  env,
  shell: process.platform === 'win32',
}).on('exit', (code) => process.exit(code ?? 0));
