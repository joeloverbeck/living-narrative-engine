# EXPCHAPANREN-006: Integration Tests

**Status: ✅ COMPLETED**

## Summary

Create integration tests that verify the complete event flow from `ExpressionDispatcher` through `ExpressionMessageRenderer` to DOM rendering. Tests should confirm non-interference with existing renderers.

## Files to Create

- `tests/integration/domUI/expressionMessageRenderer.integration.test.js`

## Out of Scope

- **DO NOT** modify any source files
- **DO NOT** modify unit tests
- **DO NOT** modify CSS files
- **DO NOT** create E2E or visual tests
- **DO NOT** test expression evaluation logic (only the dispatch→render flow)

## Implementation Details

### Test Structure

```javascript
/**
 * @file Integration tests for ExpressionMessageRenderer.
 * Tests complete event flow from dispatch through DOM rendering.
 * @see Ticket EXPCHAPANREN-006
 */

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';

// Import renderers (integration tests dispatch via event bus, not ExpressionDispatcher directly)
import { ExpressionMessageRenderer } from '../../../src/domUI/expressionMessageRenderer.js';
import { DamageEventMessageRenderer } from '../../../src/domUI/damageEventMessageRenderer.js';
```

### Test Categories

#### 1. Full Event Flow (3-4 tests)

```javascript
describe('Full Event Flow', () => {
  it('should render expression when ExpressionDispatcher dispatches event');
  it('should render with correct descriptionText after placeholder replacement');
  it('should apply tag-based CSS modifiers from expression definition');
  it('should scroll chat panel to bottom after rendering');
});
```

#### 2. Non-Interference with Existing Renderers (3-4 tests)

```javascript
describe('Non-Interference with Existing Renderers', () => {
  it('should not interfere with DamageEventMessageRenderer');
  it('should not interfere with SpeechBubbleRenderer events');
  it('should not interfere with ActionResultRenderer events');
  it('should coexist with DamageEventMessageRenderer on same event bus');
});
```

#### 3. DOM Integration (3 tests)

```javascript
describe('DOM Integration', () => {
  it('should append to existing message list with other message types');
  it('should maintain correct message order when mixed with other types');
  it('should render multiple expressions in sequence');
});
```

#### 4. CSS Class Integration (3 tests)

```javascript
describe('CSS Class Integration', () => {
  it('should render with base expression-message class');
  it('should render with correct CSS classes based on tags');
  it('should apply --default modifier when no matching tags');
});
```

### Test Setup Pattern

```javascript
describe('ExpressionMessageRenderer Integration', () => {
  let mockEventBus;
  let mockEntityManager;
  let mockLogger;
  let mockDocumentContext;
  let mockDomElementFactory;
  let messageList;
  let scrollContainer;
  let expressionRenderer;
  let damageRenderer;

  beforeEach(() => {
    // Setup mock DOM
    messageList = document.createElement('ul');
    messageList.id = 'message-list';
    scrollContainer = document.createElement('div');
    scrollContainer.id = 'outputDiv';
    document.body.appendChild(scrollContainer);
    scrollContainer.appendChild(messageList);

    // Setup shared event bus
    const eventListeners = {};
    mockEventBus = {
      subscribe: jest.fn((eventName, listener) => {
        if (!eventListeners[eventName]) {
          eventListeners[eventName] = [];
        }
        eventListeners[eventName].push(listener);
        return () => {
          const idx = eventListeners[eventName].indexOf(listener);
          if (idx >= 0) eventListeners[eventName].splice(idx, 1);
        };
      }),
      dispatch: jest.fn(async (eventName, payload) => {
        const listeners = eventListeners[eventName] || [];
        for (const listener of listeners) {
          await listener({ type: eventName, payload });
        }
      }),
    };

    // Create renderers with shared event bus
    expressionRenderer = new ExpressionMessageRenderer({
      logger: mockLogger,
      documentContext: mockDocumentContext,
      safeEventDispatcher: mockEventBus,
      domElementFactory: mockDomElementFactory,
    });

    damageRenderer = new DamageEventMessageRenderer({
      logger: mockLogger,
      documentContext: mockDocumentContext,
      safeEventDispatcher: mockEventBus,
      domElementFactory: mockDomElementFactory,
    });
  });

  afterEach(() => {
    expressionRenderer?.dispose?.();
    damageRenderer?.dispose?.();
    document.body.innerHTML = '';
  });
});
```

### Key Test Scenarios

#### Scenario 1: Expression Event Flow

```javascript
it('should render expression when ExpressionDispatcher dispatches event', async () => {
  // Arrange
  const expressionPayload = {
    perceptionType: 'emotion.expression',
    descriptionText: "Avery's features ease as tension releases.",
    contextualData: {
      source: 'expression_system',
      expressionId: 'emotions_affection:warm_affection',
      tags: ['affection', 'warmth'],
    },
  };

  // Act
  await mockEventBus.dispatch('core:perceptible_event', expressionPayload);

  // Assert
  expect(messageList.children.length).toBe(1);
  const renderedMessage = messageList.children[0];
  expect(renderedMessage.textContent).toBe(expressionPayload.descriptionText);
  expect(renderedMessage.classList.contains('expression-message')).toBe(true);
  expect(renderedMessage.classList.contains('expression-message--affection')).toBe(true);
});
```

#### Scenario 2: Non-Interference

```javascript
it('should not interfere with DamageEventMessageRenderer', async () => {
  // Arrange
  const damagePayload = {
    perceptionType: 'damage_received',
    descriptionText: 'You take 15 damage to your arm.',
    totalDamage: 15,
  };

  // Act
  await mockEventBus.dispatch('core:perceptible_event', damagePayload);

  // Assert - damage renderer handled it, expression renderer ignored it
  expect(messageList.children.length).toBe(1);
  expect(messageList.children[0].classList.contains('damage-message')).toBe(true);
  expect(messageList.children[0].classList.contains('expression-message')).toBe(false);
});
```

## Acceptance Criteria

### Tests That Must Pass

1. All integration tests pass: `npm run test:integration -- tests/integration/domUI/expressionMessageRenderer.integration.test.js`
2. `npx eslint tests/integration/domUI/expressionMessageRenderer.integration.test.js` passes
3. No regressions in existing integration tests: `npm run test:integration`

### Invariants That Must Remain True

1. `DamageEventMessageRenderer` continues to filter only `damage_received` events
2. Expression events do not create damage message elements
3. Damage events do not create expression message elements
4. Both renderers can coexist on the same event bus
5. Message order in DOM matches dispatch order

## Dependencies

- **EXPCHAPANREN-002** must be completed (renderer class)
- **EXPCHAPANREN-003** must be completed (DI registration)
- **EXPCHAPANREN-004** must be completed (tags in payload)
- **EXPCHAPANREN-005** should be completed (unit tests validate individual behaviors)

## Estimated Test Count

- Total: 12-15 integration tests
- Estimated lines: 300-400

## Notes

- Integration tests use real DOM (jsdom) not mocked elements
- Tests verify event bus routing between multiple subscribers
- Tests do not require full application bootstrap (only targeted components)

## Outcome

**Completed: 2026-01-09**

### What Was Actually Changed vs Originally Planned

**Originally Planned:**
- Create 12-15 integration tests covering event flow, non-interference, DOM integration, and CSS class integration
- Estimated 300-400 lines of test code

**What Was Actually Implemented:**
- Created 19 integration tests (exceeds estimate)
- ~400 lines of test code (within estimate)
- Test categories implemented:
  1. **Full Event Flow** (4 tests): Expression event rendering, descriptionText handling, tag-based CSS modifiers, scroll behavior
  2. **Non-Interference** (4 tests): DamageEventMessageRenderer, speech events, action result events, coexistence
  3. **DOM Integration** (3 tests): Append behavior, message order, sequential expressions
  4. **CSS Class Integration** (5 tests): Base class, tag-based modifiers, default fallback scenarios
  5. **Edge Cases** (3 tests): emotion.mood_shift handling, empty/whitespace descriptionText

**Minor Ticket Corrections Made:**
- Removed unnecessary `ExpressionDispatcher` import from test structure (integration tests dispatch via event bus)
- Clarified that integration tests should not directly invoke `ExpressionDispatcher` but rather test the event bus→renderer flow

**All Acceptance Criteria Met:**
- ✅ All 19 integration tests pass
- ✅ ESLint passes
- ✅ Invariants verified (renderer coexistence, event filtering, message ordering)
