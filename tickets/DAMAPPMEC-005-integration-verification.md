# DAMAPPMEC-005: Integration Verification

## Description
Create an integration test suite to verify the holistic behavior of the Damage Application Mechanics. This ensures that targeting, damage application, and propagation work together correctly within the ECS environment.

## Expected File List
- `tests/integration/damage-mechanics.test.js` (New)

## Out of Scope
- Performance benchmarking.
- Narrative text generation testing.

## Acceptance Criteria

### 1. Integration Test Suite
- **Setup:** Construct a dummy entity with a multi-level anatomy (e.g., Torso -> [Head, Arm, Heart]).
  - Torso: Weight 50, Propagates to Heart (piercing only).
  - Head: Weight 20.
  - Arm: Weight 30.
  - Heart: Internal.
- **Scenario 1: Targeted Hit:**
  - Action: Apply 50 Cutting damage specifically to "Arm".
  - Assert: Arm health -50. Torso, Head, Heart untouched. Events fired for Arm.
- **Scenario 2: General Hit Resolution:**
  - Action: Apply damage with `part_ref: null` multiple times.
  - Assert: Different parts are hit over time according to weights.
- **Scenario 3: Propagation Chain:**
  - Action: Apply 40 Piercing damage to Torso.
  - Assert: Torso health -40. Heart health -20 (assuming 0.5 fraction).
  - Assert: Correct events for both Torso and Heart.
- **Scenario 4: Threshold & Destruction:**
  - Action: Deal lethal damage to Head.
  - Assert: Head status "Destroyed". `is_destroyed` true. Event `anatomy:part_destroyed` fired.

### Invariants
- The system must not crash on missing optional data.
- Events must be dispatched to the global event bus (mocked/spied in test).
