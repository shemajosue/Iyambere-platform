/**
 * Seeds a working demo of the Kigali pilot zone: three accounts (one per role),
 * a slice of the pipeline registry, pressure readings including one zone that
 * is clearly off the EPANET model, and a few reports at different lifecycle
 * stages so the dashboard has something to show on first run.
 *
 *   npm run seed
 *
 * Safe to re-run: it clears the demo data first.
 */
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { pool, query } from '../src/db.js';

const PASSWORD = 'iyambere';

const USERS = [
  { full_name: 'Uwase Aline',        phone: '0780000001', role: 'citizen',    district: 'Gasabo'   },
  { full_name: 'Habimana Eric',      phone: '0780000002', role: 'technician', district: 'Gasabo'   },
  { full_name: 'Mukamana Josiane',   phone: '0780000003', role: 'supervisor', district: 'Kigali'   },
  { full_name: 'Niyonzima Patrick',  phone: '0780000004', role: 'technician', district: 'Nyarugenge' },
];

// Short segments of the Kigali distribution network, as [lng, lat] pairs.
const PIPES = [
  {
    code: 'KGL-GSB-001', district: 'Gasabo', material: 'HDPE', diameter_mm: 200,
    installed_on: '2011-06-15', design_pressure_bar: 4.5, condition_score: 3, status: 'active',
    path: [[30.0885, -1.9420], [30.0930, -1.9455], [30.0972, -1.9488]],
    notes: 'Main feeder along the Kimironko corridor.',
  },
  {
    code: 'KGL-GSB-002', district: 'Gasabo', material: 'PVC', diameter_mm: 110,
    installed_on: '2004-03-01', design_pressure_bar: 3.8, condition_score: 2, status: 'active',
    path: [[30.0972, -1.9488], [30.1015, -1.9502]],
    notes: 'Ageing branch line; three bursts recorded since 2023.',
  },
  {
    code: 'KGL-NYA-014', district: 'Nyarugenge', material: 'Ductile iron', diameter_mm: 300,
    installed_on: '2016-09-20', design_pressure_bar: 5.2, condition_score: 4, status: 'active',
    path: [[30.0555, -1.9535], [30.0601, -1.9570], [30.0648, -1.9592]],
    notes: 'Transmission main serving the city centre.',
  },
  {
    code: 'KGL-NYA-007', district: 'Nyarugenge', material: 'Steel', diameter_mm: 150,
    installed_on: '1998-01-10', design_pressure_bar: 3.0, condition_score: 1, status: 'inactive',
    path: [[30.0512, -1.9498], [30.0540, -1.9515]],
    notes: 'Bypassed during the 2019 upgrade. Not decommissioned — verify before excavation.',
  },
  {
    code: 'KGL-KCY-003', district: 'Kicukiro', material: 'HDPE', diameter_mm: 160,
    installed_on: '2018-11-05', design_pressure_bar: 4.0, condition_score: 5, status: 'active',
    path: [[30.1042, -1.9812], [30.1088, -1.9840]],
    notes: 'Recently laid; no incidents to date.',
  },
];

async function main() {
  console.log('Clearing existing demo data...');
  await query('TRUNCATE report_events, reports, pressure_readings, pipes, users RESTART IDENTITY CASCADE');
  await query("SELECT setval('ticket_ref_seq', 1, false)");

  console.log('Creating accounts...');
  const hash = bcrypt.hashSync(PASSWORD, 10);
  const users = {};
  for (const u of USERS) {
    const { rows } = await query(
      `INSERT INTO users (full_name, phone, password_hash, role, district)
       VALUES ($1, $2, $3, $4, $5) RETURNING id, role, full_name`,
      [u.full_name, u.phone, hash, u.role, u.district]
    );
    users[u.phone] = rows[0];
  }

  console.log('Loading the pipeline registry...');
  const pipes = {};
  for (const p of PIPES) {
    const { rows } = await query(
      `INSERT INTO pipes (code, district, material, diameter_mm, installed_on,
                          design_pressure_bar, condition_score, status, path, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10) RETURNING id, code`,
      [p.code, p.district, p.material, p.diameter_mm, p.installed_on, p.design_pressure_bar,
       p.condition_score, p.status, JSON.stringify(p.path), p.notes]
    );
    pipes[p.code] = rows[0];
  }

  console.log('Recording pressure readings...');
  // Twelve hours of hourly readings per pipe. KGL-GSB-002 drifts steadily away
  // from its EPANET expectation — the pattern an unreported burst produces.
  for (const p of PIPES) {
    const expected = p.design_pressure_bar;
    for (let hoursAgo = 12; hoursAgo >= 0; hoursAgo--) {
      const drift = p.code === 'KGL-GSB-002' ? (12 - hoursAgo) * 0.06 : 0;
      const noise = (Math.random() - 0.5) * 0.1;
      const measured = Math.max(0, expected - drift + noise);
      await query(
        `INSERT INTO pressure_readings (pipe_id, node_ref, measured_bar,
                                        epanet_expected_bar, recorded_at)
         VALUES ($1, $2, $3, $4, now() - ($5::text || ' hours')::interval)`,
        [pipes[p.code].id, `N-${p.code.slice(-3)}`, measured.toFixed(2), expected, hoursAgo]
      );
    }
  }

  console.log('Creating sample reports...');
  const citizen = users['0780000001'];
  const technician = users['0780000002'];
  const supervisor = users['0780000003'];

  const reports = [
    {
      description: 'Water flowing across the road near the Kimironko market entrance.',
      severity: 'high', district: 'Gasabo', latitude: -1.9488, longitude: 30.0972,
      pipe: 'KGL-GSB-002', stage: 'verified',
    },
    {
      description: 'Constant trickle from a joint on the pavement, getting worse.',
      severity: 'medium', district: 'Gasabo', latitude: -1.9455, longitude: 30.0930,
      pipe: 'KGL-GSB-001', stage: 'on_site',
    },
    {
      description: 'Damp patch and low pressure in the houses on this street.',
      severity: 'low', district: 'Nyarugenge', latitude: -1.9570, longitude: 30.0601,
      pipe: null, stage: 'submitted',
    },
  ];

  for (const r of reports) {
    const { rows } = await query(
      `INSERT INTO reports (reporter_id, description, severity, district,
                            latitude, longitude, pipe_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, now() - interval '2 days') RETURNING id`,
      [citizen.id, r.description, r.severity, r.district, r.latitude, r.longitude,
       r.pipe ? pipes[r.pipe].id : null]
    );
    const id = rows[0].id;

    await event(id, citizen.id, 'submitted', 'Report received.', '2 days');
    if (r.stage === 'submitted') continue;

    await query(
      `UPDATE reports SET status = 'assigned', assigned_to = $2,
              assigned_at = now() - interval '46 hours' WHERE id = $1`,
      [id, technician.id]
    );
    await event(id, supervisor.id, 'assigned', `Assigned to ${technician.full_name}.`, '46 hours');

    await query(
      `UPDATE reports SET status = 'accepted', accepted_at = now() - interval '45 hours'
        WHERE id = $1`, [id]);
    await event(id, technician.id, 'accepted', 'Technician accepted the job.', '45 hours');

    await query(
      `UPDATE reports SET status = 'on_site', arrived_at = now() - interval '43 hours'
        WHERE id = $1`, [id]);
    await event(id, technician.id, 'on_site', 'Technician arrived on site.', '43 hours');
    if (r.stage === 'on_site') continue;

    await query(
      `UPDATE reports SET status = 'resolved', resolved_at = now() - interval '41 hours',
              resolution_notes = 'Damaged section cut out and replaced with a 1.5 m HDPE insert.'
        WHERE id = $1`, [id]);
    await event(id, technician.id, 'resolved', 'Repair completed.', '41 hours');
    if (r.stage === 'resolved') continue;

    await query(
      `UPDATE reports SET status = 'verified', verified_at = now() - interval '39 hours'
        WHERE id = $1`, [id]);
    await event(id, supervisor.id, 'verified', 'Repair verified on site.', '39 hours');
  }

  console.log(`\nDone. Sign in with any of these — password "${PASSWORD}":`);
  for (const u of USERS) console.log(`  ${u.phone}  ${u.role.padEnd(11)} ${u.full_name}`);
  await pool.end();
}

function event(reportId, actorId, status, note, ago) {
  return query(
    `INSERT INTO report_events (report_id, actor_id, status, note, created_at)
     VALUES ($1, $2, $3, $4, now() - ($5::text)::interval)`,
    [reportId, actorId, status, note, ago]
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
