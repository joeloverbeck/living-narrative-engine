# TURORDTIC-007: Implement Render Method for Full Queue Display

## Status
Ready for Implementation

## Priority
High - Core rendering functionality

## Dependencies
- TURORDTIC-003 (class skeleton)
- TURORDTIC-004 (display data extraction)
- TURORDTIC-005 (element creation)
- TURORDTIC-006 (event handlers call this method)

## Description
Implement the `render()` public method that displays the complete turn order queue when a round starts. This method creates actor elements, applies animations, and populates the ticker container.

## Affected Files
- `src/domUI/turnOrderTickerRenderer.js` (modify)

## Current Behavior
The method stub logs a debug message:
```javascript
render(actors) {
  this.#logger.debug('render() called', { actorCount: actors.length });
}
```

## Implementation

### Replace Method Implementation

**Location:** `src/domUI/turnOrderTickerRenderer.js`

Replace the stub with:

```javascript
/**
 * Render the full turn order queue.
 * Called when a new round starts.
 * Clears existing actors and renders the new queue with entrance animations.
 *
 * @param {Array<Entity>} actors - Array of actor entities in turn order
 * @public
 */
render(actors) {
  if (!Array.isArray(actors)) {
    this.#logger.error('render() requires an array of actors', { actors });
    throw new TypeError('actors must be an array');
  }

  this.#logger.info('Rendering turn order queue', {
    actorCount: actors.length,
    actorIds: actors.map(a => a?.id).filter(Boolean),
  });

  try {
    // Clear existing queue
    this.#clearQueue();

    // Handle empty queue
    if (actors.length === 0) {
      this.#renderEmptyQueue();
      return;
    }

    // Create and append actor elements
    actors.forEach((actor, index) => {
      if (!actor || !actor.id) {
        this.#logger.warn('Skipping invalid actor in render', { actor, index });
        return;
      }

      try {
        const actorElement = this.#createActorElement(actor);

        // Apply entrance animation with stagger
        this.#animateActorEntry(actorElement, index);

        // Append to queue
        this.#actorQueueElement.appendChild(actorElement);

      } catch (error) {
        this.#logger.error('Failed to render actor', {
          actorId: actor.id,
          index,
          error: error.message,
        });
      }
    });

    // Auto-scroll to show first actors (in case of overflow)
    this.#scrollToStart();

    this.#logger.debug('Turn order queue rendered successfully', {
      renderedCount: this.#actorQueueElement.children.length,
    });

  } catch (error) {
    this.#logger.error('Failed to render turn order queue', {
      error: error.message,
      actorCount: actors.length,
    });
    // Try to at least clear the queue so it's not showing stale data
    this.#clearQueue();
  }
}

/**
 * Clear all actors from the queue.
 *
 * @private
 */
#clearQueue() {
  if (!this.#actorQueueElement) {
    return;
  }

  // Remove all child elements
  while (this.#actorQueueElement.firstChild) {
    this.#actorQueueElement.removeChild(this.#actorQueueElement.firstChild);
  }

  this.#logger.debug('Actor queue cleared');
}

/**
 * Render a message when the queue is empty.
 *
 * @private
 */
#renderEmptyQueue() {
  const emptyMessage = this.#domElementFactory.createElement('div');
  emptyMessage.classList.add('ticker-empty-message');
  emptyMessage.textContent = 'No participating actors';
  emptyMessage.style.cssText = 'color: #95a5a6; font-style: italic; padding: 0.5rem;';

  this.#actorQueueElement.appendChild(emptyMessage);

  this.#logger.info('Rendered empty queue message');
}

/**
 * Scroll the queue to the beginning.
 * Ensures first actors are visible when queue overflows.
 *
 * @private
 */
#scrollToStart() {
  if (this.#actorQueueElement && this.#actorQueueElement.scrollTo) {
    this.#actorQueueElement.scrollTo({
      left: 0,
      behavior: 'smooth',
    });
  }
}
```

## Edge Cases Handled

### 1. Empty Actor Array
**Scenario:** No actors in round (all disabled)
**Solution:** Display "No participating actors" message

### 2. Invalid Actor Objects
**Scenario:** Actor missing `id` property or `null`
**Solution:** Log warning, skip that actor, continue rendering others

### 3. Actor Creation Failure
**Scenario:** `#createActorElement()` throws an error
**Solution:** Catch per-actor, log error, continue with remaining actors

### 4. Non-Array Input
**Scenario:** `render()` called with non-array
**Solution:** Throw TypeError immediately

### 5. Queue Overflow
**Scenario:** More than 10 actors (horizontal overflow)
**Solution:** Auto-scroll to start, CSS handles scrolling (from TURORDTIC-001)

### 6. Render Called Multiple Times
**Scenario:** Multiple rounds start rapidly
**Solution:** `#clearQueue()` removes old actors before rendering new ones

## Testing

### Unit Tests
**File:** `tests/unit/domUI/turnOrderTickerRenderer.test.js`

Add test suite:

```javascript
describe('TurnOrderTickerRenderer - Render Method', () => {
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
      getDisplayData: jest.fn((id) => ({
        name: `Actor ${id}`,
      })),
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
  });

  it('should render all actors in order', () => {
    const actors = [
      { id: 'actor-1' },
      { id: 'actor-2' },
      { id: 'actor-3' },
    ];

    renderer.render(actors);

    expect(queueElement.children.length).toBe(3);
    expect(queueElement.children[0].getAttribute('data-entity-id')).toBe('actor-1');
    expect(queueElement.children[1].getAttribute('data-entity-id')).toBe('actor-2');
    expect(queueElement.children[2].getAttribute('data-entity-id')).toBe('actor-3');
  });

  it('should clear existing actors before rendering', () => {
    // First render
    renderer.render([{ id: 'actor-1' }]);
    expect(queueElement.children.length).toBe(1);

    // Second render
    renderer.render([{ id: 'actor-2' }, { id: 'actor-3' }]);
    expect(queueElement.children.length).toBe(2);
    expect(queueElement.querySelector('[data-entity-id="actor-1"]')).toBeNull();
  });

  it('should render empty queue message when no actors', () => {
    renderer.render([]);

    expect(queueElement.children.length).toBe(1);
    expect(queueElement.firstChild.textContent).toBe('No participating actors');
    expect(queueElement.firstChild.classList.contains('ticker-empty-message')).toBe(true);
  });

  it('should skip invalid actors and continue rendering', () => {
    const actors = [
      { id: 'actor-1' },
      null,
      { id: 'actor-3' },
      { invalidProp: 'no-id' },
      { id: 'actor-5' },
    ];

    renderer.render(actors);

    expect(queueElement.children.length).toBe(3);
    expect(mockLogger.warn).toHaveBeenCalledTimes(2);
  });

  it('should throw TypeError for non-array input', () => {
    expect(() => {
      renderer.render('not-an-array');
    }).toThrow(TypeError);

    expect(() => {
      renderer.render({ id: 'single-actor' });
    }).toThrow(TypeError);

    expect(() => {
      renderer.render(null);
    }).toThrow(TypeError);
  });

  it('should handle single actor', () => {
    renderer.render([{ id: 'solo-actor' }]);

    expect(queueElement.children.length).toBe(1);
    expect(queueElement.children[0].getAttribute('data-entity-id')).toBe('solo-actor');
  });

  it('should call #animateActorEntry for each actor', () => {
    const animateSpy = jest.spyOn(renderer, '#animateActorEntry' as any);

    const actors = [
      { id: 'actor-1' },
      { id: 'actor-2' },
    ];

    renderer.render(actors);

    expect(animateSpy).toHaveBeenCalledTimes(2);
    expect(animateSpy).toHaveBeenCalledWith(expect.any(HTMLElement), 0);
    expect(animateSpy).toHaveBeenCalledWith(expect.any(HTMLElement), 1);
  });

  it('should recover from render failure by clearing queue', () => {
    // Mock createActorElement to throw on second call
    let callCount = 0;
    jest.spyOn(renderer, '#createActorElement' as any).mockImplementation(() => {
      callCount++;
      if (callCount === 2) {
        throw new Error('Render failure');
      }
      return document.createElement('div');
    });

    const actors = [
      { id: 'actor-1' },
      { id: 'actor-2' },
      { id: 'actor-3' },
    ];

    renderer.render(actors);

    // Should log error but continue
    expect(mockLogger.error).toHaveBeenCalled();
    // Should have rendered actor-1 and actor-3, skipped actor-2
    expect(queueElement.children.length).toBe(2);
  });

  it('should log rendering info with actor IDs', () => {
    const actors = [
      { id: 'actor-1' },
      { id: 'actor-2' },
    ];

    renderer.render(actors);

    expect(mockLogger.info).toHaveBeenCalledWith(
      'Rendering turn order queue',
      expect.objectContaining({
        actorCount: 2,
        actorIds: ['actor-1', 'actor-2'],
      })
    );
  });
});
```

### Integration Test
**File:** `tests/integration/domUI/turnOrderTicker.integration.test.js`

```javascript
describe('Turn Order Ticker - Full Render Workflow', () => {
  it('should render complete queue on round start', async () => {
    const {
      renderer,
      eventBus,
      entityManager,
      entityDisplayDataProvider,
    } = await setupTestEnvironment();

    // Create actors
    await entityManager.createEntity('actor-1', ['core:actor', 'core:name']);
    await entityManager.createEntity('actor-2', ['core:actor', 'core:name']);

    entityDisplayDataProvider.getDisplayData
      .mockReturnValueOnce({ name: 'Alice' })
      .mockReturnValueOnce({ name: 'Bob' });

    // Dispatch round started
    eventBus.dispatch('core:round_started', {
      roundNumber: 1,
      actors: ['actor-1', 'actor-2'],
      strategy: 'round-robin',
    });

    const queueElement = document.querySelector('#ticker-actor-queue');
    expect(queueElement.children.length).toBe(2);
    expect(queueElement.children[0].getAttribute('data-entity-id')).toBe('actor-1');
    expect(queueElement.children[1].getAttribute('data-entity-id')).toBe('actor-2');
  });
});
```

### Testing Commands
```bash
# Run render tests
NODE_ENV=test npm run test:unit -- tests/unit/domUI/turnOrderTickerRenderer.test.js --testNamePattern="Render Method" --verbose

# Run integration tests
NODE_ENV=test npm run test:integration -- tests/integration/domUI/turnOrderTicker.integration.test.js --silent
```

## Acceptance Criteria
- [ ] Method accepts array of actor entities
- [ ] Method clears existing queue before rendering
- [ ] Method creates element for each actor
- [ ] Method applies entrance animation to each actor
- [ ] Method handles empty actor array gracefully
- [ ] Method displays "No participating actors" for empty queue
- [ ] Method skips invalid actors and logs warnings
- [ ] Method throws TypeError for non-array input
- [ ] Method scrolls queue to start after rendering
- [ ] Method logs rendering info and errors appropriately
- [ ] All unit tests pass
- [ ] Integration tests pass

## Performance Considerations
- **DOM Batch Updates:** All actors appended in single method call
- **Element Reuse:** Clear and recreate (simpler than diffing for this use case)
- **Lazy Loading:** Portrait images use `loading="lazy"` (from TURORDTIC-005)
- **Animation Stagger:** Prevents all actors animating simultaneously (handled in TURORDTIC-011)

## Accessibility Considerations
- **ARIA Live Region:** Ticker container has `aria-live="polite"` (from TURORDTIC-001)
- **Screen Readers:** Will announce when queue updates
- **Empty State:** Clear message when no actors available

## Notes
- This method is PUBLIC and called by `#handleRoundStarted()`
- The method assumes actors array contains objects with `id` property
- Animation implementation is in TURORDTIC-011 (stub calls are okay for now)
- Scroll behavior uses `smooth` for better UX

## Next Ticket
TURORDTIC-008: Implement current actor highlighting
