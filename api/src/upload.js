import fs from 'node:fs';
import path from 'node:path';
import multer from 'multer';

export const UPLOAD_DIR = path.resolve('uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Photos are the evidence that makes a report actionable, so they are stored
// on disk and served from /uploads. Swap this for S3-compatible object storage
// when the platform moves to shared cloud hosting.
export const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (_req, file, cb) => {
      const suffix = path.extname(file.originalname) || '.jpg';
      cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${suffix}`);
    },
  }),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, file.mimetype.startsWith('image/')),
});

/** Public URL for a stored photo, or null when no file was attached. */
export function photoUrl(req, file) {
  if (!file) return null;
  return `${req.protocol}://${req.get('host')}/uploads/${file.filename}`;
}
