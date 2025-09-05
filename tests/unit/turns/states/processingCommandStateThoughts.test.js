/**
 * @file Tests for ProcessingCommandState thought handling
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { ProcessingCommandState } from '../../../../src/turns/states/processingCommandState.js';
import { ENTITY_SPOKE_ID, ENTITY_THOUGHT_ID } from '../../../../src/constants/eventIds.js';

// Mock the helper functions
jest.mock('../../../../src/turns/states/helpers/buildSpeechPayload.js', () => ({
  buildSpeechPayload: jest.fn(),
}));

jest.mock('../../../../src/turns/states/helpers/buildThoughtPayload.js', () => ({
  buildThoughtPayload: jest.fn(),
}));

jest.mock('../../../../src/turns/states/helpers/dispatchSpeechEvent.js', () => ({
  dispatchSpeechEvent: jest.fn(),
}));

jest.mock('../../../../src/turns/states/helpers/dispatchThoughtEvent.js', () => ({
  dispatchThoughtEvent: jest.fn(),
}));

jest.mock('../../../../src/turns/states/helpers/contextUtils.js', () => ({
  getLogger: jest.fn(),
}));

import { buildSpeechPayload } from '../../../../src/turns/states/helpers/buildSpeechPayload.js';
import { buildThoughtPayload } from '../../../../src/turns/states/helpers/buildThoughtPayload.js';
import { dispatchSpeechEvent } from '../../../../src/turns/states/helpers/dispatchSpeechEvent.js';
import { dispatchThoughtEvent } from '../../../../src/turns/states/helpers/dispatchThoughtEvent.js';
import { getLogger } from '../../../../src/turns/states/helpers/contextUtils.js';

describe('ProcessingCommandState - Thought Handling', () => {
  let state;
  let mockTurnCtx;
  let mockActor;
  let mockLogger;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    getLogger.mockReturnValue(mockLogger);

    mockActor = {
      id: 'test-actor-123',
    };

    mockTurnCtx = {
      getActor: jest.fn().mockReturnValue(mockActor),
    };

    // Create a minimal state instance for testing
    state = Object.create(ProcessingCommandState.prototype);
    state._handler = { name: 'TestHandler' };
    state.getStateName = jest.fn().mockReturnValue('ProcessingCommandState');
  });

  describe('_dispatchSpeech method', () => {
    it('should dispatch speech event when payload is available', async () => {
      const decisionMeta = { speech: 'Hello there!', thoughts: 'Nice to meet them.' };
      const speechPayload = { speechContent: 'Hello there!' };

      buildSpeechPayload.mockReturnValue(speechPayload);
      dispatchSpeechEvent.mockResolvedValue();

      await state._dispatchSpeech(mockTurnCtx, mockActor, decisionMeta);

      expect(buildSpeechPayload).toHaveBeenCalledWith(decisionMeta);
      expect(dispatchSpeechEvent).toHaveBeenCalledWith(
        mockTurnCtx, 
        state._handler, 
        mockActor.id, 
        speechPayload
      );
      expect(buildThoughtPayload).not.toHaveBeenCalled();
      expect(dispatchThoughtEvent).not.toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(`Actor ${mockActor.id} spoke: "Hello there!". Dispatching ${ENTITY_SPOKE_ID}`)
      );
    });

    it('should dispatch thought event when speech payload is null but thoughts exist', async () => {
      const decisionMeta = { speech: '', thoughts: 'I should stay quiet...' };
      const thoughtPayload = { entityId: mockActor.id, thoughts: 'I should stay quiet...' };

      buildSpeechPayload.mockReturnValue(null);
      buildThoughtPayload.mockReturnValue(thoughtPayload);
      dispatchThoughtEvent.mockResolvedValue();

      await state._dispatchSpeech(mockTurnCtx, mockActor, decisionMeta);

      expect(buildSpeechPayload).toHaveBeenCalledWith(decisionMeta);
      expect(buildThoughtPayload).toHaveBeenCalledWith(decisionMeta, mockActor.id);
      expect(dispatchThoughtEvent).toHaveBeenCalledWith(
        mockTurnCtx, 
        state._handler, 
        mockActor.id, 
        thoughtPayload
      );
      expect(dispatchSpeechEvent).not.toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(`Actor ${mockActor.id} had thoughts but no speech. Dispatching ${ENTITY_THOUGHT_ID}`)
      );
    });

    it('should dispatch thought event with notes when available', async () => {
      const decisionMeta = { 
        speech: '', 
        thoughts: 'Interesting...',
        notes: [{ text: 'Something suspicious', subject: 'observation', subjectType: 'event' }]
      };
      const thoughtPayload = { 
        entityId: mockActor.id, 
        thoughts: 'Interesting...',
        notes: [{ text: 'Something suspicious', subject: 'observation', subjectType: 'event' }]
      };

      buildSpeechPayload.mockReturnValue(null);
      buildThoughtPayload.mockReturnValue(thoughtPayload);
      dispatchThoughtEvent.mockResolvedValue();

      await state._dispatchSpeech(mockTurnCtx, mockActor, decisionMeta);

      expect(buildThoughtPayload).toHaveBeenCalledWith(decisionMeta, mockActor.id);
      expect(dispatchThoughtEvent).toHaveBeenCalledWith(
        mockTurnCtx, 
        state._handler, 
        mockActor.id, 
        thoughtPayload
      );
    });

    it('should log debug when speech is empty string and no thoughts', async () => {
      const decisionMeta = { speech: '', thoughts: '' };

      buildSpeechPayload.mockReturnValue(null);
      buildThoughtPayload.mockReturnValue(null);

      await state._dispatchSpeech(mockTurnCtx, mockActor, decisionMeta);

      expect(buildSpeechPayload).toHaveBeenCalledWith(decisionMeta);
      expect(buildThoughtPayload).toHaveBeenCalledWith(decisionMeta, mockActor.id);
      expect(dispatchSpeechEvent).not.toHaveBeenCalled();
      expect(dispatchThoughtEvent).not.toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(`Actor ${mockActor.id} had a non-string or empty speech field in decisionMeta. No ${ENTITY_SPOKE_ID} or ${ENTITY_THOUGHT_ID} event dispatched`)
      );
    });

    it('should log debug when no speech or thoughts fields', async () => {
      const decisionMeta = {};

      buildSpeechPayload.mockReturnValue(null);
      buildThoughtPayload.mockReturnValue(null);

      await state._dispatchSpeech(mockTurnCtx, mockActor, decisionMeta);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(`Actor ${mockActor.id} has no 'speech' or 'thoughts' fields in decisionMeta. No events dispatched`)
      );
    });

    it('should handle null decisionMeta gracefully', async () => {
      buildSpeechPayload.mockReturnValue(null);
      buildThoughtPayload.mockReturnValue(null);

      await state._dispatchSpeech(mockTurnCtx, mockActor, null);

      expect(buildSpeechPayload).toHaveBeenCalledWith(null);
      expect(buildThoughtPayload).toHaveBeenCalledWith(null, mockActor.id);
      expect(dispatchSpeechEvent).not.toHaveBeenCalled();
      expect(dispatchThoughtEvent).not.toHaveBeenCalled();
    });
  });
});