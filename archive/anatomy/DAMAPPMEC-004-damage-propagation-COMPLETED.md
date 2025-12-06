# DAMAPPMEC-004: Damage Propagation Logic

## Status

Completed

## Description

Implement internal damage propagation in `APPLY_DAMAGE` so hits on a part can forward damage to its child parts according to `anatomy:part.damage_propagation` rules.

## Reality Check (code/tests vs spec)

- `applyDamageHandler` currently applies only direct damage; it never reads `damage_propagation` and never recurses.
- `anatomy:damage_applied` events omit the `propagatedFrom` field shown in `specs/damage-application-mechanics.md`.
- No unit tests cover propagation, probability gating, or damage-type filtering.

## Updated Acceptance Criteria

1. **Propagation Logic**

- After direct damage is applied to the target part, read its `damage_propagation` map (keys are child part IDs).
- For each entry: optionally filter by `damage_types` (if present and non-empty); roll against `probability` (default 1.0, clamp 0-1); compute `childDamage = amount * (damage_fraction || 0.5)`.
- Only propagate to parts that are actual children of the damaged part (via joint parentId/parentEntityId check) to avoid upstream loops.
- Invoke `APPLY_DAMAGE` on the child with the same `entity_ref`, the calculated damage, and mark the call as propagated from the parent.

2. **Event Context**

- `anatomy:damage_applied` payload should include `propagatedFrom` (null for the initial hit, parent part ID for propagated hits) per spec example.

3. **Tests** (unit)

- Propagation success: parent->child with 100% probability, fraction 0.5; child takes half the damage.
- Propagation blocked by probability (0): child takes none.
- Propagation blocked by damage type filter: child takes none when types do not match.
- Event carries `propagatedFrom` on propagated child damage.

## Out of Scope

- Schema changes (already present).
- Visual/narrative effects.

## Notes

- Total system damage can exceed the original input; we do not split damage among parts.
- Parent destruction alone does not auto-destroy children unless their own health reaches 0.

## Outcome

- Added propagation handling in `APPLY_DAMAGE` driven by `damage_propagation` rules with probability/type gating, child verification via joint parentage, and recursive calls carrying propagation context.
- `anatomy:damage_applied` events now include `propagatedFrom` (null on the initial strike, parent ID on propagated hits) per spec.
- New unit tests cover propagation success, probability/type blocks, and child validation to lock in the behavior.
