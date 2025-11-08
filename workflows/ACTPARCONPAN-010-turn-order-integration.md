# ACTPARCONPAN-010: Turn Order System Integration

## Ticket Information
- **ID**: ACTPARCONPAN-010
- **Phase**: 3 - Integration
- **Estimated Time**: 3-4 hours
- **Complexity**: Medium-High
- **Dependencies**: ACTPARCONPAN-003

## Scope
Integrate the participation component with the turn order system to skip non-participating actors in the turn queue, preventing LLM API calls for disabled actors.

## CRITICAL ARCHITECTURE NOTES

### Integration Point Discovery
After thorough codebase analysis, the correct integration point is:
- **File**: `src/turns/turnCycle.js`
- **Method**: `nextActor()` (line 31-46)
- **Reason**: This is the lowest level with access to entityManager

### Why NOT TurnOrderService or Queue Classes
- `TurnOrderService` constructor receives ONLY `{ logger }` - NO entityManager
- Queue classes (`InitiativePriorityQueue`, `SimpleRoundRobinQueue`) have NO dependencies
- The turn order layer is intentionally decoupled from entity management
- **Architecture**: `TurnManager` → `TurnCycle` (has access) → `TurnOrderService` (no access) → `Queue`

### Validated File Locations
- ✅ `src/turns/turnCycle.js` - **CORRECT INTEGRATION FILE**
- ✅ `src/turns/order/turnOrderService.js` - Service layer (no entityManager)
- ✅ `src/turns/order/queues/initiativePriorityQueue.js` - Queue implementation
- ✅ `src/turns/order/queues/simpleRoundRobinQueue.js` - Alternative queue
- ✅ `src/constants/componentIds.js` - Contains PARTICIPATION_COMPONENT_ID

### Validated Method Names
- `TurnCycle.nextActor()` - Returns Entity instance or null
- `TurnOrderService.getNextEntity()` - Returns Entity instance or null
- Queue classes use `getNext()` - No "Actor" or "Entity" suffix

### Validated Component Access Patterns
```javascript
// CORRECT: Component data access (NO nested dataSchema property)
const participationData = entityManager.getComponentData(entityId, PARTICIPATION_COMPONENT_ID);
const isParticipating = participationData?.participating ?? true;

// CORRECT: Alternative using entity instance
const participationData = entity.getComponentData(PARTICIPATION_COMPONENT_ID);
const isParticipating = participationData?.participating ?? true;

// WRONG: There is NO dataSchema nesting
// participationData?.dataSchema?.participating ← INCORRECT
```

### Validated Constants
```javascript
// From src/constants/componentIds.js (line 12)
export const PARTICIPATION_COMPONENT_ID = 'core:participation';
```

## Detailed Tasks

### 1. Add EntityManager Dependency to TurnCycle
- [ ] Modify `TurnCycle` constructor to accept `entityManager` parameter
- [ ] Add validation for entityManager dependency
- [ ] Store as private field `#entityManager`
- [ ] Update TurnManager to pass entityManager when constructing TurnCycle

### 2. Import Participation Constant
- [ ] Add import to `src/turns/turnCycle.js`:
```javascript
import { PARTICIPATION_COMPONENT_ID } from '../../constants/componentIds.js';
```

### 3. Modify nextActor() Method
- [ ] Locate `nextActor()` method in TurnCycle (currently line 31-46)
- [ ] Implement participation filtering with while loop
- [ ] Skip actors with `participating: false`
- [ ] Maintain existing turn order logic
- [ ] Handle edge case: all actors non-participating

### 4. Debug Logging
- [ ] Add debug log when skipping an actor (use `this.#logger`)
- [ ] Log actor ID and participation state
- [ ] Use existing logger instance from TurnCycle

### 5. Edge Case Handling
- [ ] Handle scenario where all actors have `participating: false`
- [ ] Prevent infinite loops if no participating actors exist
- [ ] Add max iterations safety check based on queue size
- [ ] Log warning if all actors are skipped

## Files Modified
- `src/turns/turnCycle.js` - Add participation filtering to nextActor()
- `src/turns/turnManager.js` - Pass entityManager to TurnCycle constructor

## Code Changes

### File 1: src/turns/turnCycle.js

#### Add Import
```javascript
// Add at top of file after existing imports
import { PARTICIPATION_COMPONENT_ID } from '../../constants/componentIds.js';
```

#### Update Constructor
```javascript
/**
 * Creates an instance of TurnCycle.
 *
 * @param {ITurnOrderService} service - The turn order service to wrap.
 * @param {import('../entities/entityManager.js').default} entityManager - The entity manager for component access.
 * @param {ILogger} logger - The logger service.
 */
constructor(service, entityManager, logger) {
  // Validate entityManager
  if (!entityManager || typeof entityManager.getComponentData !== 'function') {
    throw new Error('TurnCycle requires a valid EntityManager instance.');
  }

  this.#service = service;
  this.#entityManager = entityManager;
  this.#logger = logger;
}
```

#### Update nextActor() Method
```javascript
/**
 * Gets the next participating actor from the turn order service.
 * Skips actors with participating: false in their participation component.
 *
 * @async
 * @returns {Promise<import('../entities/entity.js').default | null>} The next participating entity or null if the queue is empty.
 */
async nextActor() {
  try {
    if (await this.#service.isEmpty()) {
      this.#logger.debug('TurnCycle.nextActor(): queue empty');
      return null;
    }

    // Safety limit: maximum attempts = current queue size or 50 (whichever is smaller)
    const queueSize = this.#service.getCurrentOrder().length;
    const maxAttempts = Math.min(queueSize || 50, 50);
    let attempts = 0;

    while (attempts < maxAttempts) {
      const entity = await this.#service.getNextEntity();

      if (!entity) {
        // Queue exhausted
        this.#logger.debug('TurnCycle.nextActor(): queue returned null');
        return null;
      }

      // Check participation component
      // IMPORTANT: getComponentData returns the data directly - NO nested dataSchema
      const participationData = this.#entityManager.getComponentData(
        entity.id,
        PARTICIPATION_COMPONENT_ID
      );

      // Default to true for backward compatibility
      const isParticipating = participationData?.participating ?? true;

      if (isParticipating) {
        // Actor is participating, return normally
        this.#logger.debug(
          `TurnCycle.nextActor(): Selected participating actor ${entity.id}`
        );
        return entity;
      }

      // Actor not participating, skip and try next
      this.#logger.debug(
        `TurnCycle.nextActor(): Skipping actor ${entity.id} - participation disabled`
      );
      attempts++;
    }

    // All actors exhausted or all non-participating
    this.#logger.warn(
      'TurnCycle.nextActor(): No participating actors found in turn queue after ' +
      `${attempts} attempts (max: ${maxAttempts})`
    );
    return null;
  } catch (error) {
    this.#logger.error('TurnCycle.nextActor(): failed', error);
    throw error;
  }
}
```

### File 2: src/turns/turnManager.js

#### Update TurnCycle Construction
```javascript
// In constructor, around line 174, update this line:
// OLD: this.#turnCycle = new TurnCycle(turnOrderService, logger);
// NEW:
this.#turnCycle = new TurnCycle(turnOrderService, entityManager, logger);
```

## Acceptance Criteria
- [ ] TurnCycle constructor accepts entityManager parameter
- [ ] TurnCycle validates entityManager dependency
- [ ] TurnManager passes entityManager to TurnCycle
- [ ] Participation component constant imported correctly
- [ ] `nextActor()` method modified with participation check
- [ ] While loop skips actors with `participating: false`
- [ ] Component data accessed correctly (NO dataSchema nesting)
- [ ] Default participation is `true` (backward compatible)
- [ ] Edge case handled: all actors non-participating
- [ ] Infinite loop prevention implemented with max attempts
- [ ] Debug logging added for skipped actors
- [ ] Warning logged when no participating actors found
- [ ] Existing turn order logic preserved
- [ ] No ESLint errors
- [ ] TypeScript type checking passes

## Validation Steps
1. Run `npx eslint src/turns/turnCycle.js src/turns/turnManager.js`
2. Run `npm run typecheck`
3. Create unit test: Verify skip logic with mock actors in TurnCycle
4. Create unit test: Test all-non-participating scenario
5. Create integration test: Full turn cycle with mixed participation states
6. Manual test: Toggle participation and observe turn skipping
7. Verify LLM API calls are NOT made for disabled actors (check logs)
8. Test both queue types: InitiativePriorityQueue and SimpleRoundRobinQueue

## Testing Considerations

### Unit Tests Required
- `TurnCycle.constructor()` - Validates entityManager dependency
- `TurnCycle.nextActor()` - Skips non-participating actors
- `TurnCycle.nextActor()` - Returns participating actors normally
- `TurnCycle.nextActor()` - Handles all non-participating (returns null)
- `TurnCycle.nextActor()` - Respects max attempts limit
- `TurnCycle.nextActor()` - Defaults to participating=true when component missing

### Integration Tests Required
- Full turn cycle with mixed participation states
- Round transitions with participation changes
- Both queue strategies (initiative and round-robin)

## Discovery Notes

**Actual integration architecture:**
```
TurnManager (has entityManager, logger, turnOrderService)
    ├── Creates: TurnCycle(turnOrderService, entityManager, logger)
    │       └── Wraps: TurnOrderService (has logger only)
    │               └── Uses: Queue classes (no dependencies)
    └── Creates: RoundManager(turnOrderService, entityManager, logger)
```

**Key architectural decision:**
The turn order service and queue layer are intentionally pure and decoupled from entity management. The TurnCycle wrapper is the architectural boundary where entity-aware logic (like participation filtering) should be applied.

**Method signatures validated:**
- `TurnCycle.nextActor()` - async, returns Promise<Entity | null>
- `TurnOrderService.getNextEntity()` - sync, returns Entity | null
- `InitiativePriorityQueue.getNext()` - sync, returns Entity | null
- `SimpleRoundRobinQueue.getNext()` - sync, returns Entity | null

**Component access validated:**
```javascript
// Participation component schema (data/mods/core/components/participation.component.json)
{
  "dataSchema": {
    "type": "object",
    "properties": {
      "participating": {
        "type": "boolean",
        "default": true
      }
    }
  }
}

// At runtime, getComponentData returns the properties directly:
const data = entityManager.getComponentData(id, 'core:participation');
// data = { participating: true } or { participating: false }
// NOT: { dataSchema: { participating: true } }
```

**Import paths validated:**
- From `src/turns/turnCycle.js` to constants: `../../constants/componentIds.js` ✓
- From `src/turns/turnManager.js` to constants: `../constants/componentIds.js` ✓

## Notes
- Default participation to `true` for backward compatibility
- Safety limit prevents infinite loops (max 50 attempts or queue size)
- Preserve all existing turn order behavior (initiative, priority)
- The participation filter should be transparent to other systems
- Test thoroughly with both queue strategies
- Component data access is DIRECT - no dataSchema nesting at runtime
- Entity instances are returned, not just IDs
- Logger usage: TurnCycle has `this.#logger` available
