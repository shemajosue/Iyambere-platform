# Presenting Iyambere

A guide for Team Iyambere: how the platform works in plain language, a demo you
can run in about eight minutes, and answers to the questions you are likely to get.

---

## The one-minute version

Kigali loses water through leaks that run for days, because reporting a leak is a
phone call to 3535 that leaves no record, no exact location and no way to check the
repair. Iyambere turns that call into a digital trail:

**Report → Dispatch → Repair → Verify.**

A citizen pins the leak on a map with a photo. WASAC sees it on a live map, already
matched to the pipe it came from, with that pipe's EPANET-modelled pressure. A
technician is dispatched by workload, and every step they take is timestamped. The
ticket only closes when a supervisor verifies the repair, and the citizen can follow
it the whole way.

The pilot zone is **Kimisagara** (Nyarugenge), supplied from the Kimisagara
treatment plant.

## How it is built, in plain language

| Piece | What it is | Why it matters |
|---|---|---|
| **One app, three portals** | React Native (Expo): the same code runs on Android, iPhone and the web | One codebase to maintain; the citizen gets a phone app and WASAC gets a desktop console |
| **API** | Node.js + Express. One file per area: reports, map, pipes, pressure, stats, users | Clean separation; every endpoint is documented in `docs/API.md` |
| **Database** | PostgreSQL. Reports, a timeline for each report, the pipe registry, pressure readings | The status rules are enforced by the server, not just hidden in the app |
| **Map API** | GeoJSON feeds (`/api/map/incidents`, `/network`, `/hotspots`) | The same live layers open in QGIS or ArcGIS for the GIS team |
| **EPANET link** | Each report is matched to the nearest live pipe within 150 m, and modelled pressures are imported from an EPANET run | Every leak arrives with the hydraulic context: material, age, condition and expected pressure |

**The rule that makes it trustworthy:** a report can only move forward one legal step
at a time, and only the assigned technician can work a job. A supervisor cannot
"verify" a repair that never happened, and nobody can skip the arrival timestamp. That
is why the response-time figures are measured rather than self-reported.

## Before you present (checklist)

- [ ] Open the cloud link **5 minutes early**. The free hosting plan sleeps when idle
      and takes about a minute to wake.
- [ ] Use a laptop with internet: the map tiles load from OpenStreetMap.
- [ ] If you want a clean slate, reseed (`npm run seed` locally, or redeploy with an
      empty database). The demo data is timed relative to "now", so it always looks fresh.
- [ ] Open three browser windows (or one normal and two private windows), one per
      portal, so you can switch between roles without signing out.
- [ ] Have a phone ready if you want to show the citizen side on a real device
      (open the same link in the phone's browser).

## The demo (about 8 minutes)

The sign-in page has three portal buttons. Each one signs in with one tap.

### 1. WASAC operations portal: the situation (1.5 min)

1. Tap **WASAC operations portal**. You land on **Network operations**.
2. Point at the stat row: leaks awaiting dispatch, in progress, repaired, pressure
   alerts, and the **average time to repair**, computed from timestamps.
3. Open **Leak map**. *"Every open leak in Kimisagara, on the pipe it came from. Red is
   a burst, amber is a steady leak, and the blue pipe is under a pressure alert."*
4. Point at **Leak hotspots**: KMS-BR-03 tops the list, with three bursts and its
   pressure 20% below the EPANET model. *"This pipe doesn't need another repair. It
   needs replacing, and the data makes the case for the budget."*

### 2. Citizen portal: report a leak (2 min)

1. In a second window, tap **Citizen portal** → **Report a leak**.
2. If the browser asks for location, allow it. Otherwise **tap the map** where the
   leak is. *"GPS or a tap. A report never fails because of location."*
3. Choose **Burst**, add a short description (a photo is optional on a laptop), and
   tap **Send report**.
4. The ticket opens (IYB-0000xx) with its timeline. *"The citizen gets a ticket number
   instead of a phone call that leaves no trace."*

### 3. Back to WASAC: dispatch (1.5 min)

1. Refresh the operations overview. The new report is at the top, **Pending**.
2. Open it. Show the **Network & EPANET** panel: it is already matched to a pipe, with
   that pipe's material, age, condition, EPANET node, expected vs latest pressure, and
   how often it has leaked before.
3. If the leak is near KMS-OLD-05, point at the amber warning: *"There's a dead main 24 m
   away. The crew is told before they dig."*
4. **Assign** the technician with the lightest workload. Mention that you can
   **re-dispatch** until the technician arrives, and close duplicates with a reason the
   citizen will see.

### 4. Technician portal: the repair (1.5 min)

1. In a third window, tap **Technician portal** (Habimana Eric). If you assigned
   Niyonzima Patrick instead, re-dispatch to Eric first, which also shows re-dispatch.
2. Open the job → **Accept job** → **I have arrived**. *"Each tap is a timestamp. This
   is how response time gets measured fairly."*
3. Write what was done, enter a **gauge reading** (try 3.6), and tap **Mark repair
   complete**.

### 5. Close the loop (1 min)

1. As WASAC, open the report → **Verify repair**. The timeline now shows every step,
   who did it and when.
2. As the citizen, open the ticket: **Verified**. *"The person who reported it knows
   it's fixed."*
3. Back on the overview, the technician performance panel has updated.

## Numbers to quote (from the concept note)

- Kigali has 1,745,555 residents (NISR 2022) and 139,485 WASAC connections supplying
  about 114,700 m³/day (RURA Q2 2022).
- National non-revenue water is 38% (WASAC 2026), against WASAC's target of 25% by 2029.
- That is an estimated 43,600 m³/day lost in Kigali, about Rwf 14.1M per day at
  Rwf 323/m³.
- Physical losses (leaks) are 80–90% of that (JICA 2022).

## Likely questions

**"Where does the pressure data come from if there are no sensors?"**
From two sources. The EPANET model of the zone gives the pressure each pipe *should*
have; it is imported with `npm run import:epanet`. Technicians record gauge readings on
site when they close a job. The system compares the two and flags any pipe more than
15% off. Permanent loggers can later feed the same endpoint without changing the app.

**"How does it know which pipe is leaking?"**
It measures the distance from the reported point to every live pipe in the registry and
takes the closest one within 150 m. It shows that distance, so a weak match is obvious.
Inactive mains are never chosen, because no water flows in them, but they are flagged
when they run close by.

**"What stops a technician faking their response time?"**
They never type a time. The server stamps each step when the button is pressed, steps
cannot be skipped or done out of order, and only the assigned technician can act on the
job. The repair still has to be verified by a supervisor.

**"Is the pipe network on the map real?"**
Not yet. The demo network is illustrative and laid out around Kimisagara. Next it gets
replaced with the surveyed network from our GIS work and real pressures from the EPANET
model.

**"Does it work offline?"**
Yes, on the phone app: a report composed without signal is saved on the phone and sent
automatically when the connection returns.

**"Can WASAC use this with their own GIS?"**
Yes. The map is published as standard GeoJSON, so QGIS and ArcGIS can load the same
live layers.

**"What does it cost to run?"**
For the pilot, a single small cloud service and a PostgreSQL database, roughly the
cost of a basic hosting plan. The whole system is one container.

## What is honestly still to do (roadmap)

| Next step | Why |
|---|---|
| Replace the demo network with surveyed Kimisagara pipes and real EPANET output | Real matching and real pressure context |
| SMS updates to citizens and technicians (e.g. Africa's Talking) | Many users won't keep the app open |
| Photo storage in the cloud (S3 or similar) | Photos currently live on the server's disk |
| Kinyarwanda interface | Reach every citizen |
| Pressure loggers on the worst branches | Find leaks nobody has reported |
| Predictive maintenance from leak history | Hotspots are the first step toward it |
