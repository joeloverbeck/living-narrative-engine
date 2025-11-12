# TURORDTIC-006: Implement Event Handlers

## Status
Ready for Implementation

## Priority
Medium - Connects rendering to game events

## Dependencies
- TURORDTIC-003 (class skeleton with event subscription)
- TURORDTIC-004 (display data extraction)
- TURORDTIC-005 (element creation)

## Description
Implement the event handler methods that respond to game events. These handlers are the bridge between the game engine and the ticker UI, calling the appropriate rendering methods when rounds start, turns begin/end, and participation changes.

## Affected Files
- `src/domUI/turnOrderTickerRenderer.js` (modify)

## Implementation

### 1. Implement #handleRoundStarted

**Location:** `src/domUI/turnOrderTickerRenderer.js`

Replace the stub with:

```javascript
/**
 * Handle round_started event.
 * Fetches actor entities and triggers full queue render.
 *
 * @param {Object} event - Event object
 * @param {Object} event.payload - Event payload
 * @param {number} event.payload.roundNumber - Round number
 * @param {string[]} event.payload.actors - Actor entity IDs in turn order
 * @param {string} event.payload.strategy - Turn order strategy
 * @private
 */
#handleRoundStarted(event) {
  try {
    const { roundNumber, actors, strategy } = event.payload || {};

    if (!roundNumber || !Array.isArray(actors)) {
      this.#logger.warn('Invalid round_started event payload', { payload: event.payload });
      return;
    }

    this.#logger.info('Round started', { roundNumber, actorCount: actors.length, strategy });

    // Update round number display
    if (this.#roundNumberElement) {
      this.#roundNumberElement.textContent = `ROUND ${roundNumber}`;
    }

    // Convert actor IDs to entity objects for render method
    // The render method expects entity objects with id property
    const actorEntities = actors.map(actorId => ({ id: actorId }));

    // Render the full queue with animations
    this.render(actorEntities);

    // Reset current actor tracking
    this.#_currentActorId = null;

  } catch (error) {
    this.#logger.error('Failed to handle round_started event', {
      error: error.message,
      payload: event.payload,
    });
  }
}
```

### 2. Implement #handleTurnStarted

Replace the stub with:

```javascript
/**
 * Handle turn_started event.
 * Highlights the current actor in the ticker.
 *
 * @param {Object} event - Event object
 * @param {Object} event.payload - Event payload
 * @param {string} event.payload.entityId - Current actor ID
 * @param {string} event.payload.entityType - Entity type ('player' or 'ai')
 * @private
 */
#handleTurnStarted(event) {
  try {
    const { entityId, entityType } = event.payload || {};

    if (!entityId) {
      this.#logger.warn('Invalid turn_started event payload: missing entityId', {
        payload: event.payload,
      });
      return;
    }

    // Only process actor turns (entityType will be 'player' or 'ai' for actors)
    // Non-actor entities would have different entityType values
    if (entityType && entityType !== 'player' && entityType !== 'ai') {
      this.#logger.debug('Ignoring non-actor turn', { entityId, entityType });
      return;
    }

    this.#logger.debug('Turn started', { entityId });

    // Update current actor highlight
    this.updateCurrentActor(entityId);
    this.#_currentActorId = entityId;

  } catch (error) {
    this.#logger.error('Failed to handle turn_started event', {
      error: error.message,
      payload: event.payload,
    });
  }
}
```

### 3. Implement #handleTurnEnded

Replace the stub with:

```javascript
/**
 * Handle turn_ended event.
 * Removes the actor from the ticker after their turn completes.
 *
 * @param {Object} event - Event object
 * @param {Object} event.payload - Event payload
 * @param {string} event.payload.entityId - Completed actor ID
 * @private
 */
#handleTurnEnded(event) {
  try {
    const { entityId } = event.payload || {};

    if (!entityId) {
      this.#logger.warn('Invalid turn_ended event payload: missing entityId', {
        payload: event.payload,
      });
      return;
    }

    this.#logger.debug('Turn ended', { entityId });

    // Remove actor from ticker
    this.removeActor(entityId);

    // Clear current actor tracking if it was this actor
    if (this.#_currentActorId === entityId) {
      this.#_currentActorId = null;
    }

  } catch (error) {
    this.#logger.error('Failed to handle turn_ended event', {
      error: error.message,
      payload: event.payload,
    });
  }
}
```

### 4. Implement #handleParticipationChanged

Replace the stub with:

```javascript
/**
 * Handle participation component changes.
 * Updates visual state when actors are enabled/disabled.
 *
 * @param {Object} event - Event object
 * @param {Object} event.payload - Event payload
 * @param {string} event.payload.entityId - Entity ID
 * @param {string} event.payload.componentId - Component ID
 * @param {Object} event.payload.data - Component data
 * @private
 */
#handleParticipationChanged(event) {
  try {
    const { entityId, componentId, data } = event.payload || {};

    // Only process participation component changes
    if (componentId !== PARTICIPATION_COMPONENT_ID) {
      return;
    }

    if (!entityId) {
      this.#logger.warn('Invalid component event payload: missing entityId', {
        payload: event.payload,
      });
      return;
    }

    // Extract participation status
    const participating = data?.participating ?? true;

    this.#logger.debug('Participation changed', { entityId, participating });

    // Update visual state
    this.updateActorParticipation(entityId, participating);

  } catch (error) {
    this.#logger.error('Failed to handle participation change event', {
      error: error.message,
      payload: event.payload,
    });
  }
}
```

## Event Subscription Verification

The constructor (from TURORDTIC-003) should already have these subscriptions:

```javascript
#subscribeToEvents() {
  const unsubRoundStarted = this.#validatedEventDispatcher.subscribe(
    ROUND_STARTED_ID,
    this.#handleRoundStarted.bind(this)
  );
  if (unsubRoundStarted) this.#unsubscribeFunctions.push(unsubRoundStarted);

  const unsubTurnStarted = this.#validatedEventDispatcher.subscribe(
    TURN_STARTED_ID,
    this.#handleTurnStarted.bind(this)
  );
  if (unsubTurnStarted) this.#unsubscribeFunctions.push(unsubTurnStarted);

  const unsubTurnEnded = this.#validatedEventDispatcher.subscribe(
    TURN_ENDED_ID,
    this.#handleTurnEnded.bind(this)
  );
  if (unsubTurnEnded) this.#unsubscribeFunctions.push(unsubTurnEnded);

  const unsubComponentAdded = this.#validatedEventDispatcher.subscribe(
    COMPONENT_ADDED_ID,
    this.#handleParticipationChanged.bind(this)
  );
  if (unsubComponentAdded) this.#unsubscribeFunctions.push(unsubComponentAdded);

  // Note: COMPONENT_UPDATED_ID does not exist in the system.
  // Component updates are treated as COMPONENT_ADDED_ID events,
  // so subscribing to COMPONENT_ADDED_ID is sufficient.
}
```

## Testing

### Unit Tests
**File:** `tests/unit/domUI/turnOrderTickerRenderer.test.js`

Add test suite:

```javascript
describe('TurnOrderTickerRenderer - Event Handlers', () => {
  let renderer;
  let mockLogger;
  let mockEntityManager;
  let mockEntityDisplayDataProvider;
  let mockContainer;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    mockEntityManager = {
      getComponent: jest.fn(),
      hasComponent: jest.fn(),
    };

    mockEntityDisplayDataProvider = {
      getDisplayData: jest.fn(() => ({ name: 'TestActor' })),
    };

    mockContainer = document.createElement('div');
    mockContainer.innerHTML = `
      <span id="ticker-round-number">ROUND 0</span>
      <div id="ticker-actor-queue"></div>
    `;

    renderer = new TurnOrderTickerRenderer({
      logger: mockLogger,
      documentContext: {
        query: (selector) => mockContainer.querySelector(selector),
        queryAll: jest.fn(),
      },
      validatedEventDispatcher: {
        dispatch: jest.fn(),
        subscribe: jest.fn(() => 'sub-id'),
        unsubscribe: jest.fn(),
      },
      domElementFactory: {
        create: jest.fn((tag) => document.createElement(tag)),
      },
      entityManager: mockEntityManager,
      entityDisplayDataProvider: mockEntityDisplayDataProvider,
      tickerContainerElement: mockContainer,
    });

    // Spy on render methods
    jest.spyOn(renderer, 'render').mockImplementation(() => {});
    jest.spyOn(renderer, 'updateCurrentActor').mockImplementation(() => {});
    jest.spyOn(renderer, 'removeActor').mockImplementation(() => {});
    jest.spyOn(renderer, 'updateActorParticipation').mockImplementation(() => {});
  });

  describe('#handleRoundStarted', () => {
    it('should call render with actor entities', () => {
      const event = {
        payload: {
          roundNumber: 1,
          actors: ['actor-1', 'actor-2', 'actor-3'],
          strategy: 'round-robin',
        },
      };

      renderer['#handleRoundStarted'](event);

      expect(renderer.render).toHaveBeenCalledWith([
        { id: 'actor-1' },
        { id: 'actor-2' },
        { id: 'actor-3' },
      ]);
    });

    it('should update round number display', () => {
      const event = {
        payload: {
          roundNumber: 5,
          actors: ['actor-1'],
          strategy: 'round-robin',
        },
      };

      renderer['#handleRoundStarted'](event);

      const roundElement = mockContainer.querySelector('#ticker-round-number');
      expect(roundElement.textContent).toBe('ROUND 5');
    });

    it('should handle empty actor list', () => {
      const event = {
        payload: {
          roundNumber: 1,
          actors: [],
          strategy: 'round-robin',
        },
      };

      renderer['#handleRoundStarted'](event);

      expect(renderer.render).toHaveBeenCalledWith([]);
    });

    it('should warn on invalid payload', () => {
      const event = { payload: null };

      renderer['#handleRoundStarted'](event);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Invalid round_started event payload',
        expect.any(Object)
      );
      expect(renderer.render).not.toHaveBeenCalled();
    });

    it('should reset current actor tracking', () => {
      renderer['#_currentActorId'] = 'previous-actor';

      const event = {
        payload: {
          roundNumber: 2,
          actors: ['actor-1'],
          strategy: 'round-robin',
        },
      };

      renderer['#handleRoundStarted'](event);

      expect(renderer['#_currentActorId']).toBeNull();
    });
  });

  describe('#handleTurnStarted', () => {
    it('should call updateCurrentActor with entity ID', () => {
      const event = {
        payload: {
          entityId: 'actor-1',
          entityType: 'player',
        },
      };

      renderer['#handleTurnStarted'](event);

      expect(renderer.updateCurrentActor).toHaveBeenCalledWith('actor-1');
    });

    it('should track current actor ID', () => {
      const event = {
        payload: {
          entityId: 'actor-2',
          entityType: 'ai',
        },
      };

      renderer['#handleTurnStarted'](event);

      expect(renderer['#_currentActorId']).toBe('actor-2');
    });

    it('should ignore non-actor entities', () => {
      const event = {
        payload: {
          entityId: 'item-1',
          entityType: 'item',
        },
      };

      renderer['#handleTurnStarted'](event);

      expect(renderer.updateCurrentActor).not.toHaveBeenCalled();
    });

    it('should warn on missing entity ID', () => {
      const event = { payload: {} };

      renderer['#handleTurnStarted'](event);

      expect(mockLogger.warn).toHaveBeenCalled();
      expect(renderer.updateCurrentActor).not.toHaveBeenCalled();
    });
  });

  describe('#handleTurnEnded', () => {
    it('should call removeActor with entity ID', () => {
      const event = {
        payload: {
          entityId: 'actor-1',
        },
      };

      renderer['#handleTurnEnded'](event);

      expect(renderer.removeActor).toHaveBeenCalledWith('actor-1');
    });

    it('should clear current actor tracking if it matches', () => {
      renderer['#_currentActorId'] = 'actor-1';

      const event = {
        payload: {
          entityId: 'actor-1',
        },
      };

      renderer['#handleTurnEnded'](event);

      expect(renderer['#_currentActorId']).toBeNull();
    });

    it('should not clear current actor tracking if different', () => {
      renderer['#_currentActorId'] = 'actor-2';

      const event = {
        payload: {
          entityId: 'actor-1',
        },
      };

      renderer['#handleTurnEnded'](event);

      expect(renderer['#_currentActorId']).toBe('actor-2');
    });

    it('should warn on missing entity ID', () => {
      const event = { payload: {} };

      renderer['#handleTurnEnded'](event);

      expect(mockLogger.warn).toHaveBeenCalled();
      expect(renderer.removeActor).not.toHaveBeenCalled();
    });
  });

  describe('#handleParticipationChanged', () => {
    it('should call updateActorParticipation when participation changes', () => {
      const event = {
        payload: {
          entityId: 'actor-1',
          componentId: 'core:participation',
          data: { participating: false },
        },
      };

      renderer['#handleParticipationChanged'](event);

      expect(renderer.updateActorParticipation).toHaveBeenCalledWith('actor-1', false);
    });

    it('should default to true if participating not specified', () => {
      const event = {
        payload: {
          entityId: 'actor-2',
          componentId: 'core:participation',
          data: {},
        },
      };

      renderer['#handleParticipationChanged'](event);

      expect(renderer.updateActorParticipation).toHaveBeenCalledWith('actor-2', true);
    });

    it('should ignore non-participation component events', () => {
      const event = {
        payload: {
          entityId: 'actor-1',
          componentId: 'core:name',
          data: { text: 'Alice' },
        },
      };

      renderer['#handleParticipationChanged'](event);

      expect(renderer.updateActorParticipation).not.toHaveBeenCalled();
    });

    it('should warn on missing entity ID', () => {
      const event = {
        payload: {
          componentId: 'core:participation',
          data: { participating: false },
        },
      };

      renderer['#handleParticipationChanged'](event);

      expect(mockLogger.warn).toHaveBeenCalled();
      expect(renderer.updateActorParticipation).not.toHaveBeenCalled();
    });
  });
});
```

### Testing Commands
```bash
# Run event handler tests
NODE_ENV=test npm run test:unit -- tests/unit/domUI/turnOrderTickerRenderer.test.js --testNamePattern="Event Handlers" --verbose

# Run all ticker tests
NODE_ENV=test npm run test:unit -- tests/unit/domUI/turnOrderTickerRenderer.test.js --silent
```

## Acceptance Criteria
- [ ] `#handleRoundStarted` updates round number display
- [ ] `#handleRoundStarted` calls `render()` with actor entities
- [ ] `#handleRoundStarted` resets current actor tracking
- [ ] `#handleRoundStarted` handles empty actor arrays
- [ ] `#handleTurnStarted` calls `updateCurrentActor()`
- [ ] `#handleTurnStarted` tracks current actor ID
- [ ] `#handleTurnStarted` ignores non-actor entities
- [ ] `#handleTurnEnded` calls `removeActor()`
- [ ] `#handleTurnEnded` clears current actor tracking
- [ ] `#handleParticipationChanged` calls `updateActorParticipation()`
- [ ] `#handleParticipationChanged` ignores non-participation events
- [ ] All handlers validate payloads and log warnings for invalid data
- [ ] All handlers catch exceptions and log errors
- [ ] All unit tests pass

## Error Handling
Each handler includes:
1. **Payload Validation:** Check for required fields
2. **Try-Catch Blocks:** Prevent crashes from unexpected errors
3. **Logging:** Warn on invalid data, error on exceptions
4. **Graceful Degradation:** Continue operation even if one event fails

## Integration Points
- **render():** Implemented in TURORDTIC-007
- **updateCurrentActor():** Implemented in TURORDTIC-008
- **removeActor():** Implemented in TURORDTIC-009
- **updateActorParticipation():** Implemented in TURORDTIC-010

## Notes
- Handlers are private methods (use `#` prefix)
- Handlers are bound to `this` in `#subscribeToEvents()`
- The `render()` method expects entity objects with `id` property, not plain strings
- Component "updates" are treated as COMPONENT_ADDED_ID events (no separate COMPONENT_UPDATED_ID exists)
- Participation events fire for ALL component changes, so we filter by component ID
- Current actor tracking (`#_currentActorId`) helps with cleanup and debugging
- Event subscriptions return unsubscribe functions, stored in `#unsubscribeFunctions` array
- The `entityType` field in turn_started events will be 'player' or 'ai' for actors

## Next Ticket
TURORDTIC-007: Implement render method for full queue display
