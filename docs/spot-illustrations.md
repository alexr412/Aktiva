# Modern activity illustrations

The six approved modern illustrations take priority in spot cards for bowling,
coffee, swimming, padel, parks and maritime zoos. Selection is presentation-only.
The existing category resolver still decides which activity a place represents.
Padel artwork is not used for other sports; the seal is not used for deer parks,
and the park scene is not used for beaches. Unsupported categories keep their
existing cover selection.

`src/components/activa/spot-illustration-artwork.ts` contains the mapping and the
desktop/mobile crop positions. The card menu identifies the images as generated
activity illustrations, rather than photos of the particular venue. Failed image
requests fall back to the existing SVG artwork.

The web assets are 960 × 640 WebP files in
`public/assets/spot-illustrations/modern-v2/`. They are derived from the original
1536 × 1024 PNGs in the task output folder
`output/aktiva-illustrationen-modern-v2/` (beside this worktree). Its `prompts.json`
records the integrated Imagegen prompts and style reference. Web export uses the
installed Sharp image processor with quality 82; there is no runtime image API.

Both original PNG series, their ZIP archives, the older SVG illustrations and the
reviewed venue-photo manifest remain available. The first series has not been
overwritten. The photo importer and photo attributions still apply where venue
photos are displayed.
