# Summary
Seeded wounds are already wired end-to-end: recipes accept `initialDamage`, `slotToPartMappings` are persisted, and generation invokes `SeededDamageApplier`. Unit + integration coverage exists for schema validation and the application stage. The remaining gap is proving that pre-seeded wounds show up in the initial generated descriptions (no new visualizer hooks needed).

# File list (expected to touch)
- tests/integration/anatomy/anatomyGenerationWorkflow.seededDamage.integration.test.js (add description assertion for seeded wounds)

# Out of scope
- Changing production recipe content in data/mods beyond isolated test fixtures.
- Altering visualizer UI or adding new UI automation.
- Broad test refactors unrelated to seeded wounds.

# Acceptance criteria
## Tests that must pass
- Newly added/updated integration test covering description output for seeded wounds.
- Existing suites in touched areas continue to pass (targeted integration run is sufficient for this ticket).

## Invariants that must remain true
- APPLY_DAMAGE and unrelated e2e fixtures stay untouched; damage semantics remain unchanged outside seeded initialization.
- Descriptions for entities without `initialDamage` stay identical to current expectations.
- Visualizer behavior remains the same aside from naturally reflecting pre-seeded health states.

# Outcome
- Narrowed scope to the missing coverage: a new integration assertion now proves seeded wounds show up in the first generated description; no schema/unit/e2e additions were necessary because they already exist.
- Left production data and visualizer code untouched; only the seeded-damage integration harness was extended to include description verification and state tracking.

Status: COMPLETED
