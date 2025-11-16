/**
 * @file Integration tests for GOAP knowledge system
 * Tests knowledge limitation, visibility detection, and turn system integration
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { createTestBed } from '../../common/testBed.js';
import SimpleEntityManager from '../../common/entities/simpleEntityManager.js';
import KnowledgeManager from '../../../src/goap/services/knowledgeManager.js';
import ContextAssemblyService from '../../../src/goap/services/contextAssemblyService.js';
import { ACTOR_KNOWLEDGE_UPDATED_ID } from '../../../src/constants/systemEventIds.js';

describe('Knowledge System Integration', () => {
  let entityManager;
  let knowledgeManager;
  let contextAssemblyService;
  let componentMutationService;
  let eventBus;
  let logger;
  let knowledgeUpdateEvents;

  beforeEach(() => {
    const testBed = createTestBed();
    entityManager = new SimpleEntityManager();
    logger = testBed.createMockLogger();

    // Create mock event bus with subscribe/dispatch
    eventBus = testBed.createMock('IEventBus', ['dispatch', 'subscribe']);

    // Configure event subscription to work properly
    const subscriptions = new Map();
    eventBus.subscribe.mockImplementation((eventType, callback) => {
      if (!subscriptions.has(eventType)) {
        subscriptions.set(eventType, []);
      }
      subscriptions.get(eventType).push(callback);
      return () => {
        const callbacks = subscriptions.get(eventType);
        const index = callbacks.indexOf(callback);
        if (index > -1) {
          callbacks.splice(index, 1);
        }
      };
    });

    // Configure dispatch to call all subscribers
    // EventBus signature: dispatch(eventName, eventPayload)
    eventBus.dispatch.mockImplementation((eventName, eventPayload = {}) => {
      const event = { type: eventName, payload: eventPayload };
      const callbacks = subscriptions.get(eventName) || [];
      callbacks.forEach((callback) => callback(event));
    });

    // Create mock ComponentMutationService that wraps entityManager
    componentMutationService = {
      addComponent: async (entityId, componentType, componentData) => {
        entityManager.addComponent(entityId, componentType, componentData);
      },
    };

    // Create KnowledgeManager
    knowledgeManager = new KnowledgeManager({
      componentMutationService,
      entityManager,
      logger,
      eventBus,
    });

    // Create ContextAssemblyService with knowledge limitation enabled
    contextAssemblyService = new ContextAssemblyService({
      entityManager,
      logger,
      enableKnowledgeLimitation: true,
    });

    // Record knowledge update events
    knowledgeUpdateEvents = [];
    eventBus.subscribe(ACTOR_KNOWLEDGE_UPDATED_ID, (event) => {
      knowledgeUpdateEvents.push(event);
    });
  });

  // ========================================================================
  // Helper Functions
  // ========================================================================

  /**
   * Create a visible entity at a specific location
   *
   * @param {string} entityId - Entity ID
   * @param {string} locationId - Location ID
   * @param {boolean} [isVisible] - Whether entity is visible
   * @returns {string} The created entity ID
   */
  function createVisibleEntity(entityId, locationId, isVisible = true) {
    entityManager.createEntity(entityId);
    entityManager.addComponent(entityId, 'core:position', { locationId });
    if (isVisible !== undefined) {
      entityManager.addComponent(entityId, 'core:visible', { isVisible });
    }
    return entityId;
  }

  /**
   * Create an actor with knowledge component
   *
   * @param {string} actorId - Actor entity ID
   * @param {string} locationId - Location ID
   * @param {string[]} [initialKnowledge] - Initial known entity IDs
   * @returns {string} The created actor ID
   */
  function createActor(actorId, locationId, initialKnowledge = []) {
    entityManager.createEntity(actorId);
    entityManager.addComponent(actorId, 'core:position', { locationId });
    entityManager.addComponent(actorId, 'core:known_to', {
      entities: [actorId, ...initialKnowledge],
    });
    return actorId;
  }

  /**
   * Verify that an actor knows specific entities
   *
   * @param {string} actorId - Actor entity ID
   * @param {string[]} expectedEntityIds - Expected known entity IDs
   */
  function expectActorKnows(actorId, expectedEntityIds) {
    const entity = entityManager.getEntity(actorId);
    const knowledge = entity.components['core:known_to']?.entities || [];

    expect(knowledge).toEqual(expect.arrayContaining(expectedEntityIds));
    expect(knowledge.length).toBe(expectedEntityIds.length);
  }

  /**
   * Verify that an actor does NOT know a specific entity
   *
   * @param {string} actorId - Actor entity ID
   * @param {string} entityId - Entity ID that should not be known
   */
  function expectActorDoesNotKnow(actorId, entityId) {
    const entity = entityManager.getEntity(actorId);
    const knowledge = entity.components['core:known_to']?.entities || [];

    expect(knowledge).not.toContain(entityId);
  }

  /**
   * Scenario: Simple visibility - one actor, one visible item
   *
   * @returns {{actorId: string, itemId: string}} Actor and item IDs
   */
  function setupSimpleVisibility() {
    const actorId = createActor('actor1', 'room1');
    const itemId = createVisibleEntity('item1', 'room1', true);

    return { actorId, itemId };
  }

  /**
   * Scenario: Multi-location - items in different rooms
   *
   * @returns {{actorId: string, visibleItemId: string, invisibleItemId: string}} Entity IDs
   */
  function setupMultiLocation() {
    const actorId = createActor('actor1', 'room1');
    const visibleItemId = createVisibleEntity('item_room1', 'room1', true);
    const invisibleItemId = createVisibleEntity('item_room2', 'room2', true);

    return { actorId, visibleItemId, invisibleItemId };
  }

  /**
   * Scenario: Visibility override - items with explicit visible flags
   *
   * @returns {{actorId: string, visibleItemId: string, hiddenItemId: string}} Entity IDs
   */
  function setupVisibilityOverride() {
    const actorId = createActor('actor1', 'room1');
    const visibleItemId = createVisibleEntity('visible_item', 'room1', true);
    const hiddenItemId = createVisibleEntity('hidden_item', 'room1', false);

    return { actorId, visibleItemId, hiddenItemId };
  }

  // ========================================================================
  // Test Suite 1: Turn System Integration
  // ========================================================================

  describe('Turn System Integration', () => {
    it('should update knowledge before action decision', async () => {
      const { actorId, itemId } = setupSimpleVisibility();

      // Simulate knowledge update during turn
      await knowledgeManager.updateKnowledge(actorId, {});

      // Verify actor now knows about the item
      expectActorKnows(actorId, [actorId, itemId]);

      // Verify event was dispatched
      expect(knowledgeUpdateEvents.length).toBe(1);
      expect(knowledgeUpdateEvents[0].payload.actorId).toBe(actorId);
      expect(knowledgeUpdateEvents[0].payload.newEntitiesCount).toBe(1);
    });

    it('should handle knowledge update failures gracefully', async () => {
      const actorId = 'nonexistent_actor';

      // Attempt to update knowledge for non-existent actor
      await knowledgeManager.updateKnowledge(actorId, {});

      // Verify no knowledge update events were dispatched
      expect(knowledgeUpdateEvents.length).toBe(0);

      // Verify warning was logged (KnowledgeManager uses warn for missing actors)
      expect(logger.warn).toHaveBeenCalledWith(
        `Actor not found: ${actorId}`
      );
    });

    it('should not block turn flow when knowledge update is fast', async () => {
      const { actorId } = setupSimpleVisibility();

      const startTime = performance.now();
      await knowledgeManager.updateKnowledge(actorId, {});
      const duration = performance.now() - startTime;

      // Knowledge update should be fast (< 10ms)
      expect(duration).toBeLessThan(10);
    });
  });

  // ========================================================================
  // Test Suite 2: Visibility Detection
  // ========================================================================

  describe('Visibility Detection', () => {
    it('should detect entities in the same location', async () => {
      const { actorId, itemId } = setupSimpleVisibility();

      await knowledgeManager.updateKnowledge(actorId, {});

      expectActorKnows(actorId, [actorId, itemId]);
    });

    it('should filter out entities in different locations', async () => {
      const { actorId, visibleItemId, invisibleItemId } =
        setupMultiLocation();

      await knowledgeManager.updateKnowledge(actorId, {});

      expectActorKnows(actorId, [actorId, visibleItemId]);
      expectActorDoesNotKnow(actorId, invisibleItemId);
    });

    it('should respect core:visible isVisible=false flag', async () => {
      const { actorId, visibleItemId, hiddenItemId } =
        setupVisibilityOverride();

      await knowledgeManager.updateKnowledge(actorId, {});

      expectActorKnows(actorId, [actorId, visibleItemId]);
      expectActorDoesNotKnow(actorId, hiddenItemId);
    });

    it('should default to visible when core:visible component is missing', async () => {
      const actorId = createActor('actor1', 'room1');
      const itemId = 'item_no_visible_component';

      entityManager.createEntity(itemId);
      entityManager.addComponent(itemId, 'core:position', {
        locationId: 'room1',
      });
      // No core:visible component

      await knowledgeManager.updateKnowledge(actorId, {});

      // Item should be visible by default
      expectActorKnows(actorId, [actorId, itemId]);
    });

    it('should exclude self from visibility detection', async () => {
      const actorId = createActor('actor1', 'room1');

      await knowledgeManager.updateKnowledge(actorId, {});

      const entity = entityManager.getEntity(actorId);
      const knowledge = entity.components['core:known_to']?.entities || [];

      // Actor should know itself (initial knowledge)
      // but not add itself again through visibility
      const selfCount = knowledge.filter((id) => id === actorId).length;
      expect(selfCount).toBe(1);
    });
  });

  // ========================================================================
  // Test Suite 3: Knowledge-Limited Context Assembly
  // ========================================================================

  describe('Knowledge-Limited Context Assembly', () => {
    it('should filter entities by actor knowledge in planning context', async () => {
      const actorId = createActor('actor1', 'room1', ['item1']);
      createVisibleEntity('item1', 'room1', true);
      createVisibleEntity('item2', 'room1', true);

      const context = contextAssemblyService.assemblePlanningContext(actorId);

      // Context should include actor knowledge
      expect(context.actor.knowledge).toEqual(
        expect.arrayContaining([actorId, 'item1'])
      );
      expect(context.actor.knowledge).not.toContain('item2');
    });

    it('should use omniscient mode when knowledge limitation disabled', async () => {
      // Create context assembly service with knowledge limitation disabled
      const omniscientService = new ContextAssemblyService({
        entityManager,
        logger,
        enableKnowledgeLimitation: false,
      });

      const actorId = createActor('actor1', 'room1', ['item1']);
      createVisibleEntity('item1', 'room1', true);
      createVisibleEntity('item2', 'room1', true);

      const context = omniscientService.assemblePlanningContext(actorId);

      // Verify context is assembled without knowledge limitation
      expect(context).toBeDefined();
      expect(context.actor).toBeDefined();
      expect(context.actor.knowledge).toBeUndefined();
    });

    it('should handle missing knowledge component gracefully', async () => {
      const actorId = 'actor_no_knowledge';
      entityManager.createEntity(actorId);
      entityManager.addComponent(actorId, 'core:position', {
        locationId: 'room1',
      });
      // No core:known_to component

      const context = contextAssemblyService.assemblePlanningContext(actorId);

      // Should default to just the actor
      expect(context.actor.knowledge).toEqual([actorId]);
    });

    it('should limit planning scope to known entities', async () => {
      const actorId = createActor('actor1', 'room1', ['item1']);
      createVisibleEntity('item1', 'room1', true);
      createVisibleEntity('item2', 'room1', true);

      const context = contextAssemblyService.assemblePlanningContext(actorId);

      // Verify knowledge array is present and limited
      expect(context.actor.knowledge).toBeDefined();
      expect(Array.isArray(context.actor.knowledge)).toBe(true);
      expect(context.actor.knowledge.length).toBeLessThanOrEqual(2);
    });
  });

  // ========================================================================
  // Test Suite 4: Multi-Actor Knowledge Scenarios
  // ========================================================================

  describe('Multi-Actor Knowledge Scenarios', () => {
    it('should maintain separate knowledge for each actor', async () => {
      const actor1Id = createActor('actor1', 'room1');
      const actor2Id = createActor('actor2', 'room2');
      createVisibleEntity('item1', 'room1', true);
      createVisibleEntity('item2', 'room2', true);

      await knowledgeManager.updateKnowledge(actor1Id, {});
      await knowledgeManager.updateKnowledge(actor2Id, {});

      expectActorKnows(actor1Id, [actor1Id, 'item1']);
      expectActorDoesNotKnow(actor1Id, 'item2');

      expectActorKnows(actor2Id, [actor2Id, 'item2']);
      expectActorDoesNotKnow(actor2Id, 'item1');
    });

    it('should allow actors to see each other in same location', async () => {
      const actor1Id = createActor('actor1', 'room1');
      const actor2Id = createActor('actor2', 'room1');

      await knowledgeManager.updateKnowledge(actor1Id, {});
      await knowledgeManager.updateKnowledge(actor2Id, {});

      expectActorKnows(actor1Id, [actor1Id, actor2Id]);
      expectActorKnows(actor2Id, [actor2Id, actor1Id]);
    });

    it('should maintain knowledge when actors move apart', async () => {
      const actor1Id = createActor('actor1', 'room1');
      const actor2Id = createActor('actor2', 'room1');

      // Initial knowledge update (actors see each other)
      await knowledgeManager.updateKnowledge(actor1Id, {});

      expectActorKnows(actor1Id, [actor1Id, actor2Id]);

      // Actor 2 moves to different room
      entityManager.addComponent(actor2Id, 'core:position', {
        locationId: 'room2',
      });

      // Knowledge update after move (knowledge is additive)
      await knowledgeManager.updateKnowledge(actor1Id, {});

      // Actor 1 should still know about Actor 2
      expectActorKnows(actor1Id, [actor1Id, actor2Id]);
    });
  });

  // ========================================================================
  // Test Suite 5: Knowledge Persistence
  // ========================================================================

  describe('Knowledge Persistence', () => {
    it('should persist knowledge across turn boundaries', async () => {
      const { actorId, itemId } = setupSimpleVisibility();

      // Turn 1: Update knowledge
      await knowledgeManager.updateKnowledge(actorId, {});
      expectActorKnows(actorId, [actorId, itemId]);

      // Turn 2: Knowledge should persist
      const entity = entityManager.getEntity(actorId);
      const knowledge = entity.components['core:known_to']?.entities || [];
      expect(knowledge).toContain(itemId);
    });

    it('should accumulate knowledge over multiple turns', async () => {
      const actorId = createActor('actor1', 'room1');

      // Turn 1: See item1
      createVisibleEntity('item1', 'room1', true);
      await knowledgeManager.updateKnowledge(actorId, {});
      expectActorKnows(actorId, [actorId, 'item1']);

      // Turn 2: See item2 (item1 still there)
      createVisibleEntity('item2', 'room1', true);
      await knowledgeManager.updateKnowledge(actorId, {});
      expectActorKnows(actorId, [actorId, 'item1', 'item2']);

      // Turn 3: See item3 (previous knowledge retained)
      createVisibleEntity('item3', 'room1', true);
      await knowledgeManager.updateKnowledge(actorId, {});
      expectActorKnows(actorId, [actorId, 'item1', 'item2', 'item3']);
    });

    it('should maintain knowledge despite visibility changes', async () => {
      const actorId = createActor('actor1', 'room1');
      const itemId = createVisibleEntity('item1', 'room1', true);

      // Turn 1: Item is visible
      await knowledgeManager.updateKnowledge(actorId, {});
      expectActorKnows(actorId, [actorId, itemId]);

      // Turn 2: Item becomes hidden
      entityManager.addComponent(itemId, 'core:visible', { isVisible: false });
      await knowledgeManager.updateKnowledge(actorId, {});

      // Knowledge should persist (additive only)
      expectActorKnows(actorId, [actorId, itemId]);
    });
  });

  // ========================================================================
  // Test Suite 6: Complete Planning Workflow
  // ========================================================================

  describe('Complete Planning Workflow', () => {
    it('should use knowledge-limited world state for planning', async () => {
      const actorId = createActor('actor1', 'room1', ['item1']);
      createVisibleEntity('item1', 'room1', true);
      createVisibleEntity('item2', 'room1', true);

      const context = contextAssemblyService.assemblePlanningContext(actorId);

      // Planning context should respect knowledge limitation
      expect(context.actor.knowledge).toContain('item1');
      expect(context.actor.knowledge).not.toContain('item2');
    });

    it('should invalidate plan when knowledge becomes outdated', async () => {
      const actorId = createActor('actor1', 'room1', ['item1']);
      createVisibleEntity('item1', 'room1', true);

      // Initial planning context establishes baseline
      contextAssemblyService.assemblePlanningContext(actorId);

      expectActorKnows(actorId, [actorId, 'item1']);

      // Add new visible entity
      createVisibleEntity('item2', 'room1', true);
      await knowledgeManager.updateKnowledge(actorId, {});

      // New planning context should include updated knowledge
      const context2 = contextAssemblyService.assemblePlanningContext(actorId);

      expect(context2.actor.knowledge).toContain('item2');
    });

    it('should update knowledge before replanning', async () => {
      const actorId = createActor('actor1', 'room1');
      createVisibleEntity('item1', 'room1', true);

      // Simulate replanning scenario
      await knowledgeManager.updateKnowledge(actorId, {});

      expectActorKnows(actorId, [actorId, 'item1']);

      // Add new entity and trigger replan
      createVisibleEntity('item2', 'room1', true);
      await knowledgeManager.updateKnowledge(actorId, {});

      expectActorKnows(actorId, [actorId, 'item1', 'item2']);
    });
  });

  // ========================================================================
  // Test Suite 7: Edge Cases
  // ========================================================================

  describe('Edge Cases', () => {
    it('should handle empty locations gracefully', async () => {
      const actorId = createActor('actor1', 'empty_room');

      await knowledgeManager.updateKnowledge(actorId, {});

      // Actor should only know themselves
      expectActorKnows(actorId, [actorId]);

      // No event dispatched when there are no new entities (knowledge unchanged)
      expect(knowledgeUpdateEvents.length).toBe(0);
    });

    it('should handle locations where all entities are invisible', async () => {
      const actorId = createActor('actor1', 'room1');
      createVisibleEntity('hidden1', 'room1', false);
      createVisibleEntity('hidden2', 'room1', false);

      await knowledgeManager.updateKnowledge(actorId, {});

      // Actor should only know themselves
      expectActorKnows(actorId, [actorId]);
      expectActorDoesNotKnow(actorId, 'hidden1');
      expectActorDoesNotKnow(actorId, 'hidden2');
    });

    it('should handle rapid turn transitions efficiently', async () => {
      const actorId = createActor('actor1', 'room1');
      createVisibleEntity('item1', 'room1', true);

      // Simulate 10 rapid knowledge updates
      const updates = [];
      for (let i = 0; i < 10; i++) {
        updates.push(knowledgeManager.updateKnowledge(actorId, {}));
      }

      await Promise.all(updates);

      // Knowledge should be consistent (additive only)
      expectActorKnows(actorId, [actorId, 'item1']);

      // Only first update dispatches event (subsequent ones have no new knowledge)
      expect(knowledgeUpdateEvents.length).toBe(1);
      expect(knowledgeUpdateEvents[0].payload.newEntitiesCount).toBe(1);
    });

    it('should handle concurrent visibility changes', async () => {
      const actorId = createActor('actor1', 'room1');
      const item1Id = createVisibleEntity('item1', 'room1', true);
      const item2Id = createVisibleEntity('item2', 'room1', true);

      // Initial knowledge update
      await knowledgeManager.updateKnowledge(actorId, {});
      expectActorKnows(actorId, [actorId, item1Id, item2Id]);

      // Concurrent changes: item1 becomes hidden, item3 appears
      entityManager.addComponent(item1Id, 'core:visible', {
        isVisible: false,
      });
      const item3Id = createVisibleEntity('item3', 'room1', true);

      await knowledgeManager.updateKnowledge(actorId, {});

      // Knowledge is additive: item1 persists, item3 is added
      expectActorKnows(actorId, [actorId, item1Id, item2Id, item3Id]);
    });
  });

  // ========================================================================
  // Performance and Event Validation
  // ========================================================================

  describe('Performance and Events', () => {
    it('should dispatch ACTOR_KNOWLEDGE_UPDATED event with correct payload', async () => {
      const { actorId } = setupSimpleVisibility();

      await knowledgeManager.updateKnowledge(actorId, {});

      expect(knowledgeUpdateEvents.length).toBe(1);
      expect(knowledgeUpdateEvents[0].type).toBe(ACTOR_KNOWLEDGE_UPDATED_ID);
      expect(knowledgeUpdateEvents[0].payload).toEqual({
        actorId,
        newEntitiesCount: 1,
        totalKnownCount: 2,
      });
    });

    it('should update knowledge efficiently for multiple entities', async () => {
      const actorId = createActor('actor1', 'room1');

      // Create 50 visible entities
      for (let i = 0; i < 50; i++) {
        createVisibleEntity(`item${i}`, 'room1', true);
      }

      const startTime = performance.now();
      await knowledgeManager.updateKnowledge(actorId, {});
      const duration = performance.now() - startTime;

      // Should handle 50 entities in < 50ms
      expect(duration).toBeLessThan(50);

      const entity = entityManager.getEntity(actorId);
      const knowledge = entity.components['core:known_to']?.entities || [];
      expect(knowledge.length).toBe(51); // actor + 50 items
    });
  });
});
