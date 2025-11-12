# TURORDTIC-010: Implement Participation State Updates

## Status
Ready for Implementation

## Priority
Medium - Visual feedback for disabled actors

## Dependencies
- TURORDTIC-003 (class skeleton)
- TURORDTIC-007 (render method creates elements to update)

## Description
Implement the `updateActorParticipation()` public method that updates the visual state of actors when their participation status changes. This applies grayscale filter and reduced opacity to non-participating actors.

## Affected Files
- `src/domUI/turnOrderTickerRenderer.js` (modify)

## Current Behavior
The method stub logs a debug message:
```javascript
updateActorParticipation(entityId, participating) {
  this.#logger.debug('updateActorParticipation() called', { entityId, participating });
}
```

## CSS Reference
From spec lines 394-404 (already implemented in TURORDTIC-001):

```css
.ticker-actor[data-participating="false"] .ticker-actor-portrait,
.ticker-actor[data-participating="false"] .ticker-actor-name-badge {
  filter: grayscale(100%);
  opacity: 0.4;
}

.ticker-actor[data-participating="false"] .ticker-actor-name {
  color: #95a5a6;
  opacity: 0.6;
}
```

## Implementation

### Replace Method Implementation

**Location:** `src/domUI/turnOrderTickerRenderer.js`

Replace the stub with:

```javascript
/**
 * Update the visual state of an actor based on participation status.
 * Applies grayscale filter and reduced opacity for non-participating actors.
 *
 * @param {string} entityId - ID of the actor
 * @param {boolean} participating - Whether the actor is participating
 * @public
 */
updateActorParticipation(entityId, participating) {
  if (!entityId || typeof entityId !== 'string') {
    this.#logger.warn('updateActorParticipation requires a valid entity ID', { entityId });
    return;
  }

  if (typeof participating !== 'boolean') {
    this.#logger.warn('updateActorParticipation requires a boolean participating value', {
      entityId,
      participating,
    });
    return;
  }

  this.#logger.debug('Updating actor participation state', { entityId, participating });

  try {
    // Find the actor element
    const actorElement = this.#actorQueueElement?.querySelector(
      `[data-entity-id="${entityId}"]`
    );

    if (!actorElement) {
      this.#logger.debug('Actor element not found in ticker', {
        entityId,
        reason: 'May not be in current round or already removed',
      });
      return;
    }

    // Apply participation state
    this.#applyParticipationState(actorElement, participating);

    this.#logger.debug('Actor participation state updated', { entityId, participating });

  } catch (error) {
    this.#logger.error('Failed to update actor participation state', {
      entityId,
      participating,
      error: error.message,
    });
  }
}
```

### Implement #applyParticipationState Helper

Replace the stub with:

```javascript
/**
 * Apply participation visual state to an actor element.
 * Updates data attribute which triggers CSS filter and opacity changes.
 *
 * @param {HTMLElement} element - The actor element
 * @param {boolean} participating - Whether the actor is participating
 * @private
 */
#applyParticipationState(element, participating) {
  if (!element || !(element instanceof HTMLElement)) {
    this.#logger.warn('applyParticipationState requires a valid HTMLElement', { element });
    return;
  }

  // Set data attribute (CSS will apply visual changes)
  element.setAttribute('data-participating', participating.toString());

  // Add transition class for smooth visual change
  element.classList.add('participation-updating');

  // Remove transition class after animation completes
  setTimeout(() => {
    element.classList.remove('participation-updating');
  }, 300); // Match CSS transition duration

  this.#logger.debug('Participation state applied to element', {
    entityId: element.getAttribute('data-entity-id'),
    participating,
  });
}
```

### Add CSS Transition (Optional Enhancement)

This CSS can be added to `css/turn-order-ticker.css` for smoother transitions:

```css
/* Smooth transition for participation changes */
.ticker-actor.participation-updating .ticker-actor-portrait,
.ticker-actor.participation-updating .ticker-actor-name-badge {
  transition: filter 0.3s ease, opacity 0.3s ease;
}

.ticker-actor.participation-updating .ticker-actor-name {
  transition: color 0.3s ease, opacity 0.3s ease;
}
```

## Edge Cases Handled

### 1. Invalid Entity ID
**Scenario:** `entityId` is null, undefined, or not a string
**Solution:** Log warning and return early

### 2. Invalid Participating Value
**Scenario:** `participating` is not a boolean
**Solution:** Log warning and return early

### 3. Actor Not in Ticker
**Scenario:** Actor not in current round or already removed
**Solution:** Log debug message (not warning - this is normal), return early

### 4. Element Not HTMLElement
**Scenario:** `#applyParticipationState()` called with invalid element
**Solution:** Validate element type, log warning, return early

### 5. Rapid Participation Toggling
**Scenario:** User toggles participation multiple times quickly
**Solution:** Each call updates the data attribute independently, CSS transitions smooth the visual changes

### 6. Mid-Turn Participation Change
**Scenario:** Actor disabled while it's their turn
**Solution:** Visual state updates immediately, current turn completes normally (turn manager handles logic)

## Testing

### Unit Tests
**File:** `tests/unit/domUI/turnOrderTickerRenderer.test.js`

Add test suite:

```javascript
describe('TurnOrderTickerRenderer - Participation Updates', () => {
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

    // Render actors
    renderer.render([
      { id: 'actor-1' },
      { id: 'actor-2' },
      { id: 'actor-3' },
    ]);
  });

  it('should set data-participating to false for non-participating actors', () => {
    renderer.updateActorParticipation('actor-2', false);

    const actor2 = queueElement.querySelector('[data-entity-id="actor-2"]');
    expect(actor2.getAttribute('data-participating')).toBe('false');
  });

  it('should set data-participating to true for participating actors', () => {
    // First set to false
    renderer.updateActorParticipation('actor-1', false);
    // Then set back to true
    renderer.updateActorParticipation('actor-1', true);

    const actor1 = queueElement.querySelector('[data-entity-id="actor-1"]');
    expect(actor1.getAttribute('data-participating')).toBe('true');
  });

  it('should validate entity ID parameter', () => {
    renderer.updateActorParticipation(null, false);
    expect(mockLogger.warn).toHaveBeenCalled();

    renderer.updateActorParticipation(undefined, false);
    expect(mockLogger.warn).toHaveBeenCalled();

    renderer.updateActorParticipation(123, false);
    expect(mockLogger.warn).toHaveBeenCalled();
  });

  it('should validate participating parameter', () => {
    renderer.updateActorParticipation('actor-1', 'not-a-boolean');
    expect(mockLogger.warn).toHaveBeenCalledWith(
      'updateActorParticipation requires a boolean participating value',
      expect.any(Object)
    );

    renderer.updateActorParticipation('actor-1', null);
    expect(mockLogger.warn).toHaveBeenCalled();
  });

  it('should handle actor not found gracefully', () => {
    renderer.updateActorParticipation('non-existent-actor', false);

    expect(mockLogger.debug).toHaveBeenCalledWith(
      'Actor element not found in ticker',
      expect.objectContaining({
        entityId: 'non-existent-actor',
        reason: 'May not be in current round or already removed',
      })
    );
  });

  it('should add and remove transition class', (done) => {
    renderer.updateActorParticipation('actor-1', false);

    const actor1 = queueElement.querySelector('[data-entity-id="actor-1"]');
    expect(actor1.classList.contains('participation-updating')).toBe(true);

    // Check after transition duration
    setTimeout(() => {
      expect(actor1.classList.contains('participation-updating')).toBe(false);
      done();
    }, 350);
  });

  it('should handle multiple updates to same actor', () => {
    renderer.updateActorParticipation('actor-1', false);
    renderer.updateActorParticipation('actor-1', true);
    renderer.updateActorParticipation('actor-1', false);

    const actor1 = queueElement.querySelector('[data-entity-id="actor-1"]');
    expect(actor1.getAttribute('data-participating')).toBe('false');
  });

  it('should update multiple actors independently', () => {
    renderer.updateActorParticipation('actor-1', false);
    renderer.updateActorParticipation('actor-2', false);
    renderer.updateActorParticipation('actor-3', true); // Keep participating

    expect(queueElement.querySelector('[data-entity-id="actor-1"]').getAttribute('data-participating')).toBe('false');
    expect(queueElement.querySelector('[data-entity-id="actor-2"]').getAttribute('data-participating')).toBe('false');
    expect(queueElement.querySelector('[data-entity-id="actor-3"]').getAttribute('data-participating')).toBe('true');
  });

  it('should not crash if queue is empty', () => {
    // Clear queue
    while (queueElement.firstChild) {
      queueElement.removeChild(queueElement.firstChild);
    }

    expect(() => {
      renderer.updateActorParticipation('actor-1', false);
    }).not.toThrow();

    expect(mockLogger.debug).toHaveBeenCalledWith(
      'Actor element not found in ticker',
      expect.any(Object)
    );
  });
});
```

### Integration Test
**File:** `tests/integration/domUI/turnOrderTicker.integration.test.js`

```javascript
describe('Turn Order Ticker - Participation Updates', () => {
  it('should update visual state when participation changes', async () => {
    const { eventBus, entityManager } = await setupTestEnvironment();

    // Setup actor
    const actor = await entityManager.createEntity('actor-1', ['core:actor', 'core:participation']);

    // Start round
    eventBus.dispatch('core:round_started', {
      roundNumber: 1,
      actors: ['actor-1'],
      strategy: 'round-robin',
    });

    const queueElement = document.querySelector('#ticker-actor-queue');
    const actorElement = queueElement.querySelector('[data-entity-id="actor-1"]');

    // Initially participating
    expect(actorElement.getAttribute('data-participating')).toBe('true');

    // Disable participation
    entityManager.addComponent(actor.id, 'core:participation', { participating: false });

    // Event should trigger update
    eventBus.dispatch('core:component_updated', {
      entityId: 'actor-1',
      componentId: 'core:participation',
      data: { participating: false },
    });

    // Wait for transition
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(actorElement.getAttribute('data-participating')).toBe('false');
  });

  it('should handle participation toggle during round', async () => {
    const { eventBus, entityManager } = await setupTestEnvironment();

    await entityManager.createEntity('actor-1', ['core:actor']);
    await entityManager.createEntity('actor-2', ['core:actor']);

    eventBus.dispatch('core:round_started', {
      roundNumber: 1,
      actors: ['actor-1', 'actor-2'],
      strategy: 'round-robin',
    });

    // Start actor-1's turn
    eventBus.dispatch('core:turn_started', { entityId: 'actor-1', entityType: 'actor' });

    // Disable actor-2 mid-round
    eventBus.dispatch('core:component_updated', {
      entityId: 'actor-2',
      componentId: 'core:participation',
      data: { participating: false },
    });

    const queueElement = document.querySelector('#ticker-actor-queue');
    const actor2Element = queueElement.querySelector('[data-entity-id="actor-2"]');

    expect(actor2Element.getAttribute('data-participating')).toBe('false');
  });
});
```

### Testing Commands
```bash
# Run participation tests
NODE_ENV=test npm run test:unit -- tests/unit/domUI/turnOrderTickerRenderer.test.js --testNamePattern="Participation Updates" --verbose

# Run integration tests
NODE_ENV=test npm run test:integration -- tests/integration/domUI/turnOrderTicker.integration.test.js --silent
```

## Acceptance Criteria
- [ ] Method updates `data-participating` attribute
- [ ] Method validates entity ID parameter
- [ ] Method validates participating parameter (boolean)
- [ ] Method handles actor not found gracefully (log debug)
- [ ] Method applies transition class temporarily
- [ ] Method removes transition class after 300ms
- [ ] Method handles rapid participation toggling
- [ ] Method updates multiple actors independently
- [ ] CSS filter and opacity apply based on data attribute
- [ ] All unit tests pass
- [ ] Integration tests pass

## Visual Effects
The `data-participating="false"` attribute (via CSS from TURORDTIC-001) applies:
1. **Grayscale Filter:** `filter: grayscale(100%)` on portrait/badge
2. **Reduced Opacity:** `opacity: 0.4` on portrait/badge
3. **Muted Name:** Gray color and `opacity: 0.6` on name label
4. **Smooth Transition:** 0.3s ease for all changes

## Performance Considerations
- **CSS-Driven:** Visual changes handled by CSS (GPU-accelerated)
- **Single Attribute:** One DOM write per update
- **Transition Class:** Temporary class for smooth visual feedback
- **No Layout Thrashing:** Attribute changes don't trigger layout recalc

## Integration with Participation Controller
From spec lines 52-55, the participation controller:
- Updates `core:participation` component via `entityManager.addComponent()`
- Dispatches `core:component_added` or `core:component_updated` events
- These events trigger `#handleParticipationChanged()` (implemented in TURORDTIC-006)
- Which calls this `updateActorParticipation()` method

## Notes
- This method is PUBLIC and called by `#handleParticipationChanged()`
- The method only updates visual state; turn logic is handled by turn cycle
- Mid-turn participation changes don't interrupt the current turn
- The transition class is optional but improves UX

## Next Ticket
TURORDTIC-011: Implement entry animations
