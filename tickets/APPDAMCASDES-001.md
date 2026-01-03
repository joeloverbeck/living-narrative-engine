# APPDAMCASDES-001: Create CascadeDestructionService

**Title:** Create CascadeDestructionService - Core Cascade Logic

**Summary:** Create the new `CascadeDestructionService` class that handles cascading destruction of child body parts when a parent part is destroyed.

## Files to Create

- `src/anatomy/services/cascadeDestructionService.js`
- `tests/unit/anatomy/services/cascadeDestructionService.test.js`

## Files to Modify

- None (pure addition)

## Out of Scope

- DI registration (ticket APPDAMCASDES-002)
- Integration with DamageResolutionService (ticket APPDAMCASDES-005)
- Narrative composition changes (ticket APPDAMCASDES-004)
- DamageAccumulator changes (ticket APPDAMCASDES-003)
- Integration tests (ticket APPDAMCASDES-006)
- E2E tests (ticket APPDAMCASDES-007)

## Implementation Details

### Constructor Dependencies

```javascript
// Dependencies:
// - logger: ILogger
// - entityManager: IEntityManager
// - bodyGraphService: BodyGraphService
// - safeEventDispatcher: ISafeEventDispatcher
```

### Main Method Signature

```javascript
executeCascade(destroyedPartId, ownerEntityId, options = {})
// Returns: { destroyedPartIds: string[], destroyedParts: object[], vitalOrganDestroyed: boolean }
```

### Core Logic

1. Get all descendants via `bodyGraphService.getAllDescendants(destroyedPartId)`
2. Filter to parts with `currentHealth > 0`
3. For each part:
   - Set health to 0 via EntityManager
   - Dispatch `PART_DESTROYED_EVENT` with `cascadedFrom` field
4. Dispatch `CASCADE_DESTRUCTION_EVENT` with all destroyed parts
5. Return result with destroyed parts info and vital organ flag

### Key Imports

```javascript
import { validateDependency } from '../../utils/dependencyUtils.js';
import { PART_HEALTH_COMPONENT_ID } from '../constants/anatomyConstants.js';
import { PART_DESTROYED_EVENT, CASCADE_DESTRUCTION_EVENT } from '../../constants/eventIds.js';
```

## Acceptance Criteria

### Tests That Must Pass

1. `should return empty result when part has no descendants`
2. `should destroy all living descendants when parent destroyed`
3. `should skip descendants already at 0 health`
4. `should dispatch PART_DESTROYED_EVENT for each destroyed child with cascadedFrom field`
5. `should dispatch CASCADE_DESTRUCTION_EVENT with all destroyed parts`
6. `should correctly traverse multi-level hierarchy (grandchildren)`
7. `should identify vital organ destruction correctly`
8. `should handle entity with no health component gracefully`
9. `should use validateDependency for all constructor parameters`

### Invariants

- Service is stateless (no instance state beyond dependencies)
- All events dispatched via ISafeEventDispatcher
- No direct mutation of components (uses EntityManager)
- Logging follows project conventions (debug/info/error levels)
- Method is synchronous (no async/await needed for this ticket)

## Dependencies

- Depends on: Nothing (first ticket)
- Blocks: APPDAMCASDES-002

## Verification Commands

```bash
# Run unit tests
npm run test:unit -- tests/unit/anatomy/services/cascadeDestructionService.test.js

# Lint the new file
npx eslint src/anatomy/services/cascadeDestructionService.js

# Type check
npm run typecheck
```
