# Fayoum Street world-accuracy plan

## Verified from the current map data

- Seed OpenStreetMap way: 37195082, tagged شارع الفيوم.
- The current candidate contains 135 coordinate points and a connected closed loop.
- The route graph includes multiple connected streets and bridge sections; it is not exclusively the main Fayoum Street.
- Directional edge checks passed when the candidate was assembled.

## Not field-verified

The route metadata explicitly sets `fieldVerified: false`. A timeout also prevented fetching every connected endpoint road. Therefore the current route is a map-derived candidate, not a survey-grade street trace.

## Storefront policy

- Existing building masses, shop fronts, awnings, signs, balconies, and shop interiors are procedural game art.
- Generic sign categories are fictional atmosphere, not confirmed business names or addresses.
- Press photos in `src/game/data/fayoum-photo-references.json` are historical research references only. They must not be shipped as textures without rights-holder permission.
- Never assign an exact shop identity to a coordinate unless both its position and appearance have been independently confirmed.

## How the 200-facade target becomes verifiable

For each facade, the production catalog must eventually contain:
- a stable facade ID;
- source image/reference and capture date;
- street-side position or route segment;
- observed building height, frontage width, ground-floor use, and distinctive facade features;
- confidence level and reviewer note;
- a separate flag for whether the in-game recreation is based on verified evidence.

No empty placeholder entries are counted as researched facades. The 200-facade target remains open until 200 records have real supporting evidence.
