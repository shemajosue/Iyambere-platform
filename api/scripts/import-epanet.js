/**
 * Loads modelled pressures from an EPANET run into the pipeline registry, so
 * every leak report matched to a pipe carries the pressure the model expects
 * there.
 *
 *   npm run import:epanet -- path/to/results.csv
 *
 * The CSV needs a header row and one line per pipe segment:
 *
 *   pipe_code,epanet_node,pressure_m
 *   KMS-001,J-12,48.6
 *
 * Use `pressure_m` for EPANET's default SI output (metres of head), or
 * `pressure_bar` if you have already converted. 1 m of head = 0.0981 bar.
 *
 * In EPANET: run the model, then Report → Table → Network Nodes → Pressure,
 * copy the table into a spreadsheet, add the pipe_code each junction belongs
 * to, and save as CSV.
 */
import 'dotenv/config';
import fs from 'node:fs';
import { pool } from '../src/db.js';

const M_TO_BAR = 0.0981;

function parseCsv(text) {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const header = lines.shift().split(',').map((h) => h.trim().toLowerCase());
  return lines.map((line) => {
    const cells = line.split(',').map((c) => c.trim());
    return Object.fromEntries(header.map((h, i) => [h, cells[i]]));
  });
}

async function main() {
  const file = process.argv[2];
  if (!file || !fs.existsSync(file)) {
    console.error('Usage: npm run import:epanet -- path/to/results.csv');
    process.exitCode = 1;
    return;
  }

  const rows = parseCsv(fs.readFileSync(file, 'utf8'));
  let updated = 0;
  const missing = [];

  for (const row of rows) {
    const bar = row.pressure_bar !== undefined
      ? Number(row.pressure_bar)
      : Number(row.pressure_m) * M_TO_BAR;

    if (!row.pipe_code || !Number.isFinite(bar)) {
      console.warn(`  skipped: ${JSON.stringify(row)}`);
      continue;
    }

    const result = await pool.query(
      `UPDATE pipes SET design_pressure_bar = $2, epanet_node = COALESCE($3, epanet_node)
        WHERE code = $1`,
      [row.pipe_code, bar.toFixed(2), row.epanet_node || null]
    );
    if (result.rowCount) updated++;
    else missing.push(row.pipe_code);
  }

  console.log(`Updated ${updated} pipe(s) with EPANET pressures.`);
  if (missing.length) {
    console.log(`Not in the registry (add them first): ${missing.join(', ')}`);
  }
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
