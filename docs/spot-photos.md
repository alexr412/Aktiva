# Verified venue photos

The active catalog contains 12 reviewed photos of the actual Bremerhaven venues.
Automatic category/example photos have been removed. Unknown venues or failed
image requests use the existing illustration rather than a different venue's photo.
This is partial real-photo coverage, not complete coverage of the 75-spot pilot.

Nine photos come from Wikimedia Commons. Three come from explicitly credited
CC BY 4.0 images on Erlebnis Bremerhaven or the verified Cuxland-Tourismus page
on Outdooractive. The exact selected image and its individual license matter:
BAD 2's first gallery photo is CC BY-NC-ND, while its second photo is CC BY 4.0.
Only the second is included. Bowling uses a licensed exterior photo from 2017,
with a notice in the image credit; current interior photos require permission.

`node --import tsx scripts/import-spot-photos.ts` refreshes the reviewed Commons
metadata and combines it with the documented external selection in
`data/spot-catalogs/bremerhaven-venue-photo-sources.json`. No image binaries,
secrets, paid APIs, Firestore reads/writes or per-view image searches are added.
The browser loads thumbnails directly from their source CDN, following HTTP cache
headers. The source/author, title, license and cropping notice are in the card menu.

An exact source ID is preferred. Legacy and curated discovery results can have
different IDs: a manually approved name alias also matches only when the venue
coordinates are within 150 metres of the reviewed location. Name-only and
category-only matches are forbidden. This does not affect feed ranking or place data.

Further actual photos have been found for CineMotion and HAVENGLOW on their
operator pages, but no reusable license has been established. Do not hotlink or
copy them into the app merely because they are publicly viewable. The remaining
venues need further source research, documented owner permission or an authorized
Places-photo provider. Google Places is not enabled by this change and has its own
billing, attribution and caching rules.
