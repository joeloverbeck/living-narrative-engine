# Summary
Align the seeded damage path with its intended quiet semantics: suppress perceptible/narrative dispatch when seeded damage runs while preserving health updates, clamping, metadata threading, propagation, and session cleanup.

# Status
Completed

# Reality check (pre-fix)
- Seeded damage plumbing existed (`SeededDamageApplier` invoked from `AnatomyGenerationWorkflow`) and tagged `executionContext.origin = 'seeded_damage'`, but `DamageResolutionService` ignored the flag, so seeded wounds produced narratives/perceptible events.
- Session creation/cleanup and clamping already worked for seeded calls because they reused the standard path, but suppression intent lacked coverage.

# File list (touched)
- src/logic/services/damageResolutionService.js
- src/logic/services/SeededDamageApplier.js
- tests/unit/logic/services/damageResolutionService.test.js
- tests/unit/logic/services/seededDamageApplier.test.js

# Acceptance criteria
## Tests that must pass
- Unit coverage that proves seeded damage suppresses perceptible/narrative dispatch while still emitting `anatomy:part_health_changed` and preserving clamping/session cleanup.
- Existing damage unit/integration tests continue to pass (no regressions in APPLY_DAMAGE).

## Invariants that must remain true
- Standard APPLY_DAMAGE calls remain unchanged in behavior and output.
- Damage sessions do not leak across calls; seeded damage cleanup mirrors normal flow.
- Metadata (including slot/recipe identifiers where provided) persists through the seeded path.

# Outcome
- `DamageResolutionService` now checks seeded/suppression flags and skips narrative composition and perceptible event dispatch while still finalizing the damage session and emitting health updates/events.
- `SeededDamageApplier` explicitly marks seeded calls with `suppressPerceptibleEvents` and metadata for downstream consumers.
- Added unit coverage for both suppression in the resolver and the applier’s flag propagation; targeted unit suites pass.
