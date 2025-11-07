import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { createTestBed } from '../../common/testBed.js';
import { ActionIndexValidationError } from '../../../src/errors/actionIndexValidationError.js';
import { assertValidActionIndex } from '../../../src/utils/actionIndexUtils.js';
import { AIFallbackActionFactory } from '../../../src/turns/services/AIFallbackActionFactory.js';
import { GenericTurnStrategy } from '../../../src/turns/strategies/genericTurnStrategy.js';

describe('ActionIndexValidationError - End-to-End Flow Integration', () => {
  let testBed;
  let mockLogger;
  let mockDispatcher;

  beforeEach(() => {
    testBed = createTestBed();
    mockLogger = testBed.createMockLogger();
    mockDispatcher = testBed.createMock('dispatcher', ['dispatch']);
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('Validation Layer', () => {
    it('should throw ActionIndexValidationError with preserved LLM data', async () => {
      const llmData = {
        index: 10,
        speech: 'Perhaps I should reconsider my approach...',
        thoughts: 'The merchant seems trustworthy.',
        notes: [{ type: 'observation', content: 'merchant_suspicious' }],
      };

      const debugData = { result: llmData };

      await expect(
        assertValidActionIndex(10, 5, 'LLMChooser', 'actor-1', mockDispatcher, mockLogger, debugData)
      ).rejects.toMatchObject({
        llmData: {
          speech: 'Perhaps I should reconsider my approach...',
          thoughts: 'The merchant seems trustworthy.',
          notes: [{ type: 'observation', content: 'merchant_suspicious' }],
        },
      });
    });

    it('should preserve data through the entire validation flow', async () => {
      const llmData = {
        index: 8,
        speech: 'I will pause to consider the situation.',
        thoughts: 'Something feels off about this place.',
        notes: [
          { type: 'memory', content: 'entered_suspicious_location' },
          { type: 'emotion', content: 'cautious' },
        ],
      };

      const debugData = { result: llmData };

      await expect(
        assertValidActionIndex(8, 3, 'LLMChooser', 'actor-test', mockDispatcher, mockLogger, debugData)
      ).rejects.toMatchObject({
        llmData: {
          speech: 'I will pause to consider the situation.',
          thoughts: 'Something feels off about this place.',
          notes: [
            { type: 'memory', content: 'entered_suspicious_location' },
            { type: 'emotion', content: 'cautious' },
          ],
        },
        index: 8,
        actionsLength: 3,
        code: 'ACTION_INDEX_VALIDATION_ERROR',
      });
    });
  });

  describe('Fallback Factory Integration', () => {
    let fallbackFactory;

    beforeEach(() => {
      fallbackFactory = new AIFallbackActionFactory({ logger: mockLogger });
    });

    it('should use preserved speech when creating fallback action', () => {
      const error = new ActionIndexValidationError('Invalid index', {
        index: 10,
        actionsLength: 5,
        speech: 'Let me reconsider my options...',
      });

      const preservedData = error.llmData;
      const fallbackAction = fallbackFactory.create(
        error.name,
        error,
        'actor-1',
        preservedData
      );

      expect(fallbackAction.speech).toBe('Let me reconsider my options...');
      expect(fallbackAction.actionDefinitionId).toBe('core:wait');
      expect(fallbackAction.resolvedParameters.isFallback).toBe(true);
      expect(fallbackAction.resolvedParameters.diagnostics.preservedDataUsed).toBe(true);
    });

    it('should generate generic message when no preserved speech available', () => {
      const error = new ActionIndexValidationError('Invalid index', {
        index: 10,
        actionsLength: 5,
      });

      const preservedData = error.llmData;
      const fallbackAction = fallbackFactory.create(
        error.name,
        error,
        'actor-1',
        preservedData
      );

      expect(fallbackAction.speech).toContain('unexpected issue');
      expect(fallbackAction.speech).toContain('wait for a moment');
      expect(fallbackAction.resolvedParameters.diagnostics.preservedDataUsed).toBe(false);
    });

    it('should preserve all LLM data types in fallback', () => {
      const error = new ActionIndexValidationError('Invalid index', {
        index: 7,
        actionsLength: 4,
        speech: 'Character dialogue',
        thoughts: 'Character thoughts',
        notes: [{ key: 'value' }],
      });

      const preservedData = error.llmData;
      const fallbackAction = fallbackFactory.create(
        error.name,
        error,
        'actor-1',
        preservedData
      );

      expect(fallbackAction.speech).toBe('Character dialogue');
      expect(preservedData.thoughts).toBe('Character thoughts');
      expect(preservedData.notes).toEqual([{ key: 'value' }]);
    });
  });

  describe('GenericTurnStrategy Integration', () => {
    it('should extract and use preserved data in catch block', async () => {
      const mockChoicePipeline = {
        buildChoices: jest.fn().mockResolvedValue([
          { actionDefinitionId: 'core:wait' },
          { actionDefinitionId: 'core:look' },
        ]),
      };

      const mockDecisionProvider = {
        decide: jest.fn().mockRejectedValue(
          new ActionIndexValidationError('Invalid index', {
            index: 5,
            actionsLength: 2,
            speech: 'I need a moment to think.',
            thoughts: 'This is confusing.',
            notes: [{ type: 'state', value: 'confused' }],
          })
        ),
      };

      const mockTurnActionFactory = {
        create: jest.fn().mockReturnValue({
          actionDefinitionId: 'core:wait',
          speech: 'fallback',
        }),
      };

      const fallbackFactory = new AIFallbackActionFactory({ logger: mockLogger });

      const strategy = new GenericTurnStrategy({
        choicePipeline: mockChoicePipeline,
        decisionProvider: mockDecisionProvider,
        turnActionFactory: mockTurnActionFactory,
        logger: mockLogger,
        fallbackFactory,
      });

      const mockContext = {
        getActor: jest.fn().mockReturnValue({ id: 'actor-1' }),
        getPromptSignal: jest.fn().mockReturnValue(null),
      };

      const result = await strategy.decideAction(mockContext);

      expect(result.kind).toBe('fallback');
      expect(result.extractedData.speech).toBe('I need a moment to think.');
      expect(result.extractedData.thoughts).toBe('This is confusing.');
      expect(result.extractedData.notes).toEqual([{ type: 'state', value: 'confused' }]);
      expect(result.action.speech).toBe('I need a moment to think.');
    });

    it('should fallback to generic message when no preserved data', async () => {
      const mockChoicePipeline = {
        buildChoices: jest.fn().mockResolvedValue([
          { actionDefinitionId: 'core:wait' },
        ]),
      };

      const mockDecisionProvider = {
        decide: jest.fn().mockRejectedValue(
          new ActionIndexValidationError('Invalid index', {
            index: 5,
            actionsLength: 1,
          })
        ),
      };

      const mockTurnActionFactory = {
        create: jest.fn().mockReturnValue({
          actionDefinitionId: 'core:wait',
          speech: 'fallback',
        }),
      };

      const fallbackFactory = new AIFallbackActionFactory({ logger: mockLogger });

      const strategy = new GenericTurnStrategy({
        choicePipeline: mockChoicePipeline,
        decisionProvider: mockDecisionProvider,
        turnActionFactory: mockTurnActionFactory,
        logger: mockLogger,
        fallbackFactory,
      });

      const mockContext = {
        getActor: jest.fn().mockReturnValue({ id: 'actor-1' }),
        getPromptSignal: jest.fn().mockReturnValue(null),
      };

      const result = await strategy.decideAction(mockContext);

      expect(result.kind).toBe('fallback');
      expect(result.extractedData.speech).toContain('unexpected issue');
      expect(result.extractedData.thoughts).toBeNull();
      expect(result.extractedData.notes).toBeNull();
    });
  });

  describe('Backward Compatibility', () => {
    it('should handle standard Error without llmData property', async () => {
      const mockChoicePipeline = {
        buildChoices: jest.fn().mockResolvedValue([
          { actionDefinitionId: 'core:wait' },
        ]),
      };

      const mockDecisionProvider = {
        decide: jest.fn().mockRejectedValue(new Error('Generic error')),
      };

      const mockTurnActionFactory = {
        create: jest.fn().mockReturnValue({
          actionDefinitionId: 'core:wait',
          speech: 'fallback',
        }),
      };

      const fallbackFactory = new AIFallbackActionFactory({ logger: mockLogger });

      const strategy = new GenericTurnStrategy({
        choicePipeline: mockChoicePipeline,
        decisionProvider: mockDecisionProvider,
        turnActionFactory: mockTurnActionFactory,
        logger: mockLogger,
        fallbackFactory,
      });

      const mockContext = {
        getActor: jest.fn().mockReturnValue({ id: 'actor-1' }),
        getPromptSignal: jest.fn().mockReturnValue(null),
      };

      const result = await strategy.decideAction(mockContext);

      expect(result.kind).toBe('fallback');
      expect(result.extractedData.speech).toContain('unexpected issue');
      expect(result.extractedData.thoughts).toBeNull();
      expect(result.extractedData.notes).toBeNull();
    });
  });

  describe('Complete End-to-End Scenario', () => {
    it('should preserve character voice through entire error flow', async () => {
      // 1. Simulate validation error with LLM data
      const llmData = {
        index: 15,
        speech: '"Perhaps I should take a moment to assess the situation more carefully," I muse thoughtfully.',
        thoughts: 'The merchant\'s nervous demeanor suggests there might be more to this than meets the eye.',
        notes: [
          { type: 'observation', npcId: 'merchant_bob', content: 'acting_suspicious' },
          { type: 'emotion', content: 'curious' },
          { type: 'memory', content: 'merchant_encounter_suspicious' },
        ],
      };

      const debugData = { result: llmData };

      let caughtError;
      try {
        await assertValidActionIndex(15, 8, 'LLMChooser', 'protagonist', mockDispatcher, mockLogger, debugData);
      } catch (err) {
        caughtError = err;
      }

      expect(caughtError).toBeInstanceOf(ActionIndexValidationError);

      // 2. Verify error preserved all data
      expect(caughtError.hasPreservedData()).toBe(true);
      expect(caughtError.getPreservedSpeech()).toBe(llmData.speech);
      expect(caughtError.getPreservedThoughts()).toBe(llmData.thoughts);
      expect(caughtError.getPreservedNotes()).toEqual(llmData.notes);

      // 3. Create fallback action with preserved data
      const fallbackFactory = new AIFallbackActionFactory({ logger: mockLogger });
      const fallbackAction = fallbackFactory.create(
        caughtError.name,
        caughtError,
        'protagonist',
        caughtError.llmData
      );

      // 4. Verify character voice is maintained
      expect(fallbackAction.speech).toBe(llmData.speech);
      expect(fallbackAction.actionDefinitionId).toBe('core:wait');
      expect(fallbackAction.resolvedParameters.isFallback).toBe(true);

      // 5. Verify metadata structure for turn result
      const meta = {
        speech: caughtError.llmData.speech || fallbackAction.speech,
        thoughts: caughtError.llmData.thoughts || null,
        notes: caughtError.llmData.notes || null,
      };

      expect(meta.speech).toBe(llmData.speech);
      expect(meta.thoughts).toBe(llmData.thoughts);
      expect(meta.notes).toEqual(llmData.notes);

      // 6. Verify no generic error message appears
      expect(meta.speech).not.toContain('unexpected issue');
      expect(meta.speech).not.toContain('communication issue');
    });
  });
});
