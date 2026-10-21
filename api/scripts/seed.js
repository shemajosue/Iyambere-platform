/**
 * Seeds a working demo of the thesis pilot zone: Kimisagara, Nyarugenge,
 * supplied from the Kimisagara water treatment plant.
 *
 * It creates one account per role (plus a second technician and two more
 * citizens), a slice of the pipeline registry with EPANET-modelled pressures,
 * a day of pressure readings with one branch drifting off the model, and ten
 * reports spread over the last nine days at every stage of the workflow — so
 * the dashboard, the analytics and the technician league table all have real
 * numbers to show.
 *
 * PIPE GEOMETRY IS ILLUSTRATIVE. Every segment lies inside the Kimisagara
 * sector boundary as published by OpenStreetMap (lat −1.9633…−1.9388,
 * lng 30.0380…30.0559), but does not trace surveyed mains. Replace it with the
 * network from the GIS work (and real pressures via `npm run import:epanet`)
 * before the pilot.
 *
 *   npm run seed
 *
 * Safe to re-run: it clears the demo data first.
 */
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { pool, query } from '../src/db.js';
import { nearestActivePipe } from '../src/network.js';

const PASSWORD = 'iyambere';
const DISTRICT = 'Nyarugenge';

const USERS = [
  { full_name: 'Uwase Aline',       phone: '0780000001', role: 'citizen' },
  { full_name: 'Habimana Eric',     phone: '0780000002', role: 'technician' },
  { full_name: 'Mukamana Josiane',  phone: '0780000003', role: 'supervisor' },
  { full_name: 'Niyonzima Patrick', phone: '0780000004', role: 'technician' },
  { full_name: 'Mugisha Jean',      phone: '0780000005', role: 'citizen' },
  { full_name: 'Ingabire Diane',    phone: '0780000006', role: 'citizen' },
];

// Kimisagara distribution zone, as [lng, lat] pairs. design_pressure_bar is the
// pressure the EPANET model predicts for each segment.
const PIPES = [
  {
    code: 'KMS-TM-01', material: 'Ductile iron', diameter_mm: 300, installed_on: '2009-04-20',
    design_pressure_bar: 5.4, condition_score: 4, status: 'active', epanet_node: 'J-01',
    path: [[30.0405, -1.9470], [30.0440, -1.9478], [30.0478, -1.9486]],
    notes: 'Transmission main leaving the Kimisagara treatment plant.',
  },
  {
    code: 'KMS-DM-02', material: 'HDPE', diameter_mm: 200, installed_on: '2014-08-11',
    design_pressure_bar: 4.6, condition_score: 3, status: 'active', epanet_node: 'J-07',
    path: [[30.0478, -1.9486], [30.0505, -1.9502], [30.0532, -1.9521]],
    notes: 'Distribution main along the valley road.',
  },
  {
    code: 'KMS-BR-03', material: 'PVC', diameter_mm: 110, installed_on: '2005-02-01',
    design_pressure_bar: 3.9, condition_score: 2, status: 'active', epanet_node: 'J-12',
    path: [[30.0478, -1.9486], [30.0472, -1.9515], [30.0466, -1.9544]],
    notes: 'Ageing branch up the hillside; repeated joint failures. Candidate for replacement.',
  },
  {
    code: 'KMS-BR-04', material: 'PVC', diameter_mm: 90, installed_on: '2008-10-15',
    design_pressure_bar: 3.6, condition_score: 3, status: 'active', epanet_node: 'J-15',
    path: [[30.0505, -1.9502], [30.0498, -1.9462], [30.0492, -1.9430]],
    notes: 'Branch towards Nyabugogo.',
  },
  {
    code: 'KMS-BR-06', material: 'HDPE', diameter_mm: 160, installed_on: '2019-06-03',
    design_pressure_bar: 4.2, condition_score: 5, status: 'active', epanet_node: 'J-21',
    path: [[30.0532, -1.9521], [30.0552, -1.9538]],
    notes: 'Recently laid extension.',
  },
  {
    code: 'KMS-OLD-05', material: 'Steel', diameter_mm: 150, installed_on: '1996-01-10',
    design_pressure_bar: 3.0, condition_score: 1, status: 'inactive', epanet_node: null,
    path: [[30.0450, -1.9500], [30.0470, -1.9520]],
    notes: 'Bypassed when KMS-BR-03 was laid. Not decommissioned — verify before excavation.',
  },
  {
    code: 'KMS-DEC-07', material: 'Asbestos cement', diameter_mm: 100, installed_on: '1988-05-01',
    design_pressure_bar: null, condition_score: 1, status: 'decommissioned', epanet_node: null,
    path: [[30.0420, -1.9440], [30.0440, -1.9455]],
    notes: 'Decommissioned 2012. Left in the ground.',
  },
];

/**
 * Reports, oldest first. `ago` is hours before now that it was filed; each
 * step is hours after filing. Missing steps mean the report stopped there.
 */
const REPORTS = [
  {
    reporter: '0780000001', tech: '0780000002', ago: 216, severity: 'high',
    lat: -1.95120, lng: 30.04735,
    description: 'Water bursting out of the road on the hill above the market.',
    steps: { assigned: 0.4, accepted: 0.6, on_site: 1.5, resolved: 4.2, verified: 6 },
    notes: 'Failed PVC joint. Cut out 1.5 m and fitted a new 110 mm coupling.',
  },
  {
    reporter: '0780000005', tech: '0780000004', ago: 170, severity: 'medium',
    lat: -1.95060, lng: 30.05110,
    description: 'Steady flow from the pavement edge near the bus stop.',
    steps: { assigned: 1.2, accepted: 1.8, on_site: 3.4, resolved: 7.5, verified: 21 },
    notes: 'Service connection cracked at the saddle. Replaced saddle and 2 m of 25 mm HDPE.',
  },
  {
    reporter: '0780000006', tech: '0780000002', ago: 122, severity: 'high',
    lat: -1.95300, lng: 30.04690,
    description: 'Strong jet from a crack, water running down the steps.',
    steps: { assigned: 0.3, accepted: 0.5, on_site: 1.1, resolved: 3.6, verified: 5 },
    notes: 'Longitudinal crack on 110 mm PVC. Replaced 3 m section. Pipe brittle — recommend renewal.',
  },
  {
    reporter: '0780000001', tech: null, ago: 52, severity: 'medium',
    lat: -1.95305, lng: 30.04695,
    description: 'Same leak as yesterday by the steps, still running.',
    rejected: { after: 1.5, reason: 'Duplicate of IYB-000003, which was already repaired. Wet ground is drying out.' },
  },
  {
    reporter: '0780000005', tech: '0780000004', ago: 70, severity: 'low',
    lat: -1.94700, lng: 30.04970,
    description: 'Small trickle from the valve chamber cover.',
    steps: { assigned: 2.5, accepted: 3.1, on_site: 5.0, resolved: 6.4 },
    notes: 'Valve gland packing worn. Repacked and tightened.',
  },
  {
    reporter: '0780000006', tech: '0780000002', ago: 26, severity: 'medium',
    lat: -1.94790, lng: 30.04420,
    description: 'Water pooling by the roadside drain, has been there all morning.',
    steps: { assigned: 0.8, accepted: 1.1, on_site: 2.2 },
  },
  {
    reporter: '0780000005', tech: '0780000004', ago: 10, severity: 'high',
    lat: -1.95170, lng: 30.04700,
    description: 'Burst near the old steel pipe crossing. Road is flooding.',
    steps: { assigned: 0.25, accepted: 0.5 },
  },
  {
    reporter: '0780000006', tech: '0780000002', ago: 4, severity: 'medium',
    lat: -1.95300, lng: 30.05450,
    description: 'Leak at a house connection, water flowing into the compound.',
    steps: { assigned: 0.6 },
  },
  {
    reporter: '0780000005', tech: null, ago: 2, severity: 'low',
    lat: -1.94520, lng: 30.04950,
    description: 'Damp patch on the footpath that never dries.',
  },
  {
    reporter: '0780000001', tech: null, ago: 0.8, severity: 'high',
    lat: -1.95020, lng: 30.05040,
    description: 'Water gushing from the road surface outside the school gate.',
  },
];

const STEP_COLUMNS = {
  assigned: 'assigned_at', accepted: 'accepted_at', on_site: 'arrived_at',
  resolved: 'resolved_at', verified: 'verified_at',
};

const hoursAgo = (h) => new Date(Date.now() - h * 3_600_000);

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
      [u.full_name, u.phone, hash, u.role, DISTRICT]
    );
    users[u.phone] = rows[0];
  }
  const supervisor = users['0780000003'];

  console.log('Loading the Kimisagara pipeline registry...');
  const pipes = {};
  for (const p of PIPES) {
    const { rows } = await query(
      `INSERT INTO pipes (code, district, material, diameter_mm, installed_on, design_pressure_bar,
                          condition_score, status, path, notes, epanet_node)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11) RETURNING id, code`,
      [p.code, DISTRICT, p.material, p.diameter_mm, p.installed_on, p.design_pressure_bar,
       p.condition_score, p.status, JSON.stringify(p.path), p.notes, p.epanet_node]
    );
    pipes[p.code] = rows[0];
  }

  console.log('Recording pressure readings...');
  // A day of hourly readings on each live pipe. KMS-BR-03 sags steadily below
  // its EPANET prediction — the signature of water escaping that branch.
  for (const p of PIPES.filter((pipe) => pipe.status === 'active')) {
    for (let h = 24; h >= 0; h--) {
      const drift = p.code === 'KMS-BR-03' ? (24 - h) * 0.034 : 0;
      const noise = (Math.random() - 0.5) * 0.12;
      const measured = Math.max(0, p.design_pressure_bar - drift + noise);
      await query(
        `INSERT INTO pressure_readings (pipe_id, node_ref, measured_bar, epanet_expected_bar, recorded_at)
         VALUES ($1, $2, $3, $4, $5)`,
        [pipes[p.code].id, p.epanet_node, measured.toFixed(2), p.design_pressure_bar, hoursAgo(h)]
      );
    }
  }

  console.log('Creating reports...');
  for (const r of REPORTS) {
    const filed = r.ago;
    const reporter = users[r.reporter];
    const tech = r.tech ? users[r.tech] : null;
    const match = await nearestActivePipe(r.lat, r.lng);

    const { rows } = await query(
      `INSERT INTO reports (reporter_id, description, severity, district, latitude, longitude,
                            pipe_id, pipe_distance_m, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9) RETURNING id`,
      [reporter.id, r.description, r.severity, DISTRICT, r.lat, r.lng,
       match?.pipe_id ?? null, match?.distance_m ?? null, hoursAgo(filed)]
    );
    const id = rows[0].id;
    await event(id, reporter.id, 'submitted',
      match ? `Report received. Matched to pipe ${match.code}, ${Math.round(match.distance_m)} m away.`
            : 'Report received.',
      filed);

    if (r.rejected) {
      const at = filed - r.rejected.after;
      await query(`UPDATE reports SET status = 'rejected', rejected_at = $2 WHERE id = $1`,
        [id, hoursAgo(at)]);
      await event(id, supervisor.id, 'rejected', r.rejected.reason, at);
      continue;
    }

    for (const [status, after] of Object.entries(r.steps ?? {})) {
      const at = filed - after;
      const sets = [`status = $2`, `${STEP_COLUMNS[status]} = $3`];
      const params = [id, status, hoursAgo(at)];
      if (status === 'assigned') { params.push(tech.id); sets.push(`assigned_to = $${params.length}`); }
      if (status === 'resolved') { params.push(r.notes); sets.push(`resolution_notes = $${params.length}`); }
      await query(`UPDATE reports SET ${sets.join(', ')} WHERE id = $1`, params);

      const actor = status === 'assigned' || status === 'verified' ? supervisor : tech;
      const note = {
        assigned: `Assigned to ${tech.full_name}.`,
        accepted: 'Technician accepted the job.',
        on_site: 'Technician arrived on site.',
        resolved: r.notes,
        verified: 'Repair verified on site.',
      }[status];
      await event(id, actor.id, status, note, at);
    }
  }

  console.log(`\nDone. Kimisagara pilot zone loaded. Sign in with any of these — password "${PASSWORD}":`);
  for (const u of USERS) console.log(`  ${u.phone}  ${u.role.padEnd(11)} ${u.full_name}`);
}

function event(reportId, actorId, status, note, ago) {
  return query(
    `INSERT INTO report_events (report_id, actor_id, status, note, created_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [reportId, actorId, status, note, hoursAgo(ago)]
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
