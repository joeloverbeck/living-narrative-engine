# DAMAPPMEC-002: Resolve Hit Location Operation

## Description
Implement the `RESOLVE_HIT_LOCATION` operation. This operation is responsible for selecting a specific body part from a target entity based on weighted probabilities defined in `anatomy:part` components.

## Expected File List
- `src/logic/operationHandlers/resolveHitLocationHandler.js` (New)
- `data/schemas/operations/resolveHitLocation.schema.json` (New)
- `tests/unit/logic/operationHandlers/resolveHitLocationHandler.test.js` (New)

## Out of Scope
- Applying damage to the selected part.
- Recursive traversal of the anatomy tree (unless required to find "exposed" parts, but spec implies direct children or a flattened list of exposed parts. Start with direct children/exposed parts logic as per spec).

## Acceptance Criteria

### 1. Operation Schema
- Must define `RESOLVE_HIT_LOCATION` type.
- Parameter: `entity_ref` (Required).
- Return type: `part_id` (string) or `part_ref`.

### 2. Logic Implementation
- Retrieve the target entity.
- Identify eligible parts for a "general hit" (typically exposed parts or direct children).
- Read `hit_probability_weight` from `anatomy:part` component of eligible parts.
- Implement a weighted random selection algorithm.
- Return the ID of the selected part.
- Handle edge case: No parts found (return null or throw error).
- Handle edge case: Zero weights (fallback to uniform or first).

### 3. Unit Tests
- **Mock Data:** Create an entity with 3 parts: Torso (weight 50), Head (weight 10), Arms (weight 40).
- **Distribution Test:** Run the handler 1000 times. Assert that Torso is selected ~50% of the time, Head ~10%, Arms ~40% (allow for statistical variance, e.g., +/- 5%).
- **Zero Weight Test:** Ensure a part with 0 weight is never selected.
- **Missing Component Test:** Handle entities missing `anatomy:part` gracefully (e.g., error or skip).

### Invariants
- The operation must be deterministic if the random seed is controlled (if the engine supports seeded RNG, otherwise standard Math.random is acceptable for now).
- Must not modify the entity state.
