# Instructions

## Using the site

Open **https://amalmehta.github.io/TrackTheMigration/**.

### The basics
- **Each glowing dot is one tagged animal.** Its fading tail is where it went over the last month (change this in Settings).
- **Play / pause** with the round button or the space bar. Drag the slider to scrub.
- **Season vs Dates**
  - *Season* plays every year each animal was tracked over one calendar year, so you can see who moves when.
  - *Dates* replays the real calendar.
- **Pick a migration** in the left panel to fly there. **All migrations** shows every species at once.
- **Move the globe:** drag to spin, right-drag (or two-finger drag) to tilt, and scroll to zoom. Land species open tilted, so you see the 3D terrain.

### Ride along with an animal
- Click any dot or route, or **Follow the farthest** on a species card. The camera follows that animal.
- A readout shows:
  - the date and its speed over the last day
  - how far it has travelled so far
  - which day of its tracking this is
  - the ground height under it (land animals with 3D terrain on), or its distance from where it started
- The **journey profile** under the readout has two small charts of the whole trip: latitude (or longitude) and speed. Hover for values, or click and drag on it to scrub through time.
- Dragging the map pauses the ride. **Recentre** picks it back up. **Esc** or **×** stops following.

### Stories
- Each species card has **Tell me the story**: four to six scenes that move the camera, set the season and switch on the right NASA layer.
- The text comes from the published study behind each dataset. Numbers in bold are computed from the tracks on screen.
- **← / →** move between scenes and **Esc** exits. The last scene always rides along with the animal that went farthest.

### Charts
- Open them with **Charts** in the time bar, or the button on a card.
- **All migrations** shows a *migration calendar*: how far each species moves in each half-month, with each row scaled to its own busiest fortnight.
  - Click a row to open that species.
  - Click a cell to jump to that time of year.
- **One species** shows three linked charts:
  - **Latitude (or longitude) through the year**, one line per animal-year. Drag a box to pick animals; the globe dims the rest, and **Clear selection** undoes it. Click a line to follow that animal.
  - **Distance per day by month.** The current month is highlighted.
  - **How far each animal went.** Click a bar to follow that animal.
- **Table** switches any view to the same numbers as a table.

### Layers and live NASA overlays
- The **Layers** button (top right) switches between satellite and street maps.
- It also offers an overlay from NASA that changes with the playback date:
  - **Vegetation greenness**: NDVI, monthly, 2000 onward
  - **Sea surface temperature**: daily, 1981–2020
  - **Snow cover**: monthly, 2000 onward
- A legend shows the date being displayed. If the animals' year has no NASA data (for example blue whales in the 1990s and vegetation), it shows the same season in the nearest year that has data, and says so.
- The same menu switches 3D terrain, day and night by season, glow and stars, and full routes on or off.

### Settings and feedback
- **Settings** is the gear button, or **⌘,** (Ctrl+, on Windows/Linux). Every preference is in one place:
  - theme (dark by default), base map, NASA overlay, terrain and its height, day/night, glow effects
  - full routes, trail length, km or miles
  - start mode, speed, autoplay
- Settings are saved in your browser.
- **Feedback** is the small tab on the right edge. It opens a pre-filled GitHub issue in a new tab; nothing is sent until you submit it there.

## Running it locally

Needs Node 20 or newer. There are no dependencies to install.

```bash
npm run serve
```

Then open http://localhost:8080. `node scripts/serve.mjs 3000` picks another port.

## Refreshing the data

Everything in `site/data/` and `site/icons/` is committed, so the site works without these steps.

```bash
npm run fetch
```

This rebuilds the tracks from the Movebank Data Repository. The first run downloads about 300 MB into the git-ignored `data/raw/`.
- `--refresh` re-downloads everything.
- `npm run fetch -- zebra osprey` rebuilds only those species.
- `SHOW_ABSTRACTS=1` prints each study's abstract.

```bash
npm run assets
```

This re-downloads the PhyloPic silhouettes with their credits, and rebuilds the NASA overlay legends from NASA Worldview's palettes.

## Adding a species

1. Find a published data package in the [Movebank Data Repository](https://datarepository.movebank.org) with an open licence (CC0 or CC BY).
2. Get its item UUID and the tracking CSV's bitstream UUID:

   ```bash
   curl -s "https://datarepository.movebank.org/server/api/core/items/<package-uuid>?embed=bundles/bitstreams"
   ```

3. Add an entry to `scripts/datasets.mjs`. Copy a similar species and adjust the speed limit, thinning and caps.
4. Add its colour to `site/js/palette.js`, in its group's hue family.
5. Pick a silhouette on [PhyloPic](https://www.phylopic.org) (CC0, public domain or CC BY) and add its UUID to `SILHOUETTES` in `scripts/fetch-assets.mjs`.
6. Write its story in `site/js/stories.js`. Use only facts from the study's abstract (`SHOW_ABSTRACTS=1 npm run fetch -- <id>`) or `{placeholders}` computed from the data.
7. Run `npm run fetch -- <id>`, `npm run assets`, then `npm test`. The tests fail if:
   - the colour is too close to another species, or outside its family's hue range
   - the story is missing or malformed

## Testing

```bash
npm test
```

This runs 40 unit tests:
- the track maths, analysis helpers and sun position
- the night shading and the NASA date handling
- the colour rules and the story content

See [System design → Testing](SYSTEM-DESIGN.md#testing) for what's checked by hand.

## Deploying

Every push to `main` runs the tests. If they pass, it publishes `site/` to GitHub Pages (`.github/workflows/pages.yml`). The repo's Pages source is set to **GitHub Actions**.
