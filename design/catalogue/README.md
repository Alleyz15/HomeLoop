# SDP catalogue imagery

The catalogue uses local, optimised copies of marketing imagery linked from the
official SDP project pages. It does not use the generated design-concept photos.

- Assets: `apps/web/public/catalogue/*.webp` (23 projects).
- Provenance: `apps/web/public/catalogue/sources.json`; each entry records the
  original page/image, image label, retrieval date and optimised dimensions.
- Retrieved: 16 October 2026. This is separate from the catalogue's database
  `checked_on` date, which is displayed per development without being overwritten.
- Some official media are floor plans, facilities, a master plan or a launch
  announcement. These are labelled specifically, not represented as photographs
  of finished homes or as proof that units remain available.
- The shared catalogue hero uses Serenia Baleria's published side-facade image,
  split into three independently drifting horizontal strips with CSS. It is
  decorative; its source credit is outside the animation and reduced motion
  leaves a static composition.

Regenerate only after checking the curated selections:

```powershell
node scripts/fetch_catalogue_assets.mjs
```

The script verifies each image identifier exists on its stated project page,
downloads the selected media and produces bounded WebP images with `sharp`
(already installed through Next.js). It never changes Supabase. An optional
`CATALOGUE_CONTACT_SHEET` absolute output path produces a review contact sheet.

Image rights remain with their owners. Attribution/source records do not grant
reuse rights. Review permissions before a public release; this work is a local
prototype, not publication. Official project links open in a new tab, with
`noopener noreferrer`. No tracking scripts or forms from those pages are embedded.
