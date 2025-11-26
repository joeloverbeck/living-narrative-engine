# NONDETACTSYS-010: Create getSkillValue JSON Logic Operator

## Summary

Create a custom JSON Logic operator `getSkillValue` that retrieves skill values from entity components. This operator enables conditions and modifiers to reference skill values in JSON Logic expressions.

## Files to Create

| File | Purpose |
|------|---------|
| `src/logic/operators/getSkillValueOperator.js` | Operator implementation |
| `tests/unit/logic/operators/getSkillValueOperator.test.js` | Unit tests |

## Files to Modify

| File | Change |
|------|--------|
| `src/logic/jsonLogicCustomOperators.js` | Register getSkillValue operator |

## Implementation Details

### getSkillValueOperator.js

```javascript
/**
 * @file getSkillValue JSON Logic operator
 * @description Retrieves skill values from entity components for use in conditions
 * @see specs/non-deterministic-actions-system.md
 */

/**
 * Creates the getSkillValue operator
 * @param {Object} dependencies
 * @param {Object} dependencies.entityManager - IEntityManager instance
 * @param {Object} dependencies.logger - ILogger instance
 * @returns {Function} JSON Logic operator function
 */
export function createGetSkillValueOperator({ entityManager, logger }) {
  /**
   * getSkillValue operator
   * @param {Array} args - [entityRef, componentId, propertyPath, defaultValue]
   * @param {Object} data - JSON Logic evaluation context
   * @returns {number} Skill value or default
   *
   * Usage in JSON:
   * { "getSkillValue": ["actor", "skills:melee_skill", "value", 0] }
   */
  return function getSkillValue(args, data) {
    const [entityRef, componentId, propertyPath = 'value', defaultValue = 0] = args;

    // Resolve entity reference from data context
    const entityId = resolveEntityReference(entityRef, data);
    if (!entityId) {
      logger.warn(`getSkillValue: Could not resolve entity reference "${entityRef}"`);
      return defaultValue;
    }

    // Get component data
    if (!entityManager.hasComponent(entityId, componentId)) {
      return defaultValue;
    }

    const componentData = entityManager.getComponentData(entityId, componentId);
    if (!componentData) {
      return defaultValue;
    }

    // Extract value from property path
    const value = extractPropertyValue(componentData, propertyPath);
    return value !== undefined ? value : defaultValue;
  };
}

/**
 * Resolves entity reference from context
 * @param {string} ref - Entity reference (e.g., "actor", "target", "primary")
 * @param {Object} data - Evaluation context
 * @returns {string|null} Entity ID or null
 */
function resolveEntityReference(ref, data) {
  // Handle direct entity ID
  if (typeof ref === 'string' && !['actor', 'target', 'primary', 'secondary'].includes(ref)) {
    return ref;
  }

  // Handle standard references
  switch (ref) {
    case 'actor':
      return data.actorId || data.event?.payload?.actorId;
    case 'target':
      return data.targetId || data.event?.payload?.targetId;
    case 'primary':
      return data.primaryId || data.event?.payload?.primaryId;
    case 'secondary':
      return data.secondaryId || data.event?.payload?.secondaryId;
    default:
      return null;
  }
}

/**
 * Extracts value from nested property path
 * @param {Object} obj - Object to extract from
 * @param {string} path - Dot-separated path (e.g., "value" or "stats.strength")
 * @returns {*} Extracted value or undefined
 */
function extractPropertyValue(obj, path) {
  return path.split('.').reduce((current, key) => {
    return current && current[key] !== undefined ? current[key] : undefined;
  }, obj);
}

export default createGetSkillValueOperator;
```

### JSON Logic Usage

```json
// Get actor's melee skill
{ "getSkillValue": ["actor", "skills:melee_skill", "value", 0] }

// Get target's defense skill with custom default
{ "getSkillValue": ["target", "skills:defense_skill", "value", 10] }

// Use in a comparison condition
{
  ">=": [
    { "getSkillValue": ["actor", "skills:melee_skill", "value", 0] },
    50
  ]
}

// Use in conditional modifier
{
  "if": [
    { ">=": [{ "getSkillValue": ["actor", "skills:melee_skill", "value", 0] }, 80] },
    { "+": [{ "var": "baseChance" }, 10] },
    { "var": "baseChance" }
  ]
}
```

### jsonLogicCustomOperators.js Modification

```javascript
// In the registerCustomOperators function
import { createGetSkillValueOperator } from './operators/getSkillValueOperator.js';

// Add to operator registration
jsonLogic.add_operation('getSkillValue', createGetSkillValueOperator({
  entityManager,
  logger,
}));
```

## Out of Scope

- **DO NOT** modify any action definitions
- **DO NOT** modify the SkillResolverService (use entityManager directly)
- **DO NOT** create integration tests (unit tests only)
- **DO NOT** implement modifier collection logic

## Acceptance Criteria

### Tests That Must Pass

```bash
# Unit tests for the operator
npm run test:unit -- --testPathPattern="getSkillValueOperator"

# Type checking
npm run typecheck

# Lint
npx eslint src/logic/operators/getSkillValueOperator.js
```

### Required Test Cases

#### Basic Retrieval Tests
1. Returns skill value when component exists
2. Returns default when component missing
3. Returns default when entity not found
4. Handles nested property paths

#### Entity Reference Resolution Tests
1. Resolves "actor" from context.actorId
2. Resolves "target" from context.targetId
3. Resolves "primary" from context.primaryId
4. Resolves "secondary" from context.secondaryId
5. Resolves direct entity ID string

#### Edge Cases
1. Empty component data returns default
2. Invalid property path returns default
3. Null/undefined args handled gracefully
4. Missing args use defaults

#### Integration with JSON Logic
1. Works in comparison operations (>=, <=, ==)
2. Works in arithmetic operations (+, -, *)
3. Works in conditional operations (if)
4. Works with other custom operators

### Invariants That Must Remain True

- [ ] Operator follows JSON Logic operator patterns
- [ ] All existing JSON Logic operations unaffected
- [ ] Entity reference resolution matches existing patterns
- [ ] Operator is stateless (pure function)
- [ ] Unit test coverage >= 90%
- [ ] No modifications to existing operators

## Dependencies

- **Depends on**: NONDETACTSYS-001 (skill components for meaningful tests)
- **Blocked by**: Nothing (can mock in tests)
- **Blocks**: NONDETACTSYS-011 (ActionFormattingStage may use this for chance calculation)

## Reference Files

| File | Purpose |
|------|---------|
| `src/logic/operators/hasFreeGrabbingAppendagesOperator.js` | Operator pattern reference |
| `src/logic/operators/isRemovalBlockedOperator.js` | Entity resolution pattern |
| `src/logic/jsonLogicCustomOperators.js` | Registration location |
| `tests/unit/logic/operators/hasFreeGrabbingAppendagesOperator.test.js` | Test pattern |
