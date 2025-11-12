# TURORDTIC-009: Implement Actor Removal on Turn Completion

## Status
Ready for Implementation

## Priority
High - Required for turn progression visualization

## Dependencies
- TURORDTIC-003 (class skeleton)
- TURORDTIC-007 (render method creates elements to remove)
- TURORDTIC-012 (exit animation - can be stubbed for now)

## Description
Implement the `removeActor()` public method that removes an actor from the ticker after their turn completes. This provides visual feedback that the turn has ended and the queue is progressing.

## Affected Files
- `src/domUI/turnOrderTickerRenderer.js` (modify)

## Current Behavior
The method stub logs a debug message:
```javascript
removeActor(entityId) {
  this.#logger.debug('removeActor() called', { entityId });
}
```

## Implementation

### Replace Method Implementation

**Location:** `src/domUI/turnOrderTickerRenderer.js`

Replace the stub with:

```javascript
/**
 * Remove an actor from the ticker after their turn completes.
 * Applies exit animation before removal.
 *
 * @param {string} entityId - ID of the actor to remove
 * @public
 */
async removeActor(entityId) {
  if (!entityId || typeof entityId !== 'string') {
    this.#logger.warn('removeActor requires a valid entity ID', { entityId });
    return;
  }

  this.#logger.debug('Removing actor from ticker', { entityId });

  try {
    // Find the actor element
    const actorElement = this.#actorQueueElement?.querySelector(
      `[data-entity-id="${entityId}"]`
    );

    if (!actorElement) {
      this.#logger.debug('Actor element not found in ticker (already removed or never rendered)', {
        entityId,
      });
      return;
    }

    // Apply exit animation
    await this.#animateActorExit(actorElement);

    // Remove from DOM
    actorElement.remove();

    // Update queue display if now empty
    const remainingActors = this.#actorQueueElement?.querySelectorAll('.ticker-actor').length || 0;
    if (remainingActors === 0) {
      this.#logger.info('All actors removed from ticker');
    }

    this.#logger.debug('Actor removed from ticker', { entityId, remainingActors });

  } catch (error) {
    this.#logger.error('Failed to remove actor from ticker', {
      entityId,
      error: error.message,
    });

    // Try to remove anyway even if animation failed
    try {
      const actorElement = this.#actorQueueElement?.querySelector(
        `[data-entity-id="${entityId}"]`
      );
      actorElement?.remove();
    } catch (fallbackError) {
      this.#logger.error('Fallback removal also failed', {
        entityId,
        error: fallbackError.message,
      });
    }
  }
}
```

## Edge Cases Handled

### 1. Invalid Entity ID
**Scenario:** `entityId` is null, undefined, or not a string
**Solution:** Log warning and return early

### 2. Actor Not in Ticker
**Scenario:** Actor already removed or never rendered
**Solution:** Log debug message (not warning - this can happen legitimately), return early

### 3. Animation Failure
**Scenario:** `#animateActorExit()` throws an error
**Solution:** Catch error, log it, attempt fallback removal without animation

### 4. Last Actor Removed
**Scenario:** All actors complete their turns
**Solution:** Log info message, queue becomes empty (new round will populate it)

### 5. Rapid Removal Calls
**Scenario:** Multiple turns end quickly
**Solution:** Each call is independent, no race conditions

### 6. Element Already Removed
**Scenario:** `remove()` called on element not in DOM
**Solution:** No error (native method is idempotent)

## Testing

### Unit Tests
**File:** `tests/unit/domUI/turnOrderTickerRenderer.test.js`

Add test suite:

```javascript
describe('TurnOrderTickerRenderer - Actor Removal', () => {
  let renderer;
  let mockLogger;
  let mockEntityManager;
  let mockEntityDisplayDataProvider;
  let mockContainer;
  let queueElement;

  beforeEach(() => {
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    mockEntityManager = {
      getComponent: jest.fn(),
      hasComponent: jest.fn(() => false),
    };

    mockEntityDisplayDataProvider = {
      getDisplayData: jest.fn((id) => ({ name: `Actor ${id}` })),
    };

    mockContainer = document.createElement('div');
    queueElement = document.createElement('div');
    queueElement.id = 'ticker-actor-queue';
    mockContainer.innerHTML = `<span id="ticker-round-number">ROUND 1</span>`;
    mockContainer.appendChild(queueElement);

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
        createElement: jest.fn((tag) => document.createElement(tag)),
      },
      entityManager: mockEntityManager,
      entityDisplayDataProvider: mockEntityDisplayDataProvider,
      tickerContainerElement: mockContainer,
    });

    // Mock animation to return immediately
    jest.spyOn(renderer, '#animateActorExit' as any).mockResolvedValue(undefined);

    // Render actors
    renderer.render([
      { id: 'actor-1' },
      { id: 'actor-2' },
      { id: 'actor-3' },
    ]);
  });

  it('should remove actor element from queue', async () => {
    await renderer.removeActor('actor-2');

    expect(queueElement.querySelector('[data-entity-id="actor-2"]')).toBeNull();
    expect(queueElement.querySelectorAll('.ticker-actor').length).toBe(2);
  });

  it('should call exit animation before removal', async () => {
    const animateSpy = renderer['#animateActorExit' as any];

    await renderer.removeActor('actor-1');

    expect(animateSpy).toHaveBeenCalled();
    const callArg = animateSpy.mock.calls[0][0];
    expect(callArg.getAttribute('data-entity-id')).toBe('actor-1');
  });

  it('should handle actor not found gracefully', async () => {
    await renderer.removeActor('non-existent-actor');

    expect(mockLogger.debug).toHaveBeenCalledWith(
      'Actor element not found in ticker (already removed or never rendered)',
      expect.objectContaining({ entityId: 'non-existent-actor' })
    );

    // Queue should be unchanged
    expect(queueElement.querySelectorAll('.ticker-actor').length).toBe(3);
  });

  it('should validate entity ID parameter', async () => {
    await renderer.removeActor(null);
    expect(mockLogger.warn).toHaveBeenCalled();

    await renderer.removeActor(undefined);
    expect(mockLogger.warn).toHaveBeenCalled();

    await renderer.removeActor(123);
    expect(mockLogger.warn).toHaveBeenCalled();
  });

  it('should remove multiple actors in sequence', async () => {
    await renderer.removeActor('actor-1');
    expect(queueElement.querySelectorAll('.ticker-actor').length).toBe(2);

    await renderer.removeActor('actor-2');
    expect(queueElement.querySelectorAll('.ticker-actor').length).toBe(1);

    await renderer.removeActor('actor-3');
    expect(queueElement.querySelectorAll('.ticker-actor').length).toBe(0);
  });

  it('should log info when last actor removed', async () => {
    await renderer.removeActor('actor-1');
    await renderer.removeActor('actor-2');
    await renderer.removeActor('actor-3');

    expect(mockLogger.info).toHaveBeenCalledWith('All actors removed from ticker');
  });

  it('should attempt fallback removal if animation fails', async () => {
    const animateSpy = renderer['#animateActorExit' as any];
    animateSpy.mockRejectedValue(new Error('Animation failed'));

    await renderer.removeActor('actor-1');

    expect(mockLogger.error).toHaveBeenCalledWith(
      'Failed to remove actor from ticker',
      expect.any(Object)
    );

    // Should still be removed (fallback)
    expect(queueElement.querySelector('[data-entity-id="actor-1"]')).toBeNull();
  });

  it('should handle double removal gracefully', async () => {
    await renderer.removeActor('actor-1');
    await renderer.removeActor('actor-1'); // Second call

    // Should log debug message for second call
    expect(mockLogger.debug).toHaveBeenCalledWith(
      'Actor element not found in ticker (already removed or never rendered)',
      expect.objectContaining({ entityId: 'actor-1' })
    );
  });

  it('should handle removal from empty queue', async () => {
    // Clear queue
    while (queueElement.firstChild) {
      queueElement.removeChild(queueElement.firstChild);
    }

    await expect(renderer.removeActor('actor-1')).resolves.not.toThrow();

    expect(mockLogger.debug).toHaveBeenCalledWith(
      'Actor element not found in ticker (already removed or never rendered)',
      expect.any(Object)
    );
  });
});
```

### Integration Test
**File:** `tests/integration/domUI/turnOrderTicker.integration.test.js`

```javascript
describe('Turn Order Ticker - Actor Removal', () => {
  it('should remove actors as turns complete', async () => {
    const { eventBus, entityManager } = await setupTestEnvironment();

    // Setup actors
    await entityManager.createEntity('actor-1', ['core:actor']);
    await entityManager.createEntity('actor-2', ['core:actor']);
    await entityManager.createEntity('actor-3', ['core:actor']);

    // Start round
    eventBus.dispatch('core:round_started', {
      roundNumber: 1,
      actors: ['actor-1', 'actor-2', 'actor-3'],
      strategy: 'round-robin',
    });

    const queueElement = document.querySelector('#ticker-actor-queue');
    expect(queueElement.querySelectorAll('.ticker-actor').length).toBe(3);

    // Complete first turn
    eventBus.dispatch('core:turn_ended', { entityId: 'actor-1' });

    // Wait for animation
    await new Promise(resolve => setTimeout(resolve, 500));

    expect(queueElement.querySelectorAll('.ticker-actor').length).toBe(2);
    expect(queueElement.querySelector('[data-entity-id="actor-1"]')).toBeNull();
  });

  it('should handle rapid turn completions', async () => {
    const { eventBus, entityManager } = await setupTestEnvironment();

    await entityManager.createEntity('actor-1', ['core:actor']);
    await entityManager.createEntity('actor-2', ['core:actor']);

    eventBus.dispatch('core:round_started', {
      roundNumber: 1,
      actors: ['actor-1', 'actor-2'],
      strategy: 'round-robin',
    });

    // Rapid completions
    eventBus.dispatch('core:turn_ended', { entityId: 'actor-1' });
    eventBus.dispatch('core:turn_ended', { entityId: 'actor-2' });

    await new Promise(resolve => setTimeout(resolve, 600));

    const queueElement = document.querySelector('#ticker-actor-queue');
    expect(queueElement.querySelectorAll('.ticker-actor').length).toBe(0);
  });
});
```

### Testing Commands
```bash
# Run removal tests
NODE_ENV=test npm run test:unit -- tests/unit/domUI/turnOrderTickerRenderer.test.js --testNamePattern="Actor Removal" --verbose

# Run integration tests
NODE_ENV=test npm run test:integration -- tests/integration/domUI/turnOrderTicker.integration.test.js --silent
```

## Acceptance Criteria
- [ ] Method removes actor element from queue
- [ ] Method calls `#animateActorExit()` before removal
- [ ] Method validates entity ID parameter
- [ ] Method handles actor not found gracefully (log debug)
- [ ] Method handles animation failure with fallback removal
- [ ] Method logs info when last actor removed
- [ ] Method handles double removal gracefully
- [ ] Method handles removal from empty queue
- [ ] Method is async and awaits animation completion
- [ ] All unit tests pass
- [ ] Integration tests pass

## Animation Integration
- The `#animateActorExit()` method is implemented in TURORDTIC-012
- For now, the stub returns `Promise.resolve()` immediately
- Once TURORDTIC-012 is complete, this method will wait for animation

## Performance Considerations
- **Async Method:** Does not block other operations
- **Single Query:** Direct attribute selector (fast)
- **Native remove():** Efficient DOM manipulation
- **No Orphaned Listeners:** Element removal cleans up event listeners automatically

## Accessibility Considerations
- **ARIA Live Region:** Removal is announced by screen readers (ticker has `aria-live="polite"`)
- **Visual Feedback:** Exit animation provides clear indication of removal

## Notes
- This method is PUBLIC and called by `#handleTurnEnded()`
- The method uses `async/await` to wait for animation completion
- Fallback removal ensures actor is always removed even if animation fails
- The method does NOT trigger a new round (that's handled by turn manager)

## Next Ticket
TURORDTIC-010: Implement participation state updates
