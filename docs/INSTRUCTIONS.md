# Instructions

## Using the site

Open **https://amalmehta.github.io/TrackTheMigration/**.

- **Pick a migration** in the left panel to fly there. **All migrations** shows every species at once.
- **Each dot is one tagged animal.** The tail behind it is where it went over the last month (change this in Settings).
- **Play / pause** with the round button or the space bar. Drag the slider to scrub.
- **Season vs Dates**
  - *Season* lays every year each animal was tracked over one calendar year, so you can see who moves when: storks leave Africa in March, blue whales head south in winter, godwits leave New Zealand in March.
  - *Dates* replays the real calendar from the first fix to the last.
- **Click a dot or a route** to highlight that one animal and see how far it went.
- **Drag** to spin the globe, **right-drag** (or two-finger drag) to tilt, and scroll to zoom. Land species open tilted, so you see the terrain.
- **Settings**: the gear button, or **⌘,** (Ctrl+, on Windows/Linux). Settings cover theme, satellite or street map, 3D terrain and its height, full routes on or off, trail length, km or miles, start mode, speed, and autoplay. They're saved in your browser.
- **Feedback**: the small tab on the right edge. It opens a pre-filled GitHub issue in a new tab; nothing is sent until you submit it there.
- Each species card shows the **data citation, DOI and licence**. Please cite the original authors if you reuse the data.

## Running it locally

Needs Node 20 or newer. There are no dependencies to install.

```bash
npm run serve
```

Then open http://localhost:8080. `node scripts/serve.mjs 3000` picks another port.

## Refreshing or rebuilding the data

The processed tracks in `site/data/` are committed, so the site works without this step. To rebuild them from the source packages:

```bash
npm run fetch
```

- The first run downloads about 300 MB of CSVs into `data/raw/`, which is git-ignored. Later runs reuse that cache.
- `npm run fetch -- --refresh` re-downloads everything.
- `npm run fetch -- zebra osprey` rebuilds only those species.
- Set `SHOW_ABSTRACTS=1` to print each study's abstract. This is useful for checking the one-line descriptions.

## Adding a species

1. Find a published data package in the [Movebank Data Repository](https://datarepository.movebank.org) with an open licence (CC0 or CC BY).
2. Get its item UUID and the tracking CSV's bitstream UUID:

   ```bash
   curl -s "https://datarepository.movebank.org/server/api/core/items/<package-uuid>?embed=bundles/bitstreams"
   ```

3. Add an entry to `scripts/datasets.mjs`. Copy a similar species and adjust the speed limit, thinning and caps.
4. Add its colour to `site/js/palette.js`, in its group's hue family.
5. Run `npm run fetch -- <id>` and then `npm test`. The palette test fails if the new colour is too close to another species, or outside its family's hue range.

## Testing

```bash
npm test
```

This runs unit tests for the track maths (`tests/tracks.test.mjs`) and the colour rules (`tests/palette.test.mjs`). See [System design → Testing](SYSTEM-DESIGN.md#testing) for what's checked by hand.

## Deploying

Every push to `main` runs the tests. If they pass, it publishes `site/` to GitHub Pages (`.github/workflows/pages.yml`). Pages must be set to **Source: GitHub Actions** in the repo settings. The repo was created with this setting.
