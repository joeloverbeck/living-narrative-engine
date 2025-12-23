/**
 * @file Deep validation tests for ModAssertionHelpers
 * @description TSTAIMIG-002: Comprehensive validation of event validation, component validation, and assertion methods
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ModAssertionHelpers } from '../../common/mods/ModAssertionHelpers.js';
import { SimpleEntityManager } from '../../common/entities/index.js';

describe('ModAssertionHelpers - Deep Validation (TSTAIMIG-002)', () => {
  let mockEntityManager;
  let sampleEvents;

  beforeEach(() => {
    // Create realistic entity manager with test data
    mockEntityManager = new SimpleEntityManager([
      {
        id: 'test-actor',
        components: {
          'core:name': { text: 'Test Actor' },
          'core:position': { locationId: 'test-room' },
          'core:actor': {},
        },
      },
      {
        id: 'test-target',
        components: {
          'core:name': { text: 'Test Target' },
          'core:position': { locationId: 'test-room' },
          'personal-space-states:closeness': { partners: ['test-actor'] },
        },
      },
    ]);

    // Sample events for testing
    sampleEvents = [
      {
        eventType: 'core:attempt_action',
        payload: {
          actorId: 'test-actor',
          actionId: 'test:action',
          targetId: 'test-target',
        },
      },
      {
        eventType: 'core:perceptible_event',
        payload: {
          descriptionText: 'Actor performs test action on Target',
          locationId: 'test-room',
          actorId: 'test-actor',
          targetId: 'test-target',
          perceptionType: 'physical.target_action',
          involvedEntities: [],
        },
      },
      {
        eventType: 'core:display_successful_action_result',
        payload: {
          message: 'Actor performs test action on Target',
        },
      },
      {
        eventType: 'core:turn_ended',
        payload: {
          success: true,
        },
      },
    ];
  });

  describe('Event Validation Methods', () => {
    describe('assertActionSuccess method', () => {
      it('should exist and validate action success events correctly', () => {
        expect(typeof ModAssertionHelpers.assertActionSuccess).toBe('function');

        // Should not throw for valid success events
        expect(() => {
          ModAssertionHelpers.assertActionSuccess(
            sampleEvents,
            'Actor performs test action on Target'
          );
        }).not.toThrow();
      });

      it('should support shouldEndTurn option correctly', () => {
        const eventsWithoutTurnEnd = sampleEvents.filter(
          (e) => e.eventType !== 'core:turn_ended'
        );

        // Should fail when expecting turn end but not present
        expect(() => {
          ModAssertionHelpers.assertActionSuccess(
            eventsWithoutTurnEnd,
            'Actor performs test action on Target',
            { shouldEndTurn: true }
          );
        }).toThrow();

        // Should pass when not expecting turn end
        expect(() => {
          ModAssertionHelpers.assertActionSuccess(
            eventsWithoutTurnEnd,
            'Actor performs test action on Target',
            { shouldEndTurn: false }
          );
        }).not.toThrow();
      });

      it('should support shouldHavePerceptibleEvent option correctly', () => {
        const eventsWithoutPerceptible = sampleEvents.filter(
          (e) => e.eventType !== 'core:perceptible_event'
        );

        // Should fail when expecting perceptible event but not present
        expect(() => {
          ModAssertionHelpers.assertActionSuccess(
            eventsWithoutPerceptible,
            'Actor performs test action on Target',
            { shouldHavePerceptibleEvent: true }
          );
        }).toThrow();

        // Should pass when not expecting perceptible event
        expect(() => {
          ModAssertionHelpers.assertActionSuccess(
            eventsWithoutPerceptible,
            'Actor performs test action on Target',
            { shouldHavePerceptibleEvent: false }
          );
        }).not.toThrow();
      });

      it('should provide clear error messages on assertion failures', () => {
        const invalidEvents = [
          {
            eventType: 'core:attempt_action',
            payload: { actionId: 'test:action' },
          },
        ];

        expect(() => {
          ModAssertionHelpers.assertActionSuccess(
            invalidEvents,
            'Expected message'
          );
        }).toThrow();
      });

      it('should validate input parameters correctly', () => {
        // Non-array events
        expect(() => {
          ModAssertionHelpers.assertActionSuccess(null, 'message');
        }).toThrow('events must be an array');

        expect(() => {
          ModAssertionHelpers.assertActionSuccess('invalid', 'message');
        }).toThrow('events must be an array');

        // Empty events array
        expect(() => {
          ModAssertionHelpers.assertActionSuccess([], 'message');
        }).toThrow('events array cannot be empty');
      });

      it('should validate message matching correctly', () => {
        const wrongMessageEvents = [...sampleEvents];
        wrongMessageEvents[2].payload.message = 'Wrong message';

        expect(() => {
          ModAssertionHelpers.assertActionSuccess(
            wrongMessageEvents,
            'Expected message'
          );
        }).toThrow();
      });
    });

    describe('assertPerceptibleEvent method', () => {
      it('should properly validate perceptible event properties', () => {
        const expectedEvent = {
          descriptionText: 'Actor performs test action on Target',
          locationId: 'test-room',
          actorId: 'test-actor',
          targetId: 'test-target',
          perceptionType: 'physical.target_action',
        };

        expect(() => {
          ModAssertionHelpers.assertPerceptibleEvent(
            sampleEvents,
            expectedEvent
          );
        }).not.toThrow();
      });

      it('should validate input parameters', () => {
        // Invalid events parameter
        expect(() => {
          ModAssertionHelpers.assertPerceptibleEvent(null, {});
        }).toThrow('events must be an array');

        // Invalid expectedEvent parameter
        expect(() => {
          ModAssertionHelpers.assertPerceptibleEvent(sampleEvents, null);
        }).toThrow('expectedEvent must be an object');

        expect(() => {
          ModAssertionHelpers.assertPerceptibleEvent(sampleEvents, 'invalid');
        }).toThrow('expectedEvent must be an object');
      });

      it('should handle optional properties correctly', () => {
        const minimalExpectedEvent = {
          descriptionText: 'Actor performs test action on Target',
          locationId: 'test-room',
          actorId: 'test-actor',
        };

        // Should work without targetId and perceptionType
        expect(() => {
          ModAssertionHelpers.assertPerceptibleEvent(
            sampleEvents,
            minimalExpectedEvent
          );
        }).not.toThrow();
      });

      it('should default perceptionType when not specified', () => {
        const eventsWithoutPerceptionType = [...sampleEvents];
        delete eventsWithoutPerceptionType[1].payload.perceptionType;

        const expectedEvent = {
          descriptionText: 'Actor performs test action on Target',
          locationId: 'test-room',
          actorId: 'test-actor',
        };

        // The assertion should add the default perceptionType expectation
        expect(() => {
          ModAssertionHelpers.assertPerceptibleEvent(
            eventsWithoutPerceptionType,
            expectedEvent
          );
        }).toThrow(); // Should fail because default expectation is not met
      });
    });
  });

  describe('Component Validation Methods', () => {
    describe('assertComponentAdded method', () => {
      it('should exist and require entityManager parameter as documented', () => {
        expect(typeof ModAssertionHelpers.assertComponentAdded).toBe(
          'function'
        );

        // Add a test component to the entity
        mockEntityManager.addComponent('test-actor', 'test:component', {
          value: 'test',
        });

        expect(() => {
          ModAssertionHelpers.assertComponentAdded(
            mockEntityManager,
            'test-actor',
            'test:component',
            { value: 'test' }
          );
        }).not.toThrow();
      });

      it('should validate entityManager parameter correctly', () => {
        // Missing entityManager
        expect(() => {
          ModAssertionHelpers.assertComponentAdded(
            null,
            'test-actor',
            'test:component'
          );
        }).toThrow(
          'entityManager must be provided with getEntityInstance method'
        );

        // Invalid entityManager without required method
        expect(() => {
          ModAssertionHelpers.assertComponentAdded(
            {},
            'test-actor',
            'test:component'
          );
        }).toThrow(
          'entityManager must be provided with getEntityInstance method'
        );
      });

      it('should validate component addition correctly', () => {
        // Add component to entity
        mockEntityManager.addComponent('test-actor', 'test:added_component', {
          value: 'added',
          timestamp: Date.now(),
        });

        // Should validate component exists
        expect(() => {
          ModAssertionHelpers.assertComponentAdded(
            mockEntityManager,
            'test-actor',
            'test:added_component'
          );
        }).not.toThrow();

        // Should validate component data matches
        expect(() => {
          ModAssertionHelpers.assertComponentAdded(
            mockEntityManager,
            'test-actor',
            'test:added_component',
            { value: 'added' }
          );
        }).not.toThrow();
      });

      it('should support partial data matching', () => {
        mockEntityManager.addComponent('test-actor', 'test:partial', {
          value: 'test',
          extra: 'data',
          nested: { deep: 'value' },
        });

        // Should match partial data
        expect(() => {
          ModAssertionHelpers.assertComponentAdded(
            mockEntityManager,
            'test-actor',
            'test:partial',
            { value: 'test' }
          );
        }).not.toThrow();

        // Should match nested partial data
        expect(() => {
          ModAssertionHelpers.assertComponentAdded(
            mockEntityManager,
            'test-actor',
            'test:partial',
            { nested: { deep: 'value' } }
          );
        }).not.toThrow();
      });

      it('should validate input parameters', () => {
        // Invalid entityId
        expect(() => {
          ModAssertionHelpers.assertComponentAdded(
            mockEntityManager,
            '',
            'test:component'
          );
        }).toThrow('entityId must be a non-empty string');

        expect(() => {
          ModAssertionHelpers.assertComponentAdded(
            mockEntityManager,
            null,
            'test:component'
          );
        }).toThrow('entityId must be a non-empty string');

        // Invalid componentId
        expect(() => {
          ModAssertionHelpers.assertComponentAdded(
            mockEntityManager,
            'test-actor',
            ''
          );
        }).toThrow('componentId must be a non-empty string');

        expect(() => {
          ModAssertionHelpers.assertComponentAdded(
            mockEntityManager,
            'test-actor',
            null
          );
        }).toThrow('componentId must be a non-empty string');
      });
    });

    describe('assertComponentRemoved method', () => {
      it('should validate component removal correctly', () => {
        // Initially add a component
        mockEntityManager.addComponent('test-actor', 'test:removable', {
          value: 'test',
        });

        // Verify it exists
        expect(() => {
          ModAssertionHelpers.assertComponentAdded(
            mockEntityManager,
            'test-actor',
            'test:removable'
          );
        }).not.toThrow();

        // Remove the component
        mockEntityManager.removeComponent('test-actor', 'test:removable');

        // Verify it's removed
        expect(() => {
          ModAssertionHelpers.assertComponentRemoved(
            mockEntityManager,
            'test-actor',
            'test:removable'
          );
        }).not.toThrow();
      });

      it('should validate input parameters', () => {
        // Invalid parameters should throw
        expect(() => {
          ModAssertionHelpers.assertComponentRemoved(
            null,
            'test-actor',
            'test:component'
          );
        }).toThrow(
          'entityManager must be provided with getEntityInstance method'
        );

        expect(() => {
          ModAssertionHelpers.assertComponentRemoved(
            mockEntityManager,
            '',
            'test:component'
          );
        }).toThrow('entityId must be a non-empty string');

        expect(() => {
          ModAssertionHelpers.assertComponentRemoved(
            mockEntityManager,
            'test-actor',
            ''
          );
        }).toThrow('componentId must be a non-empty string');
      });
    });
  });

  describe('Event Pattern Validation', () => {
    describe('Event sequence validation', () => {
      it('should validate event sequences correctly', () => {
        expect(() => {
          ModAssertionHelpers.assertStandardEventSequence(sampleEvents);
        }).not.toThrow();

        // Should validate custom sequence
        expect(() => {
          ModAssertionHelpers.assertStandardEventSequence(sampleEvents, [
            'core:attempt_action',
            'core:perceptible_event',
          ]);
        }).not.toThrow();
      });

      it('should support assertEventSequence for order validation', () => {
        const sequencedEvents = ModAssertionHelpers.assertEventSequence(
          sampleEvents,
          [
            'core:attempt_action',
            'core:perceptible_event',
            'core:display_successful_action_result',
          ]
        );

        expect(sequencedEvents).toHaveLength(3);
        expect(sequencedEvents[0].eventType).toBe('core:attempt_action');
        expect(sequencedEvents[1].eventType).toBe('core:perceptible_event');
        expect(sequencedEvents[2].eventType).toBe(
          'core:display_successful_action_result'
        );
      });
    });

    describe('Custom event matching', () => {
      it('should provide findEventByType utility', () => {
        const event = ModAssertionHelpers.findEventByType(
          sampleEvents,
          'core:perceptible_event'
        );

        expect(event).toBeDefined();
        expect(event.eventType).toBe('core:perceptible_event');

        // Should return undefined for non-existent events
        const missing = ModAssertionHelpers.findEventByType(
          sampleEvents,
          'nonexistent:event'
        );
        expect(missing).toBeUndefined();
      });

      it('should provide findAllEventsByType utility', () => {
        const duplicatedEvents = [
          ...sampleEvents,
          {
            eventType: 'core:perceptible_event',
            payload: { descriptionText: 'Second perceptible event' },
          },
        ];

        const perceptibleEvents = ModAssertionHelpers.findAllEventsByType(
          duplicatedEvents,
          'core:perceptible_event'
        );

        expect(perceptibleEvents).toHaveLength(2);
      });

      it('should provide getEventPayload utility', () => {
        const payload = ModAssertionHelpers.getEventPayload(
          sampleEvents,
          'core:attempt_action'
        );

        expect(payload).toBeDefined();
        expect(payload.actorId).toBe('test-actor');
        expect(payload.actionId).toBe('test:action');

        // Should return null for non-existent events
        const missing = ModAssertionHelpers.getEventPayload(
          sampleEvents,
          'nonexistent:event'
        );
        expect(missing).toBeNull();
      });

      it('should validate event utility input parameters', () => {
        expect(() => {
          ModAssertionHelpers.findEventByType(null, 'test:event');
        }).toThrow('events must be an array');

        expect(() => {
          ModAssertionHelpers.findEventByType(sampleEvents, '');
        }).toThrow('eventType must be a non-empty string');
      });
    });

    describe('Comprehensive assertion failures', () => {
      it('should provide assertCompleteActionWorkflow for complex validations', () => {
        const workflow = {
          successMessage: 'Actor performs test action on Target',
          perceptibleContent: 'Actor performs test action',
          componentChanges: [],
          errorExpected: false,
        };

        expect(() => {
          ModAssertionHelpers.assertCompleteActionWorkflow(
            sampleEvents,
            workflow
          );
        }).not.toThrow();
      });

      it('should handle error-expected workflows', () => {
        const errorWorkflow = {
          errorExpected: true,
        };

        const errorEvents = [
          {
            eventType: 'core:attempt_action',
            payload: { actorId: 'test-actor' },
          },
        ];

        expect(() => {
          ModAssertionHelpers.assertCompleteActionWorkflow(
            errorEvents,
            errorWorkflow
          );
        }).not.toThrow();
      });

      it('should validate component changes in workflow', () => {
        mockEntityManager.addComponent(
          'test-actor',
          'test:workflow_component',
          { value: 'test' }
        );

        const workflow = {
          componentChanges: [
            {
              entityManager: mockEntityManager,
              entityId: 'test-actor',
              componentId: 'test:workflow_component',
              expectedData: { value: 'test' },
              removed: false,
            },
          ],
        };

        expect(() => {
          ModAssertionHelpers.assertCompleteActionWorkflow(
            sampleEvents,
            workflow
          );
        }).not.toThrow();
      });
    });
  });

  describe('Specialized Assertion Methods', () => {
    describe('Body and anatomy assertions', () => {
      it('should validate body structure correctly', () => {
        mockEntityManager.addComponent('test-target', 'anatomy:body', {
          body: { root: 'torso1' },
        });

        expect(() => {
          ModAssertionHelpers.assertBodyStructure(
            mockEntityManager,
            'test-target',
            'torso1'
          );
        }).not.toThrow();

        // Should fail for wrong root part
        expect(() => {
          ModAssertionHelpers.assertBodyStructure(
            mockEntityManager,
            'test-target',
            'wrong-part'
          );
        }).toThrow();
      });

      it('should validate body part relationships correctly', () => {
        mockEntityManager.addComponent('torso1', 'anatomy:part', {
          parent: null,
          children: ['arm1', 'arm2'],
          subType: 'torso',
        });

        const expectedStructure = {
          parent: null,
          children: ['arm1', 'arm2'],
          subType: 'torso',
        };

        expect(() => {
          ModAssertionHelpers.assertBodyPart(
            mockEntityManager,
            'torso1',
            expectedStructure
          );
        }).not.toThrow();
      });
    });

    describe('Positioning assertions', () => {
      it('should validate mutual closeness correctly', () => {
        mockEntityManager.addComponent('test-actor', 'personal-space-states:closeness', {
          partners: ['test-target'],
        });

        expect(() => {
          ModAssertionHelpers.assertMutualCloseness(
            mockEntityManager,
            'test-actor',
            'test-target'
          );
        }).not.toThrow();
      });

      it('should validate kneeling position correctly', () => {
        mockEntityManager.addComponent(
          'test-actor',
          'deference-states:kneeling_before',
          {
            target: 'test-target',
          }
        );

        const kneelingComponent = ModAssertionHelpers.assertKneelingPosition(
          mockEntityManager,
          'test-actor',
          'test-target'
        );

        expect(kneelingComponent).toBeDefined();
        expect(kneelingComponent.target).toBe('test-target');
      });

      it('should validate standing position correctly', () => {
        mockEntityManager.addComponent(
          'test-actor',
          'positioning:standing_behind',
          {
            target: 'test-target',
          }
        );

        const standingComponent = ModAssertionHelpers.assertStandingPosition(
          mockEntityManager,
          'test-actor',
          'test-target'
        );

        expect(standingComponent).toBeDefined();
        expect(standingComponent.target).toBe('test-target');
      });
    });

    describe('Message pattern validation', () => {
      it('should validate message content contains expected substring', () => {
        const event = {
          payload: {
            message: 'Actor performs a complex test action on Target',
          },
        };

        expect(() => {
          ModAssertionHelpers.assertMessageContains(event, 'test action');
        }).not.toThrow();

        expect(() => {
          ModAssertionHelpers.assertMessageContains(event, 'nonexistent');
        }).toThrow();
      });

      it('should validate message matches regex pattern', () => {
        const event = {
          payload: {
            descriptionText: 'Actor performs action_123 successfully',
          },
        };

        expect(() => {
          ModAssertionHelpers.assertMessageMatches(event, /action_\d+/);
        }).not.toThrow();

        expect(() => {
          ModAssertionHelpers.assertMessageMatches(event, 'action_\\d+');
        }).not.toThrow();

        expect(() => {
          ModAssertionHelpers.assertMessageMatches(event, /nonmatch/);
        }).toThrow();
      });
    });

    describe('Intimate action validation', () => {
      it('should validate intimate actions with proper message formatting', () => {
        expect(() => {
          ModAssertionHelpers.assertIntimateActionSuccess(
            sampleEvents,
            'Actor',
            'Target',
            'performs test action on'
          );
        }).not.toThrow();

        // Should handle action descriptions that already include target
        expect(() => {
          ModAssertionHelpers.assertIntimateActionSuccess(
            sampleEvents,
            'Actor',
            'Target',
            'performs test action on Target'
          );
        }).not.toThrow();
      });
    });
  });

  describe('Integration with Jest Expect Patterns', () => {
    it('should work seamlessly with Jest expectations', () => {
      // All assertion helpers should integrate with Jest's expect
      expect(() => {
        ModAssertionHelpers.assertActionSuccess(
          sampleEvents,
          'Actor performs test action on Target'
        );
      }).not.toThrow();

      // Should throw Jest assertion errors that can be caught
      expect(() => {
        ModAssertionHelpers.assertActionSuccess([], 'message');
      }).toThrow();
    });

    it('should provide meaningful error messages for Jest', () => {
      try {
        ModAssertionHelpers.assertActionSuccess(
          [{ eventType: 'wrong:event' }],
          'message'
        );
        fail('Should have thrown');
      } catch (error) {
        // Should be a Jest assertion error with meaningful message
        expect(error.message).toBeDefined();
      }
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle empty event arrays gracefully where appropriate', () => {
      // Some methods should handle empty arrays
      expect(() => {
        ModAssertionHelpers.assertOnlyExpectedEvents([], []);
      }).not.toThrow();

      expect(() => {
        ModAssertionHelpers.assertEventCounts([], {});
      }).not.toThrow();
    });

    it('should handle malformed events gracefully', () => {
      const malformedEvents = [
        { eventType: 'test:event' }, // Missing payload
        { payload: { data: 'test' } }, // Missing eventType
      ];

      // Should not crash but may fail assertions appropriately
      expect(() => {
        ModAssertionHelpers.findEventByType(malformedEvents, 'test:event');
      }).not.toThrow();
    });

    it('should validate entity existence before component assertions', () => {
      expect(() => {
        ModAssertionHelpers.assertComponentAdded(
          mockEntityManager,
          'nonexistent-entity',
          'test:component'
        );
      }).toThrow();
    });

    it('should handle null/undefined event payloads', () => {
      const eventsWithNullPayload = [
        { eventType: 'test:event', payload: null },
      ];

      expect(() => {
        ModAssertionHelpers.getEventPayload(
          eventsWithNullPayload,
          'test:event'
        );
      }).not.toThrow();

      const payload = ModAssertionHelpers.getEventPayload(
        eventsWithNullPayload,
        'test:event'
      );
      expect(payload).toBeNull();
    });
  });
});
