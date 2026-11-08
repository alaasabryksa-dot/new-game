# Fayoum Street world-accuracy plan

## Evidence-backed street character

The public material reviewed so far supports these broad environmental details for Fayoum Street in Dar El Salam:

- The street has a dense mixed commercial/residential character with shopfronts opening onto the public way.
- Food and clothing carts/vendors have historically occupied parts of the street.
- Some shops have extended displays or other encroachments into the sidewalk/road space.
- Congestion and the interaction between local traffic, pedestrians, vendors, and storefront activity are recurring documented themes.
- Official neighborhood reports document repeated campaigns to remove encroachments on Fayoum Street (2020 and 2026). These campaigns are evidence of the street-management context, not proof that every scene or obstruction is present at all times.

Sources:
- Cairo Governorate / Dar El Salam District, 22 Jan 2020: https://www.cairo.gov.eg/ar/governorate-entities/neighborhoods/south-area/hay-dar-alsalaam/news/2020/06844acec27246f6925a57f69f97b020
- Cairo Governorate / Dar El Salam District, 16 Jun 2020: https://www.cairo.gov.eg/ar/governorate-entities/neighborhoods/south-area/hay-dar-alsalaam/news/2020/42f52a0d2c37423ebfbda21e20c56000
- Cairo Governorate / Dar El Salam District, 19 Jul 2026: https://www.cairo.gov.eg/ar/governorate-entities/neighborhoods/south-area/hay-dar-alsalaam/news/2026/july/21/12a629b99b2842848e717d6e5be97658
- Youm7, 3 Jun 2016, resident-submitted street photographs: https://www.youm7.com/story/2016/6/3/صحافة-المواطن-سكان-شارع-الفيوم-بدار-السلام-يستغيثون-من-الباعة/2746322

## Map-derived route — not field verified

- Seed OpenStreetMap way: 37195082, tagged شارع الفيوم.
- The current candidate contains 135 coordinate points and a connected closed loop.
- The route graph includes multiple connected streets and bridge sections; it is not exclusively the main Fayoum Street.
- Directional edge checks passed when the candidate was assembled.
- The route metadata explicitly sets `fieldVerified: false`. A timeout also prevented fetching every connected endpoint road. Treat it as a map-derived candidate, not a survey-grade street trace.

## Storefront and landmark evidence levels

1. **Documented street context:** street-level patterns supported by public reporting (commercial frontage, vendors, encroachment, traffic). This can guide broad scene composition.
2. **Business candidate:** a public business listing provides a name and/or address on or near Fayoum Street. It is not yet a verified facade, coordinate, current tenant, or visual reference.
3. **Visually verified facade:** an identifiable current facade is matched to a precise street position using a reliable current image or direct observation.
4. **Field verified:** position and visible features are independently checked on site.

Current online business listings provide leads such as Telecom Egypt at 126 Fayoum St, Vodafone at 36 Fayoum St, Abd Elhady Jewelry at 151 El Fayoum, Spicy Chicks at 165 Al Fayoum, and other nearby services. See `fayoum-business-candidates.json`. Listings can be stale, duplicated, or imprecise; they are not enough to model an exact facade.

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
