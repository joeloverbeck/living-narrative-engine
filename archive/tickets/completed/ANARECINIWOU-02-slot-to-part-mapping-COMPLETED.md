# Summary
Expose and propagate slot-to-part mappings from anatomy generation so seeded damage (per `specs/anatomy-recipe-initial-wounds.md`) can target concrete parts and downstream systems/events can reference the mapping.

# Status
Completed.

# Reality check (current state)
- `AnatomyGraphContext` tracks slot→entity ids during slot processing, but `BodyBlueprintFactory.createAnatomyGraph` only returns `{ rootId, entities }` and drops the map.
- `AnatomyGenerationWorkflow`/`AnatomyOrchestrator` persist only `root` and `parts` onto `anatomy:body`; any new mapping would currently be discarded. `anatomy:body` schema also disallows extra fields, so storing a mapping would fail validation.
- `anatomy:anatomy_generated` payload includes `partsMap` and `slotEntityMappings` (blueprint slot entities), but no part-level slot mapping.
- No existing unit/integration tests assert slot→part mapping exposure; only `slotEntityMappings` and `partsMap` are covered.

# Updated scope
- Add a `slotToPartMappings` map (slot key → part entity id) to the graph result from `createAnatomyGraph` without changing existing return fields.
- Thread this map through the generation workflow and persist it on `anatomy:body.body.slotToPartMappings` (plain object) alongside `root`/`parts`, updating component schema accordingly. Preserve existing fields.
- Include the mapping in the `anatomy:anatomy_generated` event payload while keeping existing payload fields unchanged.

# File list (expected to touch)
- src/anatomy/bodyBlueprintFactory/bodyBlueprintFactory.js
- src/anatomy/anatomyGraphContext.js (expose mapping getter)
- src/anatomy/workflows/anatomyGenerationWorkflow.js
- src/anatomy/workflows/stages/eventPublicationStage.js
- src/anatomy/orchestration/anatomyOrchestrator.js
- data/mods/anatomy/components/body.component.json (schema update)
- tests/unit/anatomy/* (factory/workflow/event payload coverage for the new mapping)

# Out of scope
- Applying any damage or altering health values.
- Changing blueprint slot resolution logic or slot naming conventions.
- Modifying UI rendering or visualizer logic beyond reading the new mapping.

# Acceptance criteria
- `createAnatomyGraph` returns a `slotToPartMappings` Map keyed by slot id with part entity ids, stable for identical seeds/inputs.
- `anatomy:body` stores the mapping as `body.slotToPartMappings` (plain object), preserving existing `root`, `parts`, and descriptors.
- `anatomy:anatomy_generated` payload includes the mapping (object form) with no regressions to existing fields.
- Unit coverage added for factory/workflow/event payload mapping; integration coverage can remain minimal but should assert payload structure.

# Invariants that must remain true
- Anatomy generation still produces identical part graphs and slot selection behavior when `initialDamage` is absent.
- Event payloads and stored anatomy components retain their previous fields; added mapping is additive and non-breaking.
- Mapping is stable across runs for identical inputs and mirrors existing `slotEntityMappings` semantics (no collisions, same slot keys).

# Outcome
- Added `slotToPartMappings` Map to `createAnatomyGraph` output, normalized (without the null root entry), and threaded through the generation workflow.
- Persisted mapping as `body.slotToPartMappings` on `anatomy:body` (schema updated) and included it in the `anatomy:anatomy_generated` payload.
- Updated unit coverage (factory workflow and event payload) to assert the new mapping; integration scope left unchanged as planned.
