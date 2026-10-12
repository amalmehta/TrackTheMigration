# File Structure

```
TrackTheMigration/
├── README.md                  At-a-glance: what it is, screenshots, links
├── TrackTheMigration.md       The project brief, assumptions and changelog
├── package.json               npm scripts: fetch, assets, test, smoke, serve (no dependencies)
├── .gitignore                 Ignores data/raw/, node_modules, .claude/
├── .github/workflows/
│   └── pages.yml              Unit tests + browser smoke test, then deploy site/ to GitHub Pages
│
├── site/                      Everything that is published
│   ├── index.html             Page shell: panel, time bar, layers menu, legend, follow
│   │                          readout, story card, charts drawer, atlas, Settings and Feedback
│   ├── styles.css             Theme tokens (dark default + light), glass UI, phone layout
│   ├── icons/<species>.svg    PhyloPic silhouettes (credits in data/assets.json)
│   ├── js/
│   │   ├── app.js             Wiring: clock, selection, settings changes, startup
│   │   ├── panel.js           Species list, info card, who-they-are filters
│   │   ├── layers.js          Layers popover and overlay legend
│   │   ├── map-input.js       Clicks and hover tips on the globe
│   │   ├── sharing.js         Address-bar link, Share menu, embed mode, video recording
│   │   ├── ui.js              Toast, icons, feedback tab, starfield
│   │   ├── atlas.js           Journey atlas: a small map per animal
│   │   ├── near.js            Who passed near a place
│   │   ├── poster.js          Print-ready journey posters
│   │   ├── diary.js           The Diary tab and place-name formatting
│   │   ├── thisweek.js        This week in migration
│   │   ├── perf.js            Auto quality and the frame-rate meter
│   │   ├── land.js            Land outline shared by the atlas and posters
│   │   ├── i18n.js            Languages: t(), dates and numbers, page translation
│   │   ├── lang/es.js, fr.js  Spanish and French, keyed by the English text
│   │   ├── store.js           Shared state, event bus, data loading, formatting
│   │   ├── globe.js           Map, terrain, night, NASA overlays, trails/heads, camera
│   │   ├── follow.js          Ride-along camera, readout, journey profile, 3D flight close-up
│   │   ├── charts.js          Migration calendar, linked species charts, brush, tables
│   │   ├── share.js           Share links: view ↔ URL hash
│   │   ├── race.js            Compare tray, races, leaderboard, split screen
│   │   ├── game.js            Guess where
│   │   ├── record.js          Record a short video of the globe
│   │   ├── a11y.js            Keyboard control and spoken descriptions
│   │   ├── tour.js            A year on Earth
│   │   ├── sound.js           Listen to the migration (Web Audio)
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
│       ├── overview.json      Light copy of every species for the All view and the atlas
│       ├── land.json          Land outline for the atlas maps
│       └── <species>.json     Tracks, who-each-animal-is, stops, stopover sites, footprint,
│                              conditions and flight heights per migration
│
├── scripts/
│   ├── datasets.mjs           Which data packages to use and how to clean each
│   ├── fetch-data.mjs         Download, clean, thin and write site/data/
│   ├── fetch-assets.mjs       Silhouettes (PhyloPic) and overlay legends (NASA Worldview)
│   ├── reference.mjs          Who each animal is: reference data → filter facets
│   ├── tiles.mjs              Read values out of map tiles (fetch, cache, decode)
│   ├── footprint.mjs          Human Footprint under every fix (NASA GIBS tiles)
│   ├── conditions.mjs         Greenness / sea temperature under every fix (NASA GIBS)
│   ├── elevation.mjs          Ground height under flying birds (Terrain Tiles)
│   ├── wind.mjs               Wind 100 m up along bird routes (Open-Meteo ERA5)
│   ├── places.mjs             Place names from Natural Earth (offline gazetteer)
│   ├── barriers.mjs           Sea, desert and mountain crossings
│   ├── diary.mjs              Each animal's journey diary
│   ├── seasons.mjs            This week in migration, per half-month
│   ├── i18n-keys.mjs          Every string to translate; what each language misses
│   ├── i18n-add.mjs           Add or update translations
│   ├── topojson.mjs           TopoJSON → rings, for the land outline
│   ├── png.mjs                Small PNG decoder for those tiles
│   ├── smoke.mjs              Browser smoke test (headless Chrome, no dependencies)
│   └── serve.mjs              Local static server
│
├── tests/
│   ├── tracks.test.mjs        Track maths
│   ├── analysis.test.mjs      Analysis helpers, stopovers, sun and night, NASA dates
│   ├── palette.test.mjs       Colour families and distinctness
│   ├── stories.test.mjs       Story structure and coverage
│   ├── reference.test.mjs     Facets from reference data
│   ├── share.test.mjs         Share-link decoding, month ranges
│   ├── png.test.mjs           PNG decoding, footprint pixel maths
│   ├── tiles.test.mjs         Tile pixel maths and decoders
│   ├── wind.test.mjs          Tailwind maths and travel steps
│   ├── barriers.test.mjs      Point in polygon, track sampling, crossings
│   ├── diary.test.mjs         Fastest day, milestones, diary order
│   ├── i18n.test.mjs          Spanish and French cover every string
│   └── topojson.test.mjs      TopoJSON decoding
│
├── docs/
│   ├── INSTRUCTIONS.md        Use, run, refresh data, add a species, deploy
│   ├── SYSTEM-DESIGN.md       Architecture, flows, decisions, testing, limits
│   ├── FILE-STRUCTURE.md      This file
│   └── images/                README screenshots
│
└── data/raw/                  (git-ignored) Downloaded CSVs, metadata and caches (hf, gibs, dem tiles; wind; Natural Earth in ne/)
```
