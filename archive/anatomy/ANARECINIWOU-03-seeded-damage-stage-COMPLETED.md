# Summary
Add a generation-time stage that reads recipe `initialDamage`, resolves slot-to-part ids (already exposed on `anatomy:body.slotToPartMappings`), normalizes entries, and applies seeded wounds by delegating to the existing damage resolution pipeline before any descriptions are produced.

# Status
Completed

# Reality check (current state)
- Schema work is already done: `initialDamage` is validated by `data/schemas/anatomy.recipe.schema.json` and covered by `tests/unit/schemas/anatomy.recipe.schema.test.js`.
- Slot→part mappings are already produced by `BodyBlueprintFactory` and stored on `anatomy:body.slotToPartMappings` during `AnatomyGenerationWorkflow` (also published in the `anatomy:anatomy_generated` event).
- There is **no** runtime stage that reads `initialDamage`; no helper exists to map those entries to parts, and no tests cover seeded application or ordering today.
- Damage resolution semantics (events, narratives) live entirely in `DamageResolutionService`; suppression/quiet mode is tracked separately in ANARECINIWOU-04.

# File list (expected to touch)
- src/anatomy/workflows/anatomyGenerationWorkflow.js (wire the new stage)
- src/anatomy/workflows/stages/* (new stage for applying seeded damage using slot mappings)
- src/logic/services/SeededDamageApplier.js (new helper delegating to `DamageResolutionService`)
- tests/unit/anatomy/* (stage ordering/mapping failure coverage)
- tests/integration/anatomy/* (workflow integration asserting seeded wounds land before description)

# Out of scope
- Changing damage semantics within `DamageResolutionService` (event/narrative suppression stays in ANARECINIWOU-04).
- Altering description templates or UI rendering.
- Introducing new authoring schema fields (schema already accepts `initialDamage`).

# Acceptance criteria
## Tests that must pass
- Unit tests verifying the seeded-damage stage runs after graph build (slot mappings available) and throws on missing slot mappings.
- Integration test demonstrating a recipe with `initialDamage` mutates part health/state before description generation.

## Invariants that must remain true
- Anatomy generation without `initialDamage` follows the existing stage ordering and output.
- Slot resolution errors remain explicit; no silent fallbacks to arbitrary parts.
- Applied damage uses the same clamping/state transitions as the existing `APPLY_DAMAGE` flow via `DamageResolutionService` (no local reimplementation).

# Outcome
- Added a Seeded Damage Application stage to `AnatomyGenerationWorkflow` that pulls recipe `initialDamage`, resolves slot→part ids, and invokes a new `SeededDamageApplier` (delegating to `DamageResolutionService`).
- Registered and threaded `SeededDamageApplier` through `AnatomyGenerationService`/DI; stage skips cleanly when no applier is provided to preserve existing flows without `initialDamage`.
- Introduced unit coverage for the stage and applier normalization/error handling plus an integration test proving `initialDamage` reduces part health during generation (before description would run).
