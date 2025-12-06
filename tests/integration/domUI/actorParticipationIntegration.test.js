import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { JSDOM } from 'jsdom';
import ActorParticipationController from '../../../src/domUI/actorParticipationController.js';
import DocumentContext from '../../../src/domUI/documentContext.js';
import SimpleEntityManager from '../../common/entities/simpleEntityManager.js';
import { ENGINE_READY_UI } from '../../../src/constants/eventIds.js';
import {
  ACTOR_COMPONENT_ID,
  NAME_COMPONENT_ID,
  PARTICIPATION_COMPONENT_ID,
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
  let window;
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
    dom = new JSDOM(html, {
      runScripts: 'dangerously',
      pretendToBeVisual: true,
    });
    document = dom.window.document;
    window = dom.window;

    // Setup global DOM references
    global.document = document;
    global.window = window;

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

  /**
   *
   * @param id
   * @param name
   * @param participating
   */
  async function createTestActor(id, name, participating = null) {
    // Add actor component with name
    await entityManager.addComponent(id, ACTOR_COMPONENT_ID, {});
    await entityManager.addComponent(id, NAME_COMPONENT_ID, { text: name });

    // Add participation component if specified
    if (participating !== null) {
      await entityManager.addComponent(id, PARTICIPATION_COMPONENT_ID, {
        participating,
      });
    }

    return id; // Return the entity ID
  }

  /**
   *
   */
  async function flushMicrotasks() {
    await Promise.resolve();
    await Promise.resolve();
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
      checkbox.dispatchEvent(new window.Event('change', { bubbles: true }));

      // Wait for async update
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Verify component updated using correct API
      const participation = entityManager.getComponentData(
        actorId,
        PARTICIPATION_COMPONENT_ID
      );
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
      checkbox.dispatchEvent(new window.Event('change', { bubbles: true }));

      // Wait for async update
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Verify component created using correct API
      expect(
        entityManager.hasComponent(actorId, PARTICIPATION_COMPONENT_ID)
      ).toBe(true);
      const participation = entityManager.getComponentData(
        actorId,
        PARTICIPATION_COMPONENT_ID
      );
      expect(participation.participating).toBe(false);
    });

    it('should maintain state across multiple sequential toggles', async () => {
      const actorId = await createTestActor('actor3', 'Rogue', true);

      controller = new ActorParticipationController({
        eventBus,
        documentContext,
        logger: mockLogger,
        entityManager,
      });
      controller.initialize();

      await eventBus.dispatch(ENGINE_READY_UI, {});

      const checkbox = document.querySelector('input[data-actor-id="actor3"]');
      expect(checkbox.checked).toBe(true);

      // Toggle off
      checkbox.checked = false;
      checkbox.dispatchEvent(new window.Event('change', { bubbles: true }));
      await flushMicrotasks();

      let participation = entityManager.getComponentData(
        actorId,
        PARTICIPATION_COMPONENT_ID
      );
      expect(participation.participating).toBe(false);

      // Toggle back on
      checkbox.checked = true;
      checkbox.dispatchEvent(new window.Event('change', { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 0));

      participation = entityManager.getComponentData(
        actorId,
        PARTICIPATION_COMPONENT_ID
      );
      expect(participation.participating).toBe(true);

      // Toggle off again
      checkbox.checked = false;
      checkbox.dispatchEvent(new window.Event('change', { bubbles: true }));
      await flushMicrotasks();

      participation = entityManager.getComponentData(
        actorId,
        PARTICIPATION_COMPONENT_ID
      );
      expect(participation.participating).toBe(false);
    });

    it('should persist changes across panel refreshes', async () => {
      const actorId = await createTestActor('actor4', 'Paladin', true);

      controller = new ActorParticipationController({
        eventBus,
        documentContext,
        logger: mockLogger,
        entityManager,
      });
      controller.initialize();

      await eventBus.dispatch(ENGINE_READY_UI, {});

      // Toggle participation off
      const checkbox = document.querySelector('input[data-actor-id="actor4"]');
      checkbox.checked = false;
      checkbox.dispatchEvent(new window.Event('change', { bubbles: true }));
      await flushMicrotasks();

      // Verify change persisted
      let participation = entityManager.getComponentData(
        actorId,
        PARTICIPATION_COMPONENT_ID
      );
      expect(participation.participating).toBe(false);

      // Trigger panel refresh by dispatching ENGINE_READY_UI again
      await eventBus.dispatch(ENGINE_READY_UI, {});
      await flushMicrotasks();

      // Verify checkbox still reflects persisted state
      const refreshedCheckbox = document.querySelector(
        'input[data-actor-id="actor4"]'
      );
      expect(refreshedCheckbox.checked).toBe(false);

      // Verify component still has correct value
      participation = entityManager.getComponentData(
        actorId,
        PARTICIPATION_COMPONENT_ID
      );
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
      expect(document.querySelector('[data-actor-id="actor1"]').checked).toBe(
        true
      );
      expect(document.querySelector('[data-actor-id="actor2"]').checked).toBe(
        false
      );
      expect(document.querySelector('[data-actor-id="actor3"]').checked).toBe(
        true
      ); // Default
    });

    it('should handle all actors participating', async () => {
      await createTestActor('actor1', 'Fighter', true);
      await createTestActor('actor2', 'Mage', true);
      await createTestActor('actor3', 'Cleric', true);

      controller = new ActorParticipationController({
        eventBus,
        documentContext,
        logger: mockLogger,
        entityManager,
      });
      controller.initialize();

      await eventBus.dispatch(ENGINE_READY_UI, {});

      const checkboxes = document.querySelectorAll('input[type="checkbox"]');
      expect(checkboxes.length).toBe(3);
      checkboxes.forEach((checkbox) => {
        expect(checkbox.checked).toBe(true);
      });
    });

    it('should handle all actors non-participating', async () => {
      await createTestActor('actor1', 'Guard1', false);
      await createTestActor('actor2', 'Guard2', false);
      await createTestActor('actor3', 'Guard3', false);

      controller = new ActorParticipationController({
        eventBus,
        documentContext,
        logger: mockLogger,
        entityManager,
      });
      controller.initialize();

      await eventBus.dispatch(ENGINE_READY_UI, {});

      const checkboxes = document.querySelectorAll('input[type="checkbox"]');
      expect(checkboxes.length).toBe(3);
      checkboxes.forEach((checkbox) => {
        expect(checkbox.checked).toBe(false);
      });
    });

    it('should handle selective participation updates', async () => {
      await createTestActor('actor1', 'Warrior', true);
      await createTestActor('actor2', 'Archer', false);
      await createTestActor('actor3', 'Thief', true);

      controller = new ActorParticipationController({
        eventBus,
        documentContext,
        logger: mockLogger,
        entityManager,
      });
      controller.initialize();

      await eventBus.dispatch(ENGINE_READY_UI, {});

      // Toggle only actor2
      const checkbox2 = document.querySelector('[data-actor-id="actor2"]');
      checkbox2.checked = true;
      checkbox2.dispatchEvent(new window.Event('change', { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Verify only actor2 changed
      expect(
        entityManager.getComponentData('actor1', PARTICIPATION_COMPONENT_ID)
          .participating
      ).toBe(true);
      expect(
        entityManager.getComponentData('actor2', PARTICIPATION_COMPONENT_ID)
          .participating
      ).toBe(true);
      expect(
        entityManager.getComponentData('actor3', PARTICIPATION_COMPONENT_ID)
          .participating
      ).toBe(true);

      // Toggle actor1 and actor3
      const checkbox1 = document.querySelector('[data-actor-id="actor1"]');
      const checkbox3 = document.querySelector('[data-actor-id="actor3"]');

      checkbox1.checked = false;
      checkbox1.dispatchEvent(new window.Event('change', { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 0));

      checkbox3.checked = false;
      checkbox3.dispatchEvent(new window.Event('change', { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Verify selective updates
      expect(
        entityManager.getComponentData('actor1', PARTICIPATION_COMPONENT_ID)
          .participating
      ).toBe(false);
      expect(
        entityManager.getComponentData('actor2', PARTICIPATION_COMPONENT_ID)
          .participating
      ).toBe(true);
      expect(
        entityManager.getComponentData('actor3', PARTICIPATION_COMPONENT_ID)
          .participating
      ).toBe(false);
    });
  });

  describe('ENGINE_READY_UI Event Flow', () => {
    it('should load actors after ENGINE_READY_UI event', async () => {
      // Create controller first, before creating actors
      controller = new ActorParticipationController({
        eventBus,
        documentContext,
        logger: mockLogger,
        entityManager,
      });
      controller.initialize();

      // Panel should be empty before creating actors and firing event
      let checkboxes = document.querySelectorAll('input[type="checkbox"]');
      expect(checkboxes.length).toBe(0);

      // Now create actors
      await createTestActor('actor1', 'Knight', true);
      await createTestActor('actor2', 'Wizard', false);

      // Dispatch ENGINE_READY_UI
      await eventBus.dispatch(ENGINE_READY_UI, {});
      await flushMicrotasks();

      // Panel should now contain actors
      checkboxes = document.querySelectorAll('input[type="checkbox"]');
      expect(checkboxes.length).toBe(2);
    });

    it('should render correct number of actors', async () => {
      await createTestActor('actor1', 'Hero1', true);
      await createTestActor('actor2', 'Hero2', false);
      await createTestActor('actor3', 'Hero3', null);
      await createTestActor('actor4', 'Hero4', true);
      await createTestActor('actor5', 'Hero5', false);

      controller = new ActorParticipationController({
        eventBus,
        documentContext,
        logger: mockLogger,
        entityManager,
      });
      controller.initialize();

      await eventBus.dispatch(ENGINE_READY_UI, {});
      await flushMicrotasks();

      const checkboxes = document.querySelectorAll('input[type="checkbox"]');
      expect(checkboxes.length).toBe(5);
    });

    it('should reflect correct participation states', async () => {
      await createTestActor('actor1', 'Ranger', true);
      await createTestActor('actor2', 'Druid', false);
      await createTestActor('actor3', 'Bard', null); // Should default to true

      controller = new ActorParticipationController({
        eventBus,
        documentContext,
        logger: mockLogger,
        entityManager,
      });
      controller.initialize();

      await eventBus.dispatch(ENGINE_READY_UI, {});
      await flushMicrotasks();

      expect(document.querySelector('[data-actor-id="actor1"]').checked).toBe(
        true
      );
      expect(document.querySelector('[data-actor-id="actor2"]').checked).toBe(
        false
      );
      expect(document.querySelector('[data-actor-id="actor3"]').checked).toBe(
        true
      );
    });

    it('should handle multiple ENGINE_READY_UI events correctly', async () => {
      await createTestActor('actor1', 'Monk', true);

      controller = new ActorParticipationController({
        eventBus,
        documentContext,
        logger: mockLogger,
        entityManager,
      });
      controller.initialize();

      // First ENGINE_READY_UI
      await eventBus.dispatch(ENGINE_READY_UI, {});
      await flushMicrotasks();

      let checkboxes = document.querySelectorAll('input[type="checkbox"]');
      expect(checkboxes.length).toBe(1);

      // Add another actor
      await createTestActor('actor2', 'Barbarian', false);

      // Second ENGINE_READY_UI
      await eventBus.dispatch(ENGINE_READY_UI, {});
      await flushMicrotasks();

      // Should now show both actors
      checkboxes = document.querySelectorAll('input[type="checkbox"]');
      expect(checkboxes.length).toBe(2);

      // Verify states
      expect(document.querySelector('[data-actor-id="actor1"]').checked).toBe(
        true
      );
      expect(document.querySelector('[data-actor-id="actor2"]').checked).toBe(
        false
      );
    });
  });

  describe('Component Persistence', () => {
    it('should persist participation changes in entity manager', async () => {
      const actorId = await createTestActor('actor1', 'Sorcerer', true);

      controller = new ActorParticipationController({
        eventBus,
        documentContext,
        logger: mockLogger,
        entityManager,
      });
      controller.initialize();

      await eventBus.dispatch(ENGINE_READY_UI, {});

      // Toggle participation
      const checkbox = document.querySelector('input[data-actor-id="actor1"]');
      checkbox.checked = false;
      checkbox.dispatchEvent(new window.Event('change', { bubbles: true }));
      await flushMicrotasks();

      // Verify persistence through direct entity manager access
      const participation = entityManager.getComponentData(
        actorId,
        PARTICIPATION_COMPONENT_ID
      );
      expect(participation).toBeDefined();
      expect(participation.participating).toBe(false);
    });

    it('should make changes retrievable via getComponentData', async () => {
      const actorId = await createTestActor('actor2', 'Necromancer', false);

      controller = new ActorParticipationController({
        eventBus,
        documentContext,
        logger: mockLogger,
        entityManager,
      });
      controller.initialize();

      await eventBus.dispatch(ENGINE_READY_UI, {});

      // Toggle participation
      const checkbox = document.querySelector('input[data-actor-id="actor2"]');
      checkbox.checked = true;
      checkbox.dispatchEvent(new window.Event('change', { bubbles: true }));
      await flushMicrotasks();

      // Retrieve via getComponentData
      const participation = entityManager.getComponentData(
        actorId,
        PARTICIPATION_COMPONENT_ID
      );
      expect(participation).toBeDefined();
      expect(participation.participating).toBe(true);
    });

    it('should store component data matching schema structure', async () => {
      const actorId = await createTestActor('actor3', 'Illusionist', null);

      controller = new ActorParticipationController({
        eventBus,
        documentContext,
        logger: mockLogger,
        entityManager,
      });
      controller.initialize();

      await eventBus.dispatch(ENGINE_READY_UI, {});

      // Toggle to create component
      const checkbox = document.querySelector('input[data-actor-id="actor3"]');
      checkbox.checked = false;
      checkbox.dispatchEvent(new window.Event('change', { bubbles: true }));
      await flushMicrotasks();

      // Verify data structure
      const participation = entityManager.getComponentData(
        actorId,
        PARTICIPATION_COMPONENT_ID
      );
      expect(participation).toEqual({
        participating: false,
      });
      expect(typeof participation.participating).toBe('boolean');
    });

    it('should handle backward compatibility for actors without participation component', async () => {
      const actorId = await createTestActor('actor4', 'Alchemist', null);

      controller = new ActorParticipationController({
        eventBus,
        documentContext,
        logger: mockLogger,
        entityManager,
      });
      controller.initialize();

      await eventBus.dispatch(ENGINE_READY_UI, {});

      // Actor without component should default to participating (checked)
      const checkbox = document.querySelector('input[data-actor-id="actor4"]');
      expect(checkbox.checked).toBe(true);

      // Should not have component yet
      expect(
        entityManager.hasComponent(actorId, PARTICIPATION_COMPONENT_ID)
      ).toBe(false);

      // Toggle should create component
      checkbox.checked = false;
      checkbox.dispatchEvent(new window.Event('change', { bubbles: true }));
      await flushMicrotasks();

      // Now should have component
      expect(
        entityManager.hasComponent(actorId, PARTICIPATION_COMPONENT_ID)
      ).toBe(true);
      const participation = entityManager.getComponentData(
        actorId,
        PARTICIPATION_COMPONENT_ID
      );
      expect(participation.participating).toBe(false);
    });
  });

  describe('Resilience and Edge Cases', () => {
    it('logs warnings when DOM structure is missing and defensive load fails gracefully', () => {
      const sparseDom = new JSDOM(
        '<!DOCTYPE html><html><body><div id="unrelated"></div></body></html>'
      );
      document = sparseDom.window.document;
      window = sparseDom.window;
      global.document = document;
      global.window = window;
      documentContext = new DocumentContext(document);

      const failingEventBus = {
        subscribe: jest.fn(() => undefined),
        unsubscribe: jest.fn(),
        dispatch: jest.fn(),
      };

      entityManager = new SimpleEntityManager();
      const loadError = new Error('Load failure');
      const originalGetEntities =
        entityManager.getEntitiesWithComponent.bind(entityManager);
      entityManager.getEntitiesWithComponent = jest.fn(() => {
        throw loadError;
      });

      controller = new ActorParticipationController({
        eventBus: failingEventBus,
        documentContext,
        logger: mockLogger,
        entityManager,
      });

      expect(() => controller.initialize()).not.toThrow();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        '[ActorParticipation] Widget element not found (#actor-participation-widget)'
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        '[ActorParticipation] List element not found (#actor-participation-list-container)'
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        '[ActorParticipation] Status element not found (#actor-participation-status)'
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        '[ActorParticipation] Defensive actor loading failed (expected if actors not yet loaded)',
        loadError
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        '[ActorParticipation] CRITICAL: Failed to subscribe to ENGINE_READY_UI'
      );

      entityManager.getEntitiesWithComponent = originalGetEntities;

      sparseDom.window.close();
      delete global.document;
      delete global.window;
    });

    it('propagates initialization errors when DOM querying fails', () => {
      const faultyDocumentContext = {
        query: jest.fn(() => {
          throw new Error('query failure');
        }),
        create: jest.fn(),
      };

      const safeEventBus = {
        subscribe: jest.fn(() => () => {}),
        unsubscribe: jest.fn(),
        dispatch: jest.fn(),
      };

      entityManager = new SimpleEntityManager();

      controller = new ActorParticipationController({
        eventBus: safeEventBus,
        documentContext: faultyDocumentContext,
        logger: mockLogger,
        entityManager,
      });

      expect(() => controller.initialize()).toThrow('query failure');
      expect(mockLogger.error).toHaveBeenCalledWith(
        '[ActorParticipation] Failed to initialize',
        expect.any(Error)
      );
    });

    it('ignores non-checkbox change events and logs missing data attributes', async () => {
      await createTestActor('edge-actor', 'Edge Case', true);

      controller = new ActorParticipationController({
        eventBus,
        documentContext,
        logger: mockLogger,
        entityManager,
      });
      controller.initialize();

      await eventBus.dispatch(ENGINE_READY_UI, {});
      await flushMicrotasks();

      const checkbox = document.querySelector(
        'input[data-actor-id="edge-actor"]'
      );
      const label = document.querySelector(
        'label[for="actor-participation-edge-actor"]'
      );

      label.dispatchEvent(new window.Event('change', { bubbles: true }));

      checkbox.removeAttribute('data-actor-id');
      checkbox.dispatchEvent(new window.Event('change', { bubbles: true }));

      expect(mockLogger.warn).toHaveBeenCalledWith(
        '[ActorParticipation] Checkbox missing data-actor-id attribute'
      );

      checkbox.dataset.actorId = 'edge-actor';
      checkbox.checked = false;
      checkbox.dispatchEvent(new window.Event('change', { bubbles: true }));
      await flushMicrotasks();

      expect(
        entityManager.getComponentData('edge-actor', PARTICIPATION_COMPONENT_ID)
          .participating
      ).toBe(false);
    });

    it('reverts checkbox and reports error when participation updates fail', async () => {
      await createTestActor('failure-actor', 'Broken Toggle', true);

      const originalAddComponent =
        entityManager.addComponent.bind(entityManager);
      entityManager.addComponent = jest.fn(async (id, type, data) => {
        if (
          type === PARTICIPATION_COMPONENT_ID &&
          data.participating === false
        ) {
          return false;
        }
        return SimpleEntityManager.prototype.addComponent.call(
          entityManager,
          id,
          type,
          data
        );
      });

      controller = new ActorParticipationController({
        eventBus,
        documentContext,
        logger: mockLogger,
        entityManager,
      });
      controller.initialize();

      await eventBus.dispatch(ENGINE_READY_UI, {});
      await flushMicrotasks();

      const checkbox = document.querySelector(
        'input[data-actor-id="failure-actor"]'
      );

      checkbox.checked = false;
      checkbox.dispatchEvent(new window.Event('change', { bubbles: true }));
      await flushMicrotasks();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        '[ActorParticipation] Failed to update participation component for actor failure-actor'
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        '[ActorParticipation] Error updating participation for actor failure-actor',
        expect.any(Error)
      );
      expect(checkbox.checked).toBe(true);
      const statusEl = document.querySelector('#actor-participation-status');
      expect(statusEl.textContent).toBe('Error updating participation');
      expect(statusEl.className).toBe('status-message status-error');
      expect(
        entityManager.getComponentData(
          'failure-actor',
          PARTICIPATION_COMPONENT_ID
        ).participating
      ).toBe(true);

      entityManager.addComponent = originalAddComponent;
    });

    it('handles entity manager exceptions when updating participation', async () => {
      await createTestActor('exception-actor', 'Exception', true);

      const originalAddComponent =
        entityManager.addComponent.bind(entityManager);
      entityManager.addComponent = jest.fn(async () => {
        throw new Error('mutation failure');
      });

      controller = new ActorParticipationController({
        eventBus,
        documentContext,
        logger: mockLogger,
        entityManager,
      });
      controller.initialize();

      await eventBus.dispatch(ENGINE_READY_UI, {});
      await flushMicrotasks();

      const checkbox = document.querySelector(
        'input[data-actor-id="exception-actor"]'
      );
      checkbox.checked = false;
      checkbox.dispatchEvent(new window.Event('change', { bubbles: true }));
      await flushMicrotasks();

      expect(mockLogger.error).toHaveBeenCalledWith(
        '[ActorParticipation] Error updating participation component for actor exception-actor',
        expect.any(Error)
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        '[ActorParticipation] Error updating participation for actor exception-actor',
        expect.any(Error)
      );
      expect(checkbox.checked).toBe(true);

      entityManager.addComponent = originalAddComponent;
    });

    it('displays and clears status messages over time', async () => {
      jest.useFakeTimers();
      try {
        await createTestActor('status-actor', 'Status Hero', true);

        controller = new ActorParticipationController({
          eventBus,
          documentContext,
          logger: mockLogger,
          entityManager,
        });
        controller.initialize();

        await eventBus.dispatch(ENGINE_READY_UI, {});
        await flushMicrotasks();

        const checkbox = document.querySelector(
          'input[data-actor-id="status-actor"]'
        );
        checkbox.checked = false;
        checkbox.dispatchEvent(new window.Event('change', { bubbles: true }));
        await flushMicrotasks();

        const statusEl = document.querySelector('#actor-participation-status');
        expect(statusEl.textContent).toBe(
          'Disabled participation for status-actor'
        );
        expect(statusEl.className).toBe('status-message status-success');

        jest.advanceTimersByTime(3000);
        await flushMicrotasks();

        expect(statusEl.textContent).toBe('');
        expect(statusEl.className).toBe('status-message');
      } finally {
        jest.useRealTimers();
      }
    });

    it('warns when status element is missing during status updates', async () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <body>
            <div id="actor-participation-widget">
              <div id="actor-participation-list-container"></div>
            </div>
          </body>
        </html>
      `;
      dom = new JSDOM(html, {
        runScripts: 'dangerously',
        pretendToBeVisual: true,
      });
      document = dom.window.document;
      window = dom.window;
      global.document = document;
      global.window = window;
      documentContext = new DocumentContext(document);

      entityManager = new SimpleEntityManager();
      await entityManager.addComponent(
        'actor-no-status',
        ACTOR_COMPONENT_ID,
        {}
      );
      await entityManager.addComponent('actor-no-status', NAME_COMPONENT_ID, {
        text: 'No Status',
      });
      await entityManager.addComponent(
        'actor-no-status',
        PARTICIPATION_COMPONENT_ID,
        {
          participating: true,
        }
      );

      controller = new ActorParticipationController({
        eventBus,
        documentContext,
        logger: mockLogger,
        entityManager,
      });
      controller.initialize();

      await eventBus.dispatch(ENGINE_READY_UI, {});
      await flushMicrotasks();

      const checkbox = document.querySelector(
        'input[data-actor-id="actor-no-status"]'
      );
      checkbox.checked = false;
      checkbox.dispatchEvent(new window.Event('change', { bubbles: true }));
      await flushMicrotasks();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        '[ActorParticipation] Cannot show status: status element not found'
      );

      dom.window.close();
      delete global.document;
      delete global.window;
    });

    it('refreshes the panel with newly added actors', async () => {
      await createTestActor('initial-actor', 'Initial', true);

      controller = new ActorParticipationController({
        eventBus,
        documentContext,
        logger: mockLogger,
        entityManager,
      });
      controller.initialize();

      await eventBus.dispatch(ENGINE_READY_UI, {});
      await flushMicrotasks();

      expect(document.querySelectorAll('input[type="checkbox"]').length).toBe(
        1
      );

      await entityManager.addComponent('new-actor', ACTOR_COMPONENT_ID, {});
      await entityManager.addComponent('new-actor', NAME_COMPONENT_ID, {
        text: 'New Actor',
      });

      controller.refresh();

      const checkboxes = document.querySelectorAll('input[type="checkbox"]');
      expect(checkboxes.length).toBe(2);
      expect(mockLogger.info).toHaveBeenCalledWith(
        '[ActorParticipation] Refreshing actor participation panel'
      );
    });

    it('logs errors if actor loading fails during ENGINE_READY_UI handling', async () => {
      const loadError = new Error('handleGameReady failure');

      controller = new ActorParticipationController({
        eventBus,
        documentContext,
        logger: mockLogger,
        entityManager,
      });

      const originalGetEntities =
        entityManager.getEntitiesWithComponent.bind(entityManager);
      entityManager.getEntitiesWithComponent = jest.fn(() => {
        throw loadError;
      });

      controller.initialize();

      await eventBus.dispatch(ENGINE_READY_UI, {});
      await flushMicrotasks();

      expect(mockLogger.error).toHaveBeenCalledWith(
        '[ActorParticipation] Failed to load actors',
        loadError
      );

      entityManager.getEntitiesWithComponent = originalGetEntities;
    });

    it('handles cleanup errors gracefully', async () => {
      await createTestActor('cleanup-actor', 'Cleanup', true);

      controller = new ActorParticipationController({
        eventBus,
        documentContext,
        logger: mockLogger,
        entityManager,
      });
      controller.initialize();

      await eventBus.dispatch(ENGINE_READY_UI, {});
      await flushMicrotasks();

      const originalUnsubscribe = eventBus.unsubscribe;
      eventBus.unsubscribe = jest.fn(() => {
        throw new Error('unsubscribe failure');
      });

      controller.cleanup();

      expect(mockLogger.error).toHaveBeenCalledWith(
        '[ActorParticipation] Error during cleanup',
        expect.any(Error)
      );

      eventBus.unsubscribe = originalUnsubscribe;
    });
  });
});
