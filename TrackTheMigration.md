PROJECT NAME: TrackTheMigration

META-INSTRUCTIONS:

<Read it all before acting. Ask about anything unclear, contradictory or
 underspecified — before starting and mid-build. Ask in the question widget
 (AskUserQuestion): related questions batched, concrete options, your
 recommendation first. Plain text only if the widget isn't available.>

<Don't expand scope. Anything not listed here is a proposal, including changes
 to this file — propose it, don't do it.>

<Prefer doing over describing: run the code, write the files, test it.>

<Always in scope, no proposal needed: when it goes on GitHub, a README that is
 easy to read at a glance — a line on what it is, then clear visuals
 (screenshots, a diagram or a chart), then links. Everything else goes in
 linked files: docs/INSTRUCTIONS.md (setup, run, use),
 docs/SYSTEM-DESIGN.md (see below) and docs/FILE-STRUCTURE.md (what's where). If what you're
 building is an application rather than a script, also a small unobtrusive feedback tab, and a settings
 button or tab (⌘, on the Mac) that gathers its preferences in one place.>

<If what you're building is an application, build it as a Mac app first; the
 website comes after, as its own step.>

<Color-code tags, categories and types by similarity: related ones share a
 hue family, with shades far enough apart to tell them apart at a glance, in
 both light and dark mode.>

<Name things the way a person would say them — "Goal Tracker", not
 goal_tracker — for the app, its windows, titles, files people open, repo
 descriptions and README headings. When you create the GitHub repo, name it
 with no "_" or "-": one word or joined words, e.g. GoalTracker.>

<Always in scope: a system design doc in the codebase, docs/SYSTEM-DESIGN.md,
 kept current as the build changes. Cover the architecture (with a Mermaid
 diagram), each component's job, the main flows, where data lives, the key
 design decisions and their trade-offs, how it's tested, and known limits.>

<Finish by listing every deliverable: path, what it is, how to check it works.>

<Git rules (no Claude attribution, never commit .claude/) are in
 ~/.claude/CLAUDE.md and apply on their own — nothing to repeat here.>

<Keep the changelog at the bottom current.>

CONTEXT:

Project type: Visualization (data or ideas made visible and explorable).

track the migration of animals on a 3d map.

wildebeast migration, migration of blue whales etc. pull from real data sources

DELIVERABLES:

a persistent website

OPEN QUESTIONS / ASSUMPTIONS:

<Agent fills in: what it guessed, what it decided without asking.>

Asked and answered (2026-10-09):
- Hosting: GitHub Pages, public repo "TrackTheMigration".
- Treated as a visualization website, not an app. No Mac app; it still has the feedback tab and a Settings panel (⌘,).
- Data: a fetch script pulls from real sources at build time into static JSON. The site makes no live API calls.
- Species: wildebeest and blue whale, plus birds, other land mammals and other marine animals.

Decided without asking:
- One data source: the Movebank Data Repository (published, DOI'd, CC0/CC BY packages). Nine migrations:
  - land: wildebeest (Kenya), plains zebra (Botswana), mule deer (Wyoming)
  - marine: blue whale (NE Pacific), humpback whale (E Australia), loggerhead turtle (Japan)
  - birds: white stork (Europe–Africa), osprey (Americas), bar-tailed godwit (NZ–Alaska)
- Wildebeest are the Kenyan Mara, Athi-Kaputiei and Amboseli populations. No open Serengeti data package was found.
- Not included, because no open package was found: Arctic tern, caribou, sharks.
- 3D map: MapLibre GL 5 globe with 3D terrain. Tiles need no keys: Sentinel-2 cloudless imagery, OpenFreeMap street maps, Mapzen terrain.
- Up to 30–40 longest-tracked animals per species, thinned and cleaned (speed filter, Argos quality classes).
- Default view is "Season": every tracked year laid over one calendar year. "Dates" replays the real timeline.
- Feedback goes to a pre-filled GitHub issue (no backend).
- Colours: land mammals warm, marine animals blue, birds green, with a light and a dark shade for each. A unit test enforces the spacing.

Asked and answered (2026-10-09, "make it a beautiful deep interactive viz"):
- Build all four deep-dive features: follow an animal, linked migration charts, live NASA environment layers, and guided stories.
- Cinematic redesign. Keep the same nine species.

Decided without asking (v2):
- Overlays, all from NASA GIBS with no key:
  - Vegetation (MODIS NDVI monthly, 2000 onward)
  - Sea temperature (GHRSST AVHRR-OI daily, 1981–2020, chosen because it covers the 1990s whale data)
  - Snow (MODIS monthly)
  - Dates outside an archive show the same season in the nearest covered year, with a note in the legend.
- Night shading is seasonal: the sun's latitude is real for the date, but its longitude follows the view so the visible face stays lit.
- Following an animal switches to real dates for that animal's journey, dims the others, and tucks the panel away on screens under 1400 px wide.
- Stories: four to six scenes each, written only from the study abstracts plus numbers computed live from the tracks. Each ends by riding along with the animal that went farthest.
- Species silhouettes from PhyloPic (CC0, public domain or CC BY, credited in the app). Fonts: Inter and Fraunces (Google Fonts). Charts: D3 7 from cdnjs.
- The default theme is now dark, and the light theme is kept.

Asked and answered (2026-10-11, "keep going"):
- Build all four: shareable links, filters by who the animal is, stopovers and resting places, and more migrations.

Decided without asking (v3):
- New migrations, all CC0 from the Movebank Data Repository:
  - pronghorn (Adobe Town, Wyoming/Colorado)
  - elk (Ya Ha Tinda herd, Banff)
  - greater white-fronted goose: the small Alterra study, not the 760 MB LifeTrack one
  - Hudsonian godwit (Chiloé to the Gulf of Mexico)
- The bird and land colour families were re-optimised for 13 species (smallest ΔE 21.9). White stork, osprey and bar-tailed godwit changed shade to make room.
- Who-they-are facets come from each study's reference data, and are shown only if they split the animals into at least two groups of two or more. Tagging sites use the coarsest useful grouping. Stork "handling" separates experimental or relocated birds, which the study itself flags.
- What counts as a stopover:
  - birds: 30 km for 3 days
  - marine animals: 40 km for 7 days
  - land animals: 6 km for 10 days
  - the geolocator godwit: 150 km
- Stopovers are computed at build time on unthinned tracks; up to 40 sites per species.
- Share links live in the URL hash and update automatically. A shared link opens paused. A shared overlay becomes the viewer's overlay setting.
- The elk silhouette is a cow, because every collared elk is female.

Asked and answered (2026-10-11, second "keep going"):
- Build all four: compare & race, human impact layers, the guess-where game, and embed & video.

Decided without asking (v4):
- People overlays are the key-free GIBS layers:
  - Human Footprint 1995–2004
  - GPW population density (nearest of 2000–2020)
  - Black Marble night lights (2012 or 2016)
  - Protected areas aren't available that way, so they're left out.
- Footprint per fix is sampled at build time (zoom-7 tiles, no new dependencies), for land animals and birds only. It is shown as a live readout value, a per-species chart split by group, and footprint overlays in the wildebeest and pronghorn stories.
- Races start each animal on its own day 1, hold up to four racers, and size the race to the field when one track is far longer (with a "Show all days" toggle). Shift-click adds a racer.
- The game has 10 rounds of 30 days each, a minimum move per group so rounds are meaningful, and scoring relative to the move.
- Video is a 12-second clip recorded in the browser: WebM, or MP4 in Safari.
- Embeds use `?embed=1` and autoplay.
- Animal data updates at most 30 times a second.

Asked and answered (2026-10-11, third "keep going"):
- Build speed & accessibility, A year on Earth, and Listen to the migration. Not the installable/offline app.

Decided without asking (v5):
- The All view loads a light `overview.json` (≤ 180 points per animal); full species files load on demand.
- Keyboard keys: , . < > to step time, n/p to pick animals, Enter, r, d, c, l, ? (shown in a dialog).
- Spoken descriptions are computed from the tracks: direction and speed over the last week. They're read on pause, selection, follow and with d. There are no place names, because there's no geocoder.
- Motion setting: Match system / Reduced / Full.
- The tour runs 2 days/s (about 3 minutes), 18-day segments, chosen by a transparent score, captioned only with existing story text or the species blurb, and loops in embeds. It's shareable as `#tour=1`.
- Sound is off by default. Pitch follows latitude (pentatonic; marine low, land middle, birds high) and loudness follows speed relative to the group.
- Frame rate on a real GPU couldn't be measured here (the browser pane stayed hidden), so per-frame CPU time was measured instead.

Asked and answered (2026-10-11, fourth "keep going"):
- Build the Journey atlas, Conditions along the route, Flight altitude in 3D, and a Code health pass.

Decided without asking (v6):
- Conditions: one NASA layer per group, sampled at build time per fix. Land animals get vegetation greenness and marine animals get sea surface temperature. Birds get flight height instead.
- Flight height comes from the white stork study's GPS file (heights recorded per fix). Only fixes taken in flight are kept: steps of 2 h or less, faster than 15 km/h. Two storks qualify (93412A, 54983B); the rest were sampled too sparsely.
- 3D walls are exaggerated ×6 and the button's tooltip says so. Readout numbers are real heights above the ground.
- The atlas uses the overview file and a 110 m land outline. Cards are canvases drawn lazily, not maps. It opens with the **a** key.
- Code health:
  - app.js split into panel, layers, map-input, sharing and ui modules.
  - A review found 12 bugs, all fixed.
  - A dependency-free headless-Chrome smoke test now gates every deploy.

Asked and answered (2026-10-11, fifth "keep going"):
- Build Who passes near me, Wind under their wings, Then vs now, Journey posters, plus more migrations, real-device performance and other languages. ("No, just features" was also ticked; the three extras were taken as wanted.)

Decided without asking (v7):
- New species: steppe eagle, Egyptian vulture, turkey vulture and far eastern curlew. These were the best open GPS studies found that cover new regions. Caribou were rejected because the open data barely moves on a map.
- Bird colours were re-searched for nine birds in the green family, within lightness and saturation limits.
- Wind is ERA5 at 100 m above the ground (Open-Meteo, key-free), the only height available. It is labelled as such.
- Timing uses the date each animal crossed the halfway point of its range. A trend appears only with 8 or more crossings in 3 or more years.
- Who passed near:
  - Place search uses OpenStreetMap Nominatim.
  - Your own location is rounded to about 10 km and never put in links.
  - Passes are measured along lines between fixes, not just at the fixes.
- Posters are a 2400 × 3200 PNG with a clean drawn map rather than satellite imagery.
- Auto quality steps detail down when frames drop, never changes saved settings, and can be turned off.
- Languages are Spanish and French, translated for this project, including stories. Citations stay in English. Gendered phrasing was reworded around animal names.

Asked and answered (2026-10-11, sixth "keep going"):
- Build Journey diary, Barriers and crossings, and This week in migration. Just features.

Decided without asking (v8):
- Place names come from Natural Earth offline (towns, provinces, countries, seas, deserts, ranges, lakes, all public domain and translated), not a geocoding service, because there are thousands of lookups.
- Diaries are generated from each track:
  - first and last record
  - the longest stays (merged when back-to-back at the same spot)
  - crossings, the fastest day, farthest north and south, and distance milestones
- A crossing needs a fix inside the barrier or a 600 km leg, so straight lines clipping a coast don't count. It must also be at least 150 km and take no more than 45 days. Seas count for birds only.
- This week uses half-month bins from every tracked year. The globe now opens on today's time of year.
- The poster button became a download icon to make room in the readout header.

CHANGELOG:

- 2026-10-09 — created
- 2026-09-15 — added meta-instruction: built-out applications include a small feedback tab
- 2026-09-15 — added meta-instruction: no "Claude" attribution in commits, PRs, or branches
- 2026-09-16 — added meta-instruction: always include a README when adding to GitHub
- 2026-09-16 — changed meta-instruction: ask clarifying questions in the question widget
- 2026-09-17 — added meta-instructions: Claude never a contributor; never commit .claude/
- 2026-09-26 — compressed the meta-instructions and every field prompt; git rules moved to the global instruction file
- 2026-09-27 — added meta-instruction: applications are built as a Mac app first, then a website
- 2026-09-28 — folded inputs, instructions, constraints, deliverables and done criteria into one free-form CONTEXT
- 2026-09-28 — changed meta-instruction: a README on GitHub always includes a visual
- 2026-09-28 — added meta-instruction: name things like a person would, never snake_case
- 2026-09-28 — changed meta-instruction: README leads with visuals; instructions live in a linked guide
- 2026-09-28 — changed meta-instruction: README is visuals and links; details in docs/INSTRUCTIONS.md and docs/FILE-STRUCTURE.md
- 2026-09-29 — changed meta-instruction: GitHub repo names have no "_" or "-"
- 2026-10-02 — added a DELIVERABLES field after CONTEXT
- 2026-10-02 — added meta-instruction: every project has a system design doc at docs/SYSTEM-DESIGN.md
- 2026-10-05 — added meta-instruction: applications include a settings button or tab
- 2026-10-08 — added meta-instruction: color-code tags by similarity (related share a hue family, each distinct)
- 2026-10-09 — built v1: data pipeline from the Movebank Data Repository (9 migrations), a 3D globe site with Season/Dates playback, Settings (⌘,), a feedback tab, tests, docs, and GitHub Pages deploy
- 2026-10-09 — v2: cinematic redesign (glowing trails, starfield, seasonal day/night, silhouettes, dark glass UI); follow-an-animal mode with live readout and journey profile; linked charts (migration calendar, brushable latitude chart, monthly and per-animal distance); live NASA GIBS layers (vegetation, sea temperature, snow); guided stories for all nine species; 40 tests; docs updated
- 2026-10-11 — v3: shareable links (URL hash, Share button); who-they-are filters and colour-by from study reference data; stopover detection, stopover rings, a 'Places they stayed' chart and 'staying put' in the readout; four more migrations (pronghorn, elk, white-fronted goose, Hudsonian godwit) with stories and silhouettes; palette re-optimised for 13 species; 56 tests
- 2026-10-11 — v4: compare & race (split screen, leaderboard, distance chart); human impact layers (footprint, population, night lights) plus footprint per fix in the readout and charts; guess-where game; embed mode and 12-second video export from the Share menu; 61 tests
- 2026-10-11 — v5: faster first load (overview file, on-demand species); keyboard control, spoken descriptions, reduced-motion setting, shortcuts dialog; A year on Earth guided tour; Listen to the migration (Web Audio sonification); 63 tests
- 2026-10-11 — v6: journey atlas (a small map of every animal, filter, sort, search); conditions along the route (NASA greenness or sea temperature per fix: readout, profile, monthly chart); white stork flight heights with a 3D curtain close-up; code health (app.js split into modules, 12 review fixes, browser smoke test in CI); 72 tests
- 2026-10-11 — v7: who passed near (place search or your location); wind along bird routes and 'Faster with the wind?'; 'Then vs now' migration timing by year; journey posters; four more migrations (steppe eagle, Egyptian vulture, turkey vulture, far eastern curlew); auto quality and a frame-rate meter; Spanish and French
- 2026-10-11 — v8: journey diary for every animal; barriers and crossings (seas, deserts, mountains) with a chart and globe highlight; named stopover sites; This week in migration, opening on today's date
