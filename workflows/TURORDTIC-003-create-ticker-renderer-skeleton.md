# TURORDTIC-003: Create TurnOrderTickerRenderer Class Skeleton

## Status
Ready for Implementation

## Priority
High - Core class for all ticker functionality

## Dependencies
- TURORDTIC-001 (HTML/CSS infrastructure)
- TURORDTIC-002 (round_started event)

## Description
Create the `TurnOrderTickerRenderer` class with its constructor, dependency validation, and method signatures. This establishes the class structure that will be filled in by subsequent tickets.

## Affected Files
- `src/domUI/turnOrderTickerRenderer.js` (create)

## Implementation Steps

### 1. Create Class File
**File:** `src/domUI/turnOrderTickerRenderer.js`

Create new file with complete class structure:

```javascript
/**
 * @file Turn Order Ticker Renderer
 * Manages the visual display of actor turn order in an RPG-style ticker.
 * Replaces the underutilized world name banner with actionable game state information.
 *
 * @see game.html - #turn-order-ticker container
 * @see src/turns/roundManager.js - Dispatches core:round_started
 * @see src/turns/turnManager.js - Dispatches core:turn_started and core:turn_ended
 * @see specs/turn-order-ticker-implementation.spec.md
 */

import { validateDependency } from '../utils/dependencyUtils.js';
import { ROUND_STARTED_ID } from '../constants/eventIds.js';
import { TURN_STARTED_ID, TURN_ENDED_ID } from '../constants/eventIds.js';
import { COMPONENT_ADDED_ID, COMPONENT_UPDATED_ID } from '../constants/eventIds.js';
import { PARTICIPATION_COMPONENT_ID } from '../constants/componentIds.js';

/**
 * Renders and manages the turn order ticker UI component.
 * Displays actor portraits/names in turn order, animates round transitions,
 * and visually indicates participation status.
 */
class TurnOrderTickerRenderer {
  #logger;
  #documentContext;
  #validatedEventDispatcher;
  #domElementFactory;
  #entityManager;
  #entityDisplayDataProvider;
  #tickerContainerElement;
  #roundNumberElement;
  #actorQueueElement;
  #currentActorId = null;
  #subscriptionIds = [];

  /**
   * Creates a new TurnOrderTickerRenderer.
   *
   * @param {Object} dependencies - Dependency injection object
   * @param {ILogger} dependencies.logger - Logger instance
   * @param {IDocumentContext} dependencies.documentContext - DOM access wrapper
   * @param {IValidatedEventDispatcher} dependencies.validatedEventDispatcher - Event bus
   * @param {DomElementFactory} dependencies.domElementFactory - DOM element creator
   * @param {IEntityManager} dependencies.entityManager - Entity data access
   * @param {EntityDisplayDataProvider} dependencies.entityDisplayDataProvider - Actor display data
   * @param {HTMLElement} dependencies.tickerContainerElement - #turn-order-ticker element
   */
  constructor({
    logger,
    documentContext,
    validatedEventDispatcher,
    domElementFactory,
    entityManager,
    entityDisplayDataProvider,
    tickerContainerElement,
  }) {
    // Validate all dependencies
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['info', 'warn', 'error', 'debug'],
    });
    validateDependency(documentContext, 'IDocumentContext', logger, {
      requiredMethods: ['query', 'queryAll'],
    });
    validateDependency(validatedEventDispatcher, 'IValidatedEventDispatcher', logger, {
      requiredMethods: ['dispatch', 'subscribe', 'unsubscribe'],
    });
    validateDependency(domElementFactory, 'DomElementFactory', logger, {
      requiredMethods: ['createElement'],
    });
    validateDependency(entityManager, 'IEntityManager', logger, {
      requiredMethods: ['getComponent', 'hasComponent'],
    });
    validateDependency(entityDisplayDataProvider, 'EntityDisplayDataProvider', logger, {
      requiredMethods: ['getDisplayData'],
    });

    if (!tickerContainerElement || !(tickerContainerElement instanceof HTMLElement)) {
      throw new Error('tickerContainerElement must be a valid HTMLElement');
    }

    this.#logger = logger;
    this.#documentContext = documentContext;
    this.#validatedEventDispatcher = validatedEventDispatcher;
    this.#domElementFactory = domElementFactory;
    this.#entityManager = entityManager;
    this.#entityDisplayDataProvider = entityDisplayDataProvider;
    this.#tickerContainerElement = tickerContainerElement;

    // Cache child elements
    this.#roundNumberElement = documentContext.query('#ticker-round-number');
    this.#actorQueueElement = documentContext.query('#ticker-actor-queue');

    if (!this.#roundNumberElement || !this.#actorQueueElement) {
      throw new Error('Ticker DOM structure missing required child elements');
    }

    this.#subscribeToEvents();
    this.#logger.info('TurnOrderTickerRenderer initialized');
  }

  /**
   * Subscribe to all relevant game events.
   * @private
   */
  #subscribeToEvents() {
    // Subscribe to round lifecycle
    const roundStartedSub = this.#validatedEventDispatcher.subscribe(
      ROUND_STARTED_ID,
      this.#handleRoundStarted.bind(this)
    );
    this.#subscriptionIds.push(roundStartedSub);

    // Subscribe to turn lifecycle
    const turnStartedSub = this.#validatedEventDispatcher.subscribe(
      TURN_STARTED_ID,
      this.#handleTurnStarted.bind(this)
    );
    this.#subscriptionIds.push(turnStartedSub);

    const turnEndedSub = this.#validatedEventDispatcher.subscribe(
      TURN_ENDED_ID,
      this.#handleTurnEnded.bind(this)
    );
    this.#subscriptionIds.push(turnEndedSub);

    // Subscribe to participation changes
    const componentAddedSub = this.#validatedEventDispatcher.subscribe(
      COMPONENT_ADDED_ID,
      this.#handleParticipationChanged.bind(this)
    );
    this.#subscriptionIds.push(componentAddedSub);

    const componentUpdatedSub = this.#validatedEventDispatcher.subscribe(
      COMPONENT_UPDATED_ID,
      this.#handleParticipationChanged.bind(this)
    );
    this.#subscriptionIds.push(componentUpdatedSub);

    this.#logger.debug('TurnOrderTickerRenderer event subscriptions established');
  }

  // ========== PUBLIC API ==========

  /**
   * Render the full turn order queue.
   * Called when a new round starts.
   *
   * @param {Array<Entity>} actors - Array of actor entities in turn order
   * @public
   */
  render(actors) {
    // Implementation in TURORDTIC-007
    this.#logger.debug('render() called', { actorCount: actors.length });
  }

  /**
   * Update the visual highlight for the current actor.
   *
   * @param {string} entityId - ID of the current actor
   * @public
   */
  updateCurrentActor(entityId) {
    // Implementation in TURORDTIC-008
    this.#logger.debug('updateCurrentActor() called', { entityId });
  }

  /**
   * Remove an actor from the ticker after their turn completes.
   *
   * @param {string} entityId - ID of the actor to remove
   * @public
   */
  removeActor(entityId) {
    // Implementation in TURORDTIC-009
    this.#logger.debug('removeActor() called', { entityId });
  }

  /**
   * Update the visual state of an actor based on participation status.
   *
   * @param {string} entityId - ID of the actor
   * @param {boolean} participating - Whether the actor is participating
   * @public
   */
  updateActorParticipation(entityId, participating) {
    // Implementation in TURORDTIC-010
    this.#logger.debug('updateActorParticipation() called', { entityId, participating });
  }

  /**
   * Clean up resources and unsubscribe from events.
   *
   * @public
   */
  dispose() {
    this.#subscriptionIds.forEach(subId => {
      this.#validatedEventDispatcher.unsubscribe(subId);
    });
    this.#subscriptionIds = [];
    this.#logger.info('TurnOrderTickerRenderer disposed');
  }

  // ========== PRIVATE HELPERS ==========

  /**
   * Extract display data (name, portrait) for an actor.
   *
   * @param {string} entityId - Entity ID of the actor
   * @returns {{ name: string, portraitPath?: string }} Display data
   * @private
   */
  #getActorDisplayData(entityId) {
    // Implementation in TURORDTIC-004
    return { name: entityId };
  }

  /**
   * Create a DOM element for an actor in the ticker.
   *
   * @param {Entity} entity - The actor entity
   * @returns {HTMLElement} The actor element
   * @private
   */
  #createActorElement(entity) {
    // Implementation in TURORDTIC-005
    const element = this.#domElementFactory.createElement('div');
    element.classList.add('ticker-actor');
    return element;
  }

  /**
   * Apply participation visual state to an actor element.
   *
   * @param {HTMLElement} element - The actor element
   * @param {boolean} participating - Whether the actor is participating
   * @private
   */
  #applyParticipationState(element, participating) {
    // Implementation in TURORDTIC-010
    element.setAttribute('data-participating', participating.toString());
  }

  /**
   * Animate an actor entering the ticker.
   *
   * @param {HTMLElement} element - The actor element
   * @param {number} index - Position in queue (for stagger delay)
   * @private
   */
  #animateActorEntry(element, index) {
    // Implementation in TURORDTIC-011
    element.classList.add('entering');
  }

  /**
   * Animate an actor exiting the ticker.
   *
   * @param {HTMLElement} element - The actor element
   * @returns {Promise<void>} Resolves when animation completes
   * @private
   */
  #animateActorExit(element) {
    // Implementation in TURORDTIC-012
    return Promise.resolve();
  }

  // ========== EVENT HANDLERS ==========

  /**
   * Handle round_started event.
   *
   * @param {Object} event - Event object
   * @param {Object} event.payload - Event payload
   * @param {number} event.payload.roundNumber - Round number
   * @param {string[]} event.payload.actors - Actor entity IDs
   * @private
   */
  #handleRoundStarted(event) {
    // Implementation in TURORDTIC-007
    this.#logger.debug('Round started event received', event.payload);
  }

  /**
   * Handle turn_started event.
   *
   * @param {Object} event - Event object
   * @param {Object} event.payload - Event payload
   * @param {string} event.payload.entityId - Current actor ID
   * @private
   */
  #handleTurnStarted(event) {
    // Implementation in TURORDTIC-008
    this.#logger.debug('Turn started event received', event.payload);
  }

  /**
   * Handle turn_ended event.
   *
   * @param {Object} event - Event object
   * @param {Object} event.payload - Event payload
   * @param {string} event.payload.entityId - Completed actor ID
   * @private
   */
  #handleTurnEnded(event) {
    // Implementation in TURORDTIC-009
    this.#logger.debug('Turn ended event received', event.payload);
  }

  /**
   * Handle participation component changes.
   *
   * @param {Object} event - Event object
   * @param {Object} event.payload - Event payload
   * @private
   */
  #handleParticipationChanged(event) {
    // Implementation in TURORDTIC-010
    if (event.payload?.componentId === PARTICIPATION_COMPONENT_ID) {
      this.#logger.debug('Participation changed', event.payload);
    }
  }
}

export default TurnOrderTickerRenderer;
```

## Validation

### Type Check
```bash
npm run typecheck
```
Should pass without errors.

### Import Verification
Create a temporary test to verify the class can be imported:

```javascript
// tests/unit/domUI/turnOrderTickerRenderer.test.js
import { describe, it, expect } from '@jest/globals';
import TurnOrderTickerRenderer from '../../../src/domUI/turnOrderTickerRenderer.js';

describe('TurnOrderTickerRenderer - Class Import', () => {
  it('should be importable', () => {
    expect(TurnOrderTickerRenderer).toBeDefined();
    expect(typeof TurnOrderTickerRenderer).toBe('function');
  });
});
```

### Constructor Validation Test
```javascript
describe('TurnOrderTickerRenderer - Constructor', () => {
  it('should throw if logger is missing', () => {
    expect(() => {
      new TurnOrderTickerRenderer({
        documentContext: {},
        validatedEventDispatcher: {},
        domElementFactory: {},
        entityManager: {},
        entityDisplayDataProvider: {},
        tickerContainerElement: document.createElement('div'),
      });
    }).toThrow();
  });

  it('should throw if tickerContainerElement is not an HTMLElement', () => {
    expect(() => {
      new TurnOrderTickerRenderer({
        logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
        documentContext: { query: jest.fn(), queryAll: jest.fn() },
        validatedEventDispatcher: { dispatch: jest.fn(), subscribe: jest.fn(), unsubscribe: jest.fn() },
        domElementFactory: { createElement: jest.fn() },
        entityManager: { getComponent: jest.fn(), hasComponent: jest.fn() },
        entityDisplayDataProvider: { getDisplayData: jest.fn() },
        tickerContainerElement: 'not-an-element',
      });
    }).toThrow('tickerContainerElement must be a valid HTMLElement');
  });

  it('should initialize successfully with valid dependencies', () => {
    const mockContainer = document.createElement('div');
    mockContainer.innerHTML = `
      <span id="ticker-round-number"></span>
      <div id="ticker-actor-queue"></div>
    `;

    const renderer = new TurnOrderTickerRenderer({
      logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
      documentContext: {
        query: jest.fn((selector) => mockContainer.querySelector(selector)),
        queryAll: jest.fn(),
      },
      validatedEventDispatcher: {
        dispatch: jest.fn(),
        subscribe: jest.fn(() => 'sub-id'),
        unsubscribe: jest.fn(),
      },
      domElementFactory: { createElement: jest.fn(() => document.createElement('div')) },
      entityManager: { getComponent: jest.fn(), hasComponent: jest.fn() },
      entityDisplayDataProvider: { getDisplayData: jest.fn() },
      tickerContainerElement: mockContainer,
    });

    expect(renderer).toBeDefined();
  });
});
```

## Acceptance Criteria
- [ ] `turnOrderTickerRenderer.js` file created in `src/domUI/`
- [ ] Class has complete JSDoc documentation
- [ ] Constructor validates all dependencies
- [ ] Constructor caches DOM child elements
- [ ] Constructor subscribes to 5 events (round_started, turn_started, turn_ended, component_added, component_updated)
- [ ] All public methods defined with correct signatures
- [ ] All private helper methods defined (stubs acceptable)
- [ ] All event handler methods defined (stubs acceptable)
- [ ] `dispose()` method unsubscribes from all events
- [ ] File passes TypeScript type checking
- [ ] Constructor validation tests pass

## Testing Commands
```bash
# Type check
npm run typecheck

# Run unit tests (once created)
NODE_ENV=test npm run test:unit -- tests/unit/domUI/turnOrderTickerRenderer.test.js --verbose
```

## Notes
- All method implementations are stubs at this stage
- Subsequent tickets will fill in the implementations
- The class is designed for dependency injection (no global state)
- Private fields use `#` syntax for true encapsulation
- Event subscription IDs are tracked for cleanup

## Design Patterns Used
1. **Dependency Injection:** All services injected via constructor
2. **Private Fields:** Use `#` for internal state
3. **Event-Driven:** Subscribe/unsubscribe pattern
4. **DOM Caching:** Child elements cached for performance
5. **Resource Cleanup:** `dispose()` method for proper teardown

## Next Ticket
TURORDTIC-004: Implement actor display data extraction
