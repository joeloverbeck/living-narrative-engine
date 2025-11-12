# TURORDTIC-008: Implement Current Actor Highlighting

## Status
Ready for Implementation

## Priority
Medium - Visual feedback for current turn

## Dependencies
- TURORDTIC-003 (class skeleton)
- TURORDTIC-007 (render method creates elements to highlight)

## Description
Implement the `updateCurrentActor()` public method that highlights the currently active actor in the ticker. This provides visual feedback about whose turn it is, applying a CSS class that triggers scale and border effects.

## Affected Files
- `src/domUI/turnOrderTickerRenderer.js` (modify)

## Current Behavior
The method stub logs a debug message:
```javascript
updateCurrentActor(entityId) {
  this.#logger.debug('updateCurrentActor() called', { entityId });
}
```

## CSS Reference
From spec lines 325-346 (already implemented in TURORDTIC-001):

```css
.ticker-actor.current {
  transform: scale(1.15);
}

.ticker-actor.current::before {
  content: '';
  position: absolute;
  top: -4px;
  left: -4px;
  right: -4px;
  bottom: -4px;
  border: 3px solid #3498db;
  border-radius: 8px;
  box-shadow: 0 0 15px rgba(52, 152, 219, 0.6);
  animation: pulse 2s infinite;
}
```

## Implementation

### Replace Method Implementation

**Location:** `src/domUI/turnOrderTickerRenderer.js`

Replace the stub with:

```javascript
/**
 * Update the visual highlight for the current actor.
 * Removes highlight from previous actor and applies to new one.
 * Scrolls the highlighted actor into view if needed.
 *
 * @param {string} entityId - ID of the current actor
 * @public
 */
updateCurrentActor(entityId) {
  if (!entityId || typeof entityId !== 'string') {
    this.#logger.warn('updateCurrentActor requires a valid entity ID', { entityId });
    return;
  }

  this.#logger.debug('Updating current actor highlight', { entityId });

  try {
    // Remove highlight from previous current actor
    this.#clearCurrentHighlight();

    // Find the new current actor element
    const actorElement = this.#actorQueueElement?.querySelector(
      `[data-entity-id="${entityId}"]`
    );

    if (!actorElement) {
      this.#logger.warn('Actor element not found in ticker', { entityId });
      return;
    }

    // Apply current class
    actorElement.classList.add('current');

    // Scroll into view if needed (for overflow scenarios)
    this.#scrollToActor(actorElement);

    // Update internal tracking
    this.#currentActorId = entityId;

    this.#logger.debug('Current actor highlighted', { entityId });

  } catch (error) {
    this.#logger.error('Failed to update current actor highlight', {
      entityId,
      error: error.message,
    });
  }
}

/**
 * Remove highlight from all actors.
 *
 * @private
 */
#clearCurrentHighlight() {
  if (!this.#actorQueueElement) {
    return;
  }

  const currentActors = this.#actorQueueElement.querySelectorAll('.ticker-actor.current');

  currentActors.forEach(element => {
    element.classList.remove('current');
  });

  if (currentActors.length > 0) {
    this.#logger.debug('Cleared current highlight', { count: currentActors.length });
  }
}

/**
 * Scroll an actor element into view smoothly.
 * Only scrolls if the element is not fully visible.
 *
 * @param {HTMLElement} actorElement - The actor element to scroll to
 * @private
 */
#scrollToActor(actorElement) {
  if (!actorElement || !actorElement.scrollIntoView) {
    return;
  }

  try {
    // Check if element is in view
    const container = this.#actorQueueElement;
    if (!container) {
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const elementRect = actorElement.getBoundingClientRect();

    // Only scroll if element is outside viewport
    const isVisible =
      elementRect.left >= containerRect.left &&
      elementRect.right <= containerRect.right;

    if (!isVisible) {
      actorElement.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center',
      });

      this.#logger.debug('Scrolled to actor', { entityId: actorElement.getAttribute('data-entity-id') });
    }
  } catch (error) {
    // Scroll failure is non-critical
    this.#logger.debug('Failed to scroll to actor', { error: error.message });
  }
}
```

## Edge Cases Handled

### 1. Invalid Entity ID
**Scenario:** `entityId` is null, undefined, or not a string
**Solution:** Log warning and return early

### 2. Actor Not in Ticker
**Scenario:** Actor already removed or never rendered
**Solution:** Log warning, no highlight applied

### 3. Multiple Current Highlights
**Scenario:** Previous highlight not removed (edge case bug)
**Solution:** `#clearCurrentHighlight()` removes ALL `.current` classes

### 4. Scroll Not Needed
**Scenario:** Actor already visible in viewport
**Solution:** Check visibility before scrolling (performance optimization)

### 5. Scroll Not Supported
**Scenario:** Browser doesn't support smooth scrolling or `scrollIntoView`
**Solution:** Catch error, log debug message, continue without scrolling

### 6. Called Before Render
**Scenario:** Turn starts before round renders
**Solution:** Actor not found, log warning, no crash

## Testing

### Unit Tests
**File:** `tests/unit/domUI/turnOrderTickerRenderer.test.js`

Add test suite:

```javascript
describe('TurnOrderTickerRenderer - Current Actor Highlighting', () => {
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

    // Render some actors first
    renderer.render([
      { id: 'actor-1' },
      { id: 'actor-2' },
      { id: 'actor-3' },
    ]);
  });

  it('should add current class to specified actor', () => {
    renderer.updateCurrentActor('actor-2');

    const actor2 = queueElement.querySelector('[data-entity-id="actor-2"]');
    expect(actor2.classList.contains('current')).toBe(true);
  });

  it('should remove current class from previous actor', () => {
    renderer.updateCurrentActor('actor-1');
    expect(queueElement.querySelector('[data-entity-id="actor-1"]').classList.contains('current')).toBe(true);

    renderer.updateCurrentActor('actor-2');
    expect(queueElement.querySelector('[data-entity-id="actor-1"]').classList.contains('current')).toBe(false);
    expect(queueElement.querySelector('[data-entity-id="actor-2"]').classList.contains('current')).toBe(true);
  });

  it('should update internal tracking', () => {
    renderer.updateCurrentActor('actor-3');

    expect(renderer['#currentActorId']).toBe('actor-3');
  });

  it('should handle actor not found gracefully', () => {
    renderer.updateCurrentActor('non-existent-actor');

    expect(mockLogger.warn).toHaveBeenCalledWith(
      'Actor element not found in ticker',
      expect.objectContaining({ entityId: 'non-existent-actor' })
    );

    // No actors should be highlighted
    expect(queueElement.querySelectorAll('.current').length).toBe(0);
  });

  it('should validate entity ID parameter', () => {
    renderer.updateCurrentActor(null);
    expect(mockLogger.warn).toHaveBeenCalled();

    renderer.updateCurrentActor(undefined);
    expect(mockLogger.warn).toHaveBeenCalled();

    renderer.updateCurrentActor(123);
    expect(mockLogger.warn).toHaveBeenCalled();
  });

  it('should clear all current highlights when called', () => {
    // Manually add multiple current classes (edge case bug scenario)
    queueElement.querySelector('[data-entity-id="actor-1"]').classList.add('current');
    queueElement.querySelector('[data-entity-id="actor-2"]').classList.add('current');

    renderer.updateCurrentActor('actor-3');

    // Should clear all previous and apply to actor-3 only
    expect(queueElement.querySelectorAll('.current').length).toBe(1);
    expect(queueElement.querySelector('[data-entity-id="actor-3"]').classList.contains('current')).toBe(true);
  });

  it('should handle sequential updates correctly', () => {
    renderer.updateCurrentActor('actor-1');
    renderer.updateCurrentActor('actor-2');
    renderer.updateCurrentActor('actor-3');

    expect(queueElement.querySelectorAll('.current').length).toBe(1);
    expect(queueElement.querySelector('[data-entity-id="actor-3"]').classList.contains('current')).toBe(true);
  });

  it('should not crash if queue is empty', () => {
    // Clear queue
    while (queueElement.firstChild) {
      queueElement.removeChild(queueElement.firstChild);
    }

    expect(() => {
      renderer.updateCurrentActor('actor-1');
    }).not.toThrow();

    expect(mockLogger.warn).toHaveBeenCalledWith(
      'Actor element not found in ticker',
      expect.any(Object)
    );
  });
});
```

### Integration Test
**File:** `tests/integration/domUI/turnOrderTicker.integration.test.js`

```javascript
describe('Turn Order Ticker - Current Actor Highlighting', () => {
  it('should highlight current actor on turn start', async () => {
    const { eventBus, entityManager } = await setupTestEnvironment();

    // Setup actors
    await entityManager.createEntity('actor-1', ['core:actor']);
    await entityManager.createEntity('actor-2', ['core:actor']);

    // Start round
    eventBus.dispatch('core:round_started', {
      roundNumber: 1,
      actors: ['actor-1', 'actor-2'],
      strategy: 'round-robin',
    });

    // Start turn
    eventBus.dispatch('core:turn_started', {
      entityId: 'actor-1',
      entityType: 'actor',
    });

    const queueElement = document.querySelector('#ticker-actor-queue');
    const actor1Element = queueElement.querySelector('[data-entity-id="actor-1"]');

    expect(actor1Element.classList.contains('current')).toBe(true);
  });

  it('should move highlight between actors', async () => {
    const { eventBus, entityManager } = await setupTestEnvironment();

    await entityManager.createEntity('actor-1', ['core:actor']);
    await entityManager.createEntity('actor-2', ['core:actor']);

    eventBus.dispatch('core:round_started', {
      roundNumber: 1,
      actors: ['actor-1', 'actor-2'],
      strategy: 'round-robin',
    });

    // Turn 1
    eventBus.dispatch('core:turn_started', { entityId: 'actor-1', entityType: 'actor' });

    const queueElement = document.querySelector('#ticker-actor-queue');
    expect(queueElement.querySelector('[data-entity-id="actor-1"]').classList.contains('current')).toBe(true);

    // Turn 2
    eventBus.dispatch('core:turn_started', { entityId: 'actor-2', entityType: 'actor' });

    expect(queueElement.querySelector('[data-entity-id="actor-1"]').classList.contains('current')).toBe(false);
    expect(queueElement.querySelector('[data-entity-id="actor-2"]').classList.contains('current')).toBe(true);
  });
});
```

### Testing Commands
```bash
# Run highlighting tests
NODE_ENV=test npm run test:unit -- tests/unit/domUI/turnOrderTickerRenderer.test.js --testNamePattern="Current Actor Highlighting" --verbose

# Run integration tests
NODE_ENV=test npm run test:integration -- tests/integration/domUI/turnOrderTicker.integration.test.js --silent
```

## Acceptance Criteria
- [ ] Method adds `.current` class to specified actor element
- [ ] Method removes `.current` class from previous actor
- [ ] Method updates `#currentActorId` tracking
- [ ] Method validates entity ID parameter
- [ ] Method handles actor not found gracefully
- [ ] Method clears all existing highlights before applying new one
- [ ] Method scrolls actor into view if not visible
- [ ] Method does not scroll if actor already visible
- [ ] Method handles empty queue without crashing
- [ ] All unit tests pass
- [ ] Integration tests pass

## Visual Effects
The `.current` class (from CSS in TURORDTIC-001) applies:
1. **Scale Transform:** `scale(1.15)` - Actor appears slightly larger
2. **Border:** Blue border with glow effect
3. **Pulse Animation:** Subtle pulse for attention
4. **Smooth Transition:** 0.3s ease transition

## Performance Considerations
- **Single querySelector:** Direct attribute selector (fast)
- **Conditional Scrolling:** Only scroll when actor not visible
- **Smooth Behavior:** Browser-optimized smooth scrolling
- **No Layout Thrashing:** Read layout properties once per call

## Accessibility Considerations
- **Visual Feedback:** Clear indication of current actor
- **ARIA Live Region:** Ticker updates announced by screen readers (from TURORDTIC-001)
- **High Contrast:** Border and glow visible in high contrast mode

## Notes
- This method is PUBLIC and called by `#handleTurnStarted()`
- The method does NOT remove the actor from the queue (that's `removeActor()`)
- Scroll behavior is non-critical and failures are logged as debug (not error)
- The pulse animation is continuous once applied (defined in CSS)

## Next Ticket
TURORDTIC-009: Implement actor removal on turn completion
