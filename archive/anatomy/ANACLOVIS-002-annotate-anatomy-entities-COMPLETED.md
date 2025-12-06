# Status

Completed – 2025-12-01

# Goal

Wire the `anatomy:visibility_rules` component into description generation so genital and torso parts stop surfacing when blocked by clothing, and annotate the relevant anatomy entities with those rules.

# Updated assumptions

- `anatomy:visibility_rules` exists with schema tests, but no runtime code currently reads it.
- Anatomy parts are attached to sockets via runtime `anatomy:joint` components even though the definitions omit them; socket coverage comes from `clothing:slot_metadata` on the actor.
- Description ordering comes from `anatomyFormattingService`, so visibility filtering must happen before parts reach `DescriptionTemplate`.
- Actual files to annotate:
  - Genitals: `human_penis*.entity.json` (base/small/thick variants), `human_testicle*.entity.json`, `human_vagina*.entity.json` (all seven variants), and `human_pubic_hair.entity.json` under `data/mods/anatomy/entities/definitions/`.
  - Torsos (non-breast): all `human_*torso*.entity.json` entries (male/female/futa variants) under the same folder; breasts are separate entities and stay out of scope.

# Scope

- Add `anatomy:visibility_rules` with `clothingSlotId: torso_lower`, `nonBlockingLayers: ['underwear', 'accessories']` to the genital/pubic hair entities listed above.
- Add `anatomy:visibility_rules` with `clothingSlotId: torso_upper`, `nonBlockingLayers: ['underwear', 'accessories']` to the human torso entries listed above.
- Implement description-time visibility gating that:
  - Reads `anatomy:visibility_rules` + `anatomy:joint.socketId`.
  - Maps sockets through `clothing:slot_metadata.slotMappings` to covering slots (including coverage from `clothing:coverage_mapping` on equipped items).
  - Treats any equipped layer not in `nonBlockingLayers` as blocking; defaults to visible when metadata is missing.
- Keep public APIs and descriptor text/order intact aside from filtering hidden parts out of composed descriptions.

# Out of scope

- Creating or renaming anatomy entities
- Editing descriptor text beyond what filtering removes
- Changing equipment/activity formatting

# Acceptance criteria

- Tests
  - `npm run validate:ecosystem` passes
  - Add/adjusted tests covering visibility filtering stay green
- Invariants
  - No descriptor content is rewritten; hidden parts are only filtered out of output
  - Only the specified entities gain `anatomy:visibility_rules`; unrelated anatomy entities remain untouched

# Outcome

- Implemented description-time filtering in `BodyDescriptionComposer` that respects `anatomy:visibility_rules`, socket coverage in `clothing:slot_metadata`, and secondary coverage via `clothing:coverage_mapping`, treating only configured layers as non-blocking.
- Annotated all human genital, pubic hair, and torso anatomy entities with the appropriate visibility rules for `torso_lower` and `torso_upper`.
- Added unit coverage to assert non-blocking underwear remains visible, blocking layers hide parts, and secondary coverage can hide even when the primary slot is empty. `npm run test:unit -- bodyDescriptionComposer.visibilityRules.test.js --runInBand` passes; `npm run validate:ecosystem` currently reports pre-existing cross-reference violations in fantasy/locks/core.
