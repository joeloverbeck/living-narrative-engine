# WEADAMCAPREF-003: Implement has_damage_capability operator

## Summary

Create a new JSON Logic operator `has_damage_capability` that checks if an entity has a specific damage type in its `damage_capabilities` component entries array. This operator will be used in action conditions and scope filters.

## Dependencies

- WEADAMCAPREF-002 (damage_capabilities component must exist)

## Files to Touch

| File | Action | Description |
|------|--------|-------------|
| `src/logic/operators/hasDamageCapabilityOperator.js` | CREATE | New operator class |
| `src/logic/jsonLogicCustomOperators.js` | UPDATE | Register operator |
| `tests/unit/logic/operators/hasDamageCapabilityOperator.test.js` | CREATE | Unit tests |

## Out of Scope

- Service refactoring (WEADAMCAPREF-004)
- Action/scope updates (WEADAMCAPREF-006, WEADAMCAPREF-007)
- Rule modifications (WEADAMCAPREF-008)
- ApplyDamageHandler changes (WEADAMCAPREF-005)

## Implementation Details

### Operator Class

Create `src/logic/operators/hasDamageCapabilityOperator.js`:

```javascript
/**
 * @file Operator to check if entity has a specific damage capability
 */

import BaseOperator from './baseOperator.js';

class HasDamageCapabilityOperator extends BaseOperator {
  static get operatorName() {
    return 'has_damage_capability';
  }

  /**
   * @param {Array} args - [entity_ref, damage_type_name]
   * @param {Object} context - Evaluation context
   * @returns {boolean} True if entity has the damage capability
   */
  execute(args, context) {
    const [entityRef, damageTypeName] = args;

    const entity = this.resolveEntityRef(entityRef, context);
    if (!entity) return false;

    const capabilities = this.#entityManager.getComponent(
      entity.id,
      'damage-types:damage_capabilities'
    );

    if (!capabilities?.entries) return false;

    return capabilities.entries.some(entry => entry.name === damageTypeName);
  }
}

export default HasDamageCapabilityOperator;
```

### Registration

Add to `src/logic/jsonLogicCustomOperators.js`:
1. Import the operator class
2. Create instance with dependencies
3. Register in the `registerOperators` method

### Usage in JSON Logic

```json
{ "has_damage_capability": ["primary", "slashing"] }
{ "has_damage_capability": [".", "piercing"] }
```

## Acceptance Criteria

### Tests That Must Pass

1. `npm run test:unit -- tests/unit/logic/operators/hasDamageCapabilityOperator.test.js`

Test cases:
- Entity has matching damage type → returns `true`
- Entity has different damage type only → returns `false`
- Entity has no `damage_capabilities` component → returns `false`
- Entity has multiple entries, one matches → returns `true`
- Entity reference is invalid/null → returns `false`
- Damage type name is empty string → returns `false`
- Entity has component but empty entries array → returns `false`

2. `npm run typecheck` - No type errors

### Invariants That Must Remain True

1. Operator follows existing operator patterns in the codebase
2. Operator uses dependency injection properly
3. Operator is registered with correct name `has_damage_capability`
4. Operator handles edge cases gracefully (returns false, doesn't throw)
5. Existing operators remain functional

## Estimated Size

- 1 new operator file (~60 lines)
- 1 registration update (~10 lines)
- 1 new test file (~150 lines)
