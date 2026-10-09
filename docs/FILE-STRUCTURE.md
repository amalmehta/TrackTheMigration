# File Structure

```
TrackTheMigration/
├── README.md                  At-a-glance: what it is, screenshots, links
├── TrackTheMigration.md       The project brief, assumptions and changelog
├── package.json               npm scripts: fetch, assets, test, serve (no dependencies)
├── .gitignore                 Ignores data/raw/, node_modules, .claude/
├── .github/workflows/
│   └── pages.yml              Test, then deploy site/ to GitHub Pages
│
├── site/                      Everything that is published
│   ├── index.html             Page shell: panel, time bar, layers menu, legend, follow
│   │                          readout, story card, charts drawer, Settings and Feedback
│   ├── styles.css             Theme tokens (dark default + light), glass UI, phone layout
│   ├── icons/<species>.svg    PhyloPic silhouettes (credits in data/assets.json)
│   ├── js/
│   │   ├── app.js             Wiring: clock, selection, panel, layers menu, legend, starfield
│   │   ├── store.js           Shared state, event bus, data loading, formatting
│   │   ├── globe.js           Map, terrain, night, NASA overlays, trails/heads, camera
│   │   ├── follow.js          Ride-along camera, readout, journey profile
│   │   ├── charts.js          Migration calendar, linked species charts, brush, tables
│   │   ├── story.js           Story player
│   │   ├── stories.js         Story content (scenes per species)
│   │   ├── tracks.js          Track maths and analysis (shared with the scripts)
│   │   ├── solar.js           Sun position and night shading
│   │   ├── environment.js     NASA GIBS overlay definitions and date logic
│   │   ├── palette.js         Species colours by hue family
│   │   └── settings.js        Preferences, Settings dialog, ⌘, shortcut
│   └── data/
│       ├── index.json         Species list, stats, citations, licences
│       ├── assets.json        Silhouette credits, overlay legend colours
│       └── <species>.json     Processed tracks, one file per migration
│
├── scripts/
│   ├── datasets.mjs           Which data packages to use and how to clean each
│   ├── fetch-data.mjs         Download, clean, thin and write site/data/
│   ├── fetch-assets.mjs       Silhouettes (PhyloPic) and overlay legends (NASA Worldview)
│   └── serve.mjs              Local static server
│
├── tests/
│   ├── tracks.test.mjs        Track maths
│   ├── analysis.test.mjs      Analysis helpers, sun and night, NASA dates
│   ├── palette.test.mjs       Colour families and distinctness
│   └── stories.test.mjs       Story structure and coverage
│
├── docs/
│   ├── INSTRUCTIONS.md        Use, run, refresh data, add a species, deploy
│   ├── SYSTEM-DESIGN.md       Architecture, flows, decisions, testing, limits
│   ├── FILE-STRUCTURE.md      This file
│   └── images/                README screenshots
│
└── data/raw/                  (git-ignored) Downloaded CSVs and metadata cache
```
