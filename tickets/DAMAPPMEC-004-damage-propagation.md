# DAMAPPMEC-004: Damage Propagation Logic

## Description
Extend the `APPLY_DAMAGE` operation handler to support internal damage propagation. When a part is damaged, the system must check for "child" parts defined in `damage_propagation` rules and potentially apply damage to them as well.

## Expected File List
- `src/logic/operationHandlers/applyDamageHandler.js` (Modify)
- `tests/unit/logic/operationHandlers/applyDamageHandler.test.js` (Modify)

## Out of Scope
- Changes to schemas (should be covered by previous tickets).
- Visual effects or narrative generation (handled by events).

## Acceptance Criteria

### 1. Propagation Logic
- After applying direct damage to the `target_part`:
  - Retrieve `damage_propagation` rules from `target_part`'s `anatomy:part` component.
  - Iterate through each potential child target.
- **Condition Check:**
  - If `damage_types` filter is present, ensure incoming `damage_type` is in the list.
  - Roll probability (0.0 - 1.0).
- **Recursion:**
  - If check passes: Calculate `child_damage = input_damage * damage_fraction`.
  - recursively execute `APPLY_DAMAGE` for the child part.
  - Ensure the recursive call marks the damage source (or just passes through) so events indicate it propagated (optional based on spec, spec says `propagatedFrom` in event payload).

### 2. Cycle Prevention
- Ensure that propagation is strictly Parent -> Child (DAG structure) to prevent infinite loops. (The anatomy structure is a DAG, so following children is safe, but verify logic doesn't go upstream).

### 3. Unit Tests
- **Propagation Success:** Mock Parent (Torso) -> Child (Heart, 100% chance, 0.5 fraction). Apply 20 to Torso. Assert Torso takes 20, Heart takes 10.
- **Propagation Fail (Chance):** Mock Parent -> Child (0% chance). Apply damage. Assert Child takes 0.
- **Propagation Fail (Type):** Mock Parent -> Child (Type: "piercing"). Apply "blunt" damage. Assert Child takes 0.
- **Event Verification:** Check that the child's damage event includes `propagatedFrom: <parent_id>` (if spec allows passing this context).

### Invariants
- Total damage applied to the system can exceed the initial input damage (since propagation adds *more* damage to children, it doesn't split the initial damage).
- Parent destruction does not automatically destroy children (unless implicit logic exists, but spec focuses on damage propagation).
