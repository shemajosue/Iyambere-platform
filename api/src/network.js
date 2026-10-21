/**
 * Geometry helpers for matching a reported leak to the pipe it most likely
 * came from.
 *
 * Pipe paths are stored as JSON [lng, lat] pairs (see db/schema.sql), so the
 * matching runs here in JavaScript rather than in PostGIS. Over the few
 * kilometres of one pilot zone an equirectangular projection is accurate to
 * well under a metre, which is far below GPS error on a phone.
 */
import { query } from './db.js';

const EARTH_RADIUS_M = 6_371_000;

/** Further than this and we do not pretend to know which pipe it is. */
export const MATCH_RADIUS_M = 150;

/** Projects lat/lng to local metres around a reference latitude. */
function toMetres(lng, lat, refLat) {
  const rad = Math.PI / 180;
  return {
    x: lng * rad * EARTH_RADIUS_M * Math.cos(refLat * rad),
    y: lat * rad * EARTH_RADIUS_M,
  };
}

/** Shortest distance in metres from a point to a polyline of [lng, lat] pairs. */
export function distanceToPath(lat, lng, path) {
  if (!Array.isArray(path) || path.length === 0) return Infinity;

  const p = toMetres(lng, lat, lat);
  const points = path.map(([x, y]) => toMetres(x, y, lat));
  if (points.length === 1) return Math.hypot(p.x - points[0].x, p.y - points[0].y);

  let best = Infinity;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lengthSq = dx * dx + dy * dy;
    const t = lengthSq === 0
      ? 0
      : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSq));
    best = Math.min(best, Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy)));
  }
  return best;
}

/**
 * The live (active) pipe closest to a point, within MATCH_RADIUS_M.
 * Inactive and decommissioned pipes are never the match: water cannot be
 * escaping from a main that carries none. They are reported separately by
 * `inactivePipesNear` as a warning for the excavation crew.
 */
export async function nearestActivePipe(lat, lng, db = { query }) {
  const { rows } = await db.query(`SELECT id, code, path FROM pipes WHERE status = 'active'`);

  let best = null;
  for (const pipe of rows) {
    const distance = distanceToPath(lat, lng, pipe.path);
    if (distance <= MATCH_RADIUS_M && (!best || distance < best.distance_m)) {
      best = { pipe_id: pipe.id, code: pipe.code, distance_m: Math.round(distance * 10) / 10 };
    }
  }
  return best;
}

/** Inactive pipes running close to a leak — the ones a crew might dig up by mistake. */
export async function inactivePipesNear(lat, lng, radius = MATCH_RADIUS_M) {
  const { rows } = await query(
    `SELECT id, code, material, diameter_mm, installed_on, status, notes, path
       FROM pipes WHERE status <> 'active'`
  );
  return rows
    .map((pipe) => ({ ...pipe, distance_m: Math.round(distanceToPath(lat, lng, pipe.path)) }))
    .filter((pipe) => pipe.distance_m <= radius)
    .sort((a, b) => a.distance_m - b.distance_m);
}
