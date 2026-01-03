# APPDAMCASDES-001: Create CascadeDestructionService

**Title:** Create CascadeDestructionService - Core Cascade Logic

**Summary:** Create the new `CascadeDestructionService` class that handles cascading destruction of child body parts when a parent part is destroyed.

**Status:** Completed

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
//
// Use BaseService._init for dependency validation (project standard).
```

### Main Method Signature

```javascript
async executeCascade(destroyedPartId, ownerEntityId, options = {})
// Returns: { destroyedPartIds: string[], destroyedParts: object[], vitalOrganDestroyed: boolean }
```

### Core Logic

1. Get all descendants via `bodyGraphService.getAllDescendants(destroyedPartId)`
2. Filter to parts with `currentHealth > 0`
3. For each part:
   - Set health to 0 via EntityManager
   - Dispatch `anatomy:part_destroyed` with schema-compatible payload (entityId, partId, timestamp)
4. Dispatch `anatomy:cascade_destruction` with all destroyed parts (include `cascadedFrom`)
5. Return result with destroyed parts info and vital organ flag

### Key Imports

```javascript
import { BaseService } from '../../utils/serviceBase.js';
```

## Acceptance Criteria

### Tests That Must Pass

1. `should return empty result when part has no descendants`
2. `should destroy all living descendants when parent destroyed`
3. `should skip descendants already at 0 health`
4. `should dispatch anatomy:part_destroyed for each destroyed child (schema-compatible payload)`
5. `should dispatch anatomy:cascade_destruction with all destroyed parts and cascadedFrom`
6. `should correctly traverse multi-level hierarchy (grandchildren)`
7. `should identify vital organ destruction correctly`
8. `should handle entity with no health component gracefully`
9. `should validate all constructor parameters via BaseService._init`

### Invariants

- Service is stateless (no instance state beyond dependencies)
- All events dispatched via ISafeEventDispatcher
- No direct mutation of components (uses EntityManager)
- Logging follows project conventions (debug/info/error levels)
- Method is async to accommodate EntityManager mutations and SafeEventDispatcher

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

## Outcome

Implemented CascadeDestructionService using BaseService dependency validation, schema-compatible `anatomy:part_destroyed` dispatches, and a new `anatomy:cascade_destruction` payload that carries cascadedFrom plus destroyed part details. The service now runs async to await component mutations, includes a `suppressEvents` option, and skips descendants without health components instead of throwing.
