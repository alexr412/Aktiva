# Modern activity illustrations

Spot cards use 64 modern activity illustrations, based on the v4 series with a
main group of four adult friends including an Asian woman. The approved visual
style and activity settings are preserved. Every venue in the 75-place Bremerhaven pilot has a specific
subject. Unknown meeting places receive a neutral community scene. All images
illustrate activity categories rather than the appearance of a real venue.

The 25 v6 additions cover coworking, studying, ice skating, planetariums, theme
and activity parks, lakes, galleries, beer gardens, street food, bakeries, running,
cooking, baking, photography, painting, travel, concerts, festivals, comedy,
dog walking, viewpoints, pizza, sushi and seafood restaurants.

The two v5 corrections replace cinema seating with four aligned individual seats
and remove all playing cards from the dice-and-pawn board-game scene. These two
subjects use `modern-v5/`; the other 37 continue to use v4. Earlier assets remain
archived. The complete current set of 64 PNGs is in
`output/aktiva-illustrationen-aktuell-v6/` beside this worktree.

`spot-illustration-subject.ts` selects artwork using specific activity tags and
reviewed name hints together with all category/subcategory tags and optional
activity category fields. Each subject receives a bounded match score; specific
activities outrank broad parents, agreement between name and tags adds a small
bonus, and repeated/reordered tags never change the result. Padel, tennis, football, basketball,
bouldering, billiards, karaoke, board games, minigolf and general fitness remain
distinct. Restaurant tags outrank a park in the venue name. Accessibility, WLAN,
fees and dietary metadata do not choose the artwork. A restaurant's name cannot
turn it into a park, lake or museum; distinctive activity names such as karaoke,
snooker and board-game bars remain meaningful. This is presentation-only;
the resolver never changes discovery, ranking, category data or catalog entries.

`spot-illustration-artwork.ts` maps subjects to files, accessible descriptions and
separate desktop/mobile crop positions. The card menu identifies the artwork as
AI-generated and not a photo of the particular venue. A failed image request uses
the retained SVG illustration.

The approved Variant 2 card layout uses a 168px edge-to-edge cover, soft 20px
corners and a compact activity link above the vote/plan footer. Desktop spot
cards, loading placeholders and ad slots share a 344px height. Mobile keeps one
horizontal card per row at 136px, with ratings available in the options sheet.

The web files are 960 × 640 WebP assets in
`public/assets/spot-illustrations/modern-v4/`, `modern-v5/` and `modern-v6/`. The previous `modern-v2/` and
`modern-v3/` assets remain available as archived versions. Export uses the
installed Sharp processor at quality 82. These are shared static assets: no
per-visit image search, paid image API or extra database query is needed.

The full PNGs, exact integrated Imagegen prompts and generation manifests live in
the task output folders beside this worktree:

- `output/aktiva-illustrationen-modern-v2/`
- `output/aktiva-illustrationen-modern-ergaenzung-v3/`
- `output/aktiva-illustrationen-vier-freunde-v4/`
- `output/aktiva-illustrationen-korrekturen-v5/`
- `output/aktiva-illustrationen-tags-v6/`

The v4 folder includes an incremental `export-web-assets.cjs` script and a
preservation check for the previous series. Older PNGs, ZIPs,
SVG illustrations and the reviewed photo catalog are retained.

Targeted checks cover category distinctions, ambiguous names, optional metadata,
all 75 pilot venues, and the unchanged venue-photo archive. The coverage report
in the v6 output folder records each pilot venue's selected subject, all filter
groups and the new motif fixtures. Profile interests are also recognised by the
resolver for future reuse; profile cards do not consume these covers yet. Cuisine
tags without a dedicated scene share the restaurant image; religious/historic
sights share sightseeing, and water parks share swimming.
