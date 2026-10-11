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
//   ref           the study's reference data (sex, age, tagging site…) for filters
//   files         several tracking CSVs instead of one, as [suffix, uuid] pairs
//   stop          { km, days }: what counts as a stopover (defaults per group)

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
    ref: '62a3e43e-faa8-4e8e-83b5-93c6204bdc45',
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
    ref: '2f9f6e10-d570-4f83-bee8-98acf20ec8c2',
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
    ref: 'b7d477e8-bf33-4cd0-9f49-c9617a99b2f3',
    maxKmh: 20, thinHours: 24, maxGapHours: 24 * 5, maxAnimals: 40, maxPoints: 1100,
  },
  {
    id: 'pronghorn',
    name: 'Pronghorn',
    scientific: 'Antilocapra americana',
    group: 'land',
    region: 'Wyoming and Colorado, USA',
    blurb:
      'GPS-collared female pronghorn in the Adobe Town area of southern Wyoming and northern Colorado, a cold, dry sagebrush steppe they share with feral horses and greater sage-grouse.',
    package: '0b812dab-840b-4940-af5d-98cf2c5f9f63',
    file: '17ee83f6-d3ec-4030-94fb-e7cdbfeabc1d',
    ref: '8d182f67-c36d-4a21-bdea-7ad112020d64',
    maxKmh: 25, thinHours: 12, maxGapHours: 24 * 5, maxAnimals: 32, maxPoints: 1500,
  },
  {
    id: 'elk',
    name: 'Elk',
    scientific: 'Cervus elaphus canadensis',
    group: 'land',
    region: 'Ya Ha Tinda and Banff National Park, Canada',
    blurb:
      'Female elk from the partially migratory Ya Ha Tinda herd beside Banff National Park. Some migrate each year and others stay put, and the same elk can switch strategy from one year to the next.',
    package: 'dce434f5-0cae-45be-8847-e45b61833bf0',
    file: '80b6ef22-316f-41f0-9348-bd5ee6022122',
    ref: '0de1eb11-68a0-4558-9b8f-9b8c95bd11c2',
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
    ref: 'c4ddbb3c-b643-4cd3-b424-9c3da17a5c8b',
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
    ref: 'b1e098cf-cafa-447e-9338-9079b093fbd5',
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
    ref: 'c4f0b173-24f3-482f-82d2-a446290df6b5',
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
    ref: '4076248b-11f8-4e2c-8e3c-4187e1f8b68b',
    argosClasses: ARGOS_GOOD,
    maxKmh: 80, thinHours: 12, maxGapHours: 24 * 10, maxAnimals: 40, maxPoints: 1200,
  },
  {
    id: 'white-fronted-goose',
    name: 'White-fronted Goose',
    scientific: 'Anser albifrons',
    group: 'birds',
    region: 'Netherlands to the Russian Arctic',
    blurb:
      'Greater white-fronted geese followed by GPS and satellite tags from their wintering grounds in the Netherlands to breeding grounds in the Russian Arctic, and back.',
    package: '9daa9707-6b70-4419-8693-108af8e0a1eb',
    files: [['', '04f98922-2294-4476-93c0-55a35c0a1d03'], ['-argos', 'cf2ad987-30ba-4ce3-87db-ffaf47cff0d3']],
    ref: 'bb9f4dc5-0078-43ee-911a-f09b89c1c199',
    argosClasses: ARGOS_GOOD,
    maxKmh: 100, thinHours: 6, maxGapHours: 24 * 10, maxAnimals: 40, maxPoints: 1500,
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
    ref: '70e42159-a168-4a13-b069-7d903e8d5ee4',
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
    ref: '600b3d48-6600-4605-9964-cb0ba2c9e465',
    stopovers: true, minPoints: 4, stop: { km: 150, days: 3 },
    maxKmh: 120, thinHours: 0, maxGapHours: 24 * 60, maxAnimals: 40, maxPoints: 800,
  },
  {
    id: 'hudsonian-godwit',
    name: 'Hudsonian Godwit',
    scientific: 'Limosa haemastica',
    group: 'birds',
    region: 'Chiloé, Chile to the Gulf of Mexico',
    blurb:
      'Hudsonian godwits from Chiloé Island, Chile, satellite-tracked on their northward migration: a days-long flight across more than 7,000 km, mostly over open ocean, to the Gulf of Mexico.',
    package: '30ef281e-0af2-46b2-8d86-3b5f281c6b3c',
    files: [['', '75f1d579-dc16-45b1-9135-cc62a419ac74'], ['-argos', '9264d088-0467-4be2-b6da-5618f9560253']],
    ref: '024f37a9-d1f9-45ac-b915-eb8489058663',
    argosClasses: ARGOS_GOOD,
    maxKmh: 120, thinHours: 6, maxGapHours: 24 * 10, maxAnimals: 25, maxPoints: 1500,
  },
];

export const GROUPS = {
  land: 'Land mammals',
  marine: 'Marine animals',
  birds: 'Birds',
};
