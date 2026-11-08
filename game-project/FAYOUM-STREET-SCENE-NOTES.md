# Fayoum Street — scene composition notes

## Research scope
This note translates published street reporting into broad game-environment guidance. It is not a current survey, and it does not identify exact facade coordinates.

## Documented context from 3 Aug 2024
Sout Al-Salam / Bashkatib describes a roughly 2.2 km walk from Dar El-Salam Bridge to the U-turn on the main Fayoum Street. The report mentions an education administration building, a six-school complex, commercial shops, street vendors, sidewalk displays, informal microbus/tuk-tuk stops around both ends of the bridge, and a parallel commercial street (Al-Tal).

## Recommended procedural scene blocks
1. **Bridge approach:** busier transport interchange atmosphere, with tuk-tuk/microbus presence represented as moving traffic and designated pull-in areas. Avoid asserting an exact current stop layout.
2. **Dense retail strip:** narrow varied shop bays, mixed groceries and service shops, Arabic generic signboards, awnings, shutters, and upper-floor homes.
3. **Pedestrian pressure zones:** intermittent vendor carts and display tables on sidewalk edges, with enough clear width left for safe player navigation.
4. **Education zone:** broad school/education building silhouettes and increased pedestrian activity, without invented school names or logos.
5. **Return/U-turn area:** widen the visual rhythm and road furniture where the mapped candidate indicates the transition; do not assume this is a surveyed exact U-turn location.

## Additional named landmark leads (8 Nov 2026)

Public map listings add useful research leads, not verified facade assets:
- The Gamal Abdel Nasser National Mixed Language School is listed at 2 El Fayoum Street and can inform the broad education-zone context.
- Telecom Egypt / WE Dar El Salam Central is listed at 126 El Fayoum Street.
- Nahdet Dar El Salam Mosque is associated with Fayoum Street in El-Mala'a, opposite the consumer association; its exact frontage remains uncertain.
- El-Karim Mosque is associated with the wider El-Fayoumy / Ezbet Nafie corridor and should not be placed on the main road without a precise position check.
- Paris For Clothes is listed at 92 Al Fayoum Street.
- Orange Express is listed on Matar Street off/near Al Fayoum and must remain a side-street lead.

All six require current visual confirmation before any recognizable signage or facade recreation is added. The source place IDs and confidence notes are in the JSON research catalogs.

## Asset and evidence rules
- Use original procedural meshes and original fictional signs for unverified storefronts.
- Never place a real business name at a specific frontage based only on a directory street number.
- Keep press photos as research links; do not ship them as game textures without permission.
- Mark every future facade record with evidence URL, capture date, position confidence, and visual-review status.
- The 200-facade target is not complete until 200 distinct facades have individual evidence records.

## Procedural storefront expansion (8 Nov 2026)

The Android and desktop scene generators now use 20 fictional Egyptian neighborhood-shop categories (including butcher, bakery, spice shop, household goods, stationery, spare parts, sweets, juice, clothing, shoes, detergents, and accessories), rather than repeating the original eight labels. Sign colors vary by category and longer Arabic labels use smaller type so they fit. The Android street pass also raises the chance of a commercial ground floor to create a denser mixed-use frontage.

These are deliberately invented environmental details, not claims about actual tenants. No unverified business names, logos, or exact storefront locations have been inserted. Keep this procedural approach until current facade references are available.

## Android facade and rooftop variation (8 Nov 2026)

The mobile scene now derives building width, depth, floor count, facade color, and shop category from a side-specific deterministic seed. Opposite sides therefore no longer reuse identical building dimensions and category patterns at each route sample. A portion of buildings also receive simple rooftop water tanks, rendered with instanced cylinder meshes to limit additional draw calls. These are generic environmental details, not individually surveyed properties.


## Android street-life pass (8 Nov 2026)

Android now receives a deliberately compact set of instanced sidewalk props: waste bins, occasional trees, street lamps, vendor carts and benches. The Android scene also enables a reduced ten-sprite pedestrian crowd with the existing proximity-based sidewalk avoidance. Desktop retains its richer prop set and larger crowd. This is generic environmental dressing; it does not claim exact surveyed positions for individual vendors or street furniture.
