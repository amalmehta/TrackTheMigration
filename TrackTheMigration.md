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
