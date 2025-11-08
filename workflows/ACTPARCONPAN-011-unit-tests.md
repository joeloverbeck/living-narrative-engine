# ACTPARCONPAN-011: Controller Unit Tests

## Ticket Information
- **ID**: ACTPARCONPAN-011
- **Phase**: 4 - Quality Assurance
- **Estimated Time**: 4-5 hours
- **Complexity**: Medium
- **Dependencies**: ACTPARCONPAN-006

## Scope
Create comprehensive unit tests for `ActorParticipationController` covering initialization, element caching, event subscriptions, actor loading, participation toggles, error handling, and cleanup.

## Detailed Tasks

### Test File Setup
- [ ] Create `tests/unit/domUI/actorParticipationController.test.js`
- [ ] Import test utilities from `@jest/globals`
- [ ] Import controller class
- [ ] Import required constants
- [ ] Set up test bed using `createTestBed` helper

### Initialization Tests
- [ ] Test constructor validates all dependencies
- [ ] Test constructor caches DOM elements correctly
- [ ] Test constructor attaches event listeners
- [ ] Test constructor subscribes to ENGINE_READY_UI event
- [ ] Test constructor handles missing DOM elements gracefully
- [ ] Test constructor performs defensive actor loading

### Element Caching Tests
- [ ] Test `#cacheElements()` caches widget container
- [ ] Test `#cacheElements()` caches list container
- [ ] Test `#cacheElements()` caches status area
- [ ] Test warnings logged when elements missing

### Event Subscription Tests
- [ ] Test ENGINE_READY_UI subscription created
- [ ] Test ENGINE_READY_UI event triggers `#handleGameReady()`
- [ ] Test multiple ENGINE_READY_UI events handled correctly

### Actor Loading Tests
- [ ] Test `#loadActors()` queries entity manager
- [ ] Test `#loadActors()` filters to actor entities only
- [ ] Test `#loadActors()` extracts actor names correctly
- [ ] Test `#loadActors()` queries participation component
- [ ] Test `#loadActors()` defaults participation to `true` when component missing
- [ ] Test `#loadActors()` sorts actors alphabetically
- [ ] Test empty actor list returns empty array

### Actor Rendering Tests
- [ ] Test `#renderActorList()` clears previous content
- [ ] Test `#renderActorList()` renders empty state for no actors
- [ ] Test `#renderActorList()` creates list items for each actor
- [ ] Test `#createActorListItem()` creates correct DOM structure
- [ ] Test checkboxes reflect participation state
- [ ] Test `data-actor-id` attribute set correctly

### Participation Toggle Tests
- [ ] Test `#handleParticipationToggle()` extracts actor ID
- [ ] Test `#handleParticipationToggle()` updates component via entity manager
- [ ] Test toggle creates participation component if missing
- [ ] Test toggle updates existing participation component
- [ ] Test successful toggle shows success status
- [ ] Test failed toggle shows error status
- [ ] Test failed toggle reverts checkbox state

### Status Display Tests
- [ ] Test `#showStatus()` updates status element text
- [ ] Test `#showStatus()` applies correct CSS class for type
- [ ] Test status auto-clears after 3 seconds
- [ ] Test multiple status calls clear previous timeout

### Cleanup Tests
- [ ] Test `cleanup()` unsubscribes from event bus
- [ ] Test `cleanup()` removes DOM event listeners
- [ ] Test `cleanup()` clears element references
- [ ] Test `cleanup()` clears status timeout
- [ ] Test `cleanup()` doesn't throw errors if called multiple times

### Error Handling Tests
- [ ] Test error handling when entity manager throws
- [ ] Test error handling when DOM elements missing
- [ ] Test error handling in toggle with invalid actor ID
- [ ] Test error handling with malformed event data

### Refresh Method Tests
- [ ] Test `refresh()` reloads actors
- [ ] Test `refresh()` re-renders list

## Files Created
- `tests/unit/domUI/actorParticipationController.test.js`

## Test Template Structure
```javascript
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import ActorParticipationController from '../../../src/domUI/actorParticipationController.js';
import { ENGINE_READY_UI } from '../../../src/constants/eventIds.js';
import { ACTOR_COMPONENT_ID, PARTICIPATION_COMPONENT_ID } from '../../../src/constants/componentIds.js';

describe('ActorParticipationController', () => {
  let controller;
  let mockEventBus;
  let mockDocumentContext;
  let mockLogger;
  let mockEntityManager;
  let mockElements;

  beforeEach(() => {
    // Create mocks
    mockEventBus = {
      subscribe: jest.fn((event, handler) => jest.fn()), // Returns unsubscribe
      dispatch: jest.fn(),
    };

    mockElements = {
      widget: document.createElement('div'),
      list: document.createElement('div'),
      status: document.createElement('div'),
    };
    mockElements.widget.id = 'actor-participation-widget';
    mockElements.list.id = 'actor-participation-list';
    mockElements.status.id = 'actor-participation-status';

    mockDocumentContext = {
      getElementById: jest.fn((id) => mockElements[id.split('-').pop()]),
      createElement: jest.fn((tag) => document.createElement(tag)),
    };

    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    mockEntityManager = {
      getAllEntities: jest.fn(() => []),
      hasComponent: jest.fn(() => false),
      getComponent: jest.fn(() => null),
      setComponentData: jest.fn(),
      addComponent: jest.fn(),
    };
  });

  afterEach(() => {
    if (controller) {
      controller.cleanup();
    }
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should validate all dependencies', () => {
      expect(() => {
        controller = new ActorParticipationController({
          eventBus: mockEventBus,
          documentContext: mockDocumentContext,
          logger: mockLogger,
          entityManager: mockEntityManager,
        });
      }).not.toThrow();
    });

    it('should cache DOM elements', () => {
      controller = new ActorParticipationController({
        eventBus: mockEventBus,
        documentContext: mockDocumentContext,
        logger: mockLogger,
        entityManager: mockEntityManager,
      });

      expect(mockDocumentContext.getElementById).toHaveBeenCalledWith('actor-participation-widget');
      expect(mockDocumentContext.getElementById).toHaveBeenCalledWith('actor-participation-list');
      expect(mockDocumentContext.getElementById).toHaveBeenCalledWith('actor-participation-status');
    });

    it('should subscribe to ENGINE_READY_UI event', () => {
      controller = new ActorParticipationController({
        eventBus: mockEventBus,
        documentContext: mockDocumentContext,
        logger: mockLogger,
        entityManager: mockEntityManager,
      });

      expect(mockEventBus.subscribe).toHaveBeenCalledWith(
        ENGINE_READY_UI,
        expect.any(Function)
      );
    });
  });

  // Add more test suites for other functionality...
});
```

## Acceptance Criteria
- [ ] All test suites created and passing
- [ ] Test coverage ≥ 80% branches
- [ ] Test coverage ≥ 90% functions and lines
- [ ] All critical paths tested (happy path + error cases)
- [ ] Mocks properly configured and cleaned up
- [ ] Tests follow project conventions (describe/it structure)
- [ ] No test flakiness or timing issues
- [ ] Tests run successfully with `npm run test:unit`

## Validation Steps
1. Run `npm run test:unit -- actorParticipationController.test.js`
2. Verify all tests pass
3. Check coverage report: `npm run test:unit -- --coverage actorParticipationController.test.js`
4. Ensure coverage thresholds met
5. Run full test suite: `npm run test:unit`

## Notes
- Use `jest.fn()` for mock functions with tracking
- Use `jest.clearAllMocks()` in `afterEach` for isolation
- Test both success and failure scenarios
- Mock DOM elements using real DOM APIs (jsdom)
- Use `createTestBed` helper if available in project
- Follow existing unit test patterns in `tests/unit/domUI/`
