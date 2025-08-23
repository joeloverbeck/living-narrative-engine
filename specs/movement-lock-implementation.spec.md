# Movement Lock Implementation Specification

**STATUS: NOT IMPLEMENTED - SPECIFICATION FOR FUTURE WORK**

## 1. Feature Overview

### 1.1 Purpose

Implement movement locking mechanism for `kneel_before` and `stand_up` actions to prevent unrealistic movement while an actor is kneeling. This ensures physical realism where kneeling actors cannot move to other locations until they stand up.

### 1.2 Success Criteria (TO BE ACHIEVED)

- ❌ Actors who kneel have their movement locked automatically
- ❌ Movement lock works for both legacy entities and anatomy-based entities
- ❌ Standing up removes the movement lock
- ❌ System handles edge cases gracefully (no legs, asymmetric anatomy)
- ❌ Consistent with existing movement lock patterns (closeness circles)

### 1.3 Architecture Context

**CRITICAL**: This system uses an anatomy-based architecture where movement components are attached to individual body parts (legs), NOT to the root entity. The implementation must handle both:

- **Legacy Entities**: `core:movement` component directly on actor
- **Anatomy Entities**: `core:movement` components on leg body parts

## 2. Technical Architecture

### 2.1 Affected Systems

- **Actions**: `kneel_before.action.json`, `stand_up.action.json` (existing, no changes needed)
- **Rules**: `kneel_before.rule.json`, `stand_up.rule.json` (TO BE MODIFIED)
- **Operations**: New `LOCK_MOVEMENT` and `UNLOCK_MOVEMENT` handlers (TO BE CREATED)
- **Components**: `core:movement` (existing, supports locked field)
- **Utilities**: `updateMovementLock()` (existing and functional, ready to be used)

### 2.2 Movement Component Structure

```json
{
  "locked": boolean,        // If true, voluntary movement is blocked
  "forcedOverride": boolean  // Reserved for future forced movement
}
```

### 2.3 Anatomy System Flow

```
Actor Entity
├── anatomy:body (contains recipe ID and parts map)
└── body.parts
    ├── left_leg → Entity with core:movement
    └── right_leg → Entity with core:movement
```

## 3. Implementation Requirements

### 3.1 Custom Operations Approach (REQUIRED)

**Rationale**: The rules engine cannot iterate through dynamic entity collections or update multiple entities based on runtime data. Custom operations are necessary to handle the anatomy system's complexity.

### 3.2 Operation Handlers

#### 3.2.1 Lock Movement Handler

**File**: `src/logic/operationHandlers/lockMovementHandler.js`

**Requirements**:

- Extend `BaseOperationHandler`
- Accept `actor_id` parameter
- Call `updateMovementLock(entityManager, actor_id, true)`
- Handle both legacy and anatomy-based entities automatically
- Proper error handling with `safeDispatchError`

**Template**:

```javascript
import BaseOperationHandler from './baseOperationHandler.js';
import { updateMovementLock } from '../../utils/movementUtils.js';
import { safeDispatchError } from '../../utils/safeDispatchErrorUtils.js';
import { validateDependency } from '../../utils/validationUtils.js';
import { ensureValidLogger } from '../../utils/loggerUtils.js';

class LockMovementHandler extends BaseOperationHandler {
  #entityManager;
  #dispatcher;

  constructor({ logger, entityManager, safeEventDispatcher }) {
    logger = ensureValidLogger(logger, 'LockMovementHandler');

    validateDependency(entityManager, 'IEntityManager', null, {
      requiredMethods: ['getComponentData', 'addComponent', 'updateComponent'],
    });

    validateDependency(safeEventDispatcher, 'ISafeEventDispatcher', null, {
      requiredMethods: ['dispatch'],
    });

    super('LockMovementHandler', {
      logger: { value: logger },
      entityManager: { value: entityManager },
      safeEventDispatcher: { value: safeEventDispatcher },
    });

    this.#entityManager = entityManager;
    this.#dispatcher = safeEventDispatcher;
  }

  async execute(params, executionContext) {
    const logger = this.getLogger(executionContext);
    const { actor_id } = params || {};

    if (!actor_id) {
      safeDispatchError(
        this.#dispatcher,
        'LOCK_MOVEMENT: missing actor_id parameter',
        { params },
        logger
      );
      return;
    }

    try {
      // This utility handles both legacy and anatomy-based entities
      await updateMovementLock(this.#entityManager, actor_id, true);
      logger.debug(
        `[LockMovementHandler] Successfully locked movement for entity: ${actor_id}`
      );
    } catch (err) {
      safeDispatchError(
        this.#dispatcher,
        `LOCK_MOVEMENT: failed to lock movement for entity ${actor_id}`,
        { actor_id, error: err.message },
        logger
      );
    }
  }
}

export default LockMovementHandler;
```

#### 3.2.2 Unlock Movement Handler

**File**: `src/logic/operationHandlers/unlockMovementHandler.js`

**Requirements**:

- Identical structure to `lockMovementHandler.js`
- Call `updateMovementLock(entityManager, actor_id, false)`
- Same error handling and validation

### 3.3 Registration Updates (TO BE IMPLEMENTED)

**File 1**: `src/dependencyInjection/tokens.js`

**Add tokens**:

```javascript
LockMovementHandler: Symbol('LockMovementHandler'),
UnlockMovementHandler: Symbol('UnlockMovementHandler'),
```

**File 2**: `src/dependencyInjection/registrations/operationHandlerRegistrations.js`

**Add imports**:

```javascript
import LockMovementHandler from '../../logic/operationHandlers/lockMovementHandler.js';
import UnlockMovementHandler from '../../logic/operationHandlers/unlockMovementHandler.js';
```

**Add to handlerFactories array**:

```javascript
[
  tokens.LockMovementHandler,
  LockMovementHandler,
  (c, Handler) =>
    new Handler({
      logger: c.resolve(tokens.ILogger),
      entityManager: c.resolve(tokens.IEntityManager),
      safeEventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
    }),
],
[
  tokens.UnlockMovementHandler,
  UnlockMovementHandler,
  (c, Handler) =>
    new Handler({
      logger: c.resolve(tokens.ILogger),
      entityManager: c.resolve(tokens.IEntityManager),
      safeEventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
    }),
],
```

**File 3**: `src/dependencyInjection/registrations/interpreterRegistrations.js`

**Add operation registry bindings** (in the registry.register section):

```javascript
registry.register('LOCK_MOVEMENT', bind(tokens.LockMovementHandler));
registry.register('UNLOCK_MOVEMENT', bind(tokens.UnlockMovementHandler));
```

### 3.4 Rule Modifications (TO BE IMPLEMENTED)

#### 3.4.1 Kneel Before Rule

**File**: `data/mods/positioning/rules/kneel_before.rule.json`

**Current State**: Does not include movement locking

**Required Change**: Add after line 33 (after ADD_COMPONENT operation):

```json
{
  "type": "LOCK_MOVEMENT",
  "comment": "Lock movement while kneeling (handles both legacy and anatomy entities)",
  "parameters": {
    "actor_id": "{event.payload.actorId}"
  }
},
```

#### 3.4.2 Stand Up Rule

**File**: `data/mods/positioning/rules/stand_up.rule.json`

**Current State**: Does not include movement unlocking

**Required Change**: Add after line 26 (after REMOVE_COMPONENT operation):

```json
{
  "type": "UNLOCK_MOVEMENT",
  "comment": "Unlock movement after standing (handles both legacy and anatomy entities)",
  "parameters": {
    "actor_id": "{event.payload.actorId}"
  }
},
```

## 4. Test Requirements (TO BE IMPLEMENTED)

### 4.1 Unit Tests

#### 4.1.1 LockMovementHandler Tests

**File**: `tests/unit/logic/operationHandlers/lockMovementHandler.test.js` (TO BE CREATED)

**Test Cases**:

- ❌ Successfully locks movement for valid actor_id
- ❌ Handles missing actor_id parameter gracefully
- ❌ Dispatches error event when updateMovementLock fails
- ❌ Logs debug message on successful execution
- ❌ Validates all dependencies in constructor

#### 4.1.2 UnlockMovementHandler Tests

**File**: `tests/unit/logic/operationHandlers/unlockMovementHandler.test.js` (TO BE CREATED)

**Test Cases**:

- ❌ Successfully unlocks movement for valid actor_id
- ❌ Handles missing actor_id parameter gracefully
- ❌ Dispatches error event when updateMovementLock fails
- ❌ Logs debug message on successful execution
- ❌ Validates all dependencies in constructor

### 4.2 Integration Tests

**File**: `tests/integration/positioning/movementLock.test.js` (TO BE CREATED)
**Note**: The directory `tests/integration/positioning/` does not exist and must be created first.

**Test Scenarios**:

#### 4.2.1 Anatomy-Based Entity Tests

```javascript
describe('Movement Lock - Anatomy Entities', () => {
  it('should lock all leg movement components when kneeling', () => {
    // Setup anatomy-based actor
    // Execute kneel_before action
    // Verify ALL leg entities have core:movement.locked: true
    // Attempt "go" action - should fail
  });

  it('should unlock all leg movement components when standing', () => {
    // Setup kneeling anatomy-based actor
    // Execute stand_up action
    // Verify ALL leg entities have core:movement.locked: false
    // Attempt "go" action - should succeed
  });
});
```

#### 4.2.2 Legacy Entity Tests

```javascript
describe('Movement Lock - Legacy Entities', () => {
  it('should lock movement component when kneeling', () => {
    // Setup legacy actor (no anatomy:body)
    // Execute kneel_before action
    // Verify actor's core:movement.locked: true
    // Attempt "go" action - should fail
  });

  it('should unlock movement component when standing', () => {
    // Setup kneeling legacy actor
    // Execute stand_up action
    // Verify actor's core:movement.locked: false
    // Attempt "go" action - should succeed
  });
});
```

#### 4.2.3 Edge Case Tests

```javascript
describe('Movement Lock - Edge Cases', () => {
  it('should handle entities with no legs gracefully', () => {
    // Setup entity without leg parts
    // Execute kneel_before action
    // Should not throw errors
  });

  it('should handle asymmetric anatomy (one leg)', () => {
    // Setup entity with single leg
    // Execute kneel_before action
    // Verify single leg is locked
  });

  it('should not error when standing without being kneeled', () => {
    // Setup standing actor
    // Execute stand_up action
    // Should not throw errors
  });

  it('should handle multiple actors kneeling simultaneously', () => {
    // Setup multiple actors
    // Each kneels independently
    // Verify each tracks own lock state
  });
});
```

### 4.3 End-to-End Tests

**File**: `tests/e2e/positioning/kneelStandFlow.test.js` (TO BE CREATED)
**Note**: The directory `tests/e2e/positioning/` does not exist and must be created first.

**Test Flow**:

1. Actor approaches target
2. Actor kneels before target
3. Verify movement actions are unavailable/fail
4. Actor stands up
5. Verify movement actions are available/succeed
6. Test with both anatomy and legacy entities

## 5. Implementation Checklist (NOT STARTED)

### 5.1 Code Implementation

- [ ] Create `src/logic/operationHandlers/lockMovementHandler.js`
- [ ] Create `src/logic/operationHandlers/unlockMovementHandler.js`
- [ ] Update `src/dependencyInjection/tokens.js` with new handler tokens
- [ ] Update `src/dependencyInjection/registrations/operationHandlerRegistrations.js`
  - [ ] Add imports for new handlers
  - [ ] Add handler factory configurations
- [ ] Update `src/dependencyInjection/registrations/interpreterRegistrations.js`
  - [ ] Register operations with handlers

### 5.2 Rule Updates

- [ ] Update `data/mods/positioning/rules/kneel_before.rule.json`
- [ ] Update `data/mods/positioning/rules/stand_up.rule.json`

### 5.3 Testing

- [ ] Create directory `tests/integration/positioning/`
- [ ] Create directory `tests/e2e/positioning/`
- [ ] Create unit tests for `lockMovementHandler`
- [ ] Create unit tests for `unlockMovementHandler`
- [ ] Create integration tests for anatomy entities
- [ ] Create integration tests for legacy entities
- [ ] Create edge case tests
- [ ] Create end-to-end test flow
- [ ] Run all tests with coverage: `npm run test:ci`

### 5.4 Quality Assurance

- [ ] Run linter: `npm run lint`
- [ ] Run formatter: `npm run format`
- [ ] Run type check: `npm run typecheck`
- [ ] Verify test coverage meets requirements (80%+ branches, 90%+ lines)

### 5.5 Documentation

- [ ] Update positioning mod README if exists
- [ ] Add inline documentation to handlers
- [ ] Document movement lock behavior in action files
- [ ] Update CHANGELOG if applicable

## 6. Validation Criteria

### 6.1 Functional Requirements

- Movement is properly locked when kneeling
- Movement is properly unlocked when standing
- System handles both entity types correctly
- Edge cases don't cause errors

### 6.2 Non-Functional Requirements

- Code follows project conventions (dependency injection, error handling)
- Tests achieve required coverage levels
- No performance degradation
- Consistent with existing patterns

### 6.3 Acceptance Tests

1. **Manual Test - Anatomy Entity**:
   - Create character with anatomy system
   - Have character kneel before another
   - Attempt to move to different location (should fail)
   - Have character stand up
   - Attempt to move (should succeed)

2. **Manual Test - Legacy Entity**:
   - Create legacy character (no anatomy)
   - Repeat above test flow
   - Verify same behavior

3. **Manual Test - Multiple Actors**:
   - Have 3 actors kneel simultaneously
   - Verify each has independent lock state
   - Stand them up in different order
   - Verify correct unlock behavior

## 7. Risk Mitigation

### 7.1 Potential Issues

- **Risk**: Breaking existing movement system
  - **Mitigation**: Reuse proven `updateMovementLock` utility
- **Risk**: Incompatibility with future anatomy variations
  - **Mitigation**: Utility already handles dynamic body part detection

- **Risk**: Performance impact from anatomy iteration
  - **Mitigation**: Operation only runs on explicit action, not continuously

### 7.2 Rollback Plan

If issues arise:

1. Remove operation calls from rules (revert rule JSONs)
2. Remove handler registrations
3. Delete handler files
4. System reverts to previous behavior

## 8. Future Considerations

### 8.1 Extensibility

- `forcedOverride` field allows future forced movement mechanics
- Pattern can be extended to other posture changes (sitting, lying down)
- Could add partial movement restrictions (crawling while kneeling)

### 8.2 Related Features

- Consider movement speed modifiers for different postures
- Interaction restrictions while kneeling
- Stamina/fatigue costs for posture changes

## 9. References

### 9.1 Existing Implementations

- `src/logic/operationHandlers/mergeClosenessCircleHandler.js` - Reference for movement locking
- `src/logic/operationHandlers/removeFromClosenessCircleHandler.js` - Reference for unlocking
- `src/utils/movementUtils.js::updateMovementLock()` - Core utility to reuse

### 9.2 Related Documentation

- `reports/kneel-stand-movement-lock-analysis.md` - Detailed analysis
- `data/schemas/core/movement.component.schema.json` - Component schema
- `data/mods/positioning/README.md` - Positioning mod documentation

## 10. Approval and Sign-off

### Implementation Prerequisites

- ✅ Supporting utility `updateMovementLock` exists and is functional
- ✅ Pattern proven in closeness circle handlers
- ✅ Component structure supports locked field
- ❌ Operation handlers need to be created
- ❌ Rules need to be modified
- ❌ Tests need to be written
- ❌ Registration system needs updates

### Notes for Implementer

1. **MUST** use custom operations approach - MODIFY_COMPONENT won't work for anatomy
2. **MUST** reuse `updateMovementLock` utility - don't reimplement the logic
3. **MUST** test both entity types thoroughly
4. **MUST** follow existing error handling patterns with `safeDispatchError`
5. **MUST** follow the registration pattern shown in `operationHandlerRegistrations.js`
6. **CONSIDER** adding debug logging for troubleshooting

---

**Specification Status**: NOT IMPLEMENTED - PENDING DEVELOPMENT
**Implementation Progress**: 0% (specification only)
**Estimated Effort**: 4-6 hours
**Priority**: Medium
**Dependencies**: None (all supporting utilities exist)
