# TURORDTIC-015: Create Comprehensive Unit Test Suite

## Status
Ready for Implementation

## Priority
High - Ensures code quality and prevents regressions

## Dependencies
- TURORDTIC-003 through TURORDTIC-014 (complete implementation)

## Description
Create a comprehensive unit test suite that covers all methods, edge cases, and error scenarios in `TurnOrderTickerRenderer`. Aim for 90%+ code coverage with focus on branch coverage.

## Affected Files
- `tests/unit/domUI/turnOrderTickerRenderer.test.js` (consolidate and expand)
- `tests/unit/domUI/turnOrderTickerRenderer.constructor.test.js` (optional split)
- `tests/unit/domUI/turnOrderTickerRenderer.rendering.test.js` (optional split)
- `tests/unit/domUI/turnOrderTickerRenderer.events.test.js` (optional split)

## Test Structure

### File Organization

**Option A: Single File** (Recommended for now)
```
tests/unit/domUI/turnOrderTickerRenderer.test.js
  ├─ Constructor & Dependencies
  ├─ Display Data Extraction
  ├─ Actor Element Creation
  ├─ Render Method
  ├─ Current Actor Highlighting
  ├─ Actor Removal
  ├─ Participation Updates
  ├─ Entry Animations
  ├─ Exit Animations
  ├─ Event Handlers
  └─ Dispose & Cleanup
```

**Option B: Split Files** (If file gets too large)
```
tests/unit/domUI/
  ├─ turnOrderTickerRenderer.constructor.test.js
  ├─ turnOrderTickerRenderer.rendering.test.js
  ├─ turnOrderTickerRenderer.events.test.js
  └─ turnOrderTickerRenderer.animations.test.js
```

## Comprehensive Test Suite

### File: `tests/unit/domUI/turnOrderTickerRenderer.test.js`

```javascript
/**
 * @file Turn Order Ticker Renderer - Unit Tests
 * Comprehensive test suite for TurnOrderTickerRenderer.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import TurnOrderTickerRenderer from '../../../src/domUI/turnOrderTickerRenderer.js';
import { PARTICIPATION_COMPONENT_ID } from '../../../src/constants/componentIds.js';

describe('TurnOrderTickerRenderer', () => {
  let renderer;
  let mockLogger;
  let mockDocumentContext;
  let mockValidatedEventDispatcher;
  let mockDomElementFactory;
  let mockEntityManager;
  let mockEntityDisplayDataProvider;
  let mockContainer;
  let queueElement;

  beforeEach(() => {
    // Setup mock dependencies
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    queueElement = document.createElement('div');
    queueElement.id = 'ticker-actor-queue';

    mockContainer = document.createElement('div');
    mockContainer.id = 'turn-order-ticker';
    mockContainer.innerHTML = `<span id="ticker-round-number">ROUND 0</span>`;
    mockContainer.appendChild(queueElement);

    mockDocumentContext = {
      query: jest.fn((selector) => {
        if (selector === '#turn-order-ticker') return mockContainer;
        if (selector === '#ticker-round-number') {
          return mockContainer.querySelector('#ticker-round-number');
        }
        if (selector === '#ticker-actor-queue') return queueElement;
        return null;
      }),
      queryAll: jest.fn(() => []),
    };

    mockValidatedEventDispatcher = {
      dispatch: jest.fn(),
      subscribe: jest.fn(() => `sub-${Math.random()}`),
      unsubscribe: jest.fn(),
    };

    mockDomElementFactory = {
      createElement: jest.fn((tag) => document.createElement(tag)),
    };

    mockEntityManager = {
      getComponent: jest.fn(),
      hasComponent: jest.fn(() => false),
    };

    mockEntityDisplayDataProvider = {
      getDisplayData: jest.fn((id) => ({
        name: `Actor ${id}`,
        portraitPath: null,
      })),
    };
  });

  afterEach(() => {
    if (renderer) {
      renderer.dispose();
    }
    jest.clearAllMocks();
  });

  // Helper to create renderer
  function createRenderer() {
    return new TurnOrderTickerRenderer({
      logger: mockLogger,
      documentContext: mockDocumentContext,
      validatedEventDispatcher: mockValidatedEventDispatcher,
      domElementFactory: mockDomElementFactory,
      entityManager: mockEntityManager,
      entityDisplayDataProvider: mockEntityDisplayDataProvider,
      tickerContainerElement: mockContainer,
    });
  }

  // ========== CONSTRUCTOR & DEPENDENCIES ==========

  describe('Constructor & Dependencies', () => {
    it('should validate logger dependency', () => {
      expect(() => {
        new TurnOrderTickerRenderer({
          logger: null,
          documentContext: mockDocumentContext,
          validatedEventDispatcher: mockValidatedEventDispatcher,
          domElementFactory: mockDomElementFactory,
          entityManager: mockEntityManager,
          entityDisplayDataProvider: mockEntityDisplayDataProvider,
          tickerContainerElement: mockContainer,
        });
      }).toThrow();
    });

    it('should validate documentContext dependency', () => {
      expect(() => {
        new TurnOrderTickerRenderer({
          logger: mockLogger,
          documentContext: null,
          validatedEventDispatcher: mockValidatedEventDispatcher,
          domElementFactory: mockDomElementFactory,
          entityManager: mockEntityManager,
          entityDisplayDataProvider: mockEntityDisplayDataProvider,
          tickerContainerElement: mockContainer,
        });
      }).toThrow();
    });

    it('should validate tickerContainerElement', () => {
      expect(() => {
        new TurnOrderTickerRenderer({
          logger: mockLogger,
          documentContext: mockDocumentContext,
          validatedEventDispatcher: mockValidatedEventDispatcher,
          domElementFactory: mockDomElementFactory,
          entityManager: mockEntityManager,
          entityDisplayDataProvider: mockEntityDisplayDataProvider,
          tickerContainerElement: 'not-an-element',
        });
      }).toThrow('tickerContainerElement must be a valid HTMLElement');
    });

    it('should throw if required child elements missing', () => {
      const emptyContainer = document.createElement('div');

      expect(() => {
        new TurnOrderTickerRenderer({
          logger: mockLogger,
          documentContext: {
            query: () => null, // Return null for child queries
            queryAll: jest.fn(),
          },
          validatedEventDispatcher: mockValidatedEventDispatcher,
          domElementFactory: mockDomElementFactory,
          entityManager: mockEntityManager,
          entityDisplayDataProvider: mockEntityDisplayDataProvider,
          tickerContainerElement: emptyContainer,
        });
      }).toThrow('Ticker DOM structure missing required child elements');
    });

    it('should subscribe to all required events', () => {
      renderer = createRenderer();

      expect(mockValidatedEventDispatcher.subscribe).toHaveBeenCalledWith(
        'core:round_started',
        expect.any(Function)
      );
      expect(mockValidatedEventDispatcher.subscribe).toHaveBeenCalledWith(
        'core:turn_started',
        expect.any(Function)
      );
      expect(mockValidatedEventDispatcher.subscribe).toHaveBeenCalledWith(
        'core:turn_ended',
        expect.any(Function)
      );
      expect(mockValidatedEventDispatcher.subscribe).toHaveBeenCalledWith(
        'core:component_added',
        expect.any(Function)
      );
      expect(mockValidatedEventDispatcher.subscribe).toHaveBeenCalledWith(
        'core:component_updated',
        expect.any(Function)
      );
    });
  });

  // ========== DISPLAY DATA EXTRACTION ==========

  describe('Display Data Extraction', () => {
    beforeEach(() => {
      renderer = createRenderer();
    });

    it('should extract name and portrait from display data provider', () => {
      mockEntityDisplayDataProvider.getDisplayData.mockReturnValue({
        name: 'Alice',
        portraitPath: '/portraits/alice.jpg',
      });

      const data = renderer['#getActorDisplayData']('actor-1');

      expect(data.name).toBe('Alice');
      expect(data.portraitPath).toBe('/portraits/alice.jpg');
      expect(data.participating).toBe(true);
    });

    it('should fallback to entity ID if name missing', () => {
      mockEntityDisplayDataProvider.getDisplayData.mockReturnValue({
        portraitPath: '/portrait.jpg',
      });

      const data = renderer['#getActorDisplayData']('actor-1');

      expect(data.name).toBe('actor-1');
    });

    it('should handle null display data provider result', () => {
      mockEntityDisplayDataProvider.getDisplayData.mockReturnValue(null);

      const data = renderer['#getActorDisplayData']('actor-1');

      expect(data.name).toBe('actor-1');
      expect(data.portraitPath).toBeNull();
    });

    it('should extract participation status from entity', () => {
      mockEntityManager.hasComponent.mockReturnValue(true);
      mockEntityManager.getComponent.mockReturnValue({ participating: false });

      const data = renderer['#getActorDisplayData']('actor-1');

      expect(data.participating).toBe(false);
    });

    it('should handle exceptions gracefully', () => {
      mockEntityDisplayDataProvider.getDisplayData.mockImplementation(() => {
        throw new Error('Service error');
      });

      const data = renderer['#getActorDisplayData']('actor-1');

      expect(data.name).toBe('actor-1');
      expect(mockLogger.warn).toHaveBeenCalled();
    });
  });

  // Continue with other test suites...
  // (Display remaining suites from previous tickets)

  // ========== DISPOSE & CLEANUP ==========

  describe('Dispose & Cleanup', () => {
    beforeEach(() => {
      renderer = createRenderer();
    });

    it('should unsubscribe from all events', () => {
      const subscriptionIds = mockValidatedEventDispatcher.subscribe.mock.results.map(
        result => result.value
      );

      renderer.dispose();

      subscriptionIds.forEach(subId => {
        expect(mockValidatedEventDispatcher.unsubscribe).toHaveBeenCalledWith(subId);
      });
    });

    it('should clear subscription IDs array', () => {
      renderer.dispose();

      // Try to dispose again - should not crash
      expect(() => renderer.dispose()).not.toThrow();
    });

    it('should log disposal', () => {
      renderer.dispose();

      expect(mockLogger.info).toHaveBeenCalledWith('TurnOrderTickerRenderer disposed');
    });
  });
});
```

## Test Coverage Goals

### Minimum Coverage Targets
- **Lines:** 90%
- **Functions:** 95%
- **Branches:** 85%
- **Statements:** 90%

### Critical Paths to Cover
1. **Constructor validation** - All dependency checks
2. **Event subscription** - All 5 event types
3. **Render method** - Empty, single, multiple actors
4. **Element creation** - With/without portrait, errors
5. **Animations** - Entry, exit, reduced motion
6. **Participation** - Enable, disable, rapid toggle
7. **Current actor** - Highlight, unhighlight, not found
8. **Removal** - Success, not found, animation failure
9. **Error handling** - All catch blocks
10. **Dispose** - Event unsubscription

## Testing Commands

```bash
# Run full test suite
NODE_ENV=test npm run test:unit -- tests/unit/domUI/turnOrderTickerRenderer.test.js --verbose

# Run with coverage
NODE_ENV=test npm run test:unit -- tests/unit/domUI/turnOrderTickerRenderer.test.js --coverage --collectCoverageFrom='src/domUI/turnOrderTickerRenderer.js'

# Run specific test suite
NODE_ENV=test npm run test:unit -- tests/unit/domUI/turnOrderTickerRenderer.test.js --testNamePattern="Constructor" --verbose

# Watch mode for development
NODE_ENV=test npm run test:unit -- tests/unit/domUI/turnOrderTickerRenderer.test.js --watch
```

## Coverage Report

After running tests with coverage:

```bash
# View coverage report
open coverage/lcov-report/index.html

# Or check terminal output for summary
```

## Acceptance Criteria
- [ ] All constructor validations tested
- [ ] All public methods tested
- [ ] All private methods tested (via public API)
- [ ] All event handlers tested
- [ ] All edge cases covered
- [ ] All error paths tested
- [ ] Dispose method tested
- [ ] Line coverage ≥ 90%
- [ ] Function coverage ≥ 95%
- [ ] Branch coverage ≥ 85%
- [ ] No failing tests
- [ ] No test warnings or console errors

## Test Quality Checklist

- [ ] Tests are readable and well-named
- [ ] Tests follow AAA pattern (Arrange, Act, Assert)
- [ ] Tests are independent (no shared state)
- [ ] Mocks are properly cleaned up
- [ ] Async tests properly handled
- [ ] No flaky tests (run multiple times to verify)
- [ ] No test timeouts
- [ ] Coverage gaps identified and justified

## Notes
- Tests from previous tickets (TURORDTIC-004 through TURORDTIC-012) should be consolidated here
- Use descriptive test names: "should [expected behavior] when [condition]"
- Group related tests with `describe` blocks
- Use `beforeEach` for common setup, `afterEach` for cleanup
- Consider using test fixtures for complex scenarios

## Next Ticket
TURORDTIC-016: Create comprehensive integration tests
