# Anatomy Recipes: Seeded Wounds

## Context
- Damage is applied at runtime through `APPLY_DAMAGE` (`src/logic/operationHandlers/applyDamageHandler.js` delegating to `src/logic/services/damageResolutionService.js` and the damage accumulator/narrative pipeline). E2E suites in `tests/e2e/actions/*.e2e.test.js` already stress this flow.
- Anatomy graphs are assembled from blueprints + recipes in `src/anatomy/bodyBlueprintFactory/bodyBlueprintFactory.js` and the orchestrated pipeline in `src/anatomy/orchestration/anatomyOrchestrator.js` / `src/anatomy/workflows/anatomyGenerationWorkflow.js`, which builds the parts map and then runs description generation.
- Recipes (e.g., `data/mods/fantasy/recipes/vespera_nightwhisper.recipe.json`) currently only describe slot selection, not pre-existing wounds. The anatomy visualizer (`anatomy-visualizer.html` + `src/anatomy-visualizer.js` + `src/domUI/AnatomyVisualizerUI.js`) loads an entity, generates its anatomy, and immediately renders the graph and description—there is no hook to seed health loss before `AnatomyDescriptionService` renders “Health:” text.
- Gameplay issue: scenario authors want to start a scene with specific wounds already present on named slots (e.g., `left_ass`), without knowing generated part UUIDs ahead of time.

## Goals
- Extend anatomy recipes so authors can declaratively specify per-slot health reductions (optionally multiple entries per slot) using the same slot keys already used in `slots`.
- Apply these wounds automatically after the anatomy graph is built (and parts are known) but before description generation, so initial descriptions include injury text and part health/state is consistent with downstream systems.
- Keep the damage semantics consistent with `APPLY_DAMAGE` (health clamping, state transitions, metadata/damage_tags handling, death checks) while allowing this initialization path to suppress noisy perceptible events/narratives when appropriate.
- Provide validation to catch unknown slot keys or malformed wound entries early (schema + runtime warnings/errors).
- Add comprehensive tests (unit + integration + e2e) that cover schema, slot resolution, health mutation, and description output with seeded wounds.

## Non-Goals
- No changes to weapon/macro content or the live APPLY_DAMAGE pipeline semantics.
- No new UI for editing wounds in the visualizer; goal is data-driven initialization only.
- No persistence/serialization of wound history beyond the applied health deltas.

## Proposed Design
1. **Schema extension** (`data/schemas/anatomy.recipe.schema.json`):
   - Add optional `initialDamage` (name TBD) at the recipe root: an object keyed by slot ids (same keys as `slots`/pattern expansions). Each value supports either:
     - `damage_entries: [...]` array of objects matching `damage-capability-entry.schema.json` (reuses APPLY_DAMAGE’s preferred shape: `name`, `amount`, `metadata`, `damage_tags`, optional `damage_multiplier`), or
     - a shorthand `{ amount, damage_type }` preserved for backward authoring convenience but normalized internally to `damage_entry`.
   - Enforce `amount > 0`, require at least one entry per slot, forbid unknown properties. Provide schema examples referencing existing recipes (e.g., `"left_ass": { "damage_entries": [{ "name": "blunt", "amount": 10 }] }`).

2. **Expose slot → part binding**:
   - `AnatomyGraphContext` already tracks slot-to-entity ids during `processBlueprintSlots`; thread this map into the `BodyBlueprintFactory.createAnatomyGraph` result (e.g., `slotToPartMappings`).
   - Propagate through `AnatomyGenerationWorkflow` to the orchestrator and store on the parent’s `anatomy:body` component (plain object) so downstream systems/tests can read it. Include in the `anatomy:anatomy_generated` event payload (`src/anatomy/workflows/stages/eventPublicationStage.js`) for parity with `slotEntityMappings`.

3. **Seeded damage application stage**:
   - Add a post-generation, pre-description hook (new workflow stage invoked in `AnatomyOrchestrator.orchestrateGeneration` after cache build, before `DescriptionGenerationWorkflow.generateAll`).
   - For each `initialDamage` slot entry:
     - Resolve part id via `slotToPartMappings`; if missing, fail fast with a clear error (or opt-in warning-only mode if we need backward compatibility).
     - Normalize entries to `damage_entry` objects and call a new `SeededDamageApplier` that delegates to `DamageResolutionService.resolve` with `isTopLevel` and a custom `executionContext` flag (e.g., `{ origin: 'seeded_damage', suppressPerceptibleEvents: true }`).
     - In `DamageResolutionService`, gate perceptible/narrative dispatch and session cleanup on `executionContext.origin === 'seeded_damage'` so we still update health/state, emit `anatomy:part_health_changed`, and clamp correctly, but avoid noisy action logs for startup wounds. Metadata should preserve the slot id and recipe id for traceability.
   - Ensure the damage accumulator/session is cleaned even when narration is suppressed to avoid polluting subsequent APPLY_DAMAGE calls.

4. **Description flow**:
   - Because seeded damage runs before `AnatomyDescriptionService.generateAllDescriptions`, the initial body/part descriptions and the visualizer panels should already include updated health states. No changes expected in `AnatomyVisualizerUI` aside from verifying it renders the mutated health text.

5. **Authoring ergonomics**:
   - Allow amounts to be positive integers/floats; negative/zero should be rejected.
   - Slot keys must exist in the resolved recipe (after patterns). If patterns add slots, authors can still target those keys directly.
   - Optional future-proofing: accept `state_override` in the schema for direct state setting, but do not implement unless needed—stick to damage amounts for now.

## Testing Plan
- **Schema tests**: extend `tests/unit/schemas/anatomy.recipe.schema.test.js` (or add new) to cover valid/invalid `initialDamage` shapes, unknown slot keys, and shorthand normalization.
- **Unit tests**:
  - New tests for `SeededDamageApplier` covering health clamping, metadata propagation, suppression of perceptible events, and session cleanup.
  - `BodyBlueprintFactory`/`AnatomyGenerationWorkflow` tests ensuring `slotToPartMappings` is emitted and stored on `anatomy:body`.
- **Integration tests**:
  - Add a targeted integration that builds an anatomy with a recipe containing seeded wounds and asserts part health/state and the stored `anatomy:body.slotToPartMappings` are correct.
  - Verify `anatomy:anatomy_generated` payload includes the new mapping and that `DamageResolutionService` respects the suppression flag.
- **E2E**:
  - New scenario that instantiates an entity with a recipe using `initialDamage`, then reads the generated `core:description` (similar to `tests/e2e/actions/regenerateDescriptionAfterDamage.e2e.test.js`) to assert the Health section reflects the pre-seeded wounds.
  - Add a guardrail e2e around APPLY_DAMAGE to ensure existing damage workflows remain unchanged (re-use fixtures in `tests/e2e/actions/` for regression).
  - Manual visualizer check (or automated integration) that selecting the entity in `anatomy-visualizer.html` shows injured parts immediately without triggering perceptible action logs.

## Open Questions / Risks
- Do we want seeded damage to dispatch perceptible events at all? Proposal suppresses them but still emits anatomy health change; confirm with narrative stakeholders.
- Should fatal seeded damage (health <= 0) be allowed? Current pipeline would trigger death checks; decide whether to block or allow for “corpse” setups.
- Slot naming collisions: if two parts share the same generated name, the parts map throws—ensure the new slot mapping prevents ambiguity even when part names collide.
