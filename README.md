# Track the Migration

Thirteen real animal migrations, from wildebeest, elk and pronghorn to whales, turtles, storks, geese and godwits, replayed on a living 3D globe from published tracking data. It includes guided stories, linked charts, live NASA layers, filters for who each animal is, the places they stopped, a camera that rides along with any animal, and links that open at the exact moment you share.

**[Open the live site →](https://amalmehta.github.io/TrackTheMigration/)**

![Every migration at once in Season view, late March](docs/images/all-migrations.jpg)

| Ride along with one animal | Guided stories with live NASA layers |
|---|---|
| ![Following a wildebeest across Amboseli in 3D, with a live readout and journey profile](docs/images/follow-wildebeest.jpg) | ![Blue whale story: south for winter over sea surface temperature](docs/images/story-blue-whale.jpg) |

| Where they stopped: white-fronted geese across Arctic Russia | Who they are: ospreys coloured by flyway |
|---|---|
| ![Stopover sites as rings, brighter when in use](docs/images/stopovers-goose.jpg) | ![Ospreys coloured by East, Midwest and West flyway, with a matching chart legend](docs/images/filters-osprey.jpg) |

![Linked charts: white stork latitude through the year, distance by month and per animal](docs/images/charts-white-stork.jpg)

```mermaid
flowchart LR
  MDR[(Movebank Data<br>Repository)] -->|npm run fetch| P[Clean · thin · cap]
  PP[(PhyloPic · NASA<br>Worldview)] -->|npm run assets| A[Silhouettes · legends]
  P -->|+ who · stopovers| J[site/data/*.json]
  A --> J
  J --> S[Static site<br>MapLibre globe + D3]
  G[(NASA GIBS tiles)] -->|by date| S
  S -->|GitHub Pages| You((You))
```

## Links

- [Instructions](docs/INSTRUCTIONS.md): use it, run it locally, refresh the data, add a species
- [System design](docs/SYSTEM-DESIGN.md): how it works, decisions and limits
- [File structure](docs/FILE-STRUCTURE.md): what's where
- Data: [Movebank Data Repository](https://datarepository.movebank.org) · overlays: [NASA GIBS](https://earthdata.nasa.gov/gibs) · silhouettes: [PhyloPic](https://www.phylopic.org). Every source is credited in the app.
