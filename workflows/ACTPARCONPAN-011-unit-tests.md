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
- [ ] Test constructor does NOT perform initialization in constructor (only validation)
- [ ] Test `initialize()` method caches DOM elements correctly
- [ ] Test `initialize()` method attaches event listeners
- [ ] Test `initialize()` method subscribes to ENGINE_READY_UI event
- [ ] Test `initialize()` method handles missing DOM elements gracefully
- [ ] Test `initialize()` method performs defensive actor loading

### Element Caching Tests
- [ ] Test `#cacheElements()` caches widget container (`#actor-participation-widget`)
- [ ] Test `#cacheElements()` caches list container (`#actor-participation-list-container`)
- [ ] Test `#cacheElements()` caches status area (`#actor-participation-status`)
- [ ] Test warnings logged when elements missing

### Event Subscription Tests
- [ ] Test ENGINE_READY_UI subscription created
- [ ] Test ENGINE_READY_UI event triggers `#handleGameReady()`
- [ ] Test multiple ENGINE_READY_UI events handled correctly

### Actor Loading Tests
- [ ] Test `#loadActors()` calls `getEntitiesWithComponent(ACTOR_COMPONENT_ID)`
- [ ] Test `#loadActors()` receives Entity objects (not plain data)
- [ ] Test `#loadActors()` extracts actor names using `entity.getComponentData(NAME_COMPONENT_ID)`
- [ ] Test `#loadActors()` queries participation using `entity.getComponentData(PARTICIPATION_COMPONENT_ID)`
- [ ] Test `#loadActors()` defaults participation to `true` when component missing
- [ ] Test `#loadActors()` sorts actors alphabetically by name
- [ ] Test empty actor list returns empty array

### Actor Rendering Tests
- [ ] Test `#renderActorList()` clears previous content
- [ ] Test `#renderActorList()` renders empty state for no actors
- [ ] Test `#renderActorList()` creates list items for each actor
- [ ] Test `#createActorListItem()` creates correct DOM structure
- [ ] Test checkboxes reflect participation state
- [ ] Test `data-actor-id` attribute set correctly

### Participation Toggle Tests
- [ ] Test `#handleParticipationToggle()` extracts actor ID from `checkbox.dataset.actorId`
- [ ] Test `#handleParticipationToggle()` calls `#updateParticipation()` which is async
- [ ] Test `#updateParticipation()` uses `addComponent()` (handles both create and update)
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
- [ ] Test `cleanup()` calls `eventBus.unsubscribe(ENGINE_READY_UI, handler)`
- [ ] Test `cleanup()` removes DOM event listeners using `removeEventListener()`
- [ ] Test `cleanup()` clears element references
- [ ] Test `cleanup()` clears status timeout using `clearTimeout()`
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
import { JSDOM } from 'jsdom';
import ActorParticipationController from '../../../src/domUI/actorParticipationController.js';
import DocumentContext from '../../../src/domUI/documentContext.js';
import { ENGINE_READY_UI } from '../../../src/constants/eventIds.js';
import {
  ACTOR_COMPONENT_ID,
  NAME_COMPONENT_ID,
  PARTICIPATION_COMPONENT_ID
} from '../../../src/constants/componentIds.js';

describe('ActorParticipationController', () => {
  let dom;
  let controller;
  let mockEventBus;
  let mockDocumentContext;
  let mockLogger;
  let mockEntityManager;
  let mockDocument;

  beforeEach(() => {
    // Setup JSDOM
    const html = `
      <div id="actor-participation-widget">
        <div id="actor-participation-list-container"></div>
        <div id="actor-participation-status"></div>
      </div>
    `;
    dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true });
    mockDocument = dom.window.document;

    // Create mocks
    mockEventBus = {
      subscribe: jest.fn(),
      unsubscribe: jest.fn(),
      dispatch: jest.fn(),
    };

    mockDocumentContext = new DocumentContext(mockDocument, dom.window);

    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    mockEntityManager = {
      getEntitiesWithComponent: jest.fn(() => []),
      addComponent: jest.fn().mockResolvedValue(true),
    };
  });

  afterEach(() => {
    if (controller) {
      controller.cleanup();
    }
    dom.window.close();
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should validate all dependencies in constructor', () => {
      expect(() => {
        controller = new ActorParticipationController({
          eventBus: mockEventBus,
          documentContext: mockDocumentContext,
          logger: mockLogger,
          entityManager: mockEntityManager,
        });
      }).not.toThrow();
    });

    it('should NOT cache elements or subscribe in constructor', () => {
      controller = new ActorParticipationController({
        eventBus: mockEventBus,
        documentContext: mockDocumentContext,
        logger: mockLogger,
        entityManager: mockEntityManager,
      });

      expect(mockEventBus.subscribe).not.toHaveBeenCalled();
      expect(mockLogger.debug).not.toHaveBeenCalled();
    });

    it('should cache DOM elements on initialize()', () => {
      controller = new ActorParticipationController({
        eventBus: mockEventBus,
        documentContext: mockDocumentContext,
        logger: mockLogger,
        entityManager: mockEntityManager,
      });

      controller.initialize();

      expect(mockLogger.debug).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith('[ActorParticipation] Initialization complete');
    });

    it('should subscribe to ENGINE_READY_UI event on initialize()', () => {
      controller = new ActorParticipationController({
        eventBus: mockEventBus,
        documentContext: mockDocumentContext,
        logger: mockLogger,
        entityManager: mockEntityManager,
      });

      controller.initialize();

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
- Mock DOM elements using JSDOM (not simple mock objects)
- Use real DocumentContext instance with JSDOM document
- Follow existing unit test patterns in `tests/unit/domUI/perceptibleEventSenderController.test.js`

## Key Corrections Made to Workflow (Validated Against Production Code)

### 1. Initialization Pattern
- **CORRECTED**: Controller follows PerceptibleEventSenderController pattern
- Constructor only validates dependencies (does NOT initialize)
- Separate `initialize()` method must be called to set up the controller
- Tests must call `controller.initialize()` after construction

### 2. DOM Element IDs
- **CORRECTED**: List container ID is `#actor-participation-list-container` (not `#actor-participation-list`)
- Widget ID: `#actor-participation-widget` ✓
- Status ID: `#actor-participation-status` ✓

### 3. DocumentContext API
- **CORRECTED**: Uses `query(selector)` method (NOT `getElementById()`)
- **CORRECTED**: Uses `create(tagName)` method (NOT `createElement()`)
- Must use real DocumentContext instance in tests with JSDOM

### 4. Entity Manager API
- **CORRECTED**: Uses `getEntitiesWithComponent(componentId)` (NOT `getAllEntities()`)
- **CORRECTED**: Returns Entity objects with `getComponentData()` method (NOT plain objects)
- **CORRECTED**: Uses `addComponent(id, componentId, data)` (NOT `setComponentData()`)
- **CORRECTED**: `addComponent()` is async and returns Promise<boolean>

### 5. Component IDs Required
- **CORRECTED**: Must import `NAME_COMPONENT_ID` (used to extract actor names)
- Already included: `ACTOR_COMPONENT_ID`, `PARTICIPATION_COMPONENT_ID`

### 6. Event Bus Pattern
- **CORRECTED**: `subscribe()` does NOT return unsubscribe function
- Cleanup uses: `eventBus.unsubscribe(EVENT_ID, handler)`
- Handler reference must be stored for cleanup

### 7. Actor Loading Details
- **CORRECTED**: Receives Entity objects from `getEntitiesWithComponent()`
- Extracts name using: `entity.getComponentData(NAME_COMPONENT_ID)?.text`
- Extracts participation using: `entity.getComponentData(PARTICIPATION_COMPONENT_ID)?.participating`
- Defaults to `true` using nullish coalescing: `?? true`

### 8. Test Setup Pattern
- **CORRECTED**: Use JSDOM to create real DOM environment
- Create DocumentContext with JSDOM document and window
- Mock Entity objects with `getComponentData()` method
- Mock EntityManager with `getEntitiesWithComponent()` returning Entity mocks
