/**
 * @file Specialized assertion helpers for mod integration tests
 * @description Provides standardized assertions for common mod test scenarios
 */

import { expect } from '@jest/globals';

/**
 * Helper class providing specialized assertions for mod integration tests.
 * 
 * Standardizes the verification patterns commonly used across mod tests,
 * reducing code duplication and improving test consistency.
 */
export class ModAssertionHelpers {
  /**
   * Asserts that an action executed successfully with the expected workflow.
   * 
   * @param {Array} events - The captured events from the test environment
   * @param {string} expectedMessage - Expected success message
   * @param {object} options - Additional options
   * @param {boolean} [options.shouldEndTurn] - Whether turn should end (default: true)
   * @param {boolean} [options.shouldHavePerceptibleEvent] - Whether perceptible event should exist (default: true)
   */
  static assertActionSuccess(events, expectedMessage, options = {}) {
    const {
      shouldEndTurn = true,
      shouldHavePerceptibleEvent = true,
    } = options;

    // Check that we have the basic required events
    const successEvent = events.find(
      (e) => e.eventType === 'core:display_successful_action_result'
    );
    expect(successEvent).toBeDefined();
    expect(successEvent.payload.message).toBe(expectedMessage);

    if (shouldHavePerceptibleEvent) {
      const perceptibleEvent = events.find(
        (e) => e.eventType === 'core:perceptible_event'
      );
      expect(perceptibleEvent).toBeDefined();
      expect(perceptibleEvent.payload.descriptionText).toBe(expectedMessage);
    }

    if (shouldEndTurn) {
      const turnEndedEvent = events.find(
        (e) => e.eventType === 'core:turn_ended'
      );
      expect(turnEndedEvent).toBeDefined();
      expect(turnEndedEvent.payload.success).toBe(true);
    }
  }

  /**
   * Asserts that a perceptible event was generated correctly.
   * 
   * @param {Array} events - The captured events from the test environment
   * @param {object} expectedEvent - Expected event properties
   * @param {string} expectedEvent.descriptionText - Expected description
   * @param {string} expectedEvent.locationId - Expected location ID
   * @param {string} expectedEvent.actorId - Expected actor ID
   * @param {string} [expectedEvent.targetId] - Expected target ID
   * @param {string} [expectedEvent.perceptionType] - Expected perception type
   */
  static assertPerceptibleEvent(events, expectedEvent) {
    const perceptibleEvent = events.find(
      (e) => e.eventType === 'core:perceptible_event'
    );
    
    expect(perceptibleEvent).toBeDefined();
    
    const { payload } = perceptibleEvent;
    expect(payload.descriptionText).toBe(expectedEvent.descriptionText);
    expect(payload.locationId).toBe(expectedEvent.locationId);
    expect(payload.actorId).toBe(expectedEvent.actorId);
    
    if (expectedEvent.targetId) {
      expect(payload.targetId).toBe(expectedEvent.targetId);
    }
    
    if (expectedEvent.perceptionType) {
      expect(payload.perceptionType).toBe(expectedEvent.perceptionType);
    } else {
      expect(payload.perceptionType).toBe('action_target_general');
    }
    
    // Default expectations for perceptible events
    expect(payload.involvedEntities).toEqual([]);
  }

  /**
   * Asserts that a component was added to an entity correctly.
   * 
   * @param {object} entityManager - Entity manager instance
   * @param {string} entityId - The entity ID to check
   * @param {string} componentId - The component type ID that should exist
   * @param {object} [expectedData] - Expected component data
   */
  static assertComponentAdded(entityManager, entityId, componentId, expectedData = {}) {
    const entity = entityManager.getEntityInstance(entityId);
    expect(entity).toBeDefined();
    expect(entity.components[componentId]).toBeDefined();
    
    if (Object.keys(expectedData).length > 0) {
      expect(entity.components[componentId]).toEqual(
        expect.objectContaining(expectedData)
      );
    }
  }

  /**
   * Asserts that a component was removed from an entity.
   * 
   * @param {object} entityManager - Entity manager instance
   * @param {string} entityId - The entity ID to check
   * @param {string} componentId - The component type ID that should not exist
   */
  static assertComponentRemoved(entityManager, entityId, componentId) {
    const entity = entityManager.getEntityInstance(entityId);
    expect(entity).toBeDefined();
    expect(entity.components[componentId]).toBeUndefined();
  }

  /**
   * Asserts the standard event sequence for a successful action.
   * 
   * @param {Array} events - The captured events from the test environment
   * @param {Array<string>} [expectedTypes] - Expected event types in order
   */
  static assertStandardEventSequence(events, expectedTypes = null) {
    const defaultExpectedTypes = [
      'core:attempt_action',
      'core:perceptible_event',
      'core:display_successful_action_result',
      'core:turn_ended',
    ];
    
    const typesToCheck = expectedTypes || defaultExpectedTypes;
    const eventTypes = events.map((e) => e.eventType);
    
    typesToCheck.forEach((expectedType) => {
      expect(eventTypes).toContain(expectedType);
    });
  }

  /**
   * Asserts that an action failed to execute (no success events).
   * 
   * @param {Array} events - The captured events from the test environment
   * @param {object} options - Options for failure checking
   * @param {boolean} [options.shouldHaveAttempt] - Whether attempt event should exist (default: true)
   */
  static assertActionFailure(events, options = {}) {
    const { shouldHaveAttempt = true } = options;
    
    if (shouldHaveAttempt) {
      const attemptEvent = events.find(
        (e) => e.eventType === 'core:attempt_action'
      );
      expect(attemptEvent).toBeDefined();
    }
    
    // Should not have success events
    const successEvent = events.find(
      (e) => e.eventType === 'core:display_successful_action_result'
    );
    expect(successEvent).toBeUndefined();
    
    const turnEndedEvent = events.find(
      (e) => e.eventType === 'core:turn_ended'
    );
    
    if (turnEndedEvent) {
      expect(turnEndedEvent.payload.success).toBe(false);
    }
  }

  /**
   * Asserts that only specific events were generated (no unexpected events).
   * 
   * @param {Array} events - The captured events from the test environment
   * @param {Array<string>} allowedEventTypes - Event types that are allowed
   */
  static assertOnlyExpectedEvents(events, allowedEventTypes) {
    const eventTypes = events.map((e) => e.eventType);
    const unexpectedEvents = eventTypes.filter(
      (type) => !allowedEventTypes.includes(type)
    );
    
    expect(unexpectedEvents).toEqual([]);
  }

  /**
   * Asserts that two entities have mutual closeness components.
   * 
   * @param {object} entityManager - Entity manager instance
   * @param {string} entity1Id - First entity ID
   * @param {string} entity2Id - Second entity ID
   */
  static assertMutualCloseness(entityManager, entity1Id, entity2Id) {
    const entity1 = entityManager.getEntityInstance(entity1Id);
    const entity2 = entityManager.getEntityInstance(entity2Id);
    
    expect(entity1).toBeDefined();
    expect(entity2).toBeDefined();
    
    expect(entity1.components['positioning:closeness']).toBeDefined();
    expect(entity2.components['positioning:closeness']).toBeDefined();
    
    expect(entity1.components['positioning:closeness'].partners).toContain(entity2Id);
    expect(entity2.components['positioning:closeness'].partners).toContain(entity1Id);
  }

  /**
   * Asserts that entities are in the same location.
   * 
   * @param {object} entityManager - Entity manager instance
   * @param {Array<string>} entityIds - Entity IDs to check
   * @param {string} expectedLocationId - Expected location ID
   */
  static assertSameLocation(entityManager, entityIds, expectedLocationId) {
    entityIds.forEach((entityId) => {
      const entity = entityManager.getEntityInstance(entityId);
      expect(entity).toBeDefined();
      expect(entity.components).toBeDefined();
      
      const positionComponent = entity.components['core:position'];
      expect(positionComponent).toBeDefined();
      expect(positionComponent.locationId).toBe(expectedLocationId);
    });
  }

  /**
   * Asserts that a rule did not trigger for a different action.
   * 
   * @param {Array} events - The captured events from the test environment
   * @param {number} initialEventCount - Number of events before the test action
   */
  static assertRuleDidNotTrigger(events, initialEventCount) {
    // Should only have the dispatched event, no rule-generated events
    expect(events.length).toBe(initialEventCount + 1);
    
    // Should not have any success or perceptible events
    const successEvents = events.filter(
      (e) => e.eventType === 'core:display_successful_action_result'
    );
    const perceptibleEvents = events.filter(
      (e) => e.eventType === 'core:perceptible_event'
    );
    
    expect(successEvents).toHaveLength(0);
    expect(perceptibleEvents).toHaveLength(0);
  }

  /**
   * Asserts that messages match between success and perceptible events.
   * 
   * @param {Array} events - The captured events from the test environment
   */
  static assertConsistentMessages(events) {
    const successEvent = events.find(
      (e) => e.eventType === 'core:display_successful_action_result'
    );
    const perceptibleEvent = events.find(
      (e) => e.eventType === 'core:perceptible_event'
    );
    
    if (successEvent && perceptibleEvent) {
      expect(successEvent.payload.message).toBe(
        perceptibleEvent.payload.descriptionText
      );
    }
  }

  /**
   * Asserts that an entity has specific components.
   * 
   * @param {object} entityManager - Entity manager instance
   * @param {string} entityId - Entity ID to check
   * @param {Array<string>} componentIds - Component IDs that should exist
   */
  static assertEntityHasComponents(entityManager, entityId, componentIds) {
    const entity = entityManager.getEntityInstance(entityId);
    expect(entity).toBeDefined();
    
    componentIds.forEach((componentId) => {
      expect(entity.components[componentId]).toBeDefined();
    });
  }

  /**
   * Asserts that an entity does not have specific components.
   * 
   * @param {object} entityManager - Entity manager instance
   * @param {string} entityId - Entity ID to check
   * @param {Array<string>} componentIds - Component IDs that should not exist
   */
  static assertEntityLacksComponents(entityManager, entityId, componentIds) {
    const entity = entityManager.getEntityInstance(entityId);
    expect(entity).toBeDefined();
    
    componentIds.forEach((componentId) => {
      expect(entity.components[componentId]).toBeUndefined();
    });
  }

  /**
   * Asserts that event counts match expected values.
   * 
   * @param {Array} events - The captured events from the test environment
   * @param {object} expectedCounts - Object mapping event types to expected counts
   */
  static assertEventCounts(events, expectedCounts) {
    Object.entries(expectedCounts).forEach(([eventType, expectedCount]) => {
      const actualCount = events.filter((e) => e.eventType === eventType).length;
      expect(actualCount).toBe(expectedCount);
    });
  }

  /**
   * Asserts anatomy body structure is correct.
   * 
   * @param {object} entityManager - Entity manager instance
   * @param {string} entityId - Entity with anatomy:body component
   * @param {string} rootPartId - Expected root body part ID
   */
  static assertBodyStructure(entityManager, entityId, rootPartId) {
    const entity = entityManager.getEntityInstance(entityId);
    expect(entity).toBeDefined();
    expect(entity.components['anatomy:body']).toBeDefined();
    expect(entity.components['anatomy:body'].body.root).toBe(rootPartId);
  }

  /**
   * Asserts body part relationships are correct.
   * 
   * @param {object} entityManager - Entity manager instance
   * @param {string} partId - Body part entity ID
   * @param {object} expectedStructure - Expected part structure
   * @param {string} [expectedStructure.parent] - Expected parent ID
   * @param {Array<string>} [expectedStructure.children] - Expected children IDs
   * @param {string} expectedStructure.subType - Expected subtype
   */
  static assertBodyPart(entityManager, partId, expectedStructure) {
    const part = entityManager.getEntityInstance(partId);
    expect(part).toBeDefined();
    expect(part.components['anatomy:part']).toBeDefined();
    
    const partData = part.components['anatomy:part'];
    
    if (expectedStructure.parent !== undefined) {
      expect(partData.parent).toBe(expectedStructure.parent);
    }
    
    if (expectedStructure.children) {
      expect(partData.children).toEqual(expectedStructure.children);
    }
    
    expect(partData.subType).toBe(expectedStructure.subType);
  }
}

export default ModAssertionHelpers;