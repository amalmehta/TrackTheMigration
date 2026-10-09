# Track the Migration

Real animal migrations, including wildebeest, zebra, whales, turtles, storks and godwits, replayed on a 3D globe from published GPS and satellite tracking data.

**[Open the live site →](https://amalmehta.github.io/TrackTheMigration/)**

![All nine migrations at once in Season view, late March](docs/images/all-migrations.jpg)

| Wildebeest in Kenya's Rift Valley, in 3D | Bar-tailed godwits: New Zealand → Yellow Sea → Alaska |
|---|---|
| ![Wildebeest tracks on 3D terrain](docs/images/wildebeest-3d.jpg) | ![Godwit flights across the Pacific](docs/images/godwit-pacific.jpg) |

```mermaid
flowchart LR
  MDR[(Movebank Data<br>Repository)] -->|npm run fetch| P[Clean · thin · cap]
  P --> J[site/data/*.json]
  J --> S[Static site<br>MapLibre globe]
  S -->|GitHub Pages| You((You))
```

## Links

- [Instructions](docs/INSTRUCTIONS.md): use it, run it locally, refresh the data, add a species
- [System design](docs/SYSTEM-DESIGN.md): how it works, decisions and limits
- [File structure](docs/FILE-STRUCTURE.md): what's where
- Data: [Movebank Data Repository](https://datarepository.movebank.org). Every species credits its source on the site
