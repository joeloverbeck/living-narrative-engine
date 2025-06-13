/**
 * @file Test suite that handles the proper behavior of the extracted data.
 * @see tests/turns/orchestration/aiDecisionOrchestrator.extractedData.test.js
 */

/**
 * @file This test suite verifies the functionality of the AIDecisionOrchestrator,
 * focusing on its role in orchestrating AI turn decisions. It includes a specific
 * test for TKT-012 to ensure that the `extractedData` returned by the orchestrator
 * is always normalized, containing non-undefined keys for `speech`, `thoughts`, and `notes`.
 */

import { describe, beforeEach, test, expect, jest } from '@jest/globals';
import { mock, mockDeep } from 'jest-mock-extended';

// Class to be tested
import { AIDecisionOrchestrator } from '../../../src/turns/orchestration/aiDecisionOrchestrator.js';

// Errors
import {
  InvalidIndexError,
  NoActionsDiscoveredError,
} from '../../../src/turns/errors';

// Type Imports
/** @typedef {import('../../../../src/entities/entity.js').default} Entity */
/** @typedef {import('../../../../src/turns/interfaces/ITurnContext.js').ITurnContext} ITurnContext */
/** @typedef {import('../../../../src/interfaces/IActionDiscoveryService.js').IActionDiscoveryService} IActionDiscoveryService */
/** @typedef {import('../../../../src/turns/ports/IActionIndexer.js').IActionIndexer} IActionIndexer */
/** @typedef {import('../../../../src/turns/ports/ILLMChooser.js').ILLMChooser} ILLMChooser */
/** @typedef {import('../../../../src/turns/ports/ITurnActionFactory.js').ITurnActionFactory} ITurnActionFactory */
/** @typedef {import('../../../../src/turns/interfaces/IAIFallbackActionFactory.js').IAIFallbackActionFactory} IAIFallbackActionFactory */
/** @typedef {import('../../../../src/interfaces/coreServices.js').ILogger} ILogger */

describe('AIDecisionOrchestrator', () => {
  // Mocks for all dependencies
  /** @type {IActionDiscoveryService} */
  let mockDiscoverySvc;
  /** @type {IActionIndexer} */
  let mockIndexer;
  /** @type {ILLMChooser} */
  let mockLlmChooser;
  /** @type {ITurnActionFactory} */
  let mockTurnActionFactory;
  /** @type {IAIFallbackActionFactory} */
  let mockFallbackFactory;
  /** @type {ILogger} */
  let mockLogger;

  /** @type {AIDecisionOrchestrator} */
  let orchestrator;

  /** @type {Entity} */
  let mockActor;
  /** @type {ITurnContext} */
  let mockContext;

  beforeEach(() => {
    // ARRANGE
    mockDiscoverySvc = mockDeep();
    mockIndexer = mockDeep();
    mockLlmChooser = mockDeep();
    mockTurnActionFactory = mockDeep();
    mockFallbackFactory = mockDeep();
    mockLogger = mockDeep();

    orchestrator = new AIDecisionOrchestrator({
      discoverySvc: mockDiscoverySvc,
      indexer: mockIndexer,
      llmChooser: mockLlmChooser,
      turnActionFactory: mockTurnActionFactory,
      fallbackFactory: mockFallbackFactory,
      logger: mockLogger,
    });

    mockActor = mockDeep();
    mockActor.id = 'npc1';

    mockContext = mockDeep();
    // A mock AbortSignal is required for the llmChooser call
    const mockAbortController = new AbortController();
    mockContext.getPromptSignal.mockReturnValue(mockAbortController.signal);
  });

  describe('TKT-012: Normalise extractedData keys', () => {
    test('should return speech, thoughts, and notes as null if omitted by LLM', async () => {
      // ARRANGE
      // Mock previous steps to return valid data
      mockDiscoverySvc.getValidActions.mockResolvedValue([{ action: 'wait' }]);
      const indexedActions = [{ id: 'core:wait', description: 'Wait.' }];
      mockIndexer.index.mockReturnValue(indexedActions);

      // Mock the LLM chooser to return a partial payload as per the ticket
      // It omits `thoughts` and `notes`, and `speech` is explicitly null.
      mockLlmChooser.choose.mockResolvedValue({ index: 1, speech: null });

      // Mock the action factory to return a dummy action
      mockTurnActionFactory.create.mockReturnValue({
        actionDefinitionId: 'core:wait',
        resolvedParameters: {},
      });

      // ACT
      const result = await orchestrator.decide({
        actor: mockActor,
        context: mockContext,
      });

      // ASSERT
      expect(result.kind).toBe('success');
      expect(result.extractedData).toBeDefined();
      expect(result.extractedData).toEqual({
        speech: null,
        thoughts: null,
        notes: null,
      });
    });

    test('should return a complete extractedData object even if some keys are provided', async () => {
      // ARRANGE
      mockDiscoverySvc.getValidActions.mockResolvedValue([{ action: 'speak' }]);
      const indexedActions = [{ id: 'core:speak', description: 'Speak.' }];
      mockIndexer.index.mockReturnValue(indexedActions);
      mockLlmChooser.choose.mockResolvedValue({
        index: 1,
        speech: 'Hello world',
        notes: ['Note 1'],
        // `thoughts` is omitted
      });
      mockTurnActionFactory.create.mockReturnValue({
        actionDefinitionId: 'core:speak',
        resolvedParameters: {},
      });

      // ACT
      const result = await orchestrator.decide({
        actor: mockActor,
        context: mockContext,
      });

      // ASSERT
      expect(result.extractedData).toEqual({
        speech: 'Hello world',
        thoughts: null,
        notes: ['Note 1'],
      });
    });

    test('decideOrFallback should return normalized keys on fallback', async () => {
      // ARRANGE
      // Force an error to trigger the fallback path
      const error = new NoActionsDiscoveredError(mockActor.id);
      mockDiscoverySvc.getValidActions.mockRejectedValue(error);

      // Mock the fallback factory
      const mockFallbackAction = {
        actionDefinitionId: 'core:wait',
        speech: 'I will wait.', // The fallback action itself provides speech
      };
      mockFallbackFactory.create.mockReturnValue(mockFallbackAction);

      // ACT
      const result = await orchestrator.decideOrFallback({
        actor: mockActor,
        context: mockContext,
      });

      // ASSERT
      expect(result.kind).toBe('fallback');
      expect(result.action).toBe(mockFallbackAction);
      expect(result.extractedData).toEqual({
        speech: 'I will wait.', // Speech from the fallback action
        thoughts: null,
        notes: null,
      });
    });
  });
});
