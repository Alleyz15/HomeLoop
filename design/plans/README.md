# Compare Plans adviser artwork

Created 17 October 2026 for the approved Compare Plans design. This is a fictional,
decorative property adviser, not a real member of staff, chatbot, adviser service,
or live 3D model. No additional runtime, paid third-party service, external CDN,
or browser tracking is required.

## Production files

- `apps/web/public/plans/adviser/head.webp` — open-eye head and neck.
- `apps/web/public/plans/adviser/head-blink.webp` — registered closed-eye frame.
- `apps/web/public/plans/adviser/torso.webp` — torso, held clipboard and hand.
- `apps/web/public/plans/adviser/arm.webp` — presenting arm, separately articulated.
- `apps/web/src/app/plans/adviser.tsx` and `adviser.module.css` — assembled puppet.

The four transparent production WebPs total approximately 269 KiB. Source PNGs are
retained here for provenance and reproducibility; the website does not load them.
`adviser-preview.png` and `adviser-preview-blink.png` are local QA renders, not
website backgrounds.

## Generation provenance

Generated using the built-in image-generation tool, not an API-key CLI or stock
photo. Reference: the user-approved prior Compare Plans mockup, with the woman in
a sage blazer and ivory top holding a clipboard. The reference is appearance-only;
none of its UI text or illustrative financial figures are production image assets.

### Prompt 1 — production puppet parts

Use case: stylized-concept. Asset type: production transparent 2.5D puppet parts
for a property website. Reference image: use ONLY the female property adviser
upper-right, preserving her polished rounded 3D illustration, adult short
dark-brown bob, warm medium skin, friendly calm expression, sage blazer and ivory
ribbed top, clipboard. Generate a TRANSPARENT horizontal sprite sheet with THREE
visibly separated parts with generous transparent gutters: LEFT: her entire HEAD
plus neck only, facing front slightly angled towards viewer's left, both eyes
open, calm closed-mouth smile, dark bob hair, no torso. CENTER: waist-up TORSO
ONLY, sage blazer ivory top, clipboard held by her left hand on viewer's right,
neck stump but absolutely no head/hair; her other/right shoulder (viewer's left)
ends as a smooth rounded shoulder for separate presenting arm, no arm extending
left. RIGHT: her separate RIGHT presenting arm only, bent sage sleeve from rounded
shoulder to forearm, open palm facing up extending viewer's left, as in reference;
include full fingers and upper arm so it joins naturally to torso's left shoulder.
All parts same camera, same scale, same soft studio lighting and exact same
character, physically believable anatomy, premium friendly 3D render, no lines or
labels, no text, no UI, no background, no shadows on a plane. Parts MUST NOT
overlap. This is an exploded puppet: head attaches atop torso, arm attaches to
torso's left shoulder; full character framing waist-up once assembled. Transparent
alpha everywhere except the parts.

Output retained as `adviser-parts-source.png` (2172 × 724). Mechanical rectangular
extraction generates the head, torso and arm. No painted replacement illustration
or manually drawn raster content was introduced.

### Prompt 2 — eyelid animation frame

Use case: precise-object-edit. This is an animation blink frame, not a redesign.
Change ONLY both eyes to gently CLOSED eyelids as a natural blink (upper eyelashes
resting softly across the closed lids). Preserve ALL other pixels/features as
precisely as possible: exact head silhouette, bob hair, neck, face orientation,
skin colour, camera, lighting, eyebrows, nose, smile, ear and earrings. Preserve
the exact same 612 by 628 composition, same relative scale and same alignment with
the edges. No head movement, no hair change, no smile change. Transparent
background remains truly transparent. Do not add any body, text or background.
This frame will be overlaid on the original face, so pixel registration is
critical.

Output retained as `adviser-blink-source.png` (1224 × 1256); resized proportionally
to the 612 × 628 head registration. Only two feathered eyelid regions are overlaid
in CSS, so the surrounding face, mouth and hair do not jump during blinking.

## Animation implementation and limits

This is an articulated **2.5D raster puppet**, not a rigged volumetric 3D model:

- Torso gently breathes, anchored at the waist.
- The independent head subtly inclines and changes perspective angle.
- A genuine generated eyelid frame blinks periodically.
- The independent presenting arm makes a small presenting gesture.
- Changing the `plan` prop (`A`, `B`, or `null`) smoothly changes the head/arm pose.

It does not track the cursor, speak, make decisions or calculate financial values.
It remains decorative (`aria-hidden`, no pointer interaction). Reduced-motion
preference stops all adviser motion; SSR/no-JavaScript retains a fully assembled
static pose. Any image-load error removes the entire figure, retaining a clean
decorative halo instead of a broken face or incomplete body.

## Local verification

`node design/plans/check-adviser.mjs` renders the assembled normal and closed-eye
poses with local images only. On Windows the headless browser may need to run
outside the sandbox. Both final renders were visually inspected: arm/shoulder
overlap, neck blend and feathered eyelid registration. Generation is not part of
build or page requests.

The local fixture also verifies a completely static reduced-motion pose, four
independent animation tracks and different head poses for Plan A and Plan B.

`prepare-adviser.mjs` performs only extraction, proportional frame registration,
source copying and WebP optimisation. To reproduce from the repository root:

```sh
node design/plans/prepare-adviser.mjs design/plans/adviser-parts-source.png design/plans/adviser-blink-source.png
```
