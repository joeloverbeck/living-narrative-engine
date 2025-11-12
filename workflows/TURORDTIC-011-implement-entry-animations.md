# TURORDTIC-011: Implement Entry Animations

## Status
Ready for Implementation

## Priority
Medium - Polish and UX enhancement

## Dependencies
- TURORDTIC-003 (class skeleton)
- TURORDTIC-007 (render method calls this)

## Description
Implement the `#animateActorEntry()` private method that animates actors entering the ticker when a round starts. Uses staggered slide-in animation from the left with progressive delays for a cascading effect.

## Affected Files
- `src/domUI/turnOrderTickerRenderer.js` (modify)

## Current Behavior
The method stub adds a class:
```javascript
#animateActorEntry(element, index) {
  element.classList.add('entering');
}
```

## CSS Reference
From spec lines 406-420 (already implemented in TURORDTIC-001):

```css
@keyframes slideInFromLeft {
  from {
    transform: translateX(-100px);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

.ticker-actor.entering {
  animation: slideInFromLeft 0.5s ease-out forwards;
}
```

## Implementation

### Replace Method Implementation

**Location:** `src/domUI/turnOrderTickerRenderer.js`

Replace the stub with:

```javascript
/**
 * Animate an actor entering the ticker.
 * Applies slide-in animation with staggered delay based on position.
 *
 * @param {HTMLElement} element - The actor element
 * @param {number} index - Position in queue (for stagger delay)
 * @private
 */
#animateActorEntry(element, index) {
  if (!element || !(element instanceof HTMLElement)) {
    this.#logger.warn('animateActorEntry requires a valid HTMLElement', { element });
    return;
  }

  if (typeof index !== 'number' || index < 0) {
    this.#logger.warn('animateActorEntry requires a valid non-negative index', { index });
    index = 0; // Fallback to no delay
  }

  try {
    // Calculate stagger delay: 100ms per actor
    const staggerDelay = index * 100;

    // Apply delay via CSS custom property or inline style
    element.style.animationDelay = `${staggerDelay}ms`;

    // Add entering class to trigger animation
    element.classList.add('entering');

    // Remove class after animation completes (cleanup)
    const animationDuration = 500; // Match CSS animation duration
    const totalDuration = staggerDelay + animationDuration;

    setTimeout(() => {
      element.classList.remove('entering');
      element.style.animationDelay = ''; // Clear inline style
      this.#logger.debug('Entry animation completed', {
        entityId: element.getAttribute('data-entity-id'),
      });
    }, totalDuration + 50); // Add 50ms buffer

    this.#logger.debug('Entry animation applied', {
      entityId: element.getAttribute('data-entity-id'),
      index,
      staggerDelay,
    });

  } catch (error) {
    this.#logger.warn('Failed to apply entry animation', {
      entityId: element.getAttribute('data-entity-id'),
      index,
      error: error.message,
    });
    // Animation failure is non-critical, element will still render
  }
}
```

### Add Reduced Motion Support

Update the method to respect user's motion preferences:

```javascript
#animateActorEntry(element, index) {
  if (!element || !(element instanceof HTMLElement)) {
    this.#logger.warn('animateActorEntry requires a valid HTMLElement', { element });
    return;
  }

  if (typeof index !== 'number' || index < 0) {
    this.#logger.warn('animateActorEntry requires a valid non-negative index', { index });
    index = 0;
  }

  try {
    // Check if user prefers reduced motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) {
      // Skip animation, just fade in quickly
      element.style.opacity = '0';
      requestAnimationFrame(() => {
        element.style.transition = 'opacity 0.1s';
        element.style.opacity = '1';
      });
      this.#logger.debug('Entry animation skipped (reduced motion)', {
        entityId: element.getAttribute('data-entity-id'),
      });
      return;
    }

    // Calculate stagger delay: 100ms per actor
    const staggerDelay = index * 100;

    // Apply delay via inline style
    element.style.animationDelay = `${staggerDelay}ms`;

    // Add entering class to trigger animation
    element.classList.add('entering');

    // Remove class after animation completes
    const animationDuration = 500; // Match CSS animation duration
    const totalDuration = staggerDelay + animationDuration;

    setTimeout(() => {
      element.classList.remove('entering');
      element.style.animationDelay = '';
      this.#logger.debug('Entry animation completed', {
        entityId: element.getAttribute('data-entity-id'),
      });
    }, totalDuration + 50);

    this.#logger.debug('Entry animation applied', {
      entityId: element.getAttribute('data-entity-id'),
      index,
      staggerDelay,
    });

  } catch (error) {
    this.#logger.warn('Failed to apply entry animation', {
      entityId: element.getAttribute('data-entity-id'),
      index,
      error: error.message,
    });
  }
}
```

## Edge Cases Handled

### 1. Invalid Element
**Scenario:** Element is null or not an HTMLElement
**Solution:** Log warning and return early (no animation)

### 2. Invalid Index
**Scenario:** Index is negative, NaN, or not a number
**Solution:** Log warning, fallback to index 0 (no delay)

### 3. Reduced Motion Preference
**Scenario:** User has `prefers-reduced-motion: reduce` enabled
**Solution:** Skip slide animation, use simple fade-in instead

### 4. Animation Cleanup Failure
**Scenario:** setTimeout doesn't fire (rare browser issue)
**Solution:** Not critical; class remains but doesn't affect functionality

### 5. Rapid Re-renders
**Scenario:** Multiple rounds start quickly
**Solution:** Each animation is independent with its own timeout

### 6. Large Index (Many Actors)
**Scenario:** 20+ actors causing very long delays
**Solution:** Consider capping stagger delay (e.g., `Math.min(index, 10) * 100`)

## Testing

### Unit Tests
**File:** `tests/unit/domUI/turnOrderTickerRenderer.test.js`

Add test suite:

```javascript
describe('TurnOrderTickerRenderer - Entry Animations', () => {
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

  it('should add entering class to element', () => {
    const element = document.createElement('div');
    renderer['#animateActorEntry'](element, 0);

    expect(element.classList.contains('entering')).toBe(true);
  });

  it('should apply stagger delay based on index', () => {
    const element1 = document.createElement('div');
    const element2 = document.createElement('div');
    const element3 = document.createElement('div');

    renderer['#animateActorEntry'](element1, 0);
    renderer['#animateActorEntry'](element2, 1);
    renderer['#animateActorEntry'](element3, 2);

    expect(element1.style.animationDelay).toBe('0ms');
    expect(element2.style.animationDelay).toBe('100ms');
    expect(element3.style.animationDelay).toBe('200ms');
  });

  it('should remove entering class after animation completes', (done) => {
    const element = document.createElement('div');
    renderer['#animateActorEntry'](element, 0);

    expect(element.classList.contains('entering')).toBe(true);

    // Check after animation duration + buffer
    setTimeout(() => {
      expect(element.classList.contains('entering')).toBe(false);
      expect(element.style.animationDelay).toBe('');
      done();
    }, 600);
  });

  it('should handle invalid element gracefully', () => {
    renderer['#animateActorEntry'](null, 0);
    expect(mockLogger.warn).toHaveBeenCalledWith(
      'animateActorEntry requires a valid HTMLElement',
      expect.any(Object)
    );

    renderer['#animateActorEntry']('not-an-element', 0);
    expect(mockLogger.warn).toHaveBeenCalled();
  });

  it('should handle invalid index gracefully', () => {
    const element = document.createElement('div');

    renderer['#animateActorEntry'](element, -1);
    expect(mockLogger.warn).toHaveBeenCalledWith(
      'animateActorEntry requires a valid non-negative index',
      expect.any(Object)
    );
    expect(element.style.animationDelay).toBe('0ms'); // Fallback to 0
  });

  it('should respect prefers-reduced-motion', () => {
    // Mock matchMedia
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = jest.fn().mockImplementation(query => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    }));

    const element = document.createElement('div');
    renderer['#animateActorEntry'](element, 0);

    // Should not add entering class
    expect(element.classList.contains('entering')).toBe(false);
    // Should apply opacity transition instead
    expect(element.style.opacity).toBe('1');

    // Restore original
    window.matchMedia = originalMatchMedia;
  });

  it('should handle multiple rapid animations', () => {
    const elements = [
      document.createElement('div'),
      document.createElement('div'),
      document.createElement('div'),
    ];

    elements.forEach((el, i) => {
      renderer['#animateActorEntry'](el, i);
    });

    expect(elements[0].classList.contains('entering')).toBe(true);
    expect(elements[1].classList.contains('entering')).toBe(true);
    expect(elements[2].classList.contains('entering')).toBe(true);
  });
});
```

### Integration Test
**File:** `tests/integration/domUI/turnOrderTicker.integration.test.js`

```javascript
describe('Turn Order Ticker - Entry Animations', () => {
  it('should animate actors with staggered delays on round start', async () => {
    const { eventBus, entityManager } = await setupTestEnvironment();

    await entityManager.createEntity('actor-1', ['core:actor']);
    await entityManager.createEntity('actor-2', ['core:actor']);
    await entityManager.createEntity('actor-3', ['core:actor']);

    eventBus.dispatch('core:round_started', {
      roundNumber: 1,
      actors: ['actor-1', 'actor-2', 'actor-3'],
      strategy: 'round-robin',
    });

    const queueElement = document.querySelector('#ticker-actor-queue');
    const actors = queueElement.querySelectorAll('.ticker-actor');

    // All should have entering class initially
    expect(actors[0].classList.contains('entering')).toBe(true);
    expect(actors[1].classList.contains('entering')).toBe(true);
    expect(actors[2].classList.contains('entering')).toBe(true);

    // Check stagger delays
    expect(actors[0].style.animationDelay).toBe('0ms');
    expect(actors[1].style.animationDelay).toBe('100ms');
    expect(actors[2].style.animationDelay).toBe('200ms');

    // Wait for animations to complete
    await new Promise(resolve => setTimeout(resolve, 1000));

    // entering class should be removed
    expect(actors[0].classList.contains('entering')).toBe(false);
    expect(actors[1].classList.contains('entering')).toBe(false);
    expect(actors[2].classList.contains('entering')).toBe(false);
  });
});
```

### Testing Commands
```bash
# Run animation tests
NODE_ENV=test npm run test:unit -- tests/unit/domUI/turnOrderTickerRenderer.test.js --testNamePattern="Entry Animations" --verbose

# Run integration tests
NODE_ENV=test npm run test:integration -- tests/integration/domUI/turnOrderTicker.integration.test.js --silent
```

## Acceptance Criteria
- [ ] Method adds `.entering` class to element
- [ ] Method applies `animationDelay` based on index (100ms per actor)
- [ ] Method removes `.entering` class after animation completes
- [ ] Method clears `animationDelay` inline style after completion
- [ ] Method validates element parameter
- [ ] Method validates index parameter (fallback to 0 if invalid)
- [ ] Method respects `prefers-reduced-motion` setting
- [ ] Method handles animation failures gracefully (non-critical)
- [ ] All unit tests pass
- [ ] Integration tests pass

## Performance Considerations
- **CSS Animations:** Hardware-accelerated via `transform` and `opacity`
- **Stagger Delay:** 100ms per actor prevents overwhelming visual effect
- **requestAnimationFrame:** Used for reduced motion fallback (smooth)
- **Cleanup:** Timeout removes class and inline styles to prevent memory leaks

## Accessibility Considerations
- **Reduced Motion:** Users with motion sensitivity get simple fade-in
- **Non-Critical:** Animation failure doesn't break functionality
- **ARIA Live:** Ticker updates announced by screen readers regardless of animation

## Animation Timing
- **Duration:** 500ms (CSS defined)
- **Stagger:** 100ms between actors
- **Easing:** `ease-out` for natural deceleration
- **Total Time:** For 5 actors: 0ms + 100ms + 200ms + 300ms + 400ms + 500ms = 900ms

## Optional Enhancement: Cap Stagger Delay

For games with many actors, consider capping the delay:

```javascript
// Cap at 10 actors to prevent excessively long animations
const cappedIndex = Math.min(index, 10);
const staggerDelay = cappedIndex * 100;
```

## Notes
- This method is PRIVATE and called by `render()` for each actor
- Animation is purely visual; does not affect game logic
- CSS animation defined in TURORDTIC-001
- Cleanup timeout is not critical; class won't break if it persists

## Next Ticket
TURORDTIC-012: Implement exit animations
