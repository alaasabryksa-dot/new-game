# Fayoum Street world-accuracy plan

## Evidence-backed street character

The 3 Aug 2024 report by Sout Al-Salam / Bashkatib describes the Fayoum main street as a dense mixed commercial and residential corridor running from the end of Dar El-Salam Bridge toward a U-turn. The report gives an approximate 2.2 km walking span and documents:
- an education administration building and a school complex with six schools;
- a busy commercial frontage, including grocery and coffee-bean shops;
- sidewalk space being occupied by shop displays and street-vendor carts;
- informal microbus and tuk-tuk stopping/transfer activity at both ends of the bridge;
- congestion and constrained pedestrian movement;
- Al-Tal Street as a parallel commercial street.

These are **reported conditions at the time of the 2024 article**, not a guarantee that every obstacle, business, or transport stop is still present today. The report's descriptions are useful for broad environmental composition, not for assigning a precise facade to a coordinate.

Sources:
- Sout Al-Salam / Bashkatib, 3 Aug 2024: https://bashkatibnews.com/en/sawtelsalam/dep/reports/Fayoum_Street
- Cairo Governorate / Dar El Salam District, 22 Jan 2020: https://www.cairo.gov.eg/ar/governorate-entities/neighborhoods/south-area/hay-dar-alsalaam/news/2020/06844acec27246f6925a57f69f97b020
- Cairo Governorate / Dar El Salam District, 16 Jun 2020: https://www.cairo.gov.eg/ar/governorate-entities/neighborhoods/south-area/hay-dar-alsalaam/news/2020/42f52a0d2c37423ebfbda21e20c56000
- Cairo Governorate / Dar El Salam District, 19 Jul 2026: https://www.cairo.gov.eg/ar/governorate-entities/neighborhoods/south-area/hay-dar-alsalaam/news/2026/july/21/12a629b99b2842848e717d6e5be97658
- Youm7, 3 Jun 2016: https://www.youm7.com/story/2016/6/3/صحافة-المواطن-سكان-شارع-الفيوم-بدار-السلام-يستغيثون-من-الباعة/2746322
- Youm7, 20 Aug 2015: https://www.youm7.com/story/2015/8/20/بالصور-حى-دار-السلام-والمرافق-يشنان-حملة-لإزالة-الإشغالات-بشارع/2313480

## Map-derived route — not field verified

- Seed OpenStreetMap way: 37195082, tagged شارع الفيوم.
- The current candidate contains 135 coordinate points and a connected closed loop.
- The route graph includes multiple connected streets and bridge sections; it is not exclusively the main Fayoum Street.
- Directional edge checks passed when the candidate was assembled.
- The route metadata explicitly sets `fieldVerified: false`. A timeout also prevented fetching every connected endpoint road. Treat it as a map-derived candidate, not a survey-grade street trace.
- OpenStreetMap data is © OpenStreetMap contributors and is licensed under ODbL-1.0; retain attribution and license notices.

## Storefront and landmark evidence levels

1. **Documented street context:** broad patterns supported by public reporting (commercial frontage, schools, vendors, encroachment, traffic). This can guide scene composition.
2. **Business candidate:** a public directory or map listing provides a name and/or address on or near Fayoum Street. It is not a verified current tenant, facade, coordinate, or visual reference.
3. **Visually verified facade:** a current identifiable facade is matched to a precise street position using a reliable current image or direct observation.
4. **Field verified:** position and visible features are independently checked on site.

The candidate catalog currently includes businesses and addresses from public listings, including numbered entries around 36–165 El Fayoum Street. Some directory records conflict or use nearby streets as the address. Every candidate remains excluded from in-game real signage until its exact branch, current occupancy, and facade are independently checked.

## Additional directory/map research — 8 Nov 2026

A fresh public business/map lookup produced additional location leads for the corridor. These are catalogued separately from verified facades:

- **Paris For Clothes / باريس للملابس** — listed at 92 Al Fayoum St.; a current facade photo and exact frontage position are still required.
- **Orange Express (Dar El Salam 2)** — listed at 1 Matar Street, off/near Al Fayoum. This is a side-street lead, not evidence of a main-street shopfront.
- **Gamal Abdel Nasser National Mixed Language School** — listed at 2 El Fayoum St.; this supports the school-complex context, but not the exact campus footprint or current facade.
- **Telecom Egypt / WE — Dar El Salam Central** — listed at 126 El Fayoum St.; verify the current sign, entrance, and frontage.
- **Nahdet Dar El Salam Mosque** — associated with Fayoum Street in El-Mala'a, opposite the consumer association; approximate landmark only because no numbered address was returned.
- **El-Karim Mosque** — associated with the wider El-Fayoumy / Ezbet Nafie corridor; do not place it as a main-street frontage without exact positioning.

Source record IDs and evidence notes are stored in:
- `src/game/data/fayoum-business-candidates.json`
- `src/game/data/fayoum-landmark-candidates.json`

The business catalog now has 21 leads; the separate landmark catalog has 4 leads. These counts are research records, not verified current tenants or completed facade models. No new real-world sign has been enabled in the game.

## Environment modeling guidance

- Build a believable continuous commercial corridor with varied narrow shop bays, upper-floor residential facades, balconies, shutters, awnings, Arabic signboards, utility cables, and occasional sidewalk displays.
- Vary frontage widths and heights; do not repeat one identical shop module down the whole street.
- Use generic fictional sign text and unbranded storefronts for any facade without verified imagery.
- Place schools/education-related masses and bridge-side transport activity only as broad landmarks where the route geometry supports them; do not fabricate official institution names or exact building positions.
- Keep sidewalks visually readable even when cluttered; use movable vendor carts and traffic props as scene dressing rather than permanently blocking the playable path.
- Use a small number of distinctive, original facade silhouettes to break repetition. Do not copy press photographs or third-party logos into shipped textures without permission.

## Storefront policy

- Existing building masses, shop fronts, awnings, signs, balconies, and shop interiors are procedural game art unless explicitly supported by a verified reference.
- Generic sign categories are fictional atmosphere, not confirmed business names or addresses.
- Press photos in `src/game/data/fayoum-photo-references.json` are historical research references only. Do not ship them as textures without rights-holder permission.
- Never assign an exact shop identity to a coordinate unless both its position and appearance have been independently confirmed.
- Business candidates must remain metadata/research leads until checked. Do not display their real names in the playable world yet.

## The 200-facade target

For each facade, the production catalog must eventually contain:
- a stable facade ID;
- source image/reference and capture date;
- street-side position or route segment;
- observed building height, frontage width, ground-floor use, and distinctive facade features;
- confidence level and reviewer note;
- a separate flag for whether the in-game recreation is based on verified evidence.

No empty placeholder entries are counted as researched facades. The 200-facade target remains open until 200 records have real supporting evidence.
