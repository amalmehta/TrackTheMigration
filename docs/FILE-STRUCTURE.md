# File Structure

```
TrackTheMigration/
├── README.md                  At-a-glance: what it is, screenshots, links
├── TrackTheMigration.md       The project brief, assumptions and changelog
├── package.json               npm scripts: fetch, test, serve (no dependencies)
├── .gitignore                 Ignores data/raw/, node_modules, .claude/
├── .github/workflows/
│   └── pages.yml              Test, then deploy site/ to GitHub Pages
│
├── site/                      Everything that is published
│   ├── index.html             Page shell: panel, time bar, Settings and Feedback dialogs
│   ├── styles.css             Theme tokens (light and dark), layout, phone layout
│   ├── js/
│   │   ├── app.js             Map, layers, species list, info card, playback, camera
│   │   ├── tracks.js          Track maths shared with the data script
│   │   ├── palette.js         Species colours by hue family
│   │   └── settings.js        Preferences, Settings dialog, ⌘, shortcut
│   └── data/
│       ├── index.json         Species list, stats, citations, licences
│       └── <species>.json     Processed tracks, one file per migration
│
├── scripts/
│   ├── datasets.mjs           Which data packages to use and how to clean each
│   ├── fetch-data.mjs         Download, clean, thin and write site/data/
│   └── serve.mjs              Local static server
│
├── tests/
│   ├── tracks.test.mjs        Track maths
│   └── palette.test.mjs       Colour families and distinctness
│
├── docs/
│   ├── INSTRUCTIONS.md        Use, run, refresh data, add a species, deploy
│   ├── SYSTEM-DESIGN.md       Architecture, flows, decisions, testing, limits
│   ├── FILE-STRUCTURE.md      This file
│   └── images/                README screenshots
│
└── data/raw/                  (git-ignored) Downloaded CSVs and metadata cache
```
