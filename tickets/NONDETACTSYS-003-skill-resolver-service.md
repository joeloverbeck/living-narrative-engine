# NONDETACTSYS-003: Implement SkillResolverService

## Summary

Create the `SkillResolverService` that retrieves skill values from entity components with default fallback. This service is a core building block for the non-deterministic action system.

## Files to Create

| File | Purpose |
|------|---------|
| `src/combat/services/SkillResolverService.js` | Service implementation |
| `src/combat/index.js` | Module exports for combat services |
| `tests/unit/combat/services/SkillResolverService.test.js` | Unit tests |

## Files to Modify

| File | Change |
|------|--------|
| `src/dependencyInjection/tokens/tokens-core.js` | Add `SkillResolverService` token |

## Implementation Details

### SkillResolverService.js

```javascript
/**
 * @file SkillResolverService - Retrieves skill values from entity components
 * @see specs/non-deterministic-actions-system.md
 */

import { validateDependency } from '../../utils/dependencyUtils.js';

class SkillResolverService {
  #entityManager;
  #logger;

  /**
   * @param {Object} params
   * @param {Object} params.entityManager - IEntityManager implementation
   * @param {Object} params.logger - ILogger implementation
   */
  constructor({ entityManager, logger }) {
    validateDependency(entityManager, 'IEntityManager', logger, {
      requiredMethods: ['getComponentData', 'hasComponent'],
    });
    this.#entityManager = entityManager;
    this.#logger = logger;
  }

  /**
   * Retrieves a skill value from an entity's component
   * @param {string} entityId - Entity to query
   * @param {string} skillComponentId - e.g., 'skills:melee_skill'
   * @param {number} [defaultValue=0] - Fallback if component missing
   * @returns {{ baseValue: number, hasComponent: boolean }}
   */
  getSkillValue(entityId, skillComponentId, defaultValue = 0) {
    // Implementation with logging and error handling
  }
}

export default SkillResolverService;
```

### API Contract

```javascript
/**
 * @param {string} entityId - Entity to query
 * @param {string} skillComponentId - Component ID (e.g., 'skills:melee_skill')
 * @param {number} [defaultValue=0] - Fallback if component/property missing
 * @returns {{ baseValue: number, hasComponent: boolean }}
 */
getSkillValue(entityId, skillComponentId, defaultValue = 0)
```

### DI Token

Add to `tokens-core.js`:
```javascript
SkillResolverService: 'SkillResolverService',
```

## Out of Scope

- **DO NOT** create DI registration file (separate ticket NONDETACTSYS-008)
- **DO NOT** modify any existing services
- **DO NOT** implement modifier aggregation (separate service)
- **DO NOT** implement probability calculation (separate service)
- **DO NOT** create integration tests (unit tests only)

## Acceptance Criteria

### Tests That Must Pass

```bash
# Unit tests for the service
npm run test:unit -- --testPathPattern="SkillResolverService"

# Type checking
npm run typecheck

# Lint
npx eslint src/combat/services/SkillResolverService.js
```

### Required Test Cases

1. **Returns skill value when component exists**
   - Entity has skill component with value
   - Returns `{ baseValue: [value], hasComponent: true }`

2. **Returns default when component missing**
   - Entity does not have skill component
   - Returns `{ baseValue: [defaultValue], hasComponent: false }`

3. **Returns default when entity doesn't exist**
   - Invalid entityId
   - Returns `{ baseValue: [defaultValue], hasComponent: false }`
   - Logs warning

4. **Handles custom property paths**
   - Component has nested property structure
   - Extracts value correctly

5. **Constructor validates dependencies**
   - Missing entityManager throws
   - Missing logger throws

### Invariants That Must Remain True

- [ ] Service follows existing DI patterns
- [ ] All methods have JSDoc comments
- [ ] Error handling follows project patterns (dispatch events, don't log directly)
- [ ] No direct console logging
- [ ] Unit test coverage >= 90%
- [ ] No modifications to existing files except tokens-core.js

## Directory Structure

After completion:

```
src/combat/
├── services/
│   └── SkillResolverService.js
└── index.js

tests/unit/combat/
└── services/
    └── SkillResolverService.test.js
```

## Dependencies

- **Depends on**: NONDETACTSYS-001 (needs skill components to exist for meaningful testing)
- **Blocked by**: Nothing (can mock components in tests)
- **Blocks**: NONDETACTSYS-007 (ResolveOutcomeHandler uses this service)

## Reference Files

| File | Purpose |
|------|---------|
| `src/clothing/services/clothingAccessibilityService.js` | Service pattern reference |
| `src/logic/operationHandlers/baseOperationHandler.js` | DI validation pattern |
| `tests/unit/clothing/services/clothingAccessibilityService.test.js` | Test pattern |
