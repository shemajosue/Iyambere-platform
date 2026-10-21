# Deploying Iyambere — from this folder to a live link

About 15 minutes, most of it waiting for the build. You end with one public address,
`https://iyambere-xxxx.onrender.com`, that serves all three portals and keeps running
when your laptop is closed.

## 1. Put the code on GitHub

You need a GitHub repository containing this folder. Pick one:

**A. Your own new repository (works today, no permissions needed)**

1. On github.com → **New repository** → name it `iyambere-platform` → leave it
   **empty** (no README, no .gitignore) → **Create**.
2. Unzip `iyambere-platform-with-history.zip`, open a terminal in the
   `iyambere-platform` folder, and run:

   ```bash
   git remote set-url origin https://github.com/wisecrepin4/iyambere-platform.git
   git push -u origin finalise-for-presentation:main
   ```

   Git asks you to sign in to GitHub the first time.

**B. The team repository `shemajosue/Iyambere-platform`**

Shema either adds you as a collaborator (repo **Settings → Collaborators → Add people**,
Write access) so you can run the same push with his URL, or he applies the patch himself:

```bash
git checkout -b finalise-for-presentation
git am iyambere-finalised.patch
git push -u origin finalise-for-presentation
```

## 2. Deploy on Render (free)

1. Go to [render.com](https://render.com) → **Get started** → sign up **with GitHub**,
   and allow Render to see the repository from step 1.
2. **New +** → **Blueprint** → choose the repository → branch `main` (or
   `finalise-for-presentation` for option B) → **Apply**.
3. Render reads `render.yaml` and creates two things:
   - `iyambere-db`, a PostgreSQL database
   - `iyambere`, the web service, built from the `Dockerfile`
4. Wait for the service to show **Live** (5–10 minutes the first time). The log ends with:

   ```
   Empty database — loading the Kimisagara demo.
   ...
   Serving the web app from /srv/app/dist
   Iyambere API listening on http://localhost:4000
   ```

5. Open the service's URL. You'll see the Iyambere sign-in page with the three portal
   buttons.

## 3. Check it before you present

| Check | Expected |
|---|---|
| `https://…onrender.com/health` | `{"status":"ok","service":"iyambere-api"}` |
| Sign-in page → **WASAC operations portal** | Overview with 10 reports, a pressure alert, a district bar |
| **Leak map** | Dark street map of Kimisagara with the pipe network and coloured leak points |
| **Citizen portal** → **Report a leak** → tap the map → **Send report** | A new ticket number and its timeline |
| On your phone, open the same link | The citizen portal, phone layout |

## Good to know

- **Wake it up early.** The free plan sleeps after 15 minutes with no visitors; the
  first visit then takes about a minute. Open the link 5 minutes before you present.
- **Free database expiry.** Render's free PostgreSQL expires after about 30 days. For a
  longer-lived demo, upgrade the database or point `DATABASE_URL` at a free Aiven or Neon
  database (see README).
- **Resetting the demo.** In Render → `iyambere-db` → delete and recreate it (or run
  `npm run migrate -- --reset && npm run seed` against it locally). On the next boot the
  service finds an empty database and loads the demo again.
- **Photos** are stored on the service's disk and are cleared on each redeploy. That's
  fine for a demo; use object storage before a real pilot.
- **Maps** need internet in the room for the street tiles (CARTO dark basemap, with
  automatic fallback to OpenStreetMap). The map library itself ships with the app, so
  pipes, leaks and clicks keep working even if the tiles are slow.
- **Your own domain**, e.g. `iyambere.rw`: Render → service → Settings → Custom Domains.

## Running it on your laptop instead (backup plan)

```bash
# needs Node.js 18+ and PostgreSQL
cd api && cp .env.example .env     # set DATABASE_URL
npm install && npm run migrate && npm run seed
cd ../app && npm install && npx expo export --platform web --output-dir dist
cd ../api && npm start             # → http://localhost:4000, all three portals
```
