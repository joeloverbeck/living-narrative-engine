/**
 * @file Unit tests for ModAssertionHelpers
 * @description Comprehensive test coverage for mod assertion helper methods
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ModAssertionHelpers } from '../../../common/mods/ModAssertionHelpers.js';

describe('ModAssertionHelpers', () => {
  let mockEvents;
  let mockEntityManager;
  let mockEntity;

  beforeEach(() => {
    // Reset mocks before each test
    mockEvents = [];
    mockEntity = {
      components: {},
    };
    mockEntityManager = {
      getEntityInstance: jest.fn().mockReturnValue(mockEntity),
    };
  });

  describe('assertActionSuccess', () => {
    it('should validate successful action with all expected events', () => {
      mockEvents = [
        {
          eventType: 'core:display_successful_action_result',
          payload: { message: 'Action completed successfully' },
        },
        {
          eventType: 'core:perceptible_event',
          payload: { descriptionText: 'Action completed successfully' },
        },
        {
          eventType: 'core:turn_ended',
          payload: { success: true },
        },
      ];

      expect(() => {
        ModAssertionHelpers.assertActionSuccess(
          mockEvents,
          'Action completed successfully'
        );
      }).not.toThrow();
    });

    it('should validate action without perceptible event when option is false', () => {
      mockEvents = [
        {
          eventType: 'core:display_successful_action_result',
          payload: { message: 'Silent action' },
        },
        {
          eventType: 'core:turn_ended',
          payload: { success: true },
        },
      ];

      expect(() => {
        ModAssertionHelpers.assertActionSuccess(mockEvents, 'Silent action', {
          shouldHavePerceptibleEvent: false,
        });
      }).not.toThrow();
    });

    it('should validate action without turn end when option is false', () => {
      mockEvents = [
        {
          eventType: 'core:display_successful_action_result',
          payload: { message: 'Continuous action' },
        },
        {
          eventType: 'core:perceptible_event',
          payload: { descriptionText: 'Continuous action' },
        },
      ];

      expect(() => {
        ModAssertionHelpers.assertActionSuccess(
          mockEvents,
          'Continuous action',
          {
            shouldEndTurn: false,
          }
        );
      }).not.toThrow();
    });

    it('should throw when success event is missing', () => {
      mockEvents = [
        {
          eventType: 'core:perceptible_event',
          payload: { descriptionText: 'Action failed' },
        },
      ];

      expect(() => {
        ModAssertionHelpers.assertActionSuccess(mockEvents, 'Action failed');
      }).toThrow();
    });

    it('should throw when message does not match', () => {
      mockEvents = [
        {
          eventType: 'core:display_successful_action_result',
          payload: { message: 'Wrong message' },
        },
      ];

      expect(() => {
        ModAssertionHelpers.assertActionSuccess(mockEvents, 'Expected message');
      }).toThrow();
    });
  });

  describe('assertActionFailure', () => {
    it('should validate failed action with attempt event', () => {
      mockEvents = [
        {
          eventType: 'core:attempt_action',
          payload: { actionId: 'test:action' },
        },
        {
          eventType: 'core:turn_ended',
          payload: { success: false },
        },
      ];

      expect(() => {
        ModAssertionHelpers.assertActionFailure(mockEvents);
      }).not.toThrow();
    });

    it('should validate failure without attempt event when option is false', () => {
      mockEvents = [
        {
          eventType: 'core:turn_ended',
          payload: { success: false },
        },
      ];

      expect(() => {
        ModAssertionHelpers.assertActionFailure(mockEvents, {
          shouldHaveAttempt: false,
        });
      }).not.toThrow();
    });

    it('should throw when success event is present', () => {
      mockEvents = [
        {
          eventType: 'core:display_successful_action_result',
          payload: { message: 'Should not succeed' },
        },
      ];

      expect(() => {
        ModAssertionHelpers.assertActionFailure(mockEvents);
      }).toThrow();
    });
  });

  describe('assertPerceptibleEvent', () => {
    it('should validate perceptible event with all expected properties', () => {
      mockEvents = [
        {
          eventType: 'core:perceptible_event',
          payload: {
            descriptionText: 'Test description',
            locationId: 'room1',
            actorId: 'actor1',
            targetId: 'target1',
            perceptionType: 'physical.target_action',
            involvedEntities: [],
          },
        },
      ];

      expect(() => {
        ModAssertionHelpers.assertPerceptibleEvent(mockEvents, {
          descriptionText: 'Test description',
          locationId: 'room1',
          actorId: 'actor1',
          targetId: 'target1',
        });
      }).not.toThrow();
    });

    it('should validate perceptible event with custom perception type', () => {
      mockEvents = [
        {
          eventType: 'core:perceptible_event',
          payload: {
            descriptionText: 'Custom perception',
            locationId: 'room1',
            actorId: 'actor1',
            perceptionType: 'custom_type',
            involvedEntities: [],
          },
        },
      ];

      expect(() => {
        ModAssertionHelpers.assertPerceptibleEvent(mockEvents, {
          descriptionText: 'Custom perception',
          locationId: 'room1',
          actorId: 'actor1',
          perceptionType: 'custom_type',
        });
      }).not.toThrow();
    });

    it('should use default perception type when not specified', () => {
      mockEvents = [
        {
          eventType: 'core:perceptible_event',
          payload: {
            descriptionText: 'Default perception',
            locationId: 'room1',
            actorId: 'actor1',
            perceptionType: 'physical.target_action',
            involvedEntities: [],
          },
        },
      ];

      expect(() => {
        ModAssertionHelpers.assertPerceptibleEvent(mockEvents, {
          descriptionText: 'Default perception',
          locationId: 'room1',
          actorId: 'actor1',
        });
      }).not.toThrow();
    });

    it('should throw when perceptible event is missing', () => {
      mockEvents = [];

      expect(() => {
        ModAssertionHelpers.assertPerceptibleEvent(mockEvents, {
          descriptionText: 'Missing event',
          locationId: 'room1',
          actorId: 'actor1',
        });
      }).toThrow();
    });
  });

  describe('assertComponentAdded', () => {
    it('should validate component exists on entity', () => {
      mockEntity.components['test:component'] = { value: 42 };

      expect(() => {
        ModAssertionHelpers.assertComponentAdded(
          mockEntityManager,
          'entity1',
          'test:component'
        );
      }).not.toThrow();

      expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(
        'entity1'
      );
    });

    it('should validate component data when expectedData provided', () => {
      mockEntity.components['test:component'] = { value: 42, status: 'active' };

      expect(() => {
        ModAssertionHelpers.assertComponentAdded(
          mockEntityManager,
          'entity1',
          'test:component',
          { value: 42 }
        );
      }).not.toThrow();
    });

    it('should throw when entity does not exist', () => {
      mockEntityManager.getEntityInstance.mockReturnValue(undefined);

      expect(() => {
        ModAssertionHelpers.assertComponentAdded(
          mockEntityManager,
          'missing',
          'test:component'
        );
      }).toThrow();
    });

    it('should throw when component does not exist', () => {
      expect(() => {
        ModAssertionHelpers.assertComponentAdded(
          mockEntityManager,
          'entity1',
          'missing:component'
        );
      }).toThrow();
    });

    it('should throw when component data does not match', () => {
      mockEntity.components['test:component'] = { value: 42 };

      expect(() => {
        ModAssertionHelpers.assertComponentAdded(
          mockEntityManager,
          'entity1',
          'test:component',
          { value: 100 }
        );
      }).toThrow();
    });
  });

  describe('assertComponentRemoved', () => {
    it('should validate component is removed from entity', () => {
      // Component should not exist
      expect(() => {
        ModAssertionHelpers.assertComponentRemoved(
          mockEntityManager,
          'entity1',
          'removed:component'
        );
      }).not.toThrow();
    });

    it('should throw when component still exists', () => {
      mockEntity.components['test:component'] = { value: 42 };

      expect(() => {
        ModAssertionHelpers.assertComponentRemoved(
          mockEntityManager,
          'entity1',
          'test:component'
        );
      }).toThrow();
    });

    it('should throw when entity does not exist', () => {
      mockEntityManager.getEntityInstance.mockReturnValue(undefined);

      expect(() => {
        ModAssertionHelpers.assertComponentRemoved(
          mockEntityManager,
          'missing',
          'test:component'
        );
      }).toThrow();
    });
  });

  describe('assertStandardEventSequence', () => {
    it('should validate default event sequence', () => {
      mockEvents = [
        { eventType: 'core:attempt_action' },
        { eventType: 'core:perceptible_event' },
        { eventType: 'core:display_successful_action_result' },
        { eventType: 'core:turn_ended' },
      ];

      expect(() => {
        ModAssertionHelpers.assertStandardEventSequence(mockEvents);
      }).not.toThrow();
    });

    it('should validate custom event sequence', () => {
      mockEvents = [
        { eventType: 'custom:event1' },
        { eventType: 'custom:event2' },
        { eventType: 'custom:event3' },
      ];

      expect(() => {
        ModAssertionHelpers.assertStandardEventSequence(mockEvents, [
          'custom:event1',
          'custom:event2',
          'custom:event3',
        ]);
      }).not.toThrow();
    });

    it('should validate events in any order', () => {
      mockEvents = [
        { eventType: 'core:turn_ended' },
        { eventType: 'core:attempt_action' },
        { eventType: 'core:perceptible_event' },
        { eventType: 'core:display_successful_action_result' },
      ];

      expect(() => {
        ModAssertionHelpers.assertStandardEventSequence(mockEvents);
      }).not.toThrow();
    });

    it('should throw when expected event is missing', () => {
      mockEvents = [
        { eventType: 'core:attempt_action' },
        { eventType: 'core:turn_ended' },
      ];

      expect(() => {
        ModAssertionHelpers.assertStandardEventSequence(mockEvents);
      }).toThrow();
    });
  });

  describe('assertMutualCloseness', () => {
    let mockEntity1;
    let mockEntity2;

    beforeEach(() => {
      mockEntity1 = {
        components: {
          'personal-space-states:closeness': { partners: ['entity2'] },
        },
      };
      mockEntity2 = {
        components: {
          'personal-space-states:closeness': { partners: ['entity1'] },
        },
      };

      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === 'entity1') return mockEntity1;
        if (id === 'entity2') return mockEntity2;
        return undefined;
      });
    });

    it('should validate mutual closeness between entities', () => {
      expect(() => {
        ModAssertionHelpers.assertMutualCloseness(
          mockEntityManager,
          'entity1',
          'entity2'
        );
      }).not.toThrow();
    });

    it('should throw when first entity lacks closeness component', () => {
      delete mockEntity1.components['personal-space-states:closeness'];

      expect(() => {
        ModAssertionHelpers.assertMutualCloseness(
          mockEntityManager,
          'entity1',
          'entity2'
        );
      }).toThrow();
    });

    it('should throw when entities are not mutual partners', () => {
      mockEntity1.components['personal-space-states:closeness'].partners = ['entity3'];

      expect(() => {
        ModAssertionHelpers.assertMutualCloseness(
          mockEntityManager,
          'entity1',
          'entity2'
        );
      }).toThrow();
    });

    it('should throw when entity does not exist', () => {
      expect(() => {
        ModAssertionHelpers.assertMutualCloseness(
          mockEntityManager,
          'missing',
          'entity2'
        );
      }).toThrow();
    });
  });

  describe('assertSameLocation', () => {
    beforeEach(() => {
      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === 'entity1' || id === 'entity2') {
          return {
            components: {
              'core:position': { locationId: 'room1' },
            },
          };
        }
        return undefined;
      });
    });

    it('should validate entities are in same location', () => {
      expect(() => {
        ModAssertionHelpers.assertSameLocation(
          mockEntityManager,
          ['entity1', 'entity2'],
          'room1'
        );
      }).not.toThrow();
    });

    it('should throw when entity is in different location', () => {
      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === 'entity1') {
          return {
            components: {
              'core:position': { locationId: 'room1' },
            },
          };
        }
        if (id === 'entity2') {
          return {
            components: {
              'core:position': { locationId: 'room2' },
            },
          };
        }
        return undefined;
      });

      expect(() => {
        ModAssertionHelpers.assertSameLocation(
          mockEntityManager,
          ['entity1', 'entity2'],
          'room1'
        );
      }).toThrow();
    });

    it('should throw when entity lacks position component', () => {
      mockEntityManager.getEntityInstance.mockReturnValue({
        components: {},
      });

      expect(() => {
        ModAssertionHelpers.assertSameLocation(
          mockEntityManager,
          ['entity1'],
          'room1'
        );
      }).toThrow();
    });
  });

  describe('assertConsistentMessages', () => {
    it('should validate matching messages between success and perceptible events', () => {
      mockEvents = [
        {
          eventType: 'core:display_successful_action_result',
          payload: { message: 'Consistent message' },
        },
        {
          eventType: 'core:perceptible_event',
          payload: { descriptionText: 'Consistent message' },
        },
      ];

      expect(() => {
        ModAssertionHelpers.assertConsistentMessages(mockEvents);
      }).not.toThrow();
    });

    it('should not throw when success event is missing', () => {
      mockEvents = [
        {
          eventType: 'core:perceptible_event',
          payload: { descriptionText: 'Only perceptible' },
        },
      ];

      expect(() => {
        ModAssertionHelpers.assertConsistentMessages(mockEvents);
      }).not.toThrow();
    });

    it('should not throw when perceptible event is missing', () => {
      mockEvents = [
        {
          eventType: 'core:display_successful_action_result',
          payload: { message: 'Only success' },
        },
      ];

      expect(() => {
        ModAssertionHelpers.assertConsistentMessages(mockEvents);
      }).not.toThrow();
    });

    it('should throw when messages do not match', () => {
      mockEvents = [
        {
          eventType: 'core:display_successful_action_result',
          payload: { message: 'Message A' },
        },
        {
          eventType: 'core:perceptible_event',
          payload: { descriptionText: 'Message B' },
        },
      ];

      expect(() => {
        ModAssertionHelpers.assertConsistentMessages(mockEvents);
      }).toThrow();
    });
  });

  describe('assertEntityHasComponents', () => {
    it('should validate entity has all specified components', () => {
      mockEntity.components = {
        'component:a': { data: 1 },
        'component:b': { data: 2 },
        'component:c': { data: 3 },
      };

      expect(() => {
        ModAssertionHelpers.assertEntityHasComponents(
          mockEntityManager,
          'entity1',
          ['component:a', 'component:b']
        );
      }).not.toThrow();
    });

    it('should throw when entity lacks a component', () => {
      mockEntity.components = {
        'component:a': { data: 1 },
      };

      expect(() => {
        ModAssertionHelpers.assertEntityHasComponents(
          mockEntityManager,
          'entity1',
          ['component:a', 'component:b']
        );
      }).toThrow();
    });
  });

  describe('assertEntityLacksComponents', () => {
    it('should validate entity lacks all specified components', () => {
      mockEntity.components = {
        'component:a': { data: 1 },
      };

      expect(() => {
        ModAssertionHelpers.assertEntityLacksComponents(
          mockEntityManager,
          'entity1',
          ['component:b', 'component:c']
        );
      }).not.toThrow();
    });

    it('should throw when entity has a component it should lack', () => {
      mockEntity.components = {
        'component:a': { data: 1 },
        'component:b': { data: 2 },
      };

      expect(() => {
        ModAssertionHelpers.assertEntityLacksComponents(
          mockEntityManager,
          'entity1',
          ['component:b', 'component:c']
        );
      }).toThrow();
    });
  });

  describe('assertEventCounts', () => {
    it('should validate event counts match expected values', () => {
      mockEvents = [
        { eventType: 'event:a' },
        { eventType: 'event:a' },
        { eventType: 'event:b' },
        { eventType: 'event:c' },
      ];

      expect(() => {
        ModAssertionHelpers.assertEventCounts(mockEvents, {
          'event:a': 2,
          'event:b': 1,
          'event:c': 1,
        });
      }).not.toThrow();
    });

    it('should validate zero count for missing events', () => {
      mockEvents = [{ eventType: 'event:a' }];

      expect(() => {
        ModAssertionHelpers.assertEventCounts(mockEvents, {
          'event:a': 1,
          'event:b': 0,
        });
      }).not.toThrow();
    });

    it('should throw when count does not match', () => {
      mockEvents = [{ eventType: 'event:a' }, { eventType: 'event:a' }];

      expect(() => {
        ModAssertionHelpers.assertEventCounts(mockEvents, {
          'event:a': 3,
        });
      }).toThrow();
    });
  });

  describe('assertBodyStructure', () => {
    it('should validate anatomy body structure', () => {
      mockEntity.components['anatomy:body'] = {
        body: { root: 'torso' },
      };

      expect(() => {
        ModAssertionHelpers.assertBodyStructure(
          mockEntityManager,
          'entity1',
          'torso'
        );
      }).not.toThrow();
    });

    it('should throw when body component is missing', () => {
      expect(() => {
        ModAssertionHelpers.assertBodyStructure(
          mockEntityManager,
          'entity1',
          'torso'
        );
      }).toThrow();
    });

    it('should throw when root does not match', () => {
      mockEntity.components['anatomy:body'] = {
        body: { root: 'head' },
      };

      expect(() => {
        ModAssertionHelpers.assertBodyStructure(
          mockEntityManager,
          'entity1',
          'torso'
        );
      }).toThrow();
    });
  });

  describe('assertBodyPart', () => {
    it('should validate body part structure', () => {
      mockEntity.components['anatomy:part'] = {
        parent: 'torso',
        children: ['hand1', 'hand2'],
        subType: 'arm',
      };

      expect(() => {
        ModAssertionHelpers.assertBodyPart(mockEntityManager, 'part1', {
          parent: 'torso',
          children: ['hand1', 'hand2'],
          subType: 'arm',
        });
      }).not.toThrow();
    });

    it('should validate body part with only subType', () => {
      mockEntity.components['anatomy:part'] = {
        subType: 'leg',
      };

      expect(() => {
        ModAssertionHelpers.assertBodyPart(mockEntityManager, 'part1', {
          subType: 'leg',
        });
      }).not.toThrow();
    });

    it('should throw when part component is missing', () => {
      expect(() => {
        ModAssertionHelpers.assertBodyPart(mockEntityManager, 'part1', {
          subType: 'arm',
        });
      }).toThrow();
    });

    it('should throw when parent does not match', () => {
      mockEntity.components['anatomy:part'] = {
        parent: 'torso',
        subType: 'arm',
      };

      expect(() => {
        ModAssertionHelpers.assertBodyPart(mockEntityManager, 'part1', {
          parent: 'head',
          subType: 'arm',
        });
      }).toThrow();
    });
  });

  describe('assertRuleDidNotTrigger', () => {
    it('should validate rule did not trigger', () => {
      const initialEventCount = 5;
      mockEvents = new Array(initialEventCount + 1); // Only dispatched event added

      expect(() => {
        ModAssertionHelpers.assertRuleDidNotTrigger(
          mockEvents,
          initialEventCount
        );
      }).not.toThrow();
    });

    it('should throw when additional events were generated', () => {
      const initialEventCount = 5;
      mockEvents = [
        ...new Array(initialEventCount),
        { eventType: 'dispatched' },
        { eventType: 'core:display_successful_action_result' },
        { eventType: 'core:perceptible_event' },
      ];

      expect(() => {
        ModAssertionHelpers.assertRuleDidNotTrigger(
          mockEvents,
          initialEventCount
        );
      }).toThrow();
    });
  });

  describe('assertOnlyExpectedEvents', () => {
    it('should validate only expected events are present', () => {
      mockEvents = [
        { eventType: 'allowed:a' },
        { eventType: 'allowed:b' },
        { eventType: 'allowed:c' },
      ];

      expect(() => {
        ModAssertionHelpers.assertOnlyExpectedEvents(mockEvents, [
          'allowed:a',
          'allowed:b',
          'allowed:c',
        ]);
      }).not.toThrow();
    });

    it('should throw when unexpected event is present', () => {
      mockEvents = [{ eventType: 'allowed:a' }, { eventType: 'unexpected:x' }];

      expect(() => {
        ModAssertionHelpers.assertOnlyExpectedEvents(mockEvents, ['allowed:a']);
      }).toThrow();
    });

    it('should allow core:action_success without explicit allowance', () => {
      mockEvents = [{ eventType: 'core:action_success' }];

      expect(() => {
        ModAssertionHelpers.assertOnlyExpectedEvents(mockEvents, []);
      }).not.toThrow();
    });
  });

  describe('findEventByType', () => {
    it('should find first event of specified type', () => {
      mockEvents = [
        { eventType: 'event:a', payload: { value: 1 } },
        { eventType: 'event:b', payload: { value: 2 } },
        { eventType: 'event:a', payload: { value: 3 } },
      ];

      const result = ModAssertionHelpers.findEventByType(mockEvents, 'event:a');

      expect(result).toBeDefined();
      expect(result.payload.value).toBe(1);
    });

    it('should return undefined when event type not found', () => {
      mockEvents = [{ eventType: 'event:a' }, { eventType: 'event:b' }];

      const result = ModAssertionHelpers.findEventByType(mockEvents, 'event:c');

      expect(result).toBeUndefined();
    });

    it('should throw error for invalid events parameter', () => {
      expect(() => {
        ModAssertionHelpers.findEventByType('not-an-array', 'event:a');
      }).toThrow('events must be an array');
    });

    it('should throw error for invalid eventType parameter', () => {
      expect(() => {
        ModAssertionHelpers.findEventByType([], null);
      }).toThrow('eventType must be a non-empty string');
    });
  });

  describe('findAllEventsByType', () => {
    it('should find all events of specified type', () => {
      mockEvents = [
        { eventType: 'event:a', payload: { value: 1 } },
        { eventType: 'event:b', payload: { value: 2 } },
        { eventType: 'event:a', payload: { value: 3 } },
      ];

      const results = ModAssertionHelpers.findAllEventsByType(
        mockEvents,
        'event:a'
      );

      expect(results).toHaveLength(2);
      expect(results[0].payload.value).toBe(1);
      expect(results[1].payload.value).toBe(3);
    });

    it('should return empty array when no events match', () => {
      mockEvents = [{ eventType: 'event:a' }, { eventType: 'event:b' }];

      const results = ModAssertionHelpers.findAllEventsByType(
        mockEvents,
        'event:c'
      );

      expect(results).toEqual([]);
    });

    it('should throw error for invalid parameters', () => {
      expect(() => {
        ModAssertionHelpers.findAllEventsByType(null, 'event:a');
      }).toThrow('events must be an array');
    });
  });

  describe('getEventPayload', () => {
    it('should get payload from first matching event', () => {
      mockEvents = [
        { eventType: 'event:a', payload: { value: 1 } },
        { eventType: 'event:a', payload: { value: 2 } },
      ];

      const payload = ModAssertionHelpers.getEventPayload(
        mockEvents,
        'event:a'
      );

      expect(payload).toEqual({ value: 1 });
    });

    it('should return null when event not found', () => {
      mockEvents = [{ eventType: 'event:a', payload: { value: 1 } }];

      const payload = ModAssertionHelpers.getEventPayload(
        mockEvents,
        'event:b'
      );

      expect(payload).toBeNull();
    });
  });

  describe('assertCompleteActionWorkflow', () => {
    it('should validate complete success workflow', () => {
      mockEvents = [
        {
          eventType: 'core:display_successful_action_result',
          payload: { message: 'Action complete' },
        },
        {
          eventType: 'core:perceptible_event',
          payload: { descriptionText: 'Action complete' },
        },
        {
          eventType: 'core:turn_ended',
          payload: { success: true },
        },
      ];

      mockEntity.components['test:component'] = { added: true };

      expect(() => {
        ModAssertionHelpers.assertCompleteActionWorkflow(mockEvents, {
          successMessage: 'Action complete',
          perceptibleContent: 'Action',
          componentChanges: [
            {
              entityManager: mockEntityManager,
              entityId: 'entity1',
              componentId: 'test:component',
              expectedData: { added: true },
            },
          ],
        });
      }).not.toThrow();
    });

    it('should handle error scenarios when errorExpected is true', () => {
      mockEvents = [
        {
          eventType: 'core:attempt_action',
          payload: {},
        },
      ];

      expect(() => {
        ModAssertionHelpers.assertCompleteActionWorkflow(mockEvents, {
          errorExpected: true,
        });
      }).not.toThrow();
    });

    it('should validate component removal when specified', () => {
      mockEvents = [
        {
          eventType: 'core:display_successful_action_result',
          payload: { message: 'Component removed' },
        },
        {
          eventType: 'core:turn_ended',
          payload: { success: true },
        },
      ];

      expect(() => {
        ModAssertionHelpers.assertCompleteActionWorkflow(mockEvents, {
          successMessage: 'Component removed',
          componentChanges: [
            {
              entityManager: mockEntityManager,
              entityId: 'entity1',
              componentId: 'removed:component',
              removed: true,
            },
          ],
        });
      }).not.toThrow();
    });
  });

  describe('assertEventSequence', () => {
    it('should validate events occur in correct order', () => {
      mockEvents = [
        { eventType: 'event:a' },
        { eventType: 'event:b' },
        { eventType: 'event:c' },
      ];

      const matched = ModAssertionHelpers.assertEventSequence(mockEvents, [
        'event:a',
        'event:b',
        'event:c',
      ]);

      expect(matched).toHaveLength(3);
    });

    it('should handle non-sequential but ordered events', () => {
      mockEvents = [
        { eventType: 'event:a' },
        { eventType: 'other:x' },
        { eventType: 'event:b' },
        { eventType: 'other:y' },
        { eventType: 'event:c' },
      ];

      const matched = ModAssertionHelpers.assertEventSequence(mockEvents, [
        'event:a',
        'event:b',
        'event:c',
      ]);

      expect(matched).toHaveLength(3);
    });

    it('should throw when sequence does not match', () => {
      mockEvents = [
        { eventType: 'event:a' },
        { eventType: 'event:c' },
        { eventType: 'event:b' },
      ];

      expect(() => {
        ModAssertionHelpers.assertEventSequence(mockEvents, [
          'event:a',
          'event:b',
          'event:c',
        ]);
      }).toThrow('not found in sequence');
    });

    it('should throw when event is missing', () => {
      mockEvents = [{ eventType: 'event:a' }];

      expect(() => {
        ModAssertionHelpers.assertEventSequence(mockEvents, [
          'event:a',
          'event:b',
        ]);
      }).toThrow();
    });
  });

  describe('assertClosenessRequired', () => {
    it('should validate closeness error message', () => {
      mockEvents = [
        {
          eventType: 'core:system_error_occurred',
          payload: {
            error: 'Actors must have closeness to perform this action',
          },
        },
      ];

      expect(() => {
        ModAssertionHelpers.assertClosenessRequired(mockEvents);
      }).not.toThrow();
    });

    it('should throw when error event is missing', () => {
      mockEvents = [];

      expect(() => {
        ModAssertionHelpers.assertClosenessRequired(mockEvents);
      }).toThrow();
    });

    it('should throw when error does not mention closeness', () => {
      mockEvents = [
        {
          eventType: 'core:system_error_occurred',
          payload: { error: 'Different error message' },
        },
      ];

      expect(() => {
        ModAssertionHelpers.assertClosenessRequired(mockEvents);
      }).toThrow();
    });
  });

  describe('assertIntimateActionSuccess', () => {
    it('should format and validate intimate action message', () => {
      mockEvents = [
        {
          eventType: 'core:display_successful_action_result',
          payload: { message: 'Alice kisses Bob gently' },
        },
        {
          eventType: 'core:perceptible_event',
          payload: { descriptionText: 'Alice kisses Bob gently' },
        },
        {
          eventType: 'core:turn_ended',
          payload: { success: true },
        },
      ];

      expect(() => {
        ModAssertionHelpers.assertIntimateActionSuccess(
          mockEvents,
          'Alice',
          'Bob',
          'kisses Bob gently'
        );
      }).not.toThrow();
    });
  });

  describe('assertKneelingPosition', () => {
    it('should validate kneeling position component', () => {
      mockEntity.components['deference-states:kneeling_before'] = {
        target: 'target1',
      };

      const result = ModAssertionHelpers.assertKneelingPosition(
        mockEntityManager,
        'actor1',
        'target1'
      );

      expect(result).toBeDefined();
      expect(result.target).toBe('target1');
    });

    it('should validate kneeling without target check', () => {
      mockEntity.components['deference-states:kneeling_before'] = {
        target: 'any-target',
      };

      expect(() => {
        ModAssertionHelpers.assertKneelingPosition(mockEntityManager, 'actor1');
      }).not.toThrow();
    });

    it('should throw when kneeling component is missing', () => {
      expect(() => {
        ModAssertionHelpers.assertKneelingPosition(
          mockEntityManager,
          'actor1',
          'target1'
        );
      }).toThrow();
    });
  });

  describe('assertStandingPosition', () => {
    it('should validate standing behind position component', () => {
      mockEntity.components['positioning:standing_behind'] = {
        target: 'target1',
      };

      const result = ModAssertionHelpers.assertStandingPosition(
        mockEntityManager,
        'actor1',
        'target1'
      );

      expect(result).toBeDefined();
      expect(result.target).toBe('target1');
    });

    it('should throw when standing component is missing', () => {
      expect(() => {
        ModAssertionHelpers.assertStandingPosition(
          mockEntityManager,
          'actor1',
          'target1'
        );
      }).toThrow();
    });
  });

  describe('assertMessageContains', () => {
    it('should validate message contains substring', () => {
      const event = {
        payload: { message: 'This is a test message' },
      };

      expect(() => {
        ModAssertionHelpers.assertMessageContains(event, 'test message');
      }).not.toThrow();
    });

    it('should check descriptionText if message not present', () => {
      const event = {
        payload: { descriptionText: 'This is a description' },
      };

      expect(() => {
        ModAssertionHelpers.assertMessageContains(event, 'description');
      }).not.toThrow();
    });

    it('should throw when substring not found', () => {
      const event = {
        payload: { message: 'Different content' },
      };

      expect(() => {
        ModAssertionHelpers.assertMessageContains(event, 'missing');
      }).toThrow();
    });
  });

  describe('assertMessageMatches', () => {
    it('should validate message matches regex pattern', () => {
      const event = {
        payload: { message: 'Actor123 performs action' },
      };

      expect(() => {
        ModAssertionHelpers.assertMessageMatches(event, /Actor\d+ performs/);
      }).not.toThrow();
    });

    it('should accept string pattern and convert to regex', () => {
      const event = {
        payload: { message: 'Test pattern matching' },
      };

      expect(() => {
        ModAssertionHelpers.assertMessageMatches(event, 'Test.*matching');
      }).not.toThrow();
    });

    it('should throw when pattern does not match', () => {
      const event = {
        payload: { message: 'Different content' },
      };

      expect(() => {
        ModAssertionHelpers.assertMessageMatches(event, /expected pattern/);
      }).toThrow();
    });
  });
});
