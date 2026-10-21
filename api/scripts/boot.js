/**
 * Production entry point: brings the database up to date, loads the demo data
 * the first time only, then starts the server.
 *
 *   node scripts/boot.js        (what the Docker image and Render run)
 *
 * SEED_DEMO=true seeds the Kimisagara demo when the database has no accounts
 * yet. It never runs over existing data, so restarts and redeploys keep every
 * report people have filed.
 */
import 'dotenv/config';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

function run(script) {
  const result = spawnSync(process.execPath, [path.join(here, script)], { stdio: 'inherit' });
  if (result.status !== 0) {
    console.error(`${script} failed — not starting the server.`);
    process.exit(result.status ?? 1);
  }
}

// Each step runs in its own process so the server starts with a fresh
// database pool (the scripts close theirs when they finish).
run('migrate.js');
if (process.env.SEED_DEMO === 'true') run('seed-if-empty.js');

await import('../src/index.js');
