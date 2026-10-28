# Modern activity illustrations

Spot cards use 39 modern activity illustrations: the six approved motifs and 33
additional subjects. Every venue in the 75-place Bremerhaven pilot has a specific
subject. Unknown meeting places receive a neutral community scene. All images
illustrate activity categories rather than the appearance of a real venue.

`spot-illustration-subject.ts` selects artwork using specific activity tags and
reviewed name hints before broad categories. Padel, tennis, football, basketball,
bouldering, billiards, karaoke, board games, minigolf and general fitness remain
distinct. Restaurant tags outrank a park in the venue name. Accessibility, WLAN,
fees and dietary metadata do not choose the artwork. This is presentation-only;
the resolver never changes discovery, ranking, category data or catalog entries.

`spot-illustration-artwork.ts` maps subjects to files, accessible descriptions and
separate desktop/mobile crop positions. The card menu identifies the artwork as
AI-generated and not a photo of the particular venue. A failed image request uses
the retained SVG illustration.

The web files are 960 × 640 WebP assets in
`public/assets/spot-illustrations/modern-v2/` and `modern-v3/`. Export uses the
installed Sharp processor at quality 82. These are shared static assets: no
per-visit image search, paid image API or extra database query is needed.

The full PNGs, exact integrated Imagegen prompts and generation manifests live in
the task output folders beside this worktree:

- `output/aktiva-illustrationen-modern-v2/`
- `output/aktiva-illustrationen-modern-ergaenzung-v3/`

The extension folder includes an incremental `export-web-assets.cjs` script and a
preservation check for both previous series and their archives. Older PNGs, ZIPs,
SVG illustrations and the reviewed photo catalog are retained.

Targeted checks cover category distinctions, ambiguous names, optional metadata,
all 75 pilot venues, and the unchanged venue-photo archive. The coverage report
in the extension output folder records each pilot venue's selected subject.
