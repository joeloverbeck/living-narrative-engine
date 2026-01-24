# COGLEDACTPROIMP-007: Create Cognitive Ledger Persistence Hook and Listener

## Summary

Create the persistence infrastructure to save cognitive ledger data from LLM responses back to the actor entity:
1. `cognitiveLedgerPersistenceHook.js` - The persistence logic with OVERWRITE semantics
2. `cognitiveLedgerPersistenceListener.js` - Event listener for ACTION_DECIDED events
3. Register the listener in the DI/orchestration system

---

## Files to Touch

| File | Action |
|------|--------|
| `src/ai/cognitiveLedgerPersistenceHook.js` | CREATE |
| `src/ai/cognitiveLedgerPersistenceListener.js` | CREATE |
| `src/dependencyInjection/registrations/orchestrationRegistrations.js` | MODIFY |
| `tests/unit/ai/cognitiveLedgerPersistenceHook.test.js` | CREATE |
| `tests/unit/ai/cognitiveLedgerPersistenceListener.test.js` | CREATE |
| `tests/integration/ai/cognitiveLedgerPersistence.integration.test.js` | CREATE |

---

## Out of Scope

- **DO NOT** modify `LLMResponseProcessor.js` (that's COGLEDACTPROIMP-008)
- **DO NOT** modify any prompt files
- **DO NOT** modify existing persistence hooks/listeners
- **DO NOT** modify schema files
- **DO NOT** modify `corePromptText.json`

---

## Implementation Details

### 1. Create Persistence Hook

**File**: `src/ai/cognitiveLedgerPersistenceHook.js`

Follow the pattern from `notesPersistenceHook.js` but with OVERWRITE semantics:

```javascript
/**
 * @file Persists cognitive ledger to actor entity with OVERWRITE semantics
 */

import { COGNITIVE_LEDGER_COMPONENT_ID } from '../constants/componentIds.js';

/**
 * Persists cognitive ledger data to the actor entity.
 * Uses OVERWRITE semantics (not additive like notes).
 *
 * @param {Object} params
 * @param {string} params.actorId - The actor entity ID
 * @param {Object} params.cognitiveLedger - The cognitive ledger from LLM response
 * @param {string[]} params.cognitiveLedger.settled_conclusions
 * @param {string[]} params.cognitiveLedger.open_questions
 * @param {Object} params.componentAccess - ComponentAccessService instance
 * @param {Object} params.entityManager - EntityManager instance
 * @param {Object} params.logger - Logger instance
 */
export function persistCognitiveLedger({
  actorId,
  cognitiveLedger,
  componentAccess,
  entityManager,
  logger,
}) {
  if (!cognitiveLedger) {
    logger.debug(
      `CognitiveLedgerPersistence: No cognitive_ledger in response for actor ${actorId}, skipping`
    );
    return;
  }

  const actorEntity = entityManager.getEntityInstance(actorId);
  if (!actorEntity) {
    logger.warn(
      `CognitiveLedgerPersistence: Actor entity ${actorId} not found, cannot persist ledger`
    );
    return;
  }

  // Enforce max 3 items per array
  const settled = (cognitiveLedger.settled_conclusions || []).slice(0, 3);
  const open = (cognitiveLedger.open_questions || []).slice(0, 3);

  // OVERWRITE the component entirely
  componentAccess.applyComponent(actorEntity, COGNITIVE_LEDGER_COMPONENT_ID, {
    settled_conclusions: settled,
    open_questions: open,
  });

  logger.debug(
    `CognitiveLedgerPersistence: Persisted ledger for actor ${actorId} ` +
      `(${settled.length} settled, ${open.length} open)`
  );
}
```

### 2. Create Persistence Listener

**File**: `src/ai/cognitiveLedgerPersistenceListener.js`

Follow the pattern from `notesPersistenceListener.js`:

```javascript
/**
 * @file Listens for ACTION_DECIDED events and persists cognitive ledger
 */

import { ACTION_DECIDED_ID } from '../constants/eventIds.js';
import { persistCognitiveLedger } from './cognitiveLedgerPersistenceHook.js';

export class CognitiveLedgerPersistenceListener {
  #componentAccess;
  #entityManager;
  #logger;

  /**
   * @param {Object} params
   * @param {Object} params.componentAccess - ComponentAccessService
   * @param {Object} params.entityManager - EntityManager
   * @param {Object} params.logger - Logger
   */
  constructor({ componentAccess, entityManager, logger }) {
    this.#componentAccess = componentAccess;
    this.#entityManager = entityManager;
    this.#logger = logger;
  }

  /**
   * Handles ACTION_DECIDED events.
   *
   * @param {Object} event - The event object
   * @param {Object} event.payload
   * @param {string} event.payload.actorId
   * @param {Object} [event.payload.cognitiveLedger]
   */
  handleEvent(event) {
    const { actorId, cognitiveLedger } = event.payload || {};

    if (!actorId) {
      this.#logger.warn(
        'CognitiveLedgerPersistenceListener: Received event without actorId'
      );
      return;
    }

    persistCognitiveLedger({
      actorId,
      cognitiveLedger,
      componentAccess: this.#componentAccess,
      entityManager: this.#entityManager,
      logger: this.#logger,
    });
  }
}
```

### 3. Register Listener

**File**: `src/dependencyInjection/registrations/orchestrationRegistrations.js`

Add import at top:

```javascript
import { CognitiveLedgerPersistenceListener } from '../../ai/cognitiveLedgerPersistenceListener.js';
```

Add registration in `registerOrchestration` function (follow the pattern used for other listeners):

```javascript
// Create and subscribe CognitiveLedgerPersistenceListener
const cognitiveLedgerListener = new CognitiveLedgerPersistenceListener({
  componentAccess: c.resolve(tokens.ComponentAccessService),
  entityManager: c.resolve(tokens.IEntityManager),
  logger: c.resolve(tokens.ILogger),
});
dispatcher.subscribe(ACTION_DECIDED_ID, (event) =>
  cognitiveLedgerListener.handleEvent(event)
);
```

---

## Acceptance Criteria

### Tests That Must Pass

1. **New Test File**: `tests/unit/ai/cognitiveLedgerPersistenceHook.test.js`
   - Test: Does nothing when `cognitiveLedger` is null
   - Test: Does nothing when `cognitiveLedger` is undefined
   - Test: Logs warning when actor entity not found
   - Test: Calls `applyComponent` with correct component ID
   - Test: Enforces max 3 settled_conclusions (truncates if more)
   - Test: Enforces max 3 open_questions (truncates if more)
   - Test: Handles missing `settled_conclusions` (uses empty array)
   - Test: Handles missing `open_questions` (uses empty array)
   - Test: Overwrites existing component data (not additive)

2. **New Test File**: `tests/unit/ai/cognitiveLedgerPersistenceListener.test.js`
   - Test: Calls `persistCognitiveLedger` with correct parameters
   - Test: Logs warning when `actorId` missing from payload
   - Test: Handles missing `cognitiveLedger` gracefully
   - Test: Handles null payload gracefully

3. **New Integration Test**: `tests/integration/ai/cognitiveLedgerPersistence.integration.test.js`
   - Test: End-to-end persistence flow from event to component
   - Test: Multiple events overwrite (not accumulate)
   - Test: Integration with real ComponentAccessService

4. **Existing Tests**
   - All existing persistence listener tests pass
   - `npm run test:unit -- --testPathPattern="Persistence"` passes
   - `npm run test:integration -- --testPathPattern="Persistence"` passes

### Invariants That Must Remain True

1. Existing persistence listeners (thought, notes, moodSexual) unchanged
2. Listener registration order doesn't affect functionality
3. All listeners operate independently on same event
4. No modifications to ACTION_DECIDED event structure

---

## Verification Commands

```bash
# Run new unit tests
npm run test:unit -- --testPathPattern="cognitiveLedgerPersistence"

# Run new integration tests
npm run test:integration -- --testPathPattern="cognitiveLedgerPersistence"

# Run all persistence tests
npm run test:unit -- --testPathPattern="Persistence"
npm run test:integration -- --testPathPattern="Persistence"
```

---

## Dependencies

- **Requires**: COGLEDACTPROIMP-001 (component ID constant)
- **Requires**: ACTION_DECIDED_ID constant (already exists)
