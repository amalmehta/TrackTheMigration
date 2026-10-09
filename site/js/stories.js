// Guided stories, one per migration. Every claim comes from the study behind
// the data (print the abstracts with SHOW_ABSTRACTS=1 npm run fetch) or is
// computed from the tracks on screen ({placeholders} are filled in live).
//
// Scene fields:
//   title, text      what the card says
//   at               'MM-DD' in Season view (default), or { date: 'YYYY-MM-DD' } for real dates
//   view             'species' (whole range), 'heads' (wherever the animals are at `at`),
//                    or a camera { center, zoom, pitch, bearing }
//   speed            playback days per second during the scene
//   overlay          a NASA overlay to show during the scene (vegetation | sst | snow)
//   follow           'longest' — ride along with the animal that went furthest

export const STORIES = {
  wildebeest: {
    title: 'Room to roam',
    scenes: [
      {
        title: 'Three herds, one question',
        text: 'Researchers fitted GPS collars to 36 white-bearded wildebeest in three parts of southern Kenya, to measure how far they move and what holds them back. You are watching {animals} of them.',
        view: 'species', at: '03-01', speed: 3,
      },
      {
        title: 'Amboseli: far and free',
        text: 'The Amboseli Basin is dry, with little grass, but few people. Here wildebeest moved the most: about 21 km a day. Food is scarce, so they had to roam, and little stood in their way.',
        view: { center: [37.27, -2.62], zoom: 9.3, pitch: 60, bearing: -25 }, at: '08-01', speed: 3,
      },
      {
        title: 'Athi-Kaputiei: hemmed in',
        text: 'Just south of Nairobi the grass is better, but roads, fences and spreading settlements cut across the plains. Wildebeest here moved the least, about 13 km a day, and less directly than the other herds.',
        view: { center: [36.95, -1.62], zoom: 9.6, pitch: 60, bearing: 20 }, at: '08-01', speed: 3,
      },
      {
        title: 'The Mara: green and in between',
        text: 'The Mara is the greenest of the three, with a moderate human footprint. Daily movement was in between, about 14 km a day. The vegetation overlay shows how green each landscape is this month.',
        view: { center: [35.3, -1.33], zoom: 9.3, pitch: 60, bearing: -10 }, at: '02-01', speed: 3, overlay: 'vegetation',
      },
      {
        title: 'Life outside the parks',
        text: 'All three herds made heavy use of grassland outside protected areas, so unprotected land matters for keeping these animals moving. Next: the animal that covered the most ground here, {longestId}, with {longestKm} tracked.',
        view: 'species', at: '06-01', speed: 3, follow: 'longest',
      },
    ],
  },

  zebra: {
    title: 'Following the rain',
    scenes: [
      {
        title: 'Seven zebras, two seasons',
        text: 'GPS collars followed seven Burchell’s zebras in northern Botswana as they moved between their dry-season and rainy-season ranges, {years}.',
        view: 'species', at: '10-15', speed: 4,
      },
      {
        title: 'Waiting for the rain',
        text: 'The overlay shows vegetation greenness. The model that best explained these migrations used rainfall to predict when each zebra would leave.',
        view: 'species', at: '11-01', speed: 3, overlay: 'vegetation',
      },
      {
        title: 'Pace set by rain and green',
        text: 'Once on the move, each day’s distance tracked the rain and the greenness of the land. Together these replicated the timing and pace of all seven migrations closely (R² = 0.914).',
        view: 'heads', at: '12-15', speed: 3, overlay: 'vegetation',
      },
      {
        title: 'Ready to turn back',
        text: 'Zebras adjust quickly: they can reverse a migration to avoid bad conditions, or to return when food comes back. The researchers suggest this nomadic streak may help them cope with a changing climate.',
        view: 'species', at: '03-15', speed: 4,
      },
      {
        title: 'Ride along',
        text: 'Follow {longestId}, which covered {longestKm} in the tracks shown.',
        view: 'species', at: '10-15', speed: 4, follow: 'longest',
      },
    ],
  },

  'mule-deer': {
    title: 'Up the mountain and back',
    scenes: [
      {
        title: 'The Sublette herd',
        text: '{animals} GPS-collared mule deer in western Wyoming, {years}. Every dot is a deer; the tail shows its last month.',
        view: 'species', at: '01-15', speed: 5,
      },
      {
        title: 'Winter: gathered in the south',
        text: 'In mid-winter the collared deer gather in the south-east of their range. The overlay shows how many days of the month each place had snow.',
        view: 'heads', at: '01-20', speed: 3, overlay: 'snow',
      },
      {
        title: 'Spring: the long walk north-west',
        text: 'In spring the herd strings out along narrow corridors, heading north-west towards the mountains. Switch on 3D terrain in Settings if it\u2019s off, and watch the ground rise.',
        view: 'species', at: '05-01', speed: 4,
      },
      {
        title: 'Summer: spread through the mountains',
        text: 'By midsummer the herd’s centre has shifted about 150 km north-west of its winter range. Watch them head back as autumn comes.',
        view: 'heads', at: '07-01', speed: 5,
      },
      {
        title: 'One deer’s year',
        text: 'Follow {longestId}, which covered {longestKm} in the tracks shown. The readout shows the ground height under it.',
        view: 'species', at: '04-01', speed: 4, follow: 'longest',
      },
    ],
  },

  'blue-whale': {
    title: 'The biggest animal, on the move',
    scenes: [
      {
        title: 'Tagging giants',
        text: 'Between 1993 and 2007, satellite tags were attached to 159 blue whales, mostly off California in late summer. {animals} of the longest tracks are shown.',
        view: 'heads', at: '09-01', speed: 5,
      },
      {
        title: 'South for winter',
        text: 'In winter the whales generally moved south, to Baja California and to an area west of the Costa Rica Dome in the eastern tropical Pacific. The overlay shows sea surface temperature.',
        view: 'species', at: '01-15', speed: 5, overlay: 'sst',
      },
      {
        title: 'Travelling vs searching',
        text: 'A model split each track into fast travel (about 3.7 km/h on average) and slow, looping searches for food (about 1.05 km/h). Searching took 29% of their time, with each patch lasting about 21 days on average.',
        view: 'species', at: '03-15', speed: 4,
      },
      {
        title: 'Feeding all year?',
        text: 'They searched like this throughout the migration cycle, so these whales may feed year-round. How far north they returned, from Baja California to Washington, changed from year to year, probably with their prey.',
        view: 'species', at: '06-15', speed: 5, overlay: 'sst',
      },
      {
        title: 'The long haul',
        text: 'Follow {longestId}, whose tag tracked it for {longestKm}.',
        view: 'species', at: '08-15', speed: 6, follow: 'longest',
      },
    ],
  },

  'humpback-whale': {
    title: 'From the reef to the ice',
    scenes: [
      {
        title: 'Fifty tags',
        text: 'Between 2008 and 2010, satellite tags went on 50 east Australian humpbacks: on their way south, on their way north, and on their Antarctic feeding grounds.',
        view: 'species', at: '07-15', speed: 5,
      },
      {
        title: 'July: as far north as they go',
        text: 'The whales reach their northern limit in July, off Australia’s east coast, near their breeding grounds.',
        view: 'heads', at: '07-20', speed: 3,
      },
      {
        title: 'November–December: heading south fast',
        text: 'The southward migration is fastest in November and December. Not all went straight south: five whales first travelled west towards New Zealand.',
        view: 'species', at: '11-15', speed: 4, overlay: 'sst',
      },
      {
        title: 'March: the Antarctic',
        text: 'They reach their southern limit in March. Eleven tagged whales were tracked all the way to their Antarctic feeding grounds, along routes no one had mapped before.',
        view: 'heads', at: '03-10', speed: 3, overlay: 'sst',
      },
      {
        title: 'May–June: north again',
        text: 'The northward migration is fastest in May and June. Follow {longestId}, tracked for {longestKm}.',
        view: 'species', at: '05-01', speed: 5, follow: 'longest',
      },
    ],
  },

  'loggerhead-turtle': {
    title: 'Two ways to make a living',
    scenes: [
      {
        title: 'After the nesting beach',
        text: 'Satellite tags followed 12 female loggerheads after they nested on beaches in Japan, to find where they go to feed.',
        view: 'species', at: '08-01', speed: 5,
      },
      {
        title: 'Coast or open ocean',
        text: 'They split two ways. Some head to shallow coastal seas (the East China Sea, or the coast of Japan); others head out into the open North Pacific.',
        view: 'species', at: '10-01', speed: 5, overlay: 'sst',
      },
      {
        title: 'The East China Sea',
        text: 'The researchers estimate that about 70% of the turtles nesting in Japan each year feed in the East China Sea, which makes it a critical habitat for these endangered turtles.',
        view: { center: [125.5, 29.5], zoom: 4.6, pitch: 30, bearing: 0 }, at: '12-01', speed: 4,
      },
      {
        title: 'The open Pacific',
        text: 'About 22% feed in the open ocean. Turtles from beaches further north were more likely to go oceanic; from the southern islands, more than 84% stayed coastal.',
        view: 'species', at: '02-01', speed: 5, overlay: 'sst',
      },
      {
        title: 'Out to sea',
        text: 'Follow {longestId}, which covered {longestKm} in the tracks shown.',
        view: 'species', at: '08-01', speed: 6, follow: 'longest',
      },
    ],
  },

  'white-stork': {
    title: 'A decade on the wing',
    scenes: [
      {
        title: 'Storks from nine countries',
        text: 'Since 1991, satellite tags have followed more than 200 white storks from Belgium, Germany, Greece, Israel, Poland, Russia, South Africa, Spain and Switzerland. {animals} of the longest tracks are shown.',
        view: 'species', at: '08-01', speed: 5,
      },
      {
        title: 'Autumn: heading for Africa',
        text: 'From late summer the storks head south for Africa. Watch them cross into Africa at the narrow points of the Mediterranean.',
        view: { center: [15, 30], zoom: 2.6, pitch: 20, bearing: 0 }, at: '08-20', speed: 4,
      },
      {
        title: 'Winter in Africa',
        text: 'Winter quarters vary from year to year, and so do routes, timing and stopovers. Some storks keep the same winter quarters and routes.',
        view: 'heads', at: '12-15', speed: 4,
      },
      {
        title: 'Why so variable?',
        text: 'The researchers think external factors drive this variability, and that food supply is probably the most important.',
        view: 'species', at: '03-15', speed: 5,
      },
      {
        title: 'Prinzesschen',
        text: 'One stork, Prinzesschen, was tracked for over a decade, and hers is the longest track here: {longestKm}. Ride along.',
        view: 'species', at: '08-01', speed: 14, follow: 'longest',
      },
    ],
  },

  osprey: {
    title: 'Three flyways south',
    scenes: [
      {
        title: 'Four populations',
        text: 'Satellite tags tracked adult ospreys from four US study areas on their autumn migration: the lower Columbia River, north-central Minnesota, Shelter Island in New York, and southern New Jersey.',
        view: 'species', at: '08-15', speed: 4,
      },
      {
        title: 'Western birds',
        text: 'Ospreys from the Columbia River flew south through California and wintered mostly in Mexico (88%), with a few in El Salvador and Honduras. They travelled the shortest distances.',
        view: { center: [-112, 30], zoom: 3.2, pitch: 20, bearing: 0 }, at: '09-15', speed: 3,
      },
      {
        title: 'Minnesota: three routes',
        text: 'Minnesota birds used three routes: through the central US and down Mexico’s east coast; down the Mississippi valley then across the Gulf of Mexico; or through the south-east US and across the Caribbean.',
        view: { center: [-88, 26], zoom: 2.9, pitch: 20, bearing: 0 }, at: '09-20', speed: 3,
      },
      {
        title: 'East Coast: over the Caribbean',
        text: 'East Coast birds followed the seaboard, crossed Florida and the Caribbean, and wintered from Florida as far south as Brazil.',
        view: { center: [-70, 10], zoom: 2.5, pitch: 20, bearing: 0 }, at: '10-10', speed: 3,
      },
      {
        title: 'Females first, and farther',
        text: 'Females left the breeding grounds earlier than males and flew farther, so they usually wintered south of the males from their population. Follow {longestId}: {longestKm} tracked.',
        view: 'species', at: '08-15', speed: 6, follow: 'longest',
      },
    ],
  },

  'bar-tailed-godwit': {
    title: 'Across the Pacific without stopping',
    scenes: [
      {
        title: 'A tiny logger',
        text: 'Light-level geolocators on {animals} bar-tailed godwits from New Zealand, {years}, recorded where each bird stopped. Flights between stops are drawn as straight lines.',
        view: 'species', at: '02-15', speed: 5,
      },
      {
        title: 'March: north to the Yellow Sea',
        text: 'In March the godwits leave New Zealand and fly to the coasts of the Yellow Sea in East Asia.',
        view: 'heads', at: '04-05', speed: 3,
      },
      {
        title: 'Summer: Alaska',
        text: 'From there they continue to Alaska to breed.',
        view: 'heads', at: '06-15', speed: 4,
      },
      {
        title: 'Autumn: the big flight',
        text: 'In September they fly back from Alaska to New Zealand across the open Pacific. With no stop recorded on the way, the line runs straight across the ocean.',
        view: 'species', at: '09-10', speed: 4,
      },
      {
        title: 'Few stops, high stakes',
        text: 'A 2024 study using these tracks found that larger shorebirds like godwits, which rely on one or a few major stopovers, would need new routes and strategies as coastal habitat is lost. Follow {longestId}: {longestKm}.',
        view: 'species', at: '03-01', speed: 6, follow: 'longest',
      },
    ],
  },
};
