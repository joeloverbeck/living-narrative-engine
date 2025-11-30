# Aldous Clothing Replacement Spec

## Context
- Target recipe: `data/mods/fantasy/recipes/aldous.recipe.json` currently equips placeholder workwear (linen drawers/footwraps, work tunic, narrow wool-linen trousers, leather work apron, leather belt, cracked ankle boots).
- Goal: replace placeholders with Aldous’ intended kit: close-cuff linen shirt (yellowish-brown), reinforced mud-stained wool yard trousers, dark brown waxed-leather work boots, smoke-gray quilted jerkin, smoked-glass eye shields with greenish tint and chips, and goatskin grip gloves.
- Scope: design specs only; item JSONs and recipe changes will be implemented later, but must remain validation-ready for `npm run test validate:recipe`.

## Survey Findings
- **Existing garments**: Base/outer/accessory mods have no close-cuff linen work shirt, no mud-stained reinforced trousers, no waxed leather work boots, no quilted jerkin, no head_gear eye protection, and only fingerless goatskin gloves (not grip gloves). Outer clothing skews to coats/hoodies/jackets; accessories are mostly jewelry/hats.
- **Materials**: `data/mods/core/components/material.component.json` already covers needed materials (linen, wool, leather, goatskin, glass). Waxing can be expressed via `core:material.properties` (`waterproof`) plus description—no new material enum required.
- **Descriptors**: `color_extended` lacks direct matches for “yellowish-brown” and “smoke-gray.” `texture` lacks “quilted” (jerkin padding) and “chipped” (glass edges). Mud staining can reuse `color_extended: mud-brown` + `texture: worn`.

## Descriptor Enum Adjustments
- Extend `data/mods/descriptors/components/color_extended.component.json` with: `ochre-brown` (yellowish-brown linen) and `smoke-gray` (smoke-muted gray for the jerkin).
- Extend `data/mods/descriptors/components/texture.component.json` with: `quilted` (stitched padding) and `chipped` (edge damage distinct from “cracked”).
- No new descriptor components needed; existing components suffice once enums are updated.

## Planned Clothing Definitions
- **Close-cuff work shirt (base)**
  - File/ID: `data/mods/base-clothing/entities/definitions/linen_close_cuff_work_shirt_ochre_brown.entity.json` / `base-clothing:linen_close_cuff_work_shirt_ochre_brown`.
  - Layer/slots: `layer: base`; `equipmentSlots.primary: torso_upper`; `secondary: [left_arm_clothing, right_arm_clothing]`; `allowedLayers: [underwear, base, outer]`.
  - Components: `core:material.material = linen`; `descriptors:color_extended.color = ochre-brown`; `descriptors:texture.texture = coarse`; `clothing:coverage_mapping.covers = ["torso_upper"]`; weight target ~0.32.
  - Notes: Close cuffs to stay out of clay slip, reinforced elbows/shoulders, sun-faded yellow-brown linen.

- **Reinforced yard trousers (base)**
  - File/ID: `data/mods/base-clothing/entities/definitions/reinforced_yard_trousers_mud_stained_wool.entity.json` / `base-clothing:reinforced_yard_trousers_mud_stained_wool`.
  - Layer/slots: `layer: base`; `equipmentSlots.primary: torso_lower`; `allowedLayers: [underwear, base, outer]`.
  - Components: `core:material.material = wool` (linen lining in description); `descriptors:color_extended.color = mud-brown`; `descriptors:texture.texture = worn`; optional `core:material.properties: ["waterproof"]` omitted (leave to jerkin/boots); `clothing:coverage_mapping.covers = ["torso_lower"]`; weight target ~0.5.
  - Notes: Knee and seat reinforcements for yard work, visible clay and mud staining at hems, high waist to sit under jerkin.

- **Waxed work boots (base)**
  - File/ID: `data/mods/base-clothing/entities/definitions/waxed_leather_work_boots_dark_brown.entity.json` / `base-clothing:waxed_leather_work_boots_dark_brown`.
  - Layer/slots: `layer: base`; `equipmentSlots.primary: feet`; `allowedLayers: [base, outer]`.
  - Components: `core:material.material = leather`; `core:material.properties` to include `waterproof`; `core:material.durability` ~65–75; `descriptors:color_basic.color = brown`; `descriptors:texture.texture = glossy` (waxed finish); weight target ~1.05.
  - Notes: Waxed dark-brown leather, thick sole for muddy yards, sealed stitching; keep lace eyelets/rand described.

- **Quilted jerkin (outer)**
  - File/ID: `data/mods/outer-clothing/entities/definitions/quilted_smoke_gray_jerkin_linen_wool.entity.json` / `outer-clothing:quilted_smoke_gray_jerkin_linen_wool`.
  - Layer/slots: `layer: outer`; `equipmentSlots.primary: torso_upper`; `secondary` optional for arm coverage if design includes shoulders; `allowedLayers: [underwear, base, outer]`.
  - Components: `core:material.material = linen` (wool batting noted in description); `descriptors:color_extended.color = smoke-gray`; `descriptors:texture.texture = quilted`; `clothing:coverage_mapping.covers = ["torso_upper"]`; weight target ~0.75.
  - Notes: Smoke-gray quilt channels, smoke scent tie-in, open sides with lacing to vent kiln heat.

- **Smoked-glass eye shields (accessories, head_gear)**
  - File/ID: `data/mods/accessories/entities/definitions/smoked_glass_eye_shields_green_tint_chipped.entity.json` / `accessories:smoked_glass_eye_shields_green_tint_chipped`.
  - Layer/slots: `layer: accessories`; `equipmentSlots.primary: head_gear`; `allowedLayers: [accessories]`.
  - Components: `core:material.material = glass`; `descriptors:color_extended.color = murky-green`; `descriptors:texture.texture = chipped`; `clothing:coverage_mapping.covers = ["head_gear"]`; weight target ~0.18.
  - Notes: Smoke-darkened lenses with greenish cast, leather/rope strap described, chipped edges from kiln debris.

- **Goatskin grip gloves (accessories)**
  - File/ID: `data/mods/accessories/entities/definitions/goatskin_grip_gloves.entity.json` / `accessories:goatskin_grip_gloves`.
  - Layer/slots: `layer: accessories`; `equipmentSlots.primary: hands`; `allowedLayers: [accessories]`.
  - Components: `core:material.material = goatskin`; `descriptors:color_extended.color = warm-brown`; `descriptors:texture.texture = soft`; weight target ~0.16.
  - Notes: Full-finger grip gloves (not fingerless), palm rough-out or resin grip pattern, built for handling hot clay tools.

## Recipe Updates
- Replace current clothingEntities in `aldous.recipe.json` with the five new IDs above, keeping existing underwear (linen drawers/footwraps) unless story dictates otherwise.
- Ensure each entry sets `"equip": true` and references the correct mod namespaces (base-clothing, outer-clothing, accessories).
- Remove the placeholder tunic, trousers, apron, belt, and cracked boots references from the recipe.

## Validation Plan
- After implementing items and recipe swap, run `npm run test validate:recipe -- data/mods/fantasy/recipes/aldous.recipe.json` (or the project’s `npm run test validate:recipe` invocation) to confirm schema and enum updates are accepted.
- If descriptor enums are extended, rerun any descriptor component validation suites as needed (e.g., `npm run validate -- data/mods/descriptors/components/color_extended.component.json`).
