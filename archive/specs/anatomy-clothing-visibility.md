# Clothing-Aware Anatomy Descriptions

## Context
- Anatomy descriptions are assembled in `src/anatomy/bodyDescriptionComposer.js` using the ordering and descriptor keys from `data/mods/anatomy/anatomy-formatting/default.json`. Equipment and activity sections are appended with prefixes like `Wearing: ` and `Activity: ` through formatting service defaults.
- Individual part text comes from `BodyPartDescriptionBuilder`/`PartDescriptionGenerator` without regard to clothing. Anatomy parts (e.g., penis, testicle, vagina, pubic_hair) live under `data/mods/anatomy/entities/definitions/` and only carry descriptor data today.
- Clothing coverage data already exists: `clothing:slot_metadata` on the actor defines which clothing slots cover which anatomy sockets and their allowed layers; `clothing:equipment` tracks which slot/layer is occupied; `clothing:coverage_mapping` on items allows secondary coverage. `anatomy:joint` components record the parent socket a part is attached to.
- Problem: Genital descriptions appear even when the relevant slot (e.g., `torso_lower`) is occupied by blocking layers (pants), which breaks believability and leaks hidden anatomy (e.g., futanari characters).

## Goals
- Add a data-driven visibility rule per anatomy part that ties it to a clothing slot and enumerates non-blocking layers (e.g., underwear/accessories do not hide the part, but base/outer do).
- During part description generation, suppress any part whose covering slot is occupied by a blocking layer (including secondary coverage) so hidden anatomy is not described.
- Keep ordering, grouped part handling, equipment/activity sections, and non-genital parts unchanged unless a visibility rule says otherwise.

## Data/Schema Additions
- New component under `data/mods/anatomy/components/` (name TBD, e.g., `anatomy:visibility_rules`) with fields:
  - `clothingSlotId` (string): clothing slot to inspect (e.g., `torso_lower`).
  - `nonBlockingLayers` (string[]): clothing layers that still allow description (e.g., `['underwear', 'accessories']`).
  - Optional `notes`/`reason` (string) for authoring clarity.
- Annotate genital-facing parts (`human_penis*.entity.json`, `human_penis_thick_*`, `human_penis_small`, `human_testicle*`, `human_vagina*`, `pubic_hair` variants) with this component pointing to `torso_lower` and `nonBlockingLayers: ['underwear', 'accessories']`. Also do something similar for torsos (not breasts) with the `torso_upper` clothing slot, with `['underwear', 'accessories']` as exceptions (the reason being that other actors should know in descriptive detail how hairy or muscular a torso is unless the actor is in underwear).
- Ensure schemas/validators accept the new component and `validate:ecosystem` still passes.

## Behavior Requirements
- Map part → socket via `anatomy:joint.socketId`, then use the actor’s `clothing:slot_metadata.slotMappings` to find covering clothing slot(s) that list the socket in `coveredSockets`.
- Determine occupancy from `clothing:equipment.equipped[slotId]` across layers; a layer is blocking unless listed in the part’s `nonBlockingLayers`.
- If any covering slot has a blocking layer occupied (or is covered indirectly via an equipped item’s `clothing:coverage_mapping.covers`), skip generating that part’s description entirely.
- If no covering slot metadata exists for the socket, or the slot is empty or only has non-blocking layers, keep current behavior (describe the part).
- Skipping parts must not emit empty lines or malformed grouping; equipment (`Wearing: ...`) and activity sections remain where configured.

## Test Plan
1) **Unit – Visibility Helper**
   - Visible when slot empty: joint.socketId maps to `torso_lower`, no equipment entries ⇒ returns visible.
   - Hidden by blocking layer: same setup but `torso_lower.base = 'pants'` ⇒ returns hidden.
   - Allowed underwear: `torso_lower.underwear = 'briefs'`, no other layers ⇒ visible because `nonBlockingLayers` includes underwear.
   - Mixed layers: underwear + base set ⇒ hidden (blocking layer wins).
   - Secondary coverage: another slot item with `clothing:coverage_mapping.covers = ['torso_lower']` on a blocking layer hides the part.
   - Missing slot metadata or missing joint component ⇒ defaults to visible, no throw.

2) **Integration – BodyDescriptionComposer**
   - Human male anatomy with slot metadata from blueprint, with pants (`torso_lower.base`): generated description omits `penis:`/`testicle:`/`pubic_hair:` lines but still includes other parts and the `Wearing:` section.
   - Swap to underwear-only: same actor with only `torso_lower.underwear` populated ⇒ genital lines appear again in the configured order.
   - Ensure no blank lines between remaining sections and equipment/activity order stays per `descriptionOrder`.

3) **Integration – Futanari Secrecy**
   - Human futa actor wearing base/outer on `torso_lower`: description shows feminine parts (e.g., breasts) but hides penis/testicle descriptors.
   - Remove blocking layer (underwear-only): male genital descriptors become visible.

4) **Data Validation**
   - New component schema validates required fields and enforces layer enum.
   - Entity definitions for genital/pubic parts reference the new component; `npm run validate:ecosystem` (or targeted schema tests) pass without regressions.

5) **Regression Guard**
   - Parts without the new component (e.g., arms, head) are always described regardless of clothing.
   - Visibility rules do not affect equipment/activity text formatting from `AnatomyFormattingService` defaults.
