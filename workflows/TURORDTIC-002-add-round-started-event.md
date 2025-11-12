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
According to spec line 211:
- `RoundManager.startRound()` collects actors and initializes the queue
- No event is dispatched after round initialization
- Ticker components have no way to know when a round starts

## Implementation Steps

### 1. Import Event Constant
**File:** `src/turns/roundManager.js`

Add to imports section:
```javascript
import { ROUND_STARTED_ID } from '../constants/eventIds.js';
```

### 2. Dispatch Event After Round Initialization
**File:** `src/turns/roundManager.js`

Locate the `startRound()` method. According to spec line 211, add after line 126 (after queue initialization completes):

```javascript
// After turn cycle is initialized and round tracking is set up
this.#dispatcher.dispatch(ROUND_STARTED_ID, {
  roundNumber: this.#roundNumber,
  actors: actorIds, // Array of entity IDs in turn order
  strategy: strategy // 'round-robin' or 'initiative'
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

### 3. Ensure Actor IDs Available
The `actorIds` variable should contain the array of entity IDs passed to the turn cycle. Verify this exists in the method context. If not available, extract from:
```javascript
const actorIds = actors.map(actor => actor.id);
```

### 4. Ensure Strategy Available
The `strategy` parameter should be available from the method signature or configuration. If not explicitly available, use:
```javascript
const strategy = this.#turnCycle?.getStrategy?.() || 'round-robin';
```

## Validation

### Unit Test Verification
Create test in `tests/unit/turns/roundManager.test.js`:

```javascript
describe('RoundManager - Round Started Event', () => {
  it('should dispatch core:round_started when round begins', () => {
    const mockDispatcher = createMockDispatcher();
    const roundManager = new RoundManager({ dispatcher: mockDispatcher, /* ... */ });

    roundManager.startRound(actors);

    expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
      'core:round_started',
      expect.objectContaining({
        roundNumber: expect.any(Number),
        actors: expect.any(Array),
        strategy: expect.stringMatching(/round-robin|initiative/)
      })
    );
  });

  it('should include correct round number in event', () => {
    const mockDispatcher = createMockDispatcher();
    const roundManager = new RoundManager({ dispatcher: mockDispatcher, /* ... */ });

    roundManager.startRound(actors);
    roundManager.startRound(actors); // Start second round

    const calls = mockDispatcher.dispatch.mock.calls.filter(
      call => call[0] === 'core:round_started'
    );
    expect(calls[1][1].roundNumber).toBe(2);
  });

  it('should include actor IDs in correct order', () => {
    const mockDispatcher = createMockDispatcher();
    const roundManager = new RoundManager({ dispatcher: mockDispatcher, /* ... */ });

    const actors = [
      { id: 'actor-1' },
      { id: 'actor-2' },
      { id: 'actor-3' }
    ];

    roundManager.startRound(actors);

    expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
      'core:round_started',
      expect.objectContaining({
        actors: ['actor-1', 'actor-2', 'actor-3']
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
- [ ] `ROUND_STARTED_ID` imported from `eventIds.js`
- [ ] Event dispatched in `startRound()` method after initialization
- [ ] Event payload includes `roundNumber`, `actors`, and `strategy`
- [ ] Actor IDs array is in correct turn order
- [ ] Round number increments correctly across multiple rounds
- [ ] Unit tests pass for event dispatch
- [ ] Integration tests verify event payload structure
- [ ] No breaking changes to existing turn management flow

## Edge Cases Handled
1. **Empty actor list:** Event should dispatch with empty `actors` array
2. **Single actor:** Event should dispatch with single-item array
3. **Strategy undefined:** Default to `'round-robin'` if not available

## Testing Commands
```bash
# Unit tests
NODE_ENV=test npm run test:unit -- tests/unit/turns/roundManager.test.js --verbose

# Integration tests (if created)
NODE_ENV=test npm run test:integration -- tests/integration/turns/roundStartedEvent.integration.test.js

# All turn-related tests
NODE_ENV=test npm run test:unit -- --testPathPattern="turns" --silent
```

## Notes
- This event does NOT replace existing turn events (`core:turn_started`, `core:turn_ended`)
- The event is dispatched BEFORE the first turn of the round starts
- Components subscribed to this event will receive it before any `core:turn_started` events
- The `strategy` field enables future support for initiative-based ordering

## Implementation Tips
1. Use existing dispatcher instance (avoid creating new one)
2. Ensure event dispatch happens after all round initialization is complete
3. Consider logging the event dispatch for debugging: `this.#logger.debug('Round started', payload)`
4. Verify the method doesn't dispatch the event multiple times per round

## Next Ticket
TURORDTIC-003: Create TurnOrderTickerRenderer class skeleton
