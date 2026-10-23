# Spot photos (pilot)

The five reviewed Bremerhaven venues use real photographs from Wikimedia Commons.
`src/lib/spot-photos.json` stores image URLs, exact catalog IDs, author, source page,
license URL and capture-date metadata. No photo binaries or API secrets are stored.

`node --import tsx scripts/import-spot-photos.ts` refreshes the reviewed selection
in one public Commons API request. This is an editorial import, never a request
per user, per card or per render. Search results must be checked manually before
adding a venue/file pair. Confirm the actual venue, license and thumbnail crop.

The cards load the thumbnail directly from Wikimedia, lazily. No Firestore reads,
writes or runtime photo-search requests are added. Browser/CDN caching follows
the image server's HTTP headers. Broken images and unreviewed venues fall back to
the existing category illustration. Matching uses exact place IDs, never names.

The camera control on each photo opens its image credit in the spot menu:
author/source link, license link and cropping notice. The same photo is used in
the menu thumbnail. Keep the credit with the photo when reusing it elsewhere.

The photo model also supports `kind: "example"`; these images always show a
visible “Beispielfoto” label. None of the initial five photos are example images.

The current selection is small on purpose. Commons coverage for neighborhood
cafés, bars and sports venues is limited. Extend it with verified Commons photos
or owner-provided images with documented permission, rather than assigning a
different venue's photograph. Google Places and stock-photo APIs have separate
usage, billing and attribution requirements; they are not enabled by this pilot.
