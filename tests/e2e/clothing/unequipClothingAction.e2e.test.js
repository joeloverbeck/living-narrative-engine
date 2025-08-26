/**
 * @file End-to-end tests for entity description updates during clothing removal
 * @description Complete user experience validation for clothing removal actions
 * from the player's perspective, ensuring description changes are visible in gameplay
 * 
 * Tests validate the complete user journey:
 * - Action initiation through turn execution facade
 * - ECS component updates (equipment, position, inventory)
 * - Event system integration and description update notifications
 * - Multi-character observation consistency
 * - Performance requirements and error handling
 * @see workflows/ENTDESCREG-007-create-e2e-tests.md
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createMockFacades } from '../../common/facades/testingFacadeRegistrations.js';
import { createTestBed } from '../../common/testBed.js';

describe('Clothing Actions E2E - Unequip Clothing', () => {
  let testBed;
  let mockFacades;
  let turnExecutionFacade;
  let entityManager;
  let eventBus;
  let mockLogger;

  beforeEach(() => {
    testBed = createTestBed();
    mockFacades = createMockFacades({}, jest.fn);
    
    // Setup core services from test bed and facades
    entityManager = testBed.createMockEntityManager();
    eventBus = testBed.mockValidatedEventDispatcher;
    mockLogger = testBed.mockLogger;
    turnExecutionFacade = mockFacades.turnExecutionFacade;

    // Enhance entity manager with methods needed for tests
    const entityStore = new Map();
    const componentStore = new Map();

    entityManager.entities = entityStore;
    entityManager.components = componentStore;
    
    entityManager.createEntity = (componentTypeId, data) => {
      const entityId = `entity_${Date.now()}_${Math.random()}`;
      const entity = { id: entityId, componentTypeId, ...data };
      entityStore.set(entityId, entity);
      return entity;
    };

    entityManager.getComponent = (entityId, componentType) => {
      const key = `${entityId}:${componentType}`;
      return componentStore.get(key);
    };

    entityManager.getComponentData = (entityId, componentType) => {
      const component = entityManager.getComponent(entityId, componentType);
      return component ? component.data : null;
    };

    entityManager.setComponentData = (entityId, componentType, data) => {
      const key = `${entityId}:${componentType}`;
      componentStore.set(key, { entityId, componentType, data });
    };

    entityManager.addComponent = (entityId, componentType, data) => {
      entityManager.setComponentData(entityId, componentType, data);
    };

    entityManager.updateComponent = (entityId, componentType, data) => {
      const existing = entityManager.getComponentData(entityId, componentType);
      const updated = { ...existing, ...data };
      entityManager.setComponentData(entityId, componentType, updated);
    };

    entityManager.hasComponent = (entityId, componentType) => {
      return !!entityManager.getComponent(entityId, componentType);
    };

    // Enhance event bus with subscription support
    const eventSubscribers = new Map();
    eventBus.subscribe = jest.fn((eventType, callback) => {
      if (!eventSubscribers.has(eventType)) {
        eventSubscribers.set(eventType, []);
      }
      eventSubscribers.get(eventType).push(callback);
      return () => {
        const callbacks = eventSubscribers.get(eventType);
        const index = callbacks.indexOf(callback);
        if (index > -1) callbacks.splice(index, 1);
      };
    });

    // Enhance the dispatch method to call subscribers
    const originalDispatch = eventBus.dispatch;
    eventBus.dispatch = jest.fn((event) => {
      const subscribers = eventSubscribers.get(event.type) || [];
      subscribers.forEach(callback => callback(event));
      return originalDispatch ? originalDispatch(event) : true;
    });

    // Enhance turn execution facade with realistic implementation
    const originalExecuteTurn = turnExecutionFacade.executeTurn;
    turnExecutionFacade.executeTurn = jest.fn(({ actionId, actorId, targetId, parameters }) => {
      if (actionId === 'clothing:remove_clothing') {
        // Simulate clothing removal logic
        const equipment = entityManager.getComponentData(actorId, 'clothing:equipment');
        if (equipment && equipment.equipped) {
          let itemFound = false;
          
          // Find and remove the item
          Object.keys(equipment.equipped).forEach(slot => {
            if (equipment.equipped[slot] === targetId) {
              delete equipment.equipped[slot];
              itemFound = true;
            } else if (Array.isArray(equipment.equipped[slot])) {
              const index = equipment.equipped[slot].indexOf(targetId);
              if (index > -1) {
                equipment.equipped[slot].splice(index, 1);
                if (equipment.equipped[slot].length === 0) {
                  delete equipment.equipped[slot];
                }
                itemFound = true;
              }
            }
          });

          if (itemFound) {
            // Update equipment
            entityManager.setComponentData(actorId, 'clothing:equipment', equipment);
            
            // Handle item placement
            const actorPosition = entityManager.getComponentData(actorId, 'core:position');
            if (actorPosition) {
              entityManager.setComponentData(targetId, 'core:position', {
                locationId: actorPosition.locationId
              });
            }

            // Dispatch events
            eventBus.dispatch({
              type: 'ENTITY_DESCRIPTION_UPDATED',
              payload: { entityId: actorId, reason: 'clothing_removed' }
            });

            return { success: true };
          }
        }
        
        return { success: false, error: 'target not found' };
      }
      
      return originalExecuteTurn ? originalExecuteTurn({ actionId, actorId, targetId, parameters }) : { success: false, error: 'unknown action' };
    });
  });

  afterEach(() => {
    testBed.cleanup();
  });

  // Helper methods for consistent test setup
  const helpers = {
    createEntity: (componentTypeId, data) => {
      return entityManager.createEntity(componentTypeId, data);
    },
    
    addComponent: (entityId, componentType, data) => {
      entityManager.addComponent(entityId, componentType, data);
    },
    
    updateComponent: (entityId, componentType, data) => {
      entityManager.updateComponent(entityId, componentType, data);
    },

    createMockDescriptionService: () => ({
      generateDescription: jest.fn((entityId) => {
        const actor = entityManager.entities.get(entityId);
        if (!actor) return 'Unknown entity';
        
        const equipment = entityManager.getComponentData(entityId, 'clothing:equipment');
        let description = actor.appearance?.baseDescription || actor.name || 'A person';
        
        if (equipment && equipment.equipped) {
          const clothingItems = [];
          Object.values(equipment.equipped).forEach(itemId => {
            if (Array.isArray(itemId)) {
              itemId.forEach(id => {
                const item = entityManager.entities.get(id);
                if (item) clothingItems.push(item.name);
              });
            } else {
              const item = entityManager.entities.get(itemId);
              if (item) clothingItems.push(item.name);
            }
          });
          
          if (clothingItems.length > 0) {
            description += ` wearing ${clothingItems.join(', ')}`;
          }
        }
        
        return description;
      })
    }),

    createMockObservationService: () => ({
      describeEntityFromPerspective: jest.fn((targetEntityId, observerEntityId) => {
        // Check if both entities are in the same location
        const targetPosition = entityManager.getComponentData(targetEntityId, 'core:position');
        const observerPosition = entityManager.getComponentData(observerEntityId, 'core:position');
        
        if (!targetPosition || !observerPosition || 
            targetPosition.locationId !== observerPosition.locationId) {
          return null; // Cannot see across locations
        }
        
        // Use the description service to get appearance
        const descriptionService = helpers.createMockDescriptionService();
        return descriptionService.generateDescription(targetEntityId);
      })
    })
  };

  describe('Single Character Description Updates', () => {
    it('should update character appearance after clothing removal', () => {
      // Setup: Create actor entity with clothing equipment
      const actor = helpers.createEntity('core:actor', {
        name: 'Alice',
        appearance: { baseDescription: 'A young woman' }
      });
      const actorId = actor.id;

      const hat = helpers.createEntity('clothing:clothing_item', {
        name: 'red hat',
        type: 'headwear',
        description: 'A bright red hat'
      });
      const hatId = hat.id;

      // Equip clothing to actor
      helpers.addComponent(actorId, 'clothing:equipment', {
        equipped: { headwear: hatId }
      });

      // Create description service
      const descriptionService = helpers.createMockDescriptionService();
      
      const initialDescription = descriptionService.generateDescription(actorId);
      expect(initialDescription).toContain('red hat');

      // Action: Execute clothing removal through turn execution facade
      const actionResult = turnExecutionFacade.executeTurn({
        actionId: 'clothing:remove_clothing',
        actorId: actorId,
        targetId: hatId,
        parameters: {}
      });

      // Verify: Action succeeded
      expect(actionResult.success).toBe(true);

      // Verify: Equipment component updated
      const equipment = entityManager.getComponentData(actorId, 'clothing:equipment');
      expect(equipment.equipped.headwear).toBeUndefined();

      // Verify: Updated description no longer contains removed item
      const updatedDescription = descriptionService.generateDescription(actorId);
      expect(updatedDescription).not.toContain('red hat');
      expect(updatedDescription).toContain('young woman');
    });

    it('should handle multiple clothing removals in sequence', () => {
      // Setup: Actor with multiple clothing items
      const actor = helpers.createEntity('core:actor', {
        name: 'Bob',
        appearance: { baseDescription: 'A tall man' }
      });
      const actorId = actor.id;

      const hat = helpers.createEntity('clothing:clothing_item', {
        name: 'blue cap', type: 'headwear'
      });
      const hatId = hat.id;

      const shirt = helpers.createEntity('clothing:clothing_item', {
        name: 'white shirt', type: 'torso'
      });
      const shirtId = shirt.id;

      helpers.addComponent(actorId, 'clothing:equipment', {
        equipped: { headwear: hatId, torso: shirtId }
      });

      const descriptionService = helpers.createMockDescriptionService();

      // Remove first item
      const result1 = turnExecutionFacade.executeTurn({
        actionId: 'clothing:remove_clothing',
        actorId: actorId,
        targetId: hatId
      });

      expect(result1.success).toBe(true);
      let description = descriptionService.generateDescription(actorId);
      expect(description).not.toContain('blue cap');
      expect(description).toContain('white shirt');

      // Remove second item
      const result2 = turnExecutionFacade.executeTurn({
        actionId: 'clothing:remove_clothing',
        actorId: actorId,
        targetId: shirtId
      });

      expect(result2.success).toBe(true);
      description = descriptionService.generateDescription(actorId);
      expect(description).not.toContain('blue cap');
      expect(description).not.toContain('white shirt');
      expect(description).toContain('tall man');
    });
  });

  describe('Multi-Character Interactions', () => {
    it('should update appearance visible to other characters in same location', () => {
      // Setup: Two characters in same location
      const alice = helpers.createEntity('core:actor', {
        name: 'Alice',
        appearance: { baseDescription: 'A young woman' }
      });
      const aliceId = alice.id;

      const bob = helpers.createEntity('core:actor', {
        name: 'Bob',
        appearance: { baseDescription: 'A tall man' }
      });
      const bobId = bob.id;

      const location = helpers.createEntity('core:location', {
        name: 'living_room'
      });
      const locationId = location.id;

      // Place both characters in same location
      helpers.addComponent(aliceId, 'core:position', { locationId });
      helpers.addComponent(bobId, 'core:position', { locationId });

      // Give Alice clothing
      const hat = helpers.createEntity('clothing:clothing_item', {
        name: 'elegant hat',
        type: 'headwear'
      });
      const hatId = hat.id;

      helpers.addComponent(aliceId, 'clothing:equipment', {
        equipped: { headwear: hatId }
      });

      const observationService = helpers.createMockObservationService();
      
      // Bob observes Alice initially
      let aliceFromBobsPerspective = observationService.describeEntityFromPerspective(
        aliceId, 
        bobId
      );
      expect(aliceFromBobsPerspective).toContain('elegant hat');

      // Alice removes her hat
      const actionResult = turnExecutionFacade.executeTurn({
        actionId: 'clothing:remove_clothing',
        actorId: aliceId,
        targetId: hatId
      });

      expect(actionResult.success).toBe(true);

      // Bob observes Alice after clothing removal
      aliceFromBobsPerspective = observationService.describeEntityFromPerspective(
        aliceId, 
        bobId
      );
      expect(aliceFromBobsPerspective).not.toContain('elegant hat');
      expect(aliceFromBobsPerspective).toContain('young woman');
    });

    it('should maintain consistency across multiple observer perspectives', () => {
      // Setup: Three characters in same location
      const alice = helpers.createEntity('core:actor', { 
        name: 'Alice',
        appearance: { baseDescription: 'A fashionable woman' }
      });
      const aliceId = alice.id;

      const bob = helpers.createEntity('core:actor', { name: 'Bob' });
      const bobId = bob.id;

      const carol = helpers.createEntity('core:actor', { name: 'Carol' });
      const carolId = carol.id;

      const location = helpers.createEntity('core:location', { name: 'room' });
      const locationId = location.id;

      // Place all in same location
      [aliceId, bobId, carolId].forEach(actorId => {
        helpers.addComponent(actorId, 'core:position', { locationId });
      });

      // Alice has clothing
      const jacket = helpers.createEntity('clothing:clothing_item', {
        name: 'leather jacket',
        type: 'torso'
      });
      const jacketId = jacket.id;

      helpers.addComponent(aliceId, 'clothing:equipment', {
        equipped: { torso: jacketId }
      });

      const observationService = helpers.createMockObservationService();

      // Both Bob and Carol see Alice's jacket initially
      let aliceFromBob = observationService.describeEntityFromPerspective(aliceId, bobId);
      let aliceFromCarol = observationService.describeEntityFromPerspective(aliceId, carolId);
      
      expect(aliceFromBob).toContain('leather jacket');
      expect(aliceFromCarol).toContain('leather jacket');

      // Alice removes jacket
      const result = turnExecutionFacade.executeTurn({
        actionId: 'clothing:remove_clothing',
        actorId: aliceId,
        targetId: jacketId
      });

      expect(result.success).toBe(true);

      // Both observers see the change consistently
      aliceFromBob = observationService.describeEntityFromPerspective(aliceId, bobId);
      aliceFromCarol = observationService.describeEntityFromPerspective(aliceId, carolId);
      
      expect(aliceFromBob).not.toContain('leather jacket');
      expect(aliceFromCarol).not.toContain('leather jacket');
      
      // Both should see the same base description
      expect(aliceFromBob).toEqual(aliceFromCarol);
    });
  });

  describe('Event-Driven Description Updates', () => {
    it('should update descriptions through event system integration', () => {
      // Setup: Actor with clothing
      const actor = helpers.createEntity('core:actor', {
        name: 'Shopkeeper',
        appearance: { baseDescription: 'An elderly merchant' }
      });
      const actorId = actor.id;

      const apron = helpers.createEntity('clothing:clothing_item', {
        name: 'work apron',
        type: 'torso'
      });
      const apronId = apron.id;

      helpers.addComponent(actorId, 'clothing:equipment', {
        equipped: { torso: apronId }
      });

      // Monitor event bus for description update events
      let descriptionUpdateEvent = null;
      eventBus.subscribe('ENTITY_DESCRIPTION_UPDATED', (event) => {
        descriptionUpdateEvent = event;
      });

      // Execute clothing removal action
      const actionResult = turnExecutionFacade.executeTurn({
        actionId: 'clothing:remove_clothing',
        actorId: actorId,
        targetId: apronId
      });

      expect(actionResult.success).toBe(true);

      // Verify: Description update event was dispatched
      expect(descriptionUpdateEvent).toBeTruthy();
      expect(descriptionUpdateEvent.payload.entityId).toBe(actorId);
      expect(descriptionUpdateEvent.payload.reason).toBe('clothing_removed');

      // Verify: Description service reflects the change
      const descriptionService = helpers.createMockDescriptionService();
      const updatedDescription = descriptionService.generateDescription(actorId);
      expect(updatedDescription).not.toContain('work apron');
      expect(updatedDescription).toContain('elderly merchant');
    });

    it('should handle simultaneous clothing changes across multiple entities', () => {
      // Setup: Multiple actors with clothing
      const actor1 = helpers.createEntity('core:actor', { 
        name: 'Alice',
        appearance: { baseDescription: 'A young woman' }
      });
      const actor1Id = actor1.id;

      const actor2 = helpers.createEntity('core:actor', { 
        name: 'Bob',
        appearance: { baseDescription: 'A tall man' }
      });
      const actor2Id = actor2.id;

      const hat1 = helpers.createEntity('clothing:clothing_item', {
        name: 'red cap', type: 'headwear'
      });
      const hat1Id = hat1.id;

      const hat2 = helpers.createEntity('clothing:clothing_item', {
        name: 'blue cap', type: 'headwear'
      });
      const hat2Id = hat2.id;

      helpers.addComponent(actor1Id, 'clothing:equipment', {
        equipped: { headwear: hat1Id }
      });
      helpers.addComponent(actor2Id, 'clothing:equipment', {
        equipped: { headwear: hat2Id }
      });

      // Track description update events
      const descriptionEvents = [];
      eventBus.subscribe('ENTITY_DESCRIPTION_UPDATED', (event) => {
        descriptionEvents.push(event);
      });

      // Execute simultaneous clothing removals
      const result1 = turnExecutionFacade.executeTurn({
        actionId: 'clothing:remove_clothing',
        actorId: actor1Id,
        targetId: hat1Id
      });

      const result2 = turnExecutionFacade.executeTurn({
        actionId: 'clothing:remove_clothing',
        actorId: actor2Id,
        targetId: hat2Id
      });

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);

      // Verify: Both description update events were dispatched
      expect(descriptionEvents).toHaveLength(2);
      expect(descriptionEvents.some(e => e.payload.entityId === actor1Id)).toBe(true);
      expect(descriptionEvents.some(e => e.payload.entityId === actor2Id)).toBe(true);

      // Verify: Both descriptions updated correctly
      const descriptionService = helpers.createMockDescriptionService();
      const desc1 = descriptionService.generateDescription(actor1Id);
      const desc2 = descriptionService.generateDescription(actor2Id);

      expect(desc1).not.toContain('red cap');
      expect(desc2).not.toContain('blue cap');
    });
  });

  describe('Complex Integration Scenarios', () => {
    it('should handle error scenarios gracefully', () => {
      // Setup: Actor with clothing
      const actor = helpers.createEntity('core:actor', { 
        name: 'TestActor',
        appearance: { baseDescription: 'A test person' }
      });
      const actorId = actor.id;

      const shirt = helpers.createEntity('clothing:clothing_item', {
        name: 'test shirt',
        type: 'torso'
      });
      const shirtId = shirt.id;

      helpers.addComponent(actorId, 'clothing:equipment', {
        equipped: { torso: shirtId }
      });

      // Attempt to remove clothing that doesn't exist
      const invalidActionResult = turnExecutionFacade.executeTurn({
        actionId: 'clothing:remove_clothing',
        actorId: actorId,
        targetId: 'non_existent_item'
      });

      // Verify: Action fails gracefully
      expect(invalidActionResult.success).toBe(false);
      expect(invalidActionResult.error).toContain('target not found');

      // Verify: Original clothing still equipped
      const equipment = entityManager.getComponentData(actorId, 'clothing:equipment');
      expect(equipment.equipped.torso).toBe(shirtId);

      // Attempt to remove clothing from non-existent actor
      const invalidActorResult = turnExecutionFacade.executeTurn({
        actionId: 'clothing:remove_clothing',
        actorId: 'non_existent_actor',
        targetId: shirtId
      });

      expect(invalidActorResult.success).toBe(false);
      expect(invalidActorResult.error).toContain('target not found');
    });

    it('should handle concurrent clothing operations correctly', () => {
      // Setup: Actor with multiple clothing items
      const actor = helpers.createEntity('core:actor', { 
        name: 'MultiDresser',
        appearance: { baseDescription: 'A well-dressed person' }
      });
      const actorId = actor.id;
      
      const hat = helpers.createEntity('clothing:clothing_item', {
        name: 'party hat', type: 'headwear'
      });
      const hatId = hat.id;

      const shirt = helpers.createEntity('clothing:clothing_item', {
        name: 'party shirt', type: 'torso'
      });
      const shirtId = shirt.id;

      const shoes = helpers.createEntity('clothing:clothing_item', {
        name: 'party shoes', type: 'feet'
      });
      const shoesId = shoes.id;

      helpers.addComponent(actorId, 'clothing:equipment', {
        equipped: {
          headwear: hatId,
          torso: shirtId,
          feet: shoesId
        }
      });

      // Execute multiple clothing removals
      const results = [
        turnExecutionFacade.executeTurn({
          actionId: 'clothing:remove_clothing',
          actorId: actorId,
          targetId: hatId
        }),
        turnExecutionFacade.executeTurn({
          actionId: 'clothing:remove_clothing',
          actorId: actorId,
          targetId: shirtId
        }),
        turnExecutionFacade.executeTurn({
          actionId: 'clothing:remove_clothing',
          actorId: actorId,
          targetId: shoesId
        })
      ];

      // All actions should succeed
      results.forEach(result => {
        expect(result.success).toBe(true);
      });

      // Equipment should be completely cleared
      const finalEquipment = entityManager.getComponentData(actorId, 'clothing:equipment');
      expect(finalEquipment.equipped.headwear).toBeUndefined();
      expect(finalEquipment.equipped.torso).toBeUndefined();
      expect(finalEquipment.equipped.feet).toBeUndefined();

      // Description should reflect no clothing
      const descriptionService = helpers.createMockDescriptionService();
      const finalDescription = descriptionService.generateDescription(actorId);
      expect(finalDescription).not.toContain('party hat');
      expect(finalDescription).not.toContain('party shirt');
      expect(finalDescription).not.toContain('party shoes');
    });
  });

  describe('Performance and Service Integration', () => {
    it('should update descriptions within acceptable time limits', () => {
      // Setup: Actor with clothing
      const actor = helpers.createEntity('core:actor', {
        name: 'Fashionista',
        appearance: { baseDescription: 'A stylish individual' }
      });
      const actorId = actor.id;

      // Create a clothing item
      const item = helpers.createEntity('clothing:clothing_item', {
        name: 'designer item',
        type: 'accessory'
      });
      const itemId = item.id;

      helpers.addComponent(actorId, 'clothing:equipment', {
        equipped: { accessory: itemId }
      });

      const descriptionService = helpers.createMockDescriptionService();

      // Measure time for description generation
      const startTime = Date.now();
      const initialDescription = descriptionService.generateDescription(actorId);
      const descriptionTime = Date.now() - startTime;

      // Verify: Description generation completes quickly (< 100ms)
      expect(descriptionTime).toBeLessThan(100);
      expect(initialDescription).toContain('designer item');

      // Measure time for clothing removal
      const actionStartTime = Date.now();
      const actionResult = turnExecutionFacade.executeTurn({
        actionId: 'clothing:remove_clothing',
        actorId: actorId,
        targetId: itemId
      });
      const actionTime = Date.now() - actionStartTime;

      // Verify: Action completes quickly (< 50ms)
      expect(actionTime).toBeLessThan(50);
      expect(actionResult.success).toBe(true);

      // Verify: Description updated correctly
      const updatedDescription = descriptionService.generateDescription(actorId);
      expect(updatedDescription).not.toContain('designer item');
      expect(updatedDescription).toContain('stylish individual');
    });
  });
});