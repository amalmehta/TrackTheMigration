// The migrations shown on the site. Every source is a published data package
// in the Movebank Data Repository (https://datarepository.movebank.org).
// `package` is the repository item; `file` is the tracking CSV inside it.
// Citation, licence and DOI are read from the repository at fetch time.
//
// Processing knobs:
//   maxKmh        drop fixes implying a faster speed than this (outliers)
//   thinHours     keep at most one fix per this many hours
//   maxGapHours   don't interpolate across gaps longer than this
//   maxAnimals    keep this many animals (the longest-tracked ones)
//   maxPoints     cap per animal after thinning
//   argosClasses  accepted Argos location classes ("" = GPS / unclassed)
//   stopovers     rows are stopover sites with an end-timestamp; the animal is
//                 placed there from arrival to departure (geolocator summaries)
//   minPoints     drop animals with fewer points than this (default 10)

const ARGOS_GOOD = ['3', '2', '1', 'A', 'G', ''];

export const DATASETS = [
  {
    id: 'wildebeest',
    name: 'Wildebeest',
    scientific: 'Connochaetes taurinus',
    group: 'land',
    region: 'Southern Kenya: Mara, Athi-Kaputiei and Amboseli',
    blurb:
      'White-bearded wildebeest from three Kenyan populations fitted with GPS collars to compare how far and how directly each one moves across grasslands crossed by roads, fences and towns.',
    package: '5b6706c8-e7e5-46e4-82ba-da5a82324298',
    file: '1ff949f2-3df4-45fb-ac16-bbf1ddf32108',
    maxKmh: 20, thinHours: 12, maxGapHours: 24 * 5, maxAnimals: 30, maxPoints: 1500,
  },
  {
    id: 'zebra',
    name: 'Plains Zebra',
    scientific: 'Equus quagga (burchellii)',
    group: 'land',
    region: 'Northern Botswana: Okavango Delta to Makgadikgadi',
    blurb:
      "Burchell's zebra crossing between the Okavango Delta and the Makgadikgadi grasslands as the rains arrive.",
    package: 'c9b4f9b5-875a-4b61-a5d6-c2e59ffe0aca',
    file: '9672ab98-93db-4943-bbb0-ef1a9435545d',
    maxKmh: 20, thinHours: 6, maxGapHours: 24 * 5, maxAnimals: 30, maxPoints: 1500,
  },
  {
    id: 'mule-deer',
    name: 'Mule Deer',
    scientific: 'Odocoileus hemionus',
    group: 'land',
    region: 'Western Wyoming, USA',
    blurb:
      'GPS-collared mule deer from the Sublette herd, moving each spring and autumn between low sagebrush winter range and mountain summer range.',
    package: '0e3a4577-b063-47d9-9d6b-edec949aa5fa',
    file: 'de7b956a-f5b6-4727-a2cc-a119a1217a68',
    maxKmh: 20, thinHours: 24, maxGapHours: 24 * 5, maxAnimals: 40, maxPoints: 1100,
  },
  {
    id: 'blue-whale',
    name: 'Blue Whale',
    scientific: 'Balaenoptera musculus',
    group: 'marine',
    region: 'Eastern North Pacific: California to the Costa Rica Dome',
    blurb:
      'Argos-tagged blue whales off California heading south in winter to Baja California and the Costa Rica Dome, then north again to feed.',
    package: 'b7853a1e-43fc-483d-906a-6991ec676413',
    file: 'bab61b80-771a-4568-bfb4-41ff356ee8c6',
    argosClasses: ARGOS_GOOD,
    maxKmh: 15, thinHours: 12, maxGapHours: 24 * 10, maxAnimals: 40, maxPoints: 800,
  },
  {
    id: 'humpback-whale',
    name: 'Humpback Whale',
    scientific: 'Megaptera novaeangliae',
    group: 'marine',
    region: "Australia's east coast to the Southern Ocean",
    blurb:
      'East Australian humpbacks tagged on their southward and northward migrations and on Antarctic feeding grounds.',
    package: '7fb8ee56-cb2d-4c4c-9456-166fc8e3ee6d',
    file: 'aca1254b-7574-4677-a4d0-5fc23415859f',
    argosClasses: ARGOS_GOOD,
    maxKmh: 15, thinHours: 12, maxGapHours: 24 * 10, maxAnimals: 40, maxPoints: 800,
  },
  {
    id: 'loggerhead-turtle',
    name: 'Loggerhead Turtle',
    scientific: 'Caretta caretta',
    group: 'marine',
    region: 'Japan and the North Pacific',
    blurb:
      'Female loggerheads leaving their nesting beaches in Japan for feeding grounds in the East China Sea and the open North Pacific.',
    package: '0a818ffd-e318-4c56-9cba-3ee578bb7a88',
    file: '7045a29d-6034-43ff-8ec8-7ce46c736691',
    argosClasses: ARGOS_GOOD,
    maxKmh: 10, thinHours: 12, maxGapHours: 24 * 10, maxAnimals: 40, maxPoints: 800,
  },
  {
    id: 'white-stork',
    name: 'White Stork',
    scientific: 'Ciconia ciconia',
    group: 'birds',
    region: 'Europe and the Middle East to Africa',
    blurb:
      'Satellite-tracked white storks from nine countries, some followed for a decade, flying to Africa by the western route over Gibraltar or the eastern route over the Bosphorus and Israel.',
    package: 'aae5d565-fd19-4fd4-8e2c-b6b5ca88ac5a',
    file: 'f0147626-8366-4b23-9a55-b2a76e75acbc',
    argosClasses: ARGOS_GOOD,
    maxKmh: 80, thinHours: 12, maxGapHours: 24 * 10, maxAnimals: 40, maxPoints: 1200,
  },
  {
    id: 'osprey',
    name: 'Osprey',
    scientific: 'Pandion haliaetus',
    group: 'birds',
    region: 'North America to South America',
    blurb:
      'Ospreys from Oregon–Washington, Minnesota, New York and New Jersey tracked by satellite to wintering grounds from Mexico to Brazil.',
    package: '9524d3fd-efe6-402f-afcf-9916ab3a49ac',
    file: 'd9c00b17-8072-41a1-a44c-1e7612ce9405',
    argosClasses: ARGOS_GOOD,
    maxKmh: 80, thinHours: 12, maxGapHours: 24 * 10, maxAnimals: 40, maxPoints: 1200,
  },
  {
    id: 'bar-tailed-godwit',
    name: 'Bar-tailed Godwit',
    scientific: 'Limosa lapponica',
    group: 'birds',
    region: 'New Zealand, the Yellow Sea and Alaska',
    blurb:
      'Light-level geolocator tracks of godwits from New Zealand: north via the Yellow Sea to Alaska, then a non-stop flight across the Pacific home. Only stopover sites are known, so flights are drawn as straight lines.',
    package: 'ecb87f98-e535-4b7f-9ea1-7b1e3f2edb2a',
    file: 'c1908560-b8b8-4fc4-8b76-d2fbbf7beee9',
    stopovers: true, minPoints: 4,
    maxKmh: 120, thinHours: 0, maxGapHours: 24 * 60, maxAnimals: 40, maxPoints: 800,
  },
];

export const GROUPS = {
  land: 'Land mammals',
  marine: 'Marine animals',
  birds: 'Birds',
};
