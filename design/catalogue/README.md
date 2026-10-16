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

## Internal development details

Saved-valuation journeys open `/new-home/[numeric launch ID]?valuation=[UUID]`.
The Home-entry catalogue remains browsing-only and keeps its official SDP links.
The details screen reuses the matching image and its original caption/source;
no new marketing images were fetched for this phase.

Display-only layout options in `apps/web/src/lib/development-model.ts` were
verified on 17 October 2026 against these official pages:

- [Serenia Baleria](https://www.simedarbyproperty.com/serenia-city/serenia-baleria/):
  A1 1,731 sq ft, A2 1,843 sq ft, C1/E1 2,022 sq ft, C2/E2 2,088 sq ft.
- [Serasi Residences](https://www.simedarbyproperty.com/putra-heights/serasi-residences/):
  A 668 sq ft, B 850 sq ft, C (SAMM) 550 sq ft. The SAMM eligibility warning is
  displayed; selecting it does not confirm eligibility.

Options apply only when both project name and official source URL match. Other
projects use **Standard home type**. These are not live inventory or a complete
unit catalogue. No type-specific price is inferred: the database project starting
price remains explicitly labelled, and an optional user-entered SDP sales price
overrides it for the local preview only. Confirm/review these curated layout
facts before release; they do not update automatically from SDP.

The preview subtracts the whole-RM old-home range from the new-home price, keeps
quotation cents, and labels the result as a basic difference, not cash payable.
Compare Plans is deferred: **Choose this home** is disabled and does not persist
these choices or navigate to the placeholder Plans page.
