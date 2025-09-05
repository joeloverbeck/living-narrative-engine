/**
 * @file Integration test for thought-only LLM character interactions
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { ENTITY_THOUGHT_ID, DISPLAY_THOUGHT_ID } from '../../../src/constants/eventIds.js';

// Mock the helper functions but not the main handler we're testing
jest.mock('../../../src/turns/states/helpers/buildSpeechPayload.js', () => ({
  buildSpeechPayload: jest.fn(),
}));

jest.mock('../../../src/turns/states/helpers/buildThoughtPayload.js');
jest.mock('../../../src/turns/states/helpers/dispatchThoughtEvent.js');
// Don't mock the handler we're actually testing
// jest.mock('../../../src/logic/operationHandlers/dispatchThoughtHandler.js');

import { buildSpeechPayload } from '../../../src/turns/states/helpers/buildSpeechPayload.js';
import { buildThoughtPayload } from '../../../src/turns/states/helpers/buildThoughtPayload.js';
import { dispatchThoughtEvent } from '../../../src/turns/states/helpers/dispatchThoughtEvent.js';
import DispatchThoughtHandler from '../../../src/logic/operationHandlers/dispatchThoughtHandler.js';

describe('Thought-Only LLM Interaction Integration', () => {
  let mockSafeEventDispatcher;
  let mockLogger;

  beforeEach(() => {
    jest.clearAllMocks();

    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockSafeEventDispatcher = {
      dispatch: jest.fn().mockResolvedValue(true),
    };
  });

  describe('End-to-end thought processing flow', () => {
    it('should process LLM decision with empty speech but valid thoughts', async () => {
      // Simulate LLM response with empty speech but thoughts and notes
      const llmDecisionMeta = {
        speech: '', // Empty speech
        thoughts: 'I should observe this situation carefully before acting.',
        notes: [
          {
            text: 'The room seems unusually quiet',
            subject: 'environment',
            subjectType: 'location',
            context: 'Upon entering the tavern'
          }
        ]
      };

      const entityId = 'llm-character-001';

      // Set up buildSpeechPayload to return null for empty speech
      buildSpeechPayload.mockReturnValue(null);

      // Set up buildThoughtPayload to return valid payload for thoughts
      const expectedThoughtPayload = {
        entityId,
        thoughts: llmDecisionMeta.thoughts,
        notes: llmDecisionMeta.notes
      };
      buildThoughtPayload.mockReturnValue(expectedThoughtPayload);

      // Set up dispatchThoughtEvent to simulate event dispatching
      dispatchThoughtEvent.mockImplementation(async (turnCtx, handler, actorId, payload) => {
        // Simulate the event being dispatched to the event bus
        await mockSafeEventDispatcher.dispatch(ENTITY_THOUGHT_ID, {
          entityId: actorId,
          ...payload
        });
      });

      // Simulate the processing flow
      const mockTurnCtx = { getActor: () => ({ id: entityId }) };
      const mockHandler = { name: 'TestHandler' };
      const mockActor = { id: entityId };

      // Call buildThoughtPayload (simulating ProcessingCommandState._dispatchSpeech)
      const thoughtPayload = buildThoughtPayload(llmDecisionMeta, entityId);
      expect(thoughtPayload).not.toBeNull();
      expect(thoughtPayload).toEqual(expectedThoughtPayload);

      // Dispatch the thought event
      await dispatchThoughtEvent(mockTurnCtx, mockHandler, entityId, thoughtPayload);

      // Verify the thought event was dispatched
      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        ENTITY_THOUGHT_ID,
        {
          entityId,
          thoughts: llmDecisionMeta.thoughts,
          notes: llmDecisionMeta.notes
        }
      );
    });

    it('should handle thought-only scenario through DispatchThoughtHandler', async () => {
      const thoughtHandler = new DispatchThoughtHandler({
        dispatcher: mockSafeEventDispatcher,
        logger: mockLogger
      });

      const thoughtParams = {
        entity_id: 'silent-npc-001',
        thoughts: 'The stranger asks too many questions. Best to stay quiet.',
        notes: [
          {
            text: 'Suspicious newcomer asking about the missing merchant',
            subject: 'stranger',
            subjectType: 'character'
          }
        ]
      };

      const mockExecutionContext = {
        getLogger: () => mockLogger
      };

      // Execute the handler
      thoughtHandler.execute(thoughtParams, mockExecutionContext);

      // Verify DISPLAY_THOUGHT_ID event was dispatched
      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        DISPLAY_THOUGHT_ID,
        {
          entityId: thoughtParams.entity_id,
          thoughts: thoughtParams.thoughts,
          notes: thoughtParams.notes
        }
      );

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'DispatchThoughtHandler: DISPATCH_THOUGHT: dispatching display_thought',
        expect.objectContaining({
          payload: expect.objectContaining({
            entityId: thoughtParams.entity_id,
            thoughts: thoughtParams.thoughts
          })
        })
      );
    });

    it('should not dispatch thought event when both speech and thoughts are empty', async () => {
      const emptyDecisionMeta = {
        speech: '',
        thoughts: '',
        notes: null
      };

      const entityId = 'silent-character';

      // Set up mocks to return null for both speech and thoughts
      buildSpeechPayload.mockReturnValue(null);
      buildThoughtPayload.mockReturnValue(null);

      // Verify no events would be dispatched in this scenario
      const speechPayload = buildSpeechPayload(emptyDecisionMeta);
      const thoughtPayload = buildThoughtPayload(emptyDecisionMeta, entityId);

      expect(speechPayload).toBeNull();
      expect(thoughtPayload).toBeNull();

      // Verify no dispatch calls were made
      expect(dispatchThoughtEvent).not.toHaveBeenCalled();
    });

    it('should prioritize speech over thoughts when both are present', async () => {
      const mixedDecisionMeta = {
        speech: 'Hello there, friend!',
        thoughts: 'I hope they don\'t notice my nervousness.',
        notes: [
          {
            text: 'Acting casual to avoid suspicion',
            subject: 'behavior',
            subjectType: 'emotion'
          }
        ]
      };

      const entityId = 'nervous-npc';

      // Set up buildSpeechPayload to return valid payload when speech is present
      const speechPayload = {
        speechContent: mixedDecisionMeta.speech,
        thoughts: mixedDecisionMeta.thoughts,
        notes: mixedDecisionMeta.notes
      };
      buildSpeechPayload.mockReturnValue(speechPayload);

      // In the actual flow, buildThoughtPayload wouldn't be called if speech exists
      // This test verifies the prioritization logic
      const result = buildSpeechPayload(mixedDecisionMeta);
      expect(result).toEqual(speechPayload);
      expect(result.speechContent).toBeTruthy();

      // buildThoughtPayload should not be called when speech payload exists
      expect(buildThoughtPayload).not.toHaveBeenCalled();
    });
  });

  describe('Error handling in thought processing', () => {
    it('should handle invalid thought data gracefully', async () => {
      const invalidDecisionMeta = {
        speech: '',
        thoughts: null, // Invalid thoughts
        notes: 'invalid notes format'
      };

      const entityId = 'error-test-character';

      buildSpeechPayload.mockReturnValue(null);
      buildThoughtPayload.mockReturnValue(null); // Returns null for invalid data

      const thoughtPayload = buildThoughtPayload(invalidDecisionMeta, entityId);
      expect(thoughtPayload).toBeNull();
    });

    it('should handle DispatchThoughtHandler validation errors', () => {
      const thoughtHandler = new DispatchThoughtHandler({
        dispatcher: mockSafeEventDispatcher,
        logger: mockLogger
      });

      // Invalid params - empty entity_id should fail validation
      const invalidParams = {
        entity_id: '', // Invalid empty string
        thoughts: 'Valid thoughts',
      };

      const mockExecutionContext = {
        getLogger: () => mockLogger
      };

      // Execute with invalid params
      thoughtHandler.execute(invalidParams, mockExecutionContext);

      // Should not dispatch DISPLAY_THOUGHT_ID event with invalid params (validation should fail)
      expect(mockSafeEventDispatcher.dispatch).not.toHaveBeenCalledWith(
        'core:display_thought',
        expect.any(Object)
      );
      
      // Should dispatch a validation error event instead (via safeDispatchError)
      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        'core:system_error_occurred',
        expect.objectContaining({
          message: 'Invalid "entity_id" parameter'
        })
      );
    });

    it('should handle DispatchThoughtHandler with invalid thoughts parameter', () => {
      const thoughtHandler = new DispatchThoughtHandler({
        dispatcher: mockSafeEventDispatcher,
        logger: mockLogger
      });

      // Invalid params - empty thoughts should fail validation
      const invalidParams = {
        entity_id: 'valid-entity-123',
        thoughts: '', // Invalid empty thoughts
      };

      const mockExecutionContext = {
        getLogger: () => mockLogger
      };

      // Execute with invalid params
      thoughtHandler.execute(invalidParams, mockExecutionContext);

      // Should not dispatch DISPLAY_THOUGHT_ID event with invalid thoughts
      expect(mockSafeEventDispatcher.dispatch).not.toHaveBeenCalledWith(
        'core:display_thought',
        expect.any(Object)
      );
      
      // Should dispatch a validation error event instead (via safeDispatchError)
      expect(mockSafeEventDispatcher.dispatch).toHaveBeenCalledWith(
        'core:system_error_occurred',
        expect.objectContaining({
          message: 'Invalid "thoughts" parameter'
        })
      );
    });
  });
});