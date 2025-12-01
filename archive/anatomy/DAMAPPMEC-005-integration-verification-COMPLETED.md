# DAMAPPMEC-005: Integration Verification

## Status
Completed

## Description
Create an integration test suite to verify end-to-end Damage Application Mechanics behavior (targeting, damage, propagation) using the real `ApplyDamageHandler` with the in-memory entity manager/event bus.

## Reality Check
- Existing unit tests cover propagation logic, but there is no integration coverage that stitches targeting, health updates, events, and propagation together.
- `ApplyDamageHandler` emits destruction via `anatomy:part_destroyed` when health reaches zero; no `is_destroyed` flag is present on components.
- Untargeted hits rely on `hit_probability_weight` via `BodyGraphService.getAllParts` and Math.random; deterministic RNG stubs are required for predictable assertions.

## Expected File List
- `tests/integration/anatomy/damage-application.integration.test.js` (New)

## Out of Scope
- Performance benchmarking.
- Narrative text generation testing.

## Acceptance Criteria

### 1. Integration Test Suite
- **Setup:** Build a dummy actor entity with `anatomy:body` whose root part has children (Torso -> [Head, Arm, Heart]); children are linked via `anatomy:joint`. Use realistic weights: Torso 50 (propagates to Heart on piercing at 0.5 fraction, probability 1), Head 20, Arm 30, Heart 0 (internal, excluded from random hits).
- **Scenario 1: Targeted Hit**
  - Action: Apply 50 Cutting damage specifically to "Arm".
  - Assert: Arm health -50 and state reflects new percentage; Torso, Head, Heart unchanged. Events `anatomy:damage_applied` and `anatomy:part_health_changed` fired for Arm only.
- **Scenario 2: General Hit Resolution**
  - Action: Apply damage with `part_ref: null` multiple times using deterministic `Math.random` stubs.
  - Assert: Untargeted hits respect hit weights (Torso, Head, Arm all selected over several calls; Heart ignored because weight 0). Health updates only on hit parts.
- **Scenario 3: Propagation Chain**
  - Action: Apply 40 Piercing damage to Torso.
  - Assert: Torso health -40; Heart health -20 via propagation rule; events emitted for both parts with `propagatedFrom` set on the child event.
- **Scenario 4: Threshold & Destruction**
  - Action: Deal lethal damage to Head.
  - Assert: Head health reaches 0 and state `destroyed`; event `anatomy:part_destroyed` fired (no separate `is_destroyed` flag exists).

### Invariants
- System tolerates missing optional data (e.g., propagation rules) without crashing.
- Damage events (`anatomy:damage_applied`, `anatomy:part_health_changed`, `anatomy:part_destroyed`) dispatch through the shared event dispatcher mocked/spied in the test harness.

## Outcome
- Added `tests/integration/anatomy/damage-application.integration.test.js` that exercises targeted hits, weighted untargeted hits (with deterministic RNG), propagation to child parts, and destruction signaling using the real handler plus `SimpleEntityManager`/`BodyGraphService`.
- Clarified assumptions to match current behavior (no `is_destroyed` flag, weight-based random selection requiring controlled RNG, propagation gated by `anatomy:joint` parenting and damage type).
- No runtime code changes were required; existing handler logic satisfied the scenarios once covered by integration tests.
