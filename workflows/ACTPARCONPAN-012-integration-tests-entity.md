# ACTPARCONPAN-012: Integration Tests with EntityManager

## Ticket Information
- **ID**: ACTPARCONPAN-012
- **Phase**: 4 - Quality Assurance
- **Estimated Time**: 2-3 hours
- **Complexity**: Medium
- **Dependencies**: ACTPARCONPAN-011

## Scope
Create integration tests that verify `ActorParticipationController` works correctly with real `EntityManager` instances, testing actual component creation, updates, and persistence.

## Key Corrections (from workflow analysis)
The following corrections were made to ensure workflow accuracy against production code:

1. **Test Infrastructure**:
   - Use `SimpleEntityManager` (not `createTestBed().entityManager`)
   - Use `RecordingValidatedEventDispatcher` for real event bus
   - Use `DocumentContext` from production code
   - Import from `tests/common/entities/simpleEntityManager.js`

2. **EntityManager API**:
   - Correct signature: `addComponent(entityId, componentTypeId, componentData)`
   - NOT: `addComponent(entity, { id, dataSchema })`
   - Component data is plain object, no `dataSchema` wrapper
   - Retrieval: `getComponentData(entityId, componentTypeId)` returns data directly

3. **DOM Element IDs**:
   - Correct: `#actor-participation-list-container`
   - NOT: `#actor-participation-list`

4. **Component Structure**:
   - Actor names use `NAME_COMPONENT_ID` with `{ text: name }`
   - Participation uses `PARTICIPATION_COMPONENT_ID` with `{ participating: boolean }`
   - No wrapper objects needed

5. **Controller Initialization**:
   - Must call `controller.initialize()` after construction
   - This is separate from the constructor pattern

6. **Async Handling**:
   - `addComponent()` returns a Promise
   - Test functions should be `async` with `await`
   - Wait for async updates after event dispatching

## Detailed Tasks

### Test File Setup
- [ ] Create `tests/integration/domUI/actorParticipationIntegration.test.js`
- [ ] Import test utilities and create integration test bed
- [ ] Set up real entity manager instance (not mocked)
- [ ] Set up real event bus instance
- [ ] Create real DOM elements for testing

### Actor Entity Setup
- [ ] Create helper to set up test actor entities
- [ ] Add actors to entity manager with actor components
- [ ] Add participation components to some actors
- [ ] Leave some actors without participation components

### Participation Toggle Integration Tests
- [ ] Test toggling participation updates component in entity manager
- [ ] Test enabling participation creates component if missing
- [ ] Test disabling participation updates existing component
- [ ] Test multiple sequential toggles maintain state correctly
- [ ] Test changes persist across panel refreshes

### Multi-Actor Scenario Tests
- [ ] Test multiple actors with different participation states
- [ ] Test mixed scenario: some with component, some without
- [ ] Test all actors participating
- [ ] Test all actors non-participating
- [ ] Test selective participation updates

### ENGINE_READY_UI Event Flow Tests
- [ ] Test panel loads actors after ENGINE_READY_UI event
- [ ] Test panel renders correct number of actors
- [ ] Test panel reflects correct participation states
- [ ] Test multiple ENGINE_READY_UI events handled correctly

### Component Persistence Tests
- [ ] Test participation changes persist in entity manager
- [ ] Test changes retrievable via `getComponent()`
- [ ] Test component data structure matches schema
- [ ] Test backward compatibility (actors without participation component)

## Files Created
- `tests/integration/domUI/actorParticipationIntegration.test.js`

## Test Template Structure
```javascript
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { JSDOM } from 'jsdom';
import ActorParticipationController from '../../../src/domUI/actorParticipationController.js';
import DocumentContext from '../../../src/domUI/documentContext.js';
import { SimpleEntityManager } from '../../common/entities/simpleEntityManager.js';
import { ENGINE_READY_UI } from '../../../src/constants/eventIds.js';
import {
  ACTOR_COMPONENT_ID,
  NAME_COMPONENT_ID,
  PARTICIPATION_COMPONENT_ID
} from '../../../src/constants/componentIds.js';

// Recording event dispatcher for integration testing
class RecordingValidatedEventDispatcher {
  constructor() {
    this.handlers = new Map();
    this.dispatchedEvents = [];
  }

  subscribe(eventName, handler) {
    if (!this.handlers.has(eventName)) {
      this.handlers.set(eventName, new Set());
    }
    const handlerSet = this.handlers.get(eventName);
    handlerSet.add(handler);
    return () => {
      handlerSet.delete(handler);
      if (handlerSet.size === 0) {
        this.handlers.delete(eventName);
      }
    };
  }

  async dispatch(eventName, payload) {
    this.dispatchedEvents.push({ eventName, payload });
    const handlerSet = this.handlers.get(eventName);
    if (!handlerSet) return true;
    for (const handler of Array.from(handlerSet)) {
      await handler({ type: eventName, payload });
    }
    return true;
  }

  unsubscribe(eventName, handler) {
    const handlerSet = this.handlers.get(eventName);
    if (handlerSet) {
      handlerSet.delete(handler);
    }
  }
}

describe('ActorParticipationController - Integration Tests', () => {
  let dom;
  let document;
  let controller;
  let entityManager;
  let eventBus;
  let documentContext;
  let mockLogger;

  beforeEach(() => {
    // Setup JSDOM with the correct DOM structure
    const html = `
      <!DOCTYPE html>
      <html>
        <body>
          <div id="actor-participation-widget">
            <div id="actor-participation-list-container"></div>
            <div id="actor-participation-status"></div>
          </div>
        </body>
      </html>
    `;
    dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true });
    document = dom.window.document;

    // Setup global DOM references
    global.document = document;
    global.window = dom.window;

    // Create real integration test instances
    entityManager = new SimpleEntityManager();
    eventBus = new RecordingValidatedEventDispatcher();
    documentContext = new DocumentContext(document);

    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };
  });

  afterEach(() => {
    if (controller) {
      controller.cleanup();
    }
    delete global.document;
    delete global.window;
    dom.window.close();
    jest.clearAllMocks();
  });

  async function createTestActor(id, name, participating = null) {
    // Add actor component with name
    await entityManager.addComponent(id, ACTOR_COMPONENT_ID, {});
    await entityManager.addComponent(id, NAME_COMPONENT_ID, { text: name });

    // Add participation component if specified
    if (participating !== null) {
      await entityManager.addComponent(id, PARTICIPATION_COMPONENT_ID, { participating });
    }

    return id; // Return the entity ID
  }

  describe('Participation Toggle with Real EntityManager', () => {
    it('should update participation component when toggled', async () => {
      const actorId = await createTestActor('actor1', 'Hero', true);

      controller = new ActorParticipationController({
        eventBus,
        documentContext,
        logger: mockLogger,
        entityManager,
      });
      controller.initialize();

      await eventBus.dispatch(ENGINE_READY_UI, {});

      // Find checkbox and toggle
      const checkbox = document.querySelector('input[data-actor-id="actor1"]');
      expect(checkbox).toBeTruthy();
      expect(checkbox.checked).toBe(true);

      // Toggle off
      checkbox.checked = false;
      checkbox.dispatchEvent(new Event('change', { bubbles: true }));

      // Wait for async update
      await new Promise(resolve => setTimeout(resolve, 0));

      // Verify component updated using correct API
      const participation = entityManager.getComponentData(actorId, PARTICIPATION_COMPONENT_ID);
      expect(participation.participating).toBe(false);
    });

    it('should create participation component if missing when toggled', async () => {
      const actorId = await createTestActor('actor2', 'Villain', null); // No participation component

      controller = new ActorParticipationController({
        eventBus,
        documentContext,
        logger: mockLogger,
        entityManager,
      });
      controller.initialize();

      await eventBus.dispatch(ENGINE_READY_UI, {});

      // Checkbox should default to checked (participating: true)
      const checkbox = document.querySelector('input[data-actor-id="actor2"]');
      expect(checkbox.checked).toBe(true);

      // Toggle off
      checkbox.checked = false;
      checkbox.dispatchEvent(new Event('change', { bubbles: true }));

      // Wait for async update
      await new Promise(resolve => setTimeout(resolve, 0));

      // Verify component created using correct API
      expect(entityManager.hasComponent(actorId, PARTICIPATION_COMPONENT_ID)).toBe(true);
      const participation = entityManager.getComponentData(actorId, PARTICIPATION_COMPONENT_ID);
      expect(participation.participating).toBe(false);
    });
  });

  describe('Multiple Actors with Mixed States', () => {
    it('should handle multiple actors with different participation states', async () => {
      await createTestActor('actor1', 'Alice', true);
      await createTestActor('actor2', 'Bob', false);
      await createTestActor('actor3', 'Charlie', null); // No component

      controller = new ActorParticipationController({
        eventBus,
        documentContext,
        logger: mockLogger,
        entityManager,
      });
      controller.initialize();

      await eventBus.dispatch(ENGINE_READY_UI, {});

      // Verify rendering
      const checkboxes = document.querySelectorAll('input[type="checkbox"]');
      expect(checkboxes.length).toBe(3);

      // Verify states
      expect(document.querySelector('[data-actor-id="actor1"]').checked).toBe(true);
      expect(document.querySelector('[data-actor-id="actor2"]').checked).toBe(false);
      expect(document.querySelector('[data-actor-id="actor3"]').checked).toBe(true); // Default
    });
  });

  // Add more integration test suites...
});
```

## Acceptance Criteria
- [ ] All integration tests created and passing
- [ ] Tests use real entity manager (not mocked)
- [ ] Tests verify component creation and updates
- [ ] Tests verify persistence across operations
- [ ] Tests cover multiple actor scenarios
- [ ] Tests verify ENGINE_READY_UI event flow
- [ ] Tests follow project conventions
- [ ] Tests run successfully with `npm run test:integration`

## Validation Steps
1. Run `npm run test:integration -- actorParticipationIntegration.test.js`
2. Verify all tests pass
3. Check that tests use real dependencies (not mocks)
4. Run full integration suite: `npm run test:integration`
5. Verify no test isolation issues

## Notes
- Use `SimpleEntityManager` from `tests/common/entities/simpleEntityManager.js` for real entity manager
- Create `RecordingValidatedEventDispatcher` for real event bus with tracking
- Use `DocumentContext` from `src/domUI/documentContext.js` with JSDOM document
- Create real DOM elements with JSDOM in `beforeEach`, clean up in `afterEach`
- Controller requires `initialize()` call after construction
- Component API: `addComponent(entityId, componentTypeId, componentData)`
- Component retrieval: `getComponentData(entityId, componentTypeId)` returns data object directly
- DOM element ID is `#actor-participation-list-container` not `#actor-participation-list`
- Use `NAME_COMPONENT_ID` with `{ text: name }` for actor names
- Test with real entity manager to catch integration issues
- Test backward compatibility scenarios (actors without participation)
