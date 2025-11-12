# TURORDTIC-012: Implement Exit Animations

## Status
Ready for Implementation

## Priority
Medium - Polish and UX enhancement

## Dependencies
- TURORDTIC-003 (class skeleton)
- TURORDTIC-009 (removeActor method calls this)

## Description
Implement the `#animateActorExit()` private method that animates actors leaving the ticker when their turn completes. Returns a Promise that resolves when the animation finishes, allowing the caller to wait before removing the element from the DOM.

## Affected Files
- `src/domUI/turnOrderTickerRenderer.js` (modify)

## Current Behavior
The method stub returns an immediately resolved Promise:
```javascript
#animateActorExit(element) {
  return Promise.resolve();
}
```

## CSS Reference
From spec lines 422-432 (already implemented in TURORDTIC-001):

```css
@keyframes slideOutLeft {
  to {
    transform: translateX(-100px);
    opacity: 0;
  }
}

.ticker-actor.exiting {
  animation: slideOutLeft 0.4s ease-in forwards;
}
```

## Implementation

### Replace Method Implementation

**Location:** `src/domUI/turnOrderTickerRenderer.js`

Replace the stub with:

```javascript
/**
 * Animate an actor exiting the ticker.
 * Returns a Promise that resolves when the animation completes.
 *
 * @param {HTMLElement} element - The actor element
 * @returns {Promise<void>} Resolves when animation completes
 * @private
 */
#animateActorExit(element) {
  if (!element || !(element instanceof HTMLElement)) {
    this.#logger.warn('animateActorExit requires a valid HTMLElement', { element });
    return Promise.resolve(); // Resolve immediately for invalid input
  }

  return new Promise((resolve) => {
    try {
      // Check if user prefers reduced motion
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      if (prefersReducedMotion) {
        // Skip animation, just fade out quickly
        element.style.transition = 'opacity 0.1s';
        element.style.opacity = '0';

        setTimeout(() => {
          this.#logger.debug('Exit animation skipped (reduced motion)', {
            entityId: element.getAttribute('data-entity-id'),
          });
          resolve();
        }, 100);
        return;
      }

      // Add exiting class to trigger animation
      element.classList.add('exiting');

      // Animation duration (must match CSS)
      const animationDuration = 400; // 0.4s

      // Wait for animation to complete
      setTimeout(() => {
        element.classList.remove('exiting');
        this.#logger.debug('Exit animation completed', {
          entityId: element.getAttribute('data-entity-id'),
        });
        resolve();
      }, animationDuration);

      this.#logger.debug('Exit animation applied', {
        entityId: element.getAttribute('data-entity-id'),
      });

    } catch (error) {
      this.#logger.warn('Failed to apply exit animation', {
        entityId: element.getAttribute('data-entity-id'),
        error: error.message,
      });
      // Resolve anyway so removal can proceed
      resolve();
    }
  });
}
```

### Alternative Implementation Using AnimationEnd Event

For better synchronization with CSS animations, consider using the `animationend` event:

```javascript
/**
 * Animate an actor exiting the ticker.
 * Uses animationend event for precise timing.
 *
 * @param {HTMLElement} element - The actor element
 * @returns {Promise<void>} Resolves when animation completes
 * @private
 */
#animateActorExit(element) {
  if (!element || !(element instanceof HTMLElement)) {
    this.#logger.warn('animateActorExit requires a valid HTMLElement', { element });
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    try {
      // Check if user prefers reduced motion
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      if (prefersReducedMotion) {
        element.style.transition = 'opacity 0.1s';
        element.style.opacity = '0';
        setTimeout(resolve, 100);
        return;
      }

      // Set up animation end listener
      const handleAnimationEnd = (event) => {
        if (event.target === element) {
          element.removeEventListener('animationend', handleAnimationEnd);
          element.classList.remove('exiting');
          this.#logger.debug('Exit animation completed', {
            entityId: element.getAttribute('data-entity-id'),
          });
          resolve();
        }
      };

      element.addEventListener('animationend', handleAnimationEnd);

      // Add exiting class to trigger animation
      element.classList.add('exiting');

      // Fallback timeout in case animationend doesn't fire
      setTimeout(() => {
        element.removeEventListener('animationend', handleAnimationEnd);
        element.classList.remove('exiting');
        this.#logger.debug('Exit animation completed (fallback timeout)', {
          entityId: element.getAttribute('data-entity-id'),
        });
        resolve();
      }, 500); // Slightly longer than animation duration

      this.#logger.debug('Exit animation applied', {
        entityId: element.getAttribute('data-entity-id'),
      });

    } catch (error) {
      this.#logger.warn('Failed to apply exit animation', {
        entityId: element.getAttribute('data-entity-id'),
        error: error.message,
      });
      resolve();
    }
  });
}
```

## Edge Cases Handled

### 1. Invalid Element
**Scenario:** Element is null or not an HTMLElement
**Solution:** Log warning, return resolved Promise immediately

### 2. Reduced Motion Preference
**Scenario:** User has `prefers-reduced-motion: reduce` enabled
**Solution:** Use simple fade-out instead of slide animation

### 3. AnimationEnd Event Doesn't Fire
**Scenario:** Browser issue or element removed prematurely
**Solution:** Fallback timeout ensures Promise always resolves

### 4. Animation Interrupted
**Scenario:** Element removed from DOM mid-animation
**Solution:** Event listener cleaned up, Promise resolves via timeout

### 5. Multiple Exit Calls on Same Element
**Scenario:** `removeActor()` called twice rapidly
**Solution:** First call adds class and returns Promise; second call finds element already animating

### 6. Exception During Animation Setup
**Scenario:** Any error in animation code
**Solution:** Catch error, log warning, resolve Promise to allow removal

## Testing

### Unit Tests
**File:** `tests/unit/domUI/turnOrderTickerRenderer.test.js`

Add test suite:

```javascript
describe('TurnOrderTickerRenderer - Exit Animations', () => {
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
      hasComponent: jest.fn(() => false),
    };

    mockEntityDisplayDataProvider = {
      getDisplayData: jest.fn((id) => ({ name: `Actor ${id}` })),
    };

    mockContainer = document.createElement('div');
    mockContainer.innerHTML = `
      <span id="ticker-round-number">ROUND 1</span>
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
        createElement: jest.fn((tag) => document.createElement(tag)),
      },
      entityManager: mockEntityManager,
      entityDisplayDataProvider: mockEntityDisplayDataProvider,
      tickerContainerElement: mockContainer,
    });
  });

  it('should return a Promise', () => {
    const element = document.createElement('div');
    const result = renderer['#animateActorExit'](element);

    expect(result).toBeInstanceOf(Promise);
  });

  it('should add exiting class to element', async () => {
    const element = document.createElement('div');
    const promise = renderer['#animateActorExit'](element);

    expect(element.classList.contains('exiting')).toBe(true);

    await promise;
  });

  it('should resolve after animation duration', async () => {
    const element = document.createElement('div');
    const startTime = Date.now();

    await renderer['#animateActorExit'](element);

    const elapsed = Date.now() - startTime;
    expect(elapsed).toBeGreaterThanOrEqual(390); // ~400ms with small margin
    expect(elapsed).toBeLessThan(500); // Should not take much longer
  });

  it('should remove exiting class after completion', async () => {
    const element = document.createElement('div');

    await renderer['#animateActorExit'](element);

    expect(element.classList.contains('exiting')).toBe(false);
  });

  it('should handle invalid element gracefully', async () => {
    await expect(renderer['#animateActorExit'](null)).resolves.toBeUndefined();
    await expect(renderer['#animateActorExit']('not-an-element')).resolves.toBeUndefined();

    expect(mockLogger.warn).toHaveBeenCalledWith(
      'animateActorExit requires a valid HTMLElement',
      expect.any(Object)
    );
  });

  it('should respect prefers-reduced-motion', async () => {
    // Mock matchMedia
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = jest.fn().mockImplementation(query => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    }));

    const element = document.createElement('div');
    const startTime = Date.now();

    await renderer['#animateActorExit'](element);

    const elapsed = Date.now() - startTime;
    expect(elapsed).toBeLessThan(200); // Should be ~100ms
    expect(element.classList.contains('exiting')).toBe(false);
    expect(element.style.opacity).toBe('0');

    window.matchMedia = originalMatchMedia;
  });

  it('should handle multiple sequential exits', async () => {
    const element1 = document.createElement('div');
    const element2 = document.createElement('div');
    const element3 = document.createElement('div');

    await renderer['#animateActorExit'](element1);
    await renderer['#animateActorExit'](element2);
    await renderer['#animateActorExit'](element3);

    expect(element1.classList.contains('exiting')).toBe(false);
    expect(element2.classList.contains('exiting')).toBe(false);
    expect(element3.classList.contains('exiting')).toBe(false);
  });

  it('should allow parallel exits', async () => {
    const element1 = document.createElement('div');
    const element2 = document.createElement('div');

    const promise1 = renderer['#animateActorExit'](element1);
    const promise2 = renderer['#animateActorExit'](element2);

    await Promise.all([promise1, promise2]);

    expect(element1.classList.contains('exiting')).toBe(false);
    expect(element2.classList.contains('exiting')).toBe(false);
  });

  it('should handle exception during animation setup', async () => {
    const element = document.createElement('div');

    // Mock classList.add to throw
    const originalAdd = element.classList.add;
    element.classList.add = jest.fn(() => {
      throw new Error('classList error');
    });

    await expect(renderer['#animateActorExit'](element)).resolves.toBeUndefined();

    expect(mockLogger.warn).toHaveBeenCalledWith(
      'Failed to apply exit animation',
      expect.any(Object)
    );

    // Restore
    element.classList.add = originalAdd;
  });
});
```

### Integration Test
**File:** `tests/integration/domUI/turnOrderTicker.integration.test.js`

```javascript
describe('Turn Order Ticker - Exit Animations', () => {
  it('should animate actor removal on turn end', async () => {
    const { eventBus, entityManager } = await setupTestEnvironment();

    await entityManager.createEntity('actor-1', ['core:actor']);
    await entityManager.createEntity('actor-2', ['core:actor']);

    // Start round
    eventBus.dispatch('core:round_started', {
      roundNumber: 1,
      actors: ['actor-1', 'actor-2'],
      strategy: 'round-robin',
    });

    const queueElement = document.querySelector('#ticker-actor-queue');
    expect(queueElement.querySelectorAll('.ticker-actor').length).toBe(2);

    // End turn
    eventBus.dispatch('core:turn_ended', { entityId: 'actor-1' });

    // Should have exiting class during animation
    const actor1Element = queueElement.querySelector('[data-entity-id="actor-1"]');
    expect(actor1Element?.classList.contains('exiting')).toBe(true);

    // Wait for animation
    await new Promise(resolve => setTimeout(resolve, 500));

    // Should be removed after animation
    expect(queueElement.querySelector('[data-entity-id="actor-1"]')).toBeNull();
    expect(queueElement.querySelectorAll('.ticker-actor').length).toBe(1);
  });
});
```

### Testing Commands
```bash
# Run animation tests
NODE_ENV=test npm run test:unit -- tests/unit/domUI/turnOrderTickerRenderer.test.js --testNamePattern="Exit Animations" --verbose

# Run integration tests
NODE_ENV=test npm run test:integration -- tests/integration/domUI/turnOrderTicker.integration.test.js --silent
```

## Acceptance Criteria
- [ ] Method returns a Promise
- [ ] Promise resolves after animation completes
- [ ] Method adds `.exiting` class to element
- [ ] Method removes `.exiting` class after completion
- [ ] Method validates element parameter
- [ ] Method respects `prefers-reduced-motion` setting
- [ ] Method handles animation failures gracefully
- [ ] Method supports parallel exits
- [ ] Method uses animationend event for precise timing (optional)
- [ ] Method has fallback timeout
- [ ] All unit tests pass
- [ ] Integration tests pass

## Performance Considerations
- **CSS Animations:** Hardware-accelerated via `transform` and `opacity`
- **Promise Pattern:** Allows async/await for clean code
- **Event Cleanup:** `animationend` listener removed after firing
- **Fallback Timeout:** Prevents Promise from hanging indefinitely

## Accessibility Considerations
- **Reduced Motion:** Users with motion sensitivity get simple fade-out
- **Non-Critical:** Animation failure doesn't prevent removal
- **ARIA Live:** Screen readers announce removal regardless of animation

## Animation Timing
- **Duration:** 400ms (CSS defined)
- **Easing:** `ease-in` for natural acceleration
- **Fallback:** 500ms timeout (buffer for slow devices)

## Implementation Choice: Timeout vs AnimationEnd

**Timeout (Simpler):**
- ✅ Simpler implementation
- ✅ More predictable timing
- ❌ Might not perfectly sync with CSS changes

**AnimationEnd (More Robust):**
- ✅ Perfectly synchronized with CSS
- ✅ Adapts to CSS duration changes
- ❌ More complex with event cleanup
- ❌ Requires fallback timeout anyway

**Recommendation:** Start with timeout for simplicity, upgrade to animationend if needed.

## Notes
- This method is PRIVATE and called by `removeActor()`
- Animation is purely visual; does not affect game logic
- CSS animation defined in TURORDTIC-001
- Promise pattern allows `await` in `removeActor()`

## Next Ticket
TURORDTIC-013: Register ticker renderer in DI container
