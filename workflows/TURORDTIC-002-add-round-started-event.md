# TURORDTIC-002: Add round_started Event to RoundManager

## Status
Ready for Implementation

## Priority
High - Required for ticker to know when rounds begin

## Dependencies
- TURORDTIC-001 (event constant must exist)

## Description
Modify `RoundManager` to dispatch a `core:round_started` event when a new round begins. This event will include the round number, actor list, and turn order strategy, allowing the ticker to render the full queue with animations.

## Affected Files
- `src/turns/roundManager.js` (modify)
- `src/constants/eventIds.js` (already added in TURORDTIC-001)

## Current Behavior
- `RoundManager.startRound(strategyOrOptions, initiativeDataParam)` collects actors from EntityManager and initializes the queue
- Method signature accepts strategy/options, NOT actors array (actors are fetched internally via `entityManager.entities`)
- No event is dispatched after round initialization
- RoundManager currently has NO event dispatcher dependency (constructor: `(turnOrderService, entityManager, logger)`)
- RoundManager does NOT track round numbers (no `#roundNumber` field exists)
- Ticker components have no way to know when a round starts

## Implementation Steps

### 1. Add Dispatcher Dependency to Constructor
**File:** `src/turns/roundManager.js`

**Current Constructor (lines 10-14):**
```javascript
constructor(turnOrderService, entityManager, logger) {
  this.#turnOrderService = turnOrderService;
  this.#entityManager = entityManager;
  this.#logger = logger;
}
```

**Modified Constructor:**
```javascript
constructor(turnOrderService, entityManager, logger, dispatcher) {
  this.#turnOrderService = turnOrderService;
  this.#entityManager = entityManager;
  this.#logger = logger;
  this.#dispatcher = dispatcher;
}
```

**Add Private Field (after line 3):**
```javascript
#dispatcher;
```

**Validate Dispatcher in Constructor:**
```javascript
if (!dispatcher || typeof dispatcher.dispatch !== 'function') {
  throw new Error('RoundManager requires a valid dispatcher with dispatch method');
}
```

### 2. Add Round Number Tracking
**File:** `src/turns/roundManager.js`

**Add Private Field (after line 3):**
```javascript
#roundNumber = 0;
```

**Increment in startRound() Method (after line 30, before `this.#inProgress = false;`):**
```javascript
this.#roundNumber++;
this.#logger.debug(`Starting round ${this.#roundNumber}`);
```

**Add Reset Method (or add to existing `resetFlags()` at line 147):**
```javascript
resetFlags() {
  this.#inProgress = false;
  this.#hadSuccess = false;
  this.#roundNumber = 0;
}
```

### 3. Import Event Constant
**File:** `src/turns/roundManager.js`

Add to imports section (after line 1):
```javascript
import { ROUND_STARTED_ID } from '../constants/eventIds.js';
```

### 4. Dispatch Event After Round Initialization
**File:** `src/turns/roundManager.js`

**Location:** After line 126 (`this.#inProgress = true;`)

**Code to Add:**
```javascript
// Dispatch round started event for UI components (e.g., turn order ticker)
this.#dispatcher.dispatch(ROUND_STARTED_ID, {
  roundNumber: this.#roundNumber,
  actors: actorIds, // Array of entity IDs in turn order (available at line 112)
  strategy: strategy // 'round-robin' or 'initiative' (available from method logic)
});
```

**Event Payload Structure (from spec lines 199-206):**
```javascript
{
  type: 'core:round_started',
  payload: {
    roundNumber: number,
    actors: string[],  // Array of entity IDs in turn order
    strategy: 'round-robin' | 'initiative'
  }
}
```

**Note:** The variables `actorIds` (line 112) and `strategy` (computed in method) are already available at this point.

### 5. Update TurnManager Instantiation
**File:** `src/turns/turnManager.js`

**Current Instantiation (line 173):**
```javascript
this.#roundManager =
  roundManager || new RoundManager(turnOrderService, entityManager, logger);
```

**Modified Instantiation:**
```javascript
this.#roundManager =
  roundManager || new RoundManager(turnOrderService, entityManager, logger, dispatcher);
```

**Note:** The `dispatcher` variable is already available in TurnManager (line 169: `this.#dispatcher = dispatcher;`)

## Validation

### Unit Test Verification
Create test in `tests/unit/turns/roundManager.test.js`:

```javascript
describe('RoundManager - Round Started Event', () => {
  let mockTurnOrderService;
  let mockEntityManager;
  let mockLogger;
  let mockDispatcher;

  beforeEach(() => {
    mockTurnOrderService = createMockTurnOrderService();
    mockLogger = createMockLogger();
    mockDispatcher = createMockDispatcher();

    // Mock EntityManager with actors
    const mockActors = [
      { id: 'actor-1', hasComponent: jest.fn(() => true) },
      { id: 'actor-2', hasComponent: jest.fn(() => true) },
      { id: 'actor-3', hasComponent: jest.fn(() => true) }
    ];
    mockEntityManager = {
      entities: mockActors
    };
  });

  it('should dispatch core:round_started when round begins', async () => {
    const roundManager = new RoundManager(
      mockTurnOrderService,
      mockEntityManager,
      mockLogger,
      mockDispatcher
    );

    await roundManager.startRound('round-robin');

    expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
      'core:round_started',
      expect.objectContaining({
        roundNumber: expect.any(Number),
        actors: expect.any(Array),
        strategy: 'round-robin'
      })
    );
  });

  it('should include correct round number in event', async () => {
    const roundManager = new RoundManager(
      mockTurnOrderService,
      mockEntityManager,
      mockLogger,
      mockDispatcher
    );

    await roundManager.startRound('round-robin');
    await roundManager.startRound('round-robin'); // Start second round

    const calls = mockDispatcher.dispatch.mock.calls.filter(
      call => call[0] === 'core:round_started'
    );
    expect(calls[0][1].roundNumber).toBe(1);
    expect(calls[1][1].roundNumber).toBe(2);
  });

  it('should include actor IDs in correct order', async () => {
    const roundManager = new RoundManager(
      mockTurnOrderService,
      mockEntityManager,
      mockLogger,
      mockDispatcher
    );

    await roundManager.startRound('round-robin');

    expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
      'core:round_started',
      expect.objectContaining({
        actors: ['actor-1', 'actor-2', 'actor-3']
      })
    );
  });

  it('should include strategy in event payload', async () => {
    const roundManager = new RoundManager(
      mockTurnOrderService,
      mockEntityManager,
      mockLogger,
      mockDispatcher
    );

    await roundManager.startRound('initiative', new Map([['actor-1', 10]]));

    expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
      'core:round_started',
      expect.objectContaining({
        strategy: 'initiative'
      })
    );
  });
});
```

### Integration Test Verification
Add test to `tests/integration/turns/roundStartedEvent.integration.test.js`:

```javascript
describe('Round Started Event Integration', () => {
  it('should dispatch round_started with complete actor data', async () => {
    const { eventBus, roundManager, entityManager } = setupTestEnvironment();

    // Create actors
    const actor1 = await entityManager.createEntity('actor-1', ['core:actor']);
    const actor2 = await entityManager.createEntity('actor-2', ['core:actor']);

    let eventReceived = false;
    eventBus.subscribe('core:round_started', (event) => {
      eventReceived = true;
      expect(event.payload.actors).toContain('actor-1');
      expect(event.payload.actors).toContain('actor-2');
      expect(event.payload.roundNumber).toBe(1);
    });

    await roundManager.startRound([actor1, actor2]);

    expect(eventReceived).toBe(true);
  });
});
```

### Manual Verification
```bash
# Run existing round manager tests
NODE_ENV=test npm run test:unit -- tests/unit/turns/roundManager.test.js

# Run integration tests
NODE_ENV=test npm run test:integration -- tests/integration/turns/
```

## Acceptance Criteria
- [ ] Dispatcher dependency added to `RoundManager` constructor
- [ ] Private `#dispatcher` field added to `RoundManager`
- [ ] Private `#roundNumber` field added to `RoundManager`
- [ ] Round number increments on each `startRound()` call
- [ ] Round number resets in `resetFlags()` method
- [ ] `ROUND_STARTED_ID` imported from `eventIds.js`
- [ ] Event dispatched in `startRound()` method after initialization (after line 126)
- [ ] Event payload includes `roundNumber`, `actors`, and `strategy`
- [ ] Actor IDs array is in correct turn order
- [ ] Round number increments correctly across multiple rounds
- [ ] `TurnManager` instantiation updated to pass dispatcher to `RoundManager`
- [ ] Unit tests pass for event dispatch
- [ ] Integration tests verify event payload structure
- [ ] No breaking changes to existing turn management flow
- [ ] All existing tests for `RoundManager` updated to include dispatcher parameter

## Edge Cases Handled
1. **Empty actor list:** `startRound()` throws error (existing behavior at line 106-110), no event dispatched
2. **Single actor:** Event should dispatch with single-item array
3. **Invalid strategy:** Existing validation normalizes to 'round-robin' or 'initiative' (lines 71-82), event uses normalized value
4. **First round:** Round number starts at 1 (incremented before dispatch)
5. **Round reset:** `resetFlags()` resets round number to 0

## Testing Commands
```bash
# Unit tests
NODE_ENV=test npm run test:unit -- tests/unit/turns/roundManager.test.js --verbose

# Integration tests (if created)
NODE_ENV=test npm run test:integration -- tests/integration/turns/roundStartedEvent.integration.test.js

# All turn-related tests
NODE_ENV=test npm run test:unit -- --testPathPattern="turns" --silent
```

## Breaking Changes

**Constructor Signature Change:**
- **Old:** `new RoundManager(turnOrderService, entityManager, logger)`
- **New:** `new RoundManager(turnOrderService, entityManager, logger, dispatcher)`

**Files Requiring Updates:**
1. `src/turns/turnManager.js` (line 173) - Pass dispatcher to constructor
2. `tests/unit/turns/roundManager.spec.js` - Update all test instantiations
3. `tests/integration/turns/roundManager.integration.test.js` - Update all test instantiations
4. Any other files that instantiate `RoundManager` directly

**Search Pattern to Find All Instances:**
```bash
grep -r "new RoundManager" --include="*.js" --include="*.test.js"
```

## Notes
- This event does NOT replace existing turn events (`core:turn_started`, `core:turn_ended`)
- The event is dispatched BEFORE the first turn of the round starts
- Components subscribed to this event will receive it before any `core:turn_started` events
- The `strategy` field enables future support for initiative-based ordering
- Adding dispatcher dependency is necessary because RoundManager needs to communicate with UI components
- Round number tracking enables better debugging and UI state management

## Implementation Tips
1. Use existing dispatcher instance (avoid creating new one)
2. Ensure event dispatch happens after all round initialization is complete
3. Consider logging the event dispatch for debugging: `this.#logger.debug('Round started', payload)`
4. Verify the method doesn't dispatch the event multiple times per round

## Next Ticket
TURORDTIC-003: Create TurnOrderTickerRenderer class skeleton
