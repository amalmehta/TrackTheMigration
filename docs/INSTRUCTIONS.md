# Instructions

## Using the site

Open **https://amalmehta.github.io/TrackTheMigration/**.

### A year on Earth
- Press **A year on Earth** on the All migrations card, or open a link ending in `#tour=1`.
- One calendar year plays in about three minutes. Every ~18 days the camera moves to whichever migration is busiest at that time of year, dims the rest, and shows the matching part of that species' story.
- **Space** pauses. **×** leaves. At the end, **Watch again**.
- In an embed (`?embed=1#tour=1`) it loops.

### The basics
- **Each glowing dot is one tagged animal.** Its fading tail is where it went over the last month (change this in Settings).
- **Play / pause** with the round button or the space bar. Drag the slider to scrub.
- **Season vs Dates**
  - *Season* plays every year each animal was tracked over one calendar year, so you can see who moves when.
  - *Dates* replays the real calendar.
- **Pick a migration** in the left panel to fly there. **All migrations** shows every species at once.
- **Move the globe:** drag to spin, right-drag (or two-finger drag) to tilt, and scroll to zoom. Land species open tilted, so you see the 3D terrain.

### Who they are: filters and colour by
- When a study recorded who each animal is, the species card shows **Who they are**:
  - sex, age when tagged, and where it was tagged (for example the three wildebeest populations, or the ospreys' East, Midwest and West flyways)
  - for white storks, whether a bird was part of an experiment
- Click a group's chip to hide those animals, and click again to bring them back. The globe, charts and stopovers update together.
- **Colour by** gives each group its own shade of the species colour, on the globe and in the charts, with a legend.
- Zebra, mule deer, pronghorn, elk and geese don't show this section. Their reference data doesn't split the animals into groups: every collared elk and mule deer, for example, is an adult female.

### Stopovers: places they stayed
- Rings on the globe mark places where an animal stayed put. A place counts if the animal stayed within a set distance for a set time:
  - birds: within 30 km for 3 days
  - marine animals: within 40 km for 7 days
  - land animals: within 6 km for 10 days
  - bar-tailed godwits: within 150 km, because their geolocators are coarse
- Bigger rings mean more animal-days. A ring is brighter when animals use it at the current time of year.
- Hover a ring to see who used it and in which months. Click it to pick those animals.
- The **Places they stayed** chart lists the busiest sites.
- While you follow an animal, the readout says when it is *staying put*, and for how long.
- Switch stopovers off in **Layers** or Settings.

### Human footprint along the way
- For land animals and birds, every fix was matched at build time with the Human Footprint index underneath it. While you follow one, the readout shows **Human footprint here**, with that animal's median.
- The species charts include **Human footprint where they went**: the share of fixes in wild, light, moderate and heavy footprint. It's split by group, so the three wildebeest populations line up side by side.

### Share a moment, embed it, record it
- **Share** (in the time bar) opens a menu:
  - **Copy link** gives a link to exactly what you're looking at:
  - species, date and the animal you're following
  - story scene, NASA overlay, filters and camera
  - **Copy embed code** gives an `<iframe>` you can paste into a blog or slide. It shows just the globe and the clock, plays on its own, and links back to the full site. Any link with `?embed=1` works the same way.
  - **Record a 12-second video** plays the globe and saves a video file with a title, the date and the data credit. It's WebM in Chrome and Firefox, MP4 in Safari, and it's made in your browser, so nothing is uploaded.
- The address bar keeps that link up to date as you explore. A shared link opens paused at its moment; a link to a story scene plays from that scene.

### Race animals against each other
- **Shift-click** dots, from any species, to add them to a race (up to four). While following an animal you can also press **+ Race** in its readout.
- A tray lists the racers. Press **Race ▶**:
  - every racer starts on day 1, the day its own tracking began
  - a leaderboard ranks them by distance, with what each is doing ("on the move", "staying put", "tag ended")
  - a distance-over-time chart shows all of them; drag on it to scrub
- **Split screen** gives each racer its own mini-globe that follows it.
- If one track is far longer than the rest (a stork tracked for 12 years against godwits tracked for one), the race is sized to the others. **Show all days** extends it.
- **×** ends the race.

### Guess where
- **Guess where** on the All migrations card starts a 10-round game.
- Each round stops at a real moment in a real animal's journey, chosen so the animal moves a fair distance over the next 30 days.
- Tap the globe where you think it will be in 30 days, then **Lock in**. It plays forward and shows where it really went.
- You score up to 1,000 points per round. The scoring is scaled to how far the animal moved, so a godwit crossing an ocean and a wildebeest moving between pastures are equally fair.
- **Copy my score** at the end gives you a line to paste anywhere.

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
- People overlays:
  - **Human footprint**: 0 wild to 100 city, SEDAC 1995–2004
  - **Population density**: the census year nearest the animals' year, 2000–2020
  - **Night lights**: NASA Black Marble, 2012 or 2016
- A legend shows the date being displayed. If the animals' year has no NASA data (for example blue whales in the 1990s and vegetation), it shows the same season in the nearest year that has data, and says so.
- The same menu switches 3D terrain, day and night by season, glow and stars, and full routes on or off.

### Listen to the migration
- The speaker button in the time bar turns on sound. Each species is a soft voice:
  - **pitch follows how far north its animals are**, snapped to a pentatonic scale so it always sounds consonant
  - **loudness follows how fast they're moving**, judged against what's fast for that kind of animal
- Sea animals sing low with a slow whale-like vibrato, land animals sit in the middle, and birds are high.
- Spring is a rising, swelling chorus; a quiet stretch means animals are staying put.
- Volume is in Settings. Sound is off until you switch it on, and it only plays while the globe is playing.

### Keyboard and screen readers
- Everything works from the keyboard. Press **?** for the full list. The main keys:
  - **Space**: play or pause
  - **,** and **.**: step a day (**<** and **>**: a week)
  - **n** and **p**: move between the animals on screen
  - **Enter** follows the selected animal; **r** adds it to a race
  - **c**: charts · **l**: layers · **d**: describe
- **d** describes the globe in plain words: the date, how many animals are tracked, and for the most active species which way they're heading and how fast.
  - Example: "White Stork: 42 moving, mostly north, about 93 km/day."
  - While following: the animal's speed, what it's doing, how far it went in the last week and in which direction, and the human footprint there.
- The description is read out automatically when you pause, change species or start following. The map's label carries it too.
- **Motion** in Settings (Match system / Reduced / Full) turns off camera flights, pulsing and animations. Reduced motion also stops the globe from playing on open.

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

This rebuilds the tracks from the Movebank Data Repository, plus `overview.json`: a light copy of every species for the All migrations view, at most 180 points per animal, about 0.3 MB compressed. The first run downloads about 300 MB into the git-ignored `data/raw/`.
- `--refresh` re-downloads everything.
- `npm run fetch -- zebra osprey` rebuilds only those species.
- `SHOW_ABSTRACTS=1` prints each study's abstract.

Land animals and birds also get a Human Footprint value for every fix. NASA GIBS tiles are cached in `data/raw/hf/`, about 700 small PNGs on the first run.

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
   - Add `ref:` (the reference-data CSV's UUID) to get the Who-they-are filters.
   - Use `files:` instead of `file:` when a study has several tracking CSVs (for example GPS plus Argos).
   - Use `stop:` to change what counts as a stopover.
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

This runs 63 unit tests:
- the track maths, analysis helpers and sun position
- stopover detection and clustering
- the night shading and the NASA date handling
- reference-data facets and share-link parsing
- the PNG decoder and footprint sampling maths
- the people overlays' nearest-year logic
- bearings and compass words for the spoken descriptions, and the sound's pitch and loudness mapping
- the colour rules for all 13 species and the story content

See [System design → Testing](SYSTEM-DESIGN.md#testing) for what's checked by hand.

## Deploying

Every push to `main` runs the tests. If they pass, it publishes `site/` to GitHub Pages (`.github/workflows/pages.yml`). The repo's Pages source is set to **GitHub Actions**.
