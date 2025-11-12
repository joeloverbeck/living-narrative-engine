# TURORDTIC-013: Register Ticker Renderer in DI Container

## Status
Ready for Implementation

## Priority
High - Required for initialization

## Dependencies
- TURORDTIC-003 through TURORDTIC-012 (complete implementation)

## Description
Register the `TurnOrderTickerRenderer` class in the dependency injection container. Define a DI token, create factory registration, and ensure all dependencies are available.

## Affected Files
- `src/dependencyInjection/tokens/tokens-ui.js` (create or modify)
- `src/dependencyInjection/registrations/uiRegistrations.js` (modify)

## Implementation Steps

### 1. Define DI Token

**File:** `src/dependencyInjection/tokens/tokens-ui.js`

If this file doesn't exist, create it. If it exists, add the token:

```javascript
/**
 * @file UI Component Tokens
 * Dependency injection tokens for DOM UI components.
 */

export const tokens = {
  // Existing tokens...
  ITurnOrderTickerRenderer: 'ITurnOrderTickerRenderer',
  // ... other UI tokens
};
```

### 2. Export Token from Main Tokens File

**File:** `src/dependencyInjection/tokens/tokens.js`

Ensure UI tokens are exported:

```javascript
import { tokens as uiTokens } from './tokens-ui.js';

export const tokens = {
  // ... existing tokens
  ...uiTokens,
};
```

### 3. Register in DI Container

**File:** `src/dependencyInjection/registrations/uiRegistrations.js`

Add registration:

```javascript
/**
 * @file UI Component Registrations
 * Registers DOM UI components in the DI container.
 */

import TurnOrderTickerRenderer from '../../domUI/turnOrderTickerRenderer.js';
import { tokens } from '../tokens/tokens.js';

/**
 * Register UI components.
 *
 * @param {Object} container - DI container
 * @param {Function} bind - Bind helper function
 */
export function registerUiComponents(container, bind) {
  // ... existing registrations

  // Turn Order Ticker Renderer
  container.register(
    tokens.ITurnOrderTickerRenderer,
    class TurnOrderTickerRendererFactory {
      constructor(dependencies) {
        const {
          logger,
          documentContext,
          validatedEventDispatcher,
          domElementFactory,
          entityManager,
          entityDisplayDataProvider,
        } = dependencies;

        // Get ticker container element
        const tickerContainerElement = documentContext.query('#turn-order-ticker');

        if (!tickerContainerElement) {
          logger.error('Turn order ticker container element not found in DOM');
          throw new Error('Required DOM element #turn-order-ticker not found');
        }

        return new TurnOrderTickerRenderer({
          logger,
          documentContext,
          validatedEventDispatcher,
          domElementFactory,
          entityManager,
          entityDisplayDataProvider,
          tickerContainerElement,
        });
      }

      static get dependencies() {
        return [
          tokens.ILogger,
          tokens.IDocumentContext,
          tokens.IValidatedEventDispatcher,
          tokens.IDomElementFactory,
          tokens.IEntityManager,
          tokens.IEntityDisplayDataProvider,
        ];
      }
    }
  );
}
```

### 4. Call Registration Function

**File:** `src/dependencyInjection/containerSetup.js` (or similar main DI setup file)

Ensure `registerUiComponents` is called:

```javascript
import { registerUiComponents } from './registrations/uiRegistrations.js';

export function setupContainer() {
  const container = new DIContainer();

  // ... other registrations

  registerUiComponents(container, bind);

  return container;
}
```

## Alternative: Singleton Registration

If the ticker should be a singleton (single instance throughout app lifetime):

```javascript
container.registerSingleton(
  tokens.ITurnOrderTickerRenderer,
  TurnOrderTickerRenderer,
  {
    dependencies: [
      tokens.ILogger,
      tokens.IDocumentContext,
      tokens.IValidatedEventDispatcher,
      tokens.IDomElementFactory,
      tokens.IEntityManager,
      tokens.IEntityDisplayDataProvider,
      // Special: tickerContainerElement resolved separately
    ],
    factoryFn: (
      logger,
      documentContext,
      validatedEventDispatcher,
      domElementFactory,
      entityManager,
      entityDisplayDataProvider
    ) => {
      const tickerContainerElement = documentContext.query('#turn-order-ticker');

      if (!tickerContainerElement) {
        logger.error('Turn order ticker container element not found in DOM');
        throw new Error('Required DOM element #turn-order-ticker not found');
      }

      return new TurnOrderTickerRenderer({
        logger,
        documentContext,
        validatedEventDispatcher,
        domElementFactory,
        entityManager,
        entityDisplayDataProvider,
        tickerContainerElement,
      });
    },
  }
);
```

## Validation

### Manual Testing

Create a test file to verify registration:

**File:** `tests/manual/diRegistrationTest.js`

```javascript
import { setupContainer } from '../../src/dependencyInjection/containerSetup.js';
import { tokens } from '../../src/dependencyInjection/tokens/tokens.js';

// Setup DOM
document.body.innerHTML = `
  <div id="turn-order-ticker">
    <span id="ticker-round-number">ROUND 1</span>
    <div id="ticker-actor-queue"></div>
  </div>
`;

// Setup container
const container = setupContainer();

// Resolve ticker renderer
try {
  const tickerRenderer = container.resolve(tokens.ITurnOrderTickerRenderer);
  console.log('✅ TurnOrderTickerRenderer resolved successfully');
  console.log('Renderer instance:', tickerRenderer);
} catch (error) {
  console.error('❌ Failed to resolve TurnOrderTickerRenderer:', error);
}
```

### Unit Test

**File:** `tests/unit/dependencyInjection/uiRegistrations.test.js`

```javascript
describe('UI Registrations - TurnOrderTickerRenderer', () => {
  let container;
  let mockDocumentContext;

  beforeEach(() => {
    // Setup DOM
    document.body.innerHTML = `
      <div id="turn-order-ticker">
        <span id="ticker-round-number">ROUND 1</span>
        <div id="ticker-actor-queue"></div>
      </div>
    `;

    mockDocumentContext = {
      query: (selector) => document.querySelector(selector),
      queryAll: jest.fn(),
    };

    container = createTestContainer();

    // Register mocks for dependencies
    container.register(tokens.ILogger, () => ({
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    }));

    container.register(tokens.IDocumentContext, () => mockDocumentContext);

    container.register(tokens.IValidatedEventDispatcher, () => ({
      dispatch: jest.fn(),
      subscribe: jest.fn(() => 'sub-id'),
      unsubscribe: jest.fn(),
    }));

    container.register(tokens.IDomElementFactory, () => ({
      createElement: jest.fn((tag) => document.createElement(tag)),
    }));

    container.register(tokens.IEntityManager, () => ({
      getComponent: jest.fn(),
      hasComponent: jest.fn(),
    }));

    container.register(tokens.IEntityDisplayDataProvider, () => ({
      getDisplayData: jest.fn(),
    }));

    // Register ticker renderer
    registerUiComponents(container);
  });

  it('should register TurnOrderTickerRenderer', () => {
    expect(container.isRegistered(tokens.ITurnOrderTickerRenderer)).toBe(true);
  });

  it('should resolve TurnOrderTickerRenderer instance', () => {
    const renderer = container.resolve(tokens.ITurnOrderTickerRenderer);

    expect(renderer).toBeDefined();
    expect(renderer.constructor.name).toBe('TurnOrderTickerRenderer');
  });

  it('should throw if ticker container element not found', () => {
    // Remove element from DOM
    document.body.innerHTML = '';

    expect(() => {
      container.resolve(tokens.ITurnOrderTickerRenderer);
    }).toThrow('Required DOM element #turn-order-ticker not found');
  });

  it('should inject all dependencies correctly', () => {
    const renderer = container.resolve(tokens.ITurnOrderTickerRenderer);

    // Verify renderer was constructed successfully
    expect(renderer).toBeDefined();

    // Verify dispose method exists (indicates proper construction)
    expect(typeof renderer.dispose).toBe('function');
  });
});
```

### Testing Commands
```bash
# Run DI registration tests
NODE_ENV=test npm run test:unit -- tests/unit/dependencyInjection/uiRegistrations.test.js --verbose

# Type check
npm run typecheck
```

## Acceptance Criteria
- [ ] Token defined in `tokens-ui.js`
- [ ] Token exported from main `tokens.js`
- [ ] Registration added to `uiRegistrations.js`
- [ ] Registration function called in container setup
- [ ] Ticker container element queried and validated
- [ ] Error thrown if element not found
- [ ] All dependencies resolved correctly
- [ ] Unit tests pass for registration
- [ ] Manual resolution test succeeds
- [ ] Type checking passes

## Dependencies Required

The ticker renderer depends on:
1. **ILogger** - Logging service
2. **IDocumentContext** - DOM query wrapper
3. **IValidatedEventDispatcher** - Event bus
4. **IDomElementFactory** - DOM element creator
5. **IEntityManager** - Entity data access
6. **IEntityDisplayDataProvider** - Actor display data

Ensure all these are registered before `ITurnOrderTickerRenderer`.

## Error Handling

### Missing DOM Element
If `#turn-order-ticker` is not in the DOM:
- Log error with clear message
- Throw exception to prevent initialization
- User must ensure HTML structure exists (from TURORDTIC-001)

### Missing Dependencies
If any dependency is not registered:
- DI container will throw clear error
- Error message will indicate which dependency is missing

## Registration Timing

The ticker renderer should be registered:
1. **After** core services (logger, event bus)
2. **After** entity services (entity manager, display data provider)
3. **Before** UI facade/manager initialization
4. **After** DOM is ready (document.DOMContentLoaded)

## Singleton vs Transient

**Recommendation: Singleton**

Reasons:
- Only one ticker on the page
- Maintains state (current actor, subscriptions)
- Should persist throughout application lifetime
- Dispose called only on shutdown

## Notes
- The container must query the DOM element at resolution time (not registration time)
- DOM element query may fail if called before DOM is ready
- Consider lazy initialization if DOM timing is an issue

## Next Ticket
TURORDTIC-014: Initialize ticker in UI manager
