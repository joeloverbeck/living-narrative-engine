import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { JSDOM } from 'jsdom';
import ActorParticipationController from '../../../src/domUI/actorParticipationController.js';
import DocumentContext from '../../../src/domUI/documentContext.js';
import SimpleEntityManager from '../../common/entities/simpleEntityManager.js';
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
    dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true });
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
      checkbox.dispatchEvent(new window.Event('change', { bubbles: true }));

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
      checkbox.dispatchEvent(new window.Event('change', { bubbles: true }));

      // Wait for async update
      await new Promise(resolve => setTimeout(resolve, 0));

      // Verify component created using correct API
      expect(entityManager.hasComponent(actorId, PARTICIPATION_COMPONENT_ID)).toBe(true);
      const participation = entityManager.getComponentData(actorId, PARTICIPATION_COMPONENT_ID);
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
      await new Promise(resolve => setTimeout(resolve, 0));

      let participation = entityManager.getComponentData(actorId, PARTICIPATION_COMPONENT_ID);
      expect(participation.participating).toBe(false);

      // Toggle back on
      checkbox.checked = true;
      checkbox.dispatchEvent(new window.Event('change', { bubbles: true }));
      await new Promise(resolve => setTimeout(resolve, 0));

      participation = entityManager.getComponentData(actorId, PARTICIPATION_COMPONENT_ID);
      expect(participation.participating).toBe(true);

      // Toggle off again
      checkbox.checked = false;
      checkbox.dispatchEvent(new window.Event('change', { bubbles: true }));
      await new Promise(resolve => setTimeout(resolve, 0));

      participation = entityManager.getComponentData(actorId, PARTICIPATION_COMPONENT_ID);
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
      await new Promise(resolve => setTimeout(resolve, 0));

      // Verify change persisted
      let participation = entityManager.getComponentData(actorId, PARTICIPATION_COMPONENT_ID);
      expect(participation.participating).toBe(false);

      // Trigger panel refresh by dispatching ENGINE_READY_UI again
      await eventBus.dispatch(ENGINE_READY_UI, {});
      await new Promise(resolve => setTimeout(resolve, 0));

      // Verify checkbox still reflects persisted state
      const refreshedCheckbox = document.querySelector('input[data-actor-id="actor4"]');
      expect(refreshedCheckbox.checked).toBe(false);

      // Verify component still has correct value
      participation = entityManager.getComponentData(actorId, PARTICIPATION_COMPONENT_ID);
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
      checkboxes.forEach(checkbox => {
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
      checkboxes.forEach(checkbox => {
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
      await new Promise(resolve => setTimeout(resolve, 0));

      // Verify only actor2 changed
      expect(entityManager.getComponentData('actor1', PARTICIPATION_COMPONENT_ID).participating).toBe(true);
      expect(entityManager.getComponentData('actor2', PARTICIPATION_COMPONENT_ID).participating).toBe(true);
      expect(entityManager.getComponentData('actor3', PARTICIPATION_COMPONENT_ID).participating).toBe(true);

      // Toggle actor1 and actor3
      const checkbox1 = document.querySelector('[data-actor-id="actor1"]');
      const checkbox3 = document.querySelector('[data-actor-id="actor3"]');

      checkbox1.checked = false;
      checkbox1.dispatchEvent(new window.Event('change', { bubbles: true }));
      await new Promise(resolve => setTimeout(resolve, 0));

      checkbox3.checked = false;
      checkbox3.dispatchEvent(new window.Event('change', { bubbles: true }));
      await new Promise(resolve => setTimeout(resolve, 0));

      // Verify selective updates
      expect(entityManager.getComponentData('actor1', PARTICIPATION_COMPONENT_ID).participating).toBe(false);
      expect(entityManager.getComponentData('actor2', PARTICIPATION_COMPONENT_ID).participating).toBe(true);
      expect(entityManager.getComponentData('actor3', PARTICIPATION_COMPONENT_ID).participating).toBe(false);
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
      await new Promise(resolve => setTimeout(resolve, 0));

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
      await new Promise(resolve => setTimeout(resolve, 0));

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
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(document.querySelector('[data-actor-id="actor1"]').checked).toBe(true);
      expect(document.querySelector('[data-actor-id="actor2"]').checked).toBe(false);
      expect(document.querySelector('[data-actor-id="actor3"]').checked).toBe(true);
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
      await new Promise(resolve => setTimeout(resolve, 0));

      let checkboxes = document.querySelectorAll('input[type="checkbox"]');
      expect(checkboxes.length).toBe(1);

      // Add another actor
      await createTestActor('actor2', 'Barbarian', false);

      // Second ENGINE_READY_UI
      await eventBus.dispatch(ENGINE_READY_UI, {});
      await new Promise(resolve => setTimeout(resolve, 0));

      // Should now show both actors
      checkboxes = document.querySelectorAll('input[type="checkbox"]');
      expect(checkboxes.length).toBe(2);

      // Verify states
      expect(document.querySelector('[data-actor-id="actor1"]').checked).toBe(true);
      expect(document.querySelector('[data-actor-id="actor2"]').checked).toBe(false);
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
      await new Promise(resolve => setTimeout(resolve, 0));

      // Verify persistence through direct entity manager access
      const participation = entityManager.getComponentData(actorId, PARTICIPATION_COMPONENT_ID);
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
      await new Promise(resolve => setTimeout(resolve, 0));

      // Retrieve via getComponentData
      const participation = entityManager.getComponentData(actorId, PARTICIPATION_COMPONENT_ID);
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
      await new Promise(resolve => setTimeout(resolve, 0));

      // Verify data structure
      const participation = entityManager.getComponentData(actorId, PARTICIPATION_COMPONENT_ID);
      expect(participation).toEqual({
        participating: false
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
      expect(entityManager.hasComponent(actorId, PARTICIPATION_COMPONENT_ID)).toBe(false);

      // Toggle should create component
      checkbox.checked = false;
      checkbox.dispatchEvent(new window.Event('change', { bubbles: true }));
      await new Promise(resolve => setTimeout(resolve, 0));

      // Now should have component
      expect(entityManager.hasComponent(actorId, PARTICIPATION_COMPONENT_ID)).toBe(true);
      const participation = entityManager.getComponentData(actorId, PARTICIPATION_COMPONENT_ID);
      expect(participation.participating).toBe(false);
    });
  });
});
