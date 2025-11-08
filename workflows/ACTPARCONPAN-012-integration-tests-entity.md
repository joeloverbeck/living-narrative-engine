# ACTPARCONPAN-012: Integration Tests with EntityManager

## Ticket Information
- **ID**: ACTPARCONPAN-012
- **Phase**: 4 - Quality Assurance
- **Estimated Time**: 2-3 hours
- **Complexity**: Medium
- **Dependencies**: ACTPARCONPAN-011

## Scope
Create integration tests that verify `ActorParticipationController` works correctly with real `EntityManager` instances, testing actual component creation, updates, and persistence.

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
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import ActorParticipationController from '../../../src/domUI/actorParticipationController.js';
import { createTestBed } from '../../common/testBed.js';
import { ENGINE_READY_UI } from '../../../src/constants/eventIds.js';
import { ACTOR_COMPONENT_ID, PARTICIPATION_COMPONENT_ID } from '../../../src/constants/componentIds.js';

describe('ActorParticipationController - Integration Tests', () => {
  let testBed;
  let controller;
  let entityManager;
  let eventBus;

  beforeEach(() => {
    testBed = createTestBed();
    entityManager = testBed.entityManager;
    eventBus = testBed.eventBus;

    // Create DOM elements
    const widget = document.createElement('div');
    widget.id = 'actor-participation-widget';
    const list = document.createElement('div');
    list.id = 'actor-participation-list';
    const status = document.createElement('div');
    status.id = 'actor-participation-status';

    document.body.appendChild(widget);
    widget.appendChild(list);
    widget.appendChild(status);
  });

  afterEach(() => {
    if (controller) {
      controller.cleanup();
    }
    testBed.cleanup();
    document.body.innerHTML = '';
  });

  function createTestActor(id, name, participating = null) {
    const actorEntity = testBed.createEntity(id);
    entityManager.addComponent(actorEntity, {
      id: ACTOR_COMPONENT_ID,
      dataSchema: { name },
    });

    if (participating !== null) {
      entityManager.addComponent(actorEntity, {
        id: PARTICIPATION_COMPONENT_ID,
        dataSchema: { participating },
      });
    }

    return actorEntity;
  }

  describe('Participation Toggle with Real EntityManager', () => {
    it('should update participation component when toggled', () => {
      const actor = createTestActor('actor1', 'Hero', true);

      controller = new ActorParticipationController({
        eventBus,
        documentContext: testBed.documentContext,
        logger: testBed.logger,
        entityManager,
      });

      eventBus.dispatch({ type: ENGINE_READY_UI });

      // Find checkbox and toggle
      const checkbox = document.querySelector('input[data-actor-id="actor1"]');
      expect(checkbox).toBeTruthy();
      expect(checkbox.checked).toBe(true);

      // Toggle off
      checkbox.checked = false;
      checkbox.dispatchEvent(new Event('change', { bubbles: true }));

      // Verify component updated
      const participation = entityManager.getComponent(actor, PARTICIPATION_COMPONENT_ID);
      expect(participation.dataSchema.participating).toBe(false);
    });

    it('should create participation component if missing when toggled', () => {
      const actor = createTestActor('actor2', 'Villain', null); // No participation component

      controller = new ActorParticipationController({
        eventBus,
        documentContext: testBed.documentContext,
        logger: testBed.logger,
        entityManager,
      });

      eventBus.dispatch({ type: ENGINE_READY_UI });

      // Checkbox should default to checked (participating: true)
      const checkbox = document.querySelector('input[data-actor-id="actor2"]');
      expect(checkbox.checked).toBe(true);

      // Toggle off
      checkbox.checked = false;
      checkbox.dispatchEvent(new Event('change', { bubbles: true }));

      // Verify component created
      expect(entityManager.hasComponent(actor, PARTICIPATION_COMPONENT_ID)).toBe(true);
      const participation = entityManager.getComponent(actor, PARTICIPATION_COMPONENT_ID);
      expect(participation.dataSchema.participating).toBe(false);
    });
  });

  describe('Multiple Actors with Mixed States', () => {
    it('should handle multiple actors with different participation states', () => {
      createTestActor('actor1', 'Alice', true);
      createTestActor('actor2', 'Bob', false);
      createTestActor('actor3', 'Charlie', null); // No component

      controller = new ActorParticipationController({
        eventBus,
        documentContext: testBed.documentContext,
        logger: testBed.logger,
        entityManager,
      });

      eventBus.dispatch({ type: ENGINE_READY_UI });

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
- Use `createTestBed()` for consistent test environment setup
- Create real DOM elements in `beforeEach`, clean up in `afterEach`
- Test with real entity manager to catch integration issues
- Verify component schema structure matches expectations
- Test backward compatibility scenarios (actors without participation)
