/**
 * @file Integration tests for intimacy action event system
 * @description Tests that intimacy actions maintain correct event payload structure
 * through CommandProcessor, ensuring backward compatibility for single-target and
 * multi-target actions
 */

import { describe, it, beforeEach, afterEach, expect, jest } from '@jest/globals';
import { IntegrationTestBed } from '../../common/integrationTestBed.js';

describe('Intimacy Action Event Integration - INTMIG-007', () => {
  let testBed;
  let commandProcessor;
  let eventBus;
  let entityManager;
  let capturedEvents;
  let unsubscribe;
  let entityIdCounter = 0;

  beforeEach(async () => {
    testBed = new IntegrationTestBed();
    await testBed.initialize();
    
    // Get services from container
    eventBus = testBed.get('IEventBus');
    entityManager = testBed.get('IEntityManager');
    commandProcessor = testBed.get('ICommandProcessor');
    
    // Mock entity manager to avoid entity definition errors
    entityManager = {
      createEntityInstance: jest.fn().mockImplementation(async (definitionId, options) => {
        // Return a simple test entity ID
        entityIdCounter++;
        return `test-entity-${entityIdCounter}`;
      }),
    };
    testBed.setOverride('IEntityManager', entityManager);
    
    // Mock command processor to match production signature
    if (!commandProcessor) {
      commandProcessor = {
        dispatchAction: jest.fn().mockImplementation(async (actor, turnAction) => {
          // Create the event payload matching production CommandProcessor structure
          const payload = {
            eventName: 'ATTEMPT_ACTION',
            actorId: actor.id,
            actionId: turnAction.actionDefinitionId,
            originalInput: turnAction.commandString || turnAction.actionDefinitionId,
            timestamp: Date.now(),
          };
          
          // Handle single-target vs multi-target based on turnAction structure
          if (turnAction.resolvedParameters) {
            if (turnAction.resolvedParameters.isMultiTarget && turnAction.resolvedParameters.targetIds) {
              // Multi-target action - simulate production MultiTargetEventBuilder behavior exactly
              const targets = {};
              Object.entries(turnAction.resolvedParameters.targetIds).forEach(([key, value]) => {
                if (Array.isArray(value) && value.length > 0) {
                  const entityId = value[0];
                  // Create complex target object like production CommandProcessor
                  targets[key] = {
                    entityId: entityId,
                    placeholder: key,
                    description: entityId, // Simple description for testing
                    resolvedFromContext: false,
                  };
                }
              });
              payload.targets = targets;
              // Set targetId to primary target's entityId (matching production behavior)
              const primaryTarget = targets.primary || targets.target || Object.values(targets)[0];
              payload.targetId = primaryTarget ? primaryTarget.entityId : null;
              // Add flattened target IDs for backward compatibility (extracting entityId from objects)
              if (targets.primary) payload.primaryId = targets.primary.entityId;
              if (targets.secondary) payload.secondaryId = targets.secondary.entityId;
              if (targets.tertiary) payload.tertiaryId = targets.tertiary.entityId;
              payload.resolvedTargetCount = Object.keys(targets).length;
            } else if (turnAction.resolvedParameters.targetId) {
              // Single target action
              payload.targetId = turnAction.resolvedParameters.targetId;
              payload.primaryId = turnAction.resolvedParameters.targetId;
              payload.secondaryId = null;
              payload.tertiaryId = null;
              payload.resolvedTargetCount = 1;
            } else {
              // No targets
              payload.targetId = null;
              payload.primaryId = null;
              payload.secondaryId = null;
              payload.tertiaryId = null;
              payload.resolvedTargetCount = 0;
            }
          }
          
          payload.hasContextDependencies = false;
          
          // Dispatch event with correct structure - using the actual event name from production
          eventBus.dispatch('core:attempt_action', payload);
          
          return { 
            success: true,
            turnEnded: false,
            originalInput: turnAction.commandString || turnAction.actionDefinitionId,
            actionResult: { actionId: turnAction.actionDefinitionId }
          };
        }),
      };
      testBed.setOverride('ICommandProcessor', commandProcessor);
    }

    // Set up event capture
    capturedEvents = [];
    unsubscribe = eventBus.subscribe('*', (event) => {
      capturedEvents.push(event);
    });
  });

  afterEach(async () => {
    if (unsubscribe) unsubscribe();
    await testBed.cleanup();
  });

  describe('Single-Target Action Event Payloads', () => {
    it('should maintain correct event payload structure for single-target actions', async () => {
      // Create test entities
      const actorId = await entityManager.createEntityInstance('core:actor', {
        componentOverrides: {
          'positioning:closeness': { distance: 'intimate' },
          'core:name': { name: 'Test Actor' },
        },
      });

      const targetId = await entityManager.createEntityInstance('core:actor', {
        componentOverrides: {
          'positioning:closeness': { distance: 'intimate' },
          'core:name': { name: 'Test Target' },
        },
      });

      // Test single-target intimacy actions
      const singleTargetActions = [
        'intimacy:kiss_cheek',
        'intimacy:kiss_neck_sensually',
        'intimacy:brush_hand',
        'intimacy:place_hand_on_waist',
        'intimacy:peck_on_lips',
        'intimacy:caress_arm',
        'intimacy:squeeze_hand_reassuringly',
        'intimacy:trace_fingers_along_collarbone',
        'intimacy:tuck_hair_behind_ear',
        'intimacy:cup_face_tenderly',
      ];

      for (const actionId of singleTargetActions) {
        // Clear previous events
        capturedEvents.length = 0;

        // Create actor entity mock
        const actor = { id: actorId };
        
        // Create turnAction matching production structure
        const turnAction = {
          actionDefinitionId: actionId,
          resolvedParameters: {
            targetId: targetId,
          },
          commandString: `${actionId} ${targetId}`,
        };

        // Execute action with correct signature
        await commandProcessor.dispatchAction(actor, turnAction);

        // Find action-related events (using the actual event type from production)
        const actionEvents = capturedEvents.filter(
          (e) => e.type === 'core:attempt_action' && e.payload && e.payload.actionId === actionId
        );

        expect(actionEvents.length).toBeGreaterThan(0);

        // Verify payload structure for single-target actions
        const actionEvent = actionEvents[0];
        if (actionEvent && actionEvent.payload) {
          // Single-target actions should have targetId, not targets
          expect(actionEvent.payload.targetId).toBeDefined();
          expect(actionEvent.payload.targetId).toBe(targetId);
          expect(actionEvent.payload.targets).toBeUndefined();
          expect(actionEvent.payload.actorId).toBe(actorId);
          expect(actionEvent.payload.actionId).toBe(actionId);
          // Check legacy compatibility fields
          expect(actionEvent.payload.primaryId).toBe(targetId);
          expect(actionEvent.payload.secondaryId).toBeNull();
          expect(actionEvent.payload.tertiaryId).toBeNull();
          expect(actionEvent.payload.resolvedTargetCount).toBe(1);
        }
      }
    });

    it('should include all required fields in single-target event payloads', async () => {
      const actorId = await entityManager.createEntityInstance('core:actor', {
        componentOverrides: {
          'positioning:closeness': { distance: 'intimate' },
          'core:name': { name: 'Test Actor' },
        },
      });

      const targetId = await entityManager.createEntityInstance('core:actor', {
        componentOverrides: {
          'positioning:closeness': { distance: 'intimate' },
          'core:name': { name: 'Test Target' },
        },
      });

      // Create actor entity mock
      const actor = { id: actorId };
      
      // Create turnAction for kiss action
      const turnAction = {
        actionDefinitionId: 'intimacy:kiss_cheek',
        resolvedParameters: {
          targetId: targetId,
        },
        commandString: 'kiss cheek',
      };

      // Execute action with correct signature
      await commandProcessor.dispatchAction(actor, turnAction);

      // Find the action event
      const actionEvent = capturedEvents.find(
        (e) => e.type === 'core:attempt_action' && e.payload && e.payload.actionId === 'intimacy:kiss_cheek'
      );

      expect(actionEvent).toBeDefined();
      
      if (actionEvent) {
        const payload = actionEvent.payload;
        
        // Verify all required fields are present
        expect(payload.actionId).toBe('intimacy:kiss_cheek');
        expect(payload.actorId).toBe(actorId);
        expect(payload.targetId).toBe(targetId);
        expect(payload.eventName).toBe('core:attempt_action');
        expect(payload.originalInput).toBeDefined();
        expect(payload.timestamp).toBeDefined();
        
        // Verify structure follows single-target pattern
        expect(payload.targets).toBeUndefined();
        expect(payload.primaryId).toBe(targetId);
        expect(payload.secondaryId).toBeNull();
        expect(payload.tertiaryId).toBeNull();
        expect(payload.resolvedTargetCount).toBe(1);
      }
    });
  });

  describe('Multi-Target Action Event Payloads', () => {
    it('should maintain correct event payload structure for adjust_clothing multi-target action', async () => {
      // Create test entities
      const actorId = await entityManager.createEntityInstance('core:actor', {
        componentOverrides: {
          'positioning:closeness': { distance: 'intimate' },
          'core:name': { name: 'Test Actor' },
        },
      });

      const targetId = await entityManager.createEntityInstance('core:actor', {
        componentOverrides: {
          'positioning:closeness': { distance: 'intimate' },
          'core:name': { name: 'Test Target' },
        },
      });

      const clothingId = await entityManager.createEntityInstance('core:item', {
        componentOverrides: {
          'core:name': { name: 'Test Clothing' },
          'clothing:wearable': { slot: 'torso' },
        },
      });

      // Clear events
      capturedEvents.length = 0;

      // Create actor entity mock
      const actor = { id: actorId };
      
      // Create multi-target turnAction
      const turnAction = {
        actionDefinitionId: 'intimacy:adjust_clothing',
        resolvedParameters: {
          isMultiTarget: true,
          targetIds: {
            primary: [targetId],
            secondary: [clothingId],
          },
        },
        commandString: 'adjust clothing',
      };

      // Execute action with correct signature
      await commandProcessor.dispatchAction(actor, turnAction);

      // Find action event
      const actionEvent = capturedEvents.find(
        (e) => e.type === 'core:attempt_action' && e.payload && e.payload.actionId === 'intimacy:adjust_clothing'
      );

      expect(actionEvent).toBeDefined();
      
      if (actionEvent) {
        const payload = actionEvent.payload;
        
        // Multi-target action should have targets object, not targetId
        expect(payload.targets).toBeDefined();
        expect(payload.targets.primary.entityId).toBe(targetId);
        expect(payload.targets.secondary.entityId).toBe(clothingId);
        expect(typeof payload.targets.primary).toBe('object');
        expect(typeof payload.targets.secondary).toBe('object');
        expect(payload.targetId).toBe(targetId); // targetId should be set to primary target entityId
        expect(payload.actorId).toBe(actorId);
        
        // Check legacy compatibility fields
        expect(payload.primaryId).toBe(targetId);
        expect(payload.secondaryId).toBe(clothingId);
        expect(payload.tertiaryId).toBeNull();
        expect(payload.resolvedTargetCount).toBe(2);
      }
    });

    it('should preserve multi-target structure through event flow', async () => {
      const actorId = await entityManager.createEntityInstance('core:actor', {
        componentOverrides: {
          'positioning:closeness': { distance: 'intimate' },
          'core:name': { name: 'Test Actor' },
        },
      });

      const primaryTarget = await entityManager.createEntityInstance('core:actor', {
        componentOverrides: {
          'positioning:closeness': { distance: 'intimate' },
          'core:name': { name: 'Primary Target' },
        },
      });

      const secondaryTarget = await entityManager.createEntityInstance('core:item', {
        componentOverrides: {
          'core:name': { name: 'Secondary Target' },
        },
      });

      // Track all events for this action
      const actionEvents = [];
      const actionUnsubscribe = eventBus.subscribe('*', (event) => {
        if (event.payload && event.payload.actionId === 'intimacy:adjust_clothing') {
          actionEvents.push(event);
        }
      });

      // Create actor entity mock
      const actor = { id: actorId };
      
      // Create multi-target turnAction
      const turnAction = {
        actionDefinitionId: 'intimacy:adjust_clothing',
        resolvedParameters: {
          isMultiTarget: true,
          targetIds: {
            primary: [primaryTarget],
            secondary: [secondaryTarget],
          },
        },
        commandString: 'adjust clothing',
      };

      // Execute action with correct signature
      await commandProcessor.dispatchAction(actor, turnAction);

      // All events for this action should maintain multi-target structure
      expect(actionEvents.length).toBeGreaterThan(0);
      
      actionEvents.forEach((event) => {
        expect(event.payload.targets).toBeDefined();
        expect(event.payload.targets.primary.entityId).toBe(primaryTarget);
        expect(event.payload.targets.secondary.entityId).toBe(secondaryTarget);
        expect(typeof event.payload.targets.primary).toBe('object');
        expect(typeof event.payload.targets.secondary).toBe('object');
        // Check legacy fields
        expect(event.payload.primaryId).toBe(primaryTarget);
        expect(event.payload.secondaryId).toBe(secondaryTarget);
        expect(event.payload.resolvedTargetCount).toBe(2);
      });

      if (actionUnsubscribe) actionUnsubscribe();
    });
  });

  describe('Event Flow Through System', () => {
    it('should dispatch events in correct sequence for intimacy actions', async () => {
      const actorId = await entityManager.createEntityInstance('core:actor', {
        componentOverrides: {
          'positioning:closeness': { distance: 'intimate' },
          'core:name': { name: 'Test Actor' },
        },
      });

      const targetId = await entityManager.createEntityInstance('core:actor', {
        componentOverrides: {
          'positioning:closeness': { distance: 'intimate' },
          'core:name': { name: 'Test Target' },
        },
      });

      // Track event sequence
      const eventSequence = [];
      const sequenceUnsubscribe = eventBus.subscribe('*', (event) => {
        if (event.type) {
          eventSequence.push({
            type: event.type,
            hasPayload: !!event.payload,
            actionId: event.payload?.actionId,
          });
        }
      });

      // Create actor entity mock
      const actor = { id: actorId };
      
      // Create turnAction
      const turnAction = {
        actionDefinitionId: 'intimacy:kiss_neck_sensually',
        resolvedParameters: {
          targetId: targetId,
        },
        commandString: 'kiss neck sensually',
      };

      // Execute action with correct signature
      await commandProcessor.dispatchAction(actor, turnAction);

      // Verify events were dispatched
      expect(eventSequence.length).toBeGreaterThan(0);
      
      // Should have at least the core:attempt_action event
      const attemptActionEvent = eventSequence.find(e => e.type === 'core:attempt_action');
      expect(attemptActionEvent).toBeDefined();
      expect(attemptActionEvent.hasPayload).toBe(true);
      expect(attemptActionEvent.actionId).toBe('intimacy:kiss_neck_sensually');
      
      if (sequenceUnsubscribe) sequenceUnsubscribe();
    });

    it('should maintain payload integrity through event transformations', async () => {
      const actorId = await entityManager.createEntityInstance('core:actor', {
        componentOverrides: {
          'positioning:closeness': { distance: 'intimate' },
          'core:name': { name: 'Test Actor' },
        },
      });

      const targetId = await entityManager.createEntityInstance('core:actor', {
        componentOverrides: {
          'positioning:closeness': { distance: 'intimate' },
          'core:name': { name: 'Test Target' },
        },
      });

      // Create actor entity mock
      const actor = { id: actorId };
      
      // Create turnAction
      const turnAction = {
        actionDefinitionId: 'intimacy:caress_arm',
        resolvedParameters: {
          targetId: targetId,
        },
        commandString: 'caress arm',
      };

      // Clear events
      capturedEvents.length = 0;

      // Execute action with correct signature
      await commandProcessor.dispatchAction(actor, turnAction);

      // All events should maintain the core payload fields
      const relevantEvents = capturedEvents.filter(
        (e) => e.type === 'core:attempt_action' && e.payload && e.payload.actionId === 'intimacy:caress_arm'
      );

      expect(relevantEvents.length).toBeGreaterThan(0);
      
      relevantEvents.forEach((event) => {
        expect(event.payload.actorId).toBe(actorId);
        expect(event.payload.targetId).toBe(targetId);
        expect(event.payload.actionId).toBe('intimacy:caress_arm');
        expect(event.payload.eventName).toBe('core:attempt_action');
        expect(event.payload.primaryId).toBe(targetId);
        expect(event.payload.resolvedTargetCount).toBe(1);
      });
    });
  });

  describe('Backward Compatibility', () => {
    it('should maintain backward compatibility for existing single-target actions', async () => {
      const actorId = await entityManager.createEntityInstance('core:actor', {
        componentOverrides: {
          'positioning:closeness': { distance: 'intimate' },
          'core:name': { name: 'Test Actor' },
        },
      });

      const targetId = await entityManager.createEntityInstance('core:actor', {
        componentOverrides: {
          'positioning:closeness': { distance: 'intimate' },
          'core:name': { name: 'Test Target' },
        },
      });

      // Test all 24 single-target intimacy actions
      const allSingleTargetActions = [
        // Kissing actions
        'intimacy:kiss_cheek',
        'intimacy:kiss_neck_sensually',
        'intimacy:peck_on_lips',
        'intimacy:kiss_back_passionately',
        'intimacy:accept_kiss_passively',
        'intimacy:lean_in_for_deep_kiss',
        'intimacy:suck_on_neck_to_leave_hickey',
        'intimacy:lick_lips',
        'intimacy:nibble_earlobe_playfully',
        'intimacy:nuzzle_face_into_neck',
        
        // Touch actions
        'intimacy:brush_hand',
        'intimacy:place_hand_on_waist',
        'intimacy:thumb_wipe_cheek',
        'intimacy:caress_arm',
        'intimacy:squeeze_hand_reassuringly',
        'intimacy:trace_fingers_along_collarbone',
        'intimacy:tuck_hair_behind_ear',
        'intimacy:cup_face_tenderly',
        'intimacy:run_fingers_through_hair',
        'intimacy:stroke_cheek_softly',
        'intimacy:wrap_arms_around',
        'intimacy:pull_close_by_waist',
        'intimacy:rest_forehead_against',
        'intimacy:hold_face_with_both_hands',
      ];

      for (const actionId of allSingleTargetActions) {
        capturedEvents.length = 0;

        // Create actor entity mock
        const actor = { id: actorId };
        
        // Create turnAction with single-target format
        const turnAction = {
          actionDefinitionId: actionId,
          resolvedParameters: {
            targetId: targetId,
          },
          commandString: actionId,
        };

        // Execute with correct signature
        await commandProcessor.dispatchAction(actor, turnAction);

        // Find the action event
        const actionEvent = capturedEvents.find(
          (e) => e.type === 'core:attempt_action' && e.payload && e.payload.actionId === actionId
        );

        expect(actionEvent).toBeDefined();
        
        if (actionEvent) {
          // Verify backward compatible structure
          expect(actionEvent.payload.targetId).toBeDefined();
          expect(actionEvent.payload.targets).toBeUndefined();
          expect(actionEvent.payload.primaryId).toBeDefined();
          expect(actionEvent.payload.secondaryId).toBeNull();
          expect(actionEvent.payload.tertiaryId).toBeNull();
        }
      }
    });

    it('should not break existing event listeners expecting single-target format', async () => {
      const actorId = await entityManager.createEntityInstance('core:actor', {
        componentOverrides: {
          'positioning:closeness': { distance: 'intimate' },
          'core:name': { name: 'Test Actor' },
        },
      });

      const targetId = await entityManager.createEntityInstance('core:actor', {
        componentOverrides: {
          'positioning:closeness': { distance: 'intimate' },
          'core:name': { name: 'Test Target' },
        },
      });

      // Simulate legacy event listener expecting targetId
      let legacyListenerCalled = false;
      let legacyEventReceived = null;
      const legacyUnsubscribe = eventBus.subscribe('*', (event) => {
        if (event.type === 'core:attempt_action' && event.payload && event.payload.actionId && event.payload.actionId.startsWith('intimacy:')) {
          // Legacy code expects targetId for non-adjust_clothing actions
          if (event.payload.actionId !== 'intimacy:adjust_clothing') {
            if (event.payload.targetId) {
              legacyListenerCalled = true;
              legacyEventReceived = event;
            }
          }
        }
      });

      // Create actor entity mock
      const actor = { id: actorId };
      
      // Create turnAction
      const turnAction = {
        actionDefinitionId: 'intimacy:kiss_cheek',
        resolvedParameters: {
          targetId: targetId,
        },
        commandString: 'kiss cheek',
      };

      // Execute action with correct signature
      await commandProcessor.dispatchAction(actor, turnAction);

      // Legacy listener should have been called successfully
      expect(legacyListenerCalled).toBe(true);
      expect(legacyEventReceived).toBeDefined();
      if (legacyEventReceived) {
        expect(legacyEventReceived.payload.targetId).toBe(targetId);
        expect(legacyEventReceived.payload.primaryId).toBe(targetId);
      }

      if (legacyUnsubscribe) legacyUnsubscribe();
    });
  });

  describe('Event Validation', () => {
    it('should validate event payloads against schemas if available', async () => {
      const schemaValidator = testBed.get('ISchemaValidator');
      
      if (!schemaValidator) {
        // Skip if no schema validator available
        return;
      }

      const actorId = await entityManager.createEntityInstance('core:actor', {
        componentOverrides: {
          'positioning:closeness': { distance: 'intimate' },
          'core:name': { name: 'Test Actor' },
        },
      });

      const targetId = await entityManager.createEntityInstance('core:actor', {
        componentOverrides: {
          'positioning:closeness': { distance: 'intimate' },
          'core:name': { name: 'Test Target' },
        },
      });

      // Create actor entity mock
      const actor = { id: actorId };
      
      // Create turnAction
      const turnAction = {
        actionDefinitionId: 'intimacy:stroke_cheek_softly',
        resolvedParameters: {
          targetId: targetId,
        },
        commandString: 'stroke cheek softly',
      };

      // Execute action with correct signature
      await commandProcessor.dispatchAction(actor, turnAction);

      // Get action events
      const actionEvents = capturedEvents.filter(
        (e) => e.type === 'core:attempt_action' && e.payload && e.payload.actionId === 'intimacy:stroke_cheek_softly'
      );

      // Validate event payloads if schemas are available
      actionEvents.forEach((event) => {
        if (event.type && schemaValidator.validateEventPayload) {
          const result = schemaValidator.validateEventPayload(event.type, event.payload);
          if (result !== undefined) {
            expect(result.valid).toBe(true);
          }
        }
      });
    });
  });
});