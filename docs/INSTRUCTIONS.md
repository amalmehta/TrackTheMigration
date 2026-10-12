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

### Conditions along the way
- Every fix was also matched at build time with NASA's satellite record for that date: **vegetation greenness** (NDVI) under land animals, and **sea surface temperature** under whales and turtles.
- While you follow one, the readout shows **Greenness here** or **Sea temperature here** on a colour bar matching the overlay. The journey profile adds a third row with the whole trip.
- The species charts include **Greenness (or sea temperature) by month**: the typical value where the animals were, with a band for the middle half.

### Journey atlas
- **Journey atlas** on the All migrations card (or **Atlas** on a species card, or **a**) opens a small map of every tracked animal's whole journey.
- Pick a species, narrow it to a group (sex, age, where tagged) and sort by distance, time tracked, human footprint or date. Search by an animal's name or number.
- Hover a card to replay the journey; click it to fly to that animal and ride along. Cards tagged **height** have flight heights.

### This week in migration
- The All migrations card starts with **This week in migration**: which species are busiest at today's time of year (from every year each animal was tracked), how many are tracked, which way and how fast they're going and where, and who picks up next. Click a species to watch it at this time of year, or **Watch this week** for all of them. The globe also opens on today's date.

### Diary and barriers
- Following an animal, the **Diary** tab tells its journey as dated entries: first and last record, the places it stayed and for how long, the seas, deserts and mountains it crossed, its fastest day, its farthest north and south, and distance milestones. Click an entry to jump to that day. While it's crossing a barrier, the readout says so ("crossing Sahara · day 3").
- The species charts include **Barriers they crossed**: the seas, deserts and mountain ranges crossed by the most animals, with the typical time and distance. Click one to see every crossing on the globe and pick those animals.
- Stopover sites are named after the nearest town, region or sea.

### Who passed near
- **Who passed near…** on the All migrations card (or **m**). Type a town, park or coast and press **Search**, or **Use my location**, and pick a distance.
- You get every tracked animal that came that close, nearest first, with the date of its closest approach and how many other visits it made. Click one to jump to that moment and ride along (paused; press play).
- A searched place is part of the share link. Your own location is rounded to about 10 km, stays in your browser and is never put in a link. Place search uses OpenStreetMap's Nominatim.

### Wind under their wings
- For birds, every travelling step was matched with the wind 100 m above the ground at that place and hour (ERA5, via Open-Meteo).
- Following a bird, the readout shows **Wind 100 m up**: a tailwind, headwind or crosswind, and how strong. Birds without flight heights get a wind row in the journey profile: bars up for tailwind, down for headwind.
- The species charts include **Faster with the wind?**: median travel speed in each wind band, from strong headwind to strong tailwind, and the share of travel done with a tailwind.

### Then vs now
- For species that migrate far enough, the species charts include **Then vs now**: the date each animal crossed the halfway point of its range, by year and direction, against the usual date. A trend line ("days earlier per decade") appears only with enough data. Click a dot to follow that animal.

### Journey posters
- Following an animal, press the **download** button (next to + Race) to save a print-ready poster (2400 × 3200 px) of its whole journey: the route coloured from start to end, its stopovers, key numbers, its latitude through time and the data credits.

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
- The readout also shows the human footprint and the conditions there (see above).
- **Flight height** (two white storks with frequent GPS heights, 93412A and 54983B): the readout shows how high above the ground it is flying, and the profile's third row shows every in-flight reading. **See it in 3D** pauses, skips to the next flight if it's on the ground, and dives in close: its flights are drawn as walls as tall as it flew, **six times taller than life** so they're visible. **Back out** returns to the normal view.
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
  - **c**: charts · **l**: layers · **a**: atlas · **m**: who passed near · **d**: describe
- **d** describes the globe in plain words: the date, how many animals are tracked, and for the most active species which way they're heading and how fast.
  - Example: "White Stork: 42 moving, mostly north, about 93 km/day."
  - While following: the animal's speed, what it's doing, how far it went in the last week and in which direction, and the human footprint there.
- The description is read out automatically when you pause, change species or start following. The map's label carries it too.
- **Motion** in Settings (Match system / Reduced / Full) turns off camera flights, pulsing and animations. Reduced motion also stops the globe from playing on open.

### Language and performance
- The site follows your browser's language: English, Spanish (**Español**) or French (**Français**). Choose one under **Settings → Language**.
- **Settings → Quality**: on **Auto**, if the globe can't keep up it lowers detail step by step (glow, sharpness and trail length, then terrain and night shading) and tells you; it climbs back when there's headroom. **Always full detail** turns this off. **Show frame rate** adds a small meter.

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

This rebuilds the tracks from the Movebank Data Repository, plus `overview.json`: a light copy of every species for the All migrations view, at most 180 points per animal, about 0.3 MB compressed. The first run downloads about 600 MB of tracking data into the git-ignored `data/raw/`.
- `--refresh` re-downloads everything.
- `npm run fetch -- zebra osprey` rebuilds only those species.
- `SHOW_ABSTRACTS=1` prints each study's abstract.

Each fix is also matched with what's underneath it. The first run downloads about 3,100 small map tiles (about 100 MB), cached so later runs are quick:
- the Human Footprint for land animals and birds (`data/raw/hf/`)
- greenness or sea temperature for land and marine animals (`data/raw/gibs/`)
- the ground height under flying storks (`data/raw/dem/`)
- the wind along bird routes (`data/raw/wind/`, from Open-Meteo's ERA5 archive). That's about 8,000 samples; the archive's free limits mean the first run takes a few hours, and if the daily limit runs out, run it again the next day to fill the gaps.

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

## Translating

Every string is written in English in the code, wrapped in `t('…')`, and looked up in `site/js/lang/es.js` and `fr.js`.

```bash
node scripts/i18n-keys.mjs
```

This lists how many strings each language is missing. Add translations with `node scripts/i18n-add.mjs es new.json` (a JSON object of English → translation). `npm test` fails if a language misses a string, a `{placeholder}` or an HTML tag. To add a language, copy `es.js` to a new code, translate it, and add it to `LANGS` in `site/js/i18n.js` and the Language menu in `index.html`.

## Testing

```bash
npm test
```

This runs the unit tests:
- the track maths, analysis helpers and sun position
- stopover detection and clustering
- the night shading and the NASA date handling
- reference-data facets and share-link parsing
- the PNG decoder, tile pixel maths and palette or elevation decoding, and TopoJSON
- picking in-flight fixes for flight height, passes near a place, halfway crossings and trends, wind components
- that Spanish and French cover every string the site shows
- the people overlays' nearest-year logic
- bearings and compass words for the spoken descriptions, and the sound's pitch and loudness mapping
- the colour rules for all 13 species and the story content

```bash
npm run smoke
```

This serves the site and clicks through 14 flows in headless Chrome: home, a species and its charts, following with conditions, a shared stork link with flight height and the 3D close-up, a story, the atlas, the tour, who passed near, a poster, the bird charts, embed mode, Spanish, French and the phone layout. Any page error fails it. It finds Chrome itself; set `CHROME_PATH` to choose another browser.

See [System design → Testing](SYSTEM-DESIGN.md#testing) for what's checked by hand.

## Deploying

Every push to `main` runs the unit tests and the browser smoke test. If both pass, it publishes `site/` to GitHub Pages (`.github/workflows/pages.yml`). The repo's Pages source is set to **GitHub Actions**.
