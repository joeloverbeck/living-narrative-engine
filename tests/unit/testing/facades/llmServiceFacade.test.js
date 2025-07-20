/**
 * @file Unit tests for the LLMServiceFacade class.
 * @description Tests the LLM service facade that simplifies AI decision making
 * for testing by wrapping multiple LLM-related services.
 */

import {
  describe,
  beforeEach,
  afterEach,
  test,
  expect,
  jest,
} from '@jest/globals';
import { LLMServiceFacade } from '../../../../src/testing/facades/llmServiceFacade.js';

describe('LLMServiceFacade', () => {
  let mockDependencies;
  let facade;

  // Mock services
  const mockLLMAdapter = {
    getAIDecision: jest.fn(),
    setStrategy: jest.fn(),
    dispose: jest.fn(),
  };

  const mockLLMChooser = {
    getAIChoice: jest.fn(),
    dispose: jest.fn(),
  };

  const mockPromptPipeline = {
    generatePrompt: jest.fn(),
    dispose: jest.fn(),
  };

  const mockResponseProcessor = {
    processResponse: jest.fn(),
    dispose: jest.fn(),
  };

  const mockDecisionProvider = {
    getDecision: jest.fn(),
    dispose: jest.fn(),
  };

  const mockLogger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockDependencies = {
      llmAdapter: mockLLMAdapter,
      llmChooser: mockLLMChooser,
      promptPipeline: mockPromptPipeline,
      responseProcessor: mockResponseProcessor,
      decisionProvider: mockDecisionProvider,
      logger: mockLogger,
    };

    facade = new LLMServiceFacade(mockDependencies);
  });

  afterEach(() => {
    facade?.dispose();
  });

  describe('Constructor', () => {
    test('should create facade with valid dependencies', () => {
      expect(facade).toBeInstanceOf(LLMServiceFacade);
      expect(facade.llmAdapter).toBe(mockLLMAdapter);
      expect(facade.llmChooser).toBe(mockLLMChooser);
      expect(facade.promptPipeline).toBe(mockPromptPipeline);
      expect(facade.responseProcessor).toBe(mockResponseProcessor);
      expect(facade.decisionProvider).toBe(mockDecisionProvider);
    });

    test('should throw error for missing llmAdapter', () => {
      expect(() => {
        new LLMServiceFacade({
          ...mockDependencies,
          llmAdapter: null,
        });
      }).toThrow('LLMServiceFacade: Missing or invalid llmAdapter dependency.');
    });

    test('should throw error for invalid llmChooser', () => {
      expect(() => {
        new LLMServiceFacade({
          ...mockDependencies,
          llmChooser: {},
        });
      }).toThrow('LLMServiceFacade: Missing or invalid llmChooser dependency.');
    });

    test('should throw error for missing promptPipeline', () => {
      expect(() => {
        new LLMServiceFacade({
          ...mockDependencies,
          promptPipeline: undefined,
        });
      }).toThrow(
        'LLMServiceFacade: Missing or invalid promptPipeline dependency.'
      );
    });

    test('should throw error for invalid responseProcessor', () => {
      expect(() => {
        new LLMServiceFacade({
          ...mockDependencies,
          responseProcessor: { invalidMethod: jest.fn() },
        });
      }).toThrow(
        'LLMServiceFacade: Missing or invalid responseProcessor dependency.'
      );
    });

    test('should throw error for missing decisionProvider', () => {
      expect(() => {
        new LLMServiceFacade({
          ...mockDependencies,
          decisionProvider: null,
        });
      }).toThrow(
        'LLMServiceFacade: Missing or invalid decisionProvider dependency.'
      );
    });

    test('should throw error for invalid logger', () => {
      expect(() => {
        new LLMServiceFacade({
          ...mockDependencies,
          logger: { log: jest.fn() },
        });
      }).toThrow('LLMServiceFacade: Missing or invalid logger dependency.');
    });
  });

  describe('getAIDecision', () => {
    test('should delegate to decision provider successfully', async () => {
      const mockDecision = {
        actionId: 'core:move',
        targets: { direction: 'north' },
        reasoning: 'Moving north to explore',
      };

      mockDecisionProvider.getDecision.mockResolvedValue(mockDecision);

      const result = await facade.getAIDecision('test-actor', {
        context: 'test',
      });

      expect(result).toBe(mockDecision);
      expect(mockDecisionProvider.getDecision).toHaveBeenCalledWith({
        actorId: 'test-actor',
        context: { context: 'test' },
        strategy: 'tool-calling',
      });
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'LLMServiceFacade: Getting AI decision',
        { actorId: 'test-actor', context: { context: 'test' } }
      );
    });

    test('should use mock response when available', async () => {
      const mockResponse = { actionId: 'core:look', mocked: true };
      facade.setMockResponse('test-actor', mockResponse);

      const result = await facade.getAIDecision('test-actor', {});

      expect(result).toBe(mockResponse);
      expect(mockDecisionProvider.getDecision).not.toHaveBeenCalled();
    });

    test('should configure strategy when specified in options', async () => {
      const mockDecision = { actionId: 'core:look' };
      mockDecisionProvider.getDecision.mockResolvedValue(mockDecision);

      await facade.getAIDecision('test-actor', {}, { strategy: 'json-schema' });

      expect(facade.getCurrentStrategy()).toBe('json-schema');
      expect(mockLLMAdapter.setStrategy).toHaveBeenCalledWith('json-schema');
    });

    test('should handle errors gracefully', async () => {
      const error = new Error('Decision provider failed');
      mockDecisionProvider.getDecision.mockRejectedValue(error);

      await expect(facade.getAIDecision('test-actor', {})).rejects.toThrow(
        error
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        'LLMServiceFacade: Error getting AI decision',
        error
      );
    });
  });

  describe('configureLLMStrategy', () => {
    test('should configure tool-calling strategy', async () => {
      await facade.configureLLMStrategy('tool-calling');

      expect(facade.getCurrentStrategy()).toBe('tool-calling');
      expect(mockLLMAdapter.setStrategy).toHaveBeenCalledWith('tool-calling');
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'LLMServiceFacade: Configuring LLM strategy',
        { strategy: 'tool-calling' }
      );
    });

    test('should configure json-schema strategy', async () => {
      await facade.configureLLMStrategy('json-schema');

      expect(facade.getCurrentStrategy()).toBe('json-schema');
      expect(mockLLMAdapter.setStrategy).toHaveBeenCalledWith('json-schema');
    });

    test('should throw error for invalid strategy', async () => {
      await expect(
        facade.configureLLMStrategy('invalid-strategy')
      ).rejects.toThrow(
        "LLMServiceFacade: Invalid strategy 'invalid-strategy'. Must be 'tool-calling' or 'json-schema'."
      );
    });

    test('should handle adapter without setStrategy method', async () => {
      const adapterWithoutSetStrategy = { getAIDecision: jest.fn() };
      const facadeNoSetStrategy = new LLMServiceFacade({
        ...mockDependencies,
        llmAdapter: adapterWithoutSetStrategy,
      });

      await expect(
        facadeNoSetStrategy.configureLLMStrategy('tool-calling')
      ).resolves.not.toThrow();
      expect(facadeNoSetStrategy.getCurrentStrategy()).toBe('tool-calling');

      facadeNoSetStrategy.dispose();
    });
  });

  describe('Mock Response Management', () => {
    test('should set and retrieve mock responses', () => {
      const mockResponse = { actionId: 'core:test', mocked: true };
      facade.setMockResponse('test-actor', mockResponse, 'tool-calling');

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'LLMServiceFacade: Mock response set',
        { mockKey: 'test-actor:tool-calling', response: mockResponse }
      );
    });

    test('should clear all mock responses', () => {
      facade.setMockResponse('actor1', { test: 1 });
      facade.setMockResponse('actor2', { test: 2 });

      facade.clearMockResponses();

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'LLMServiceFacade: All mock responses cleared'
      );
    });

    test('should use strategy-specific mock responses', async () => {
      const toolCallingResponse = {
        actionId: 'core:tool',
        strategy: 'tool-calling',
      };
      const jsonSchemaResponse = {
        actionId: 'core:json',
        strategy: 'json-schema',
      };

      facade.setMockResponse('test-actor', toolCallingResponse, 'tool-calling');
      facade.setMockResponse('test-actor', jsonSchemaResponse, 'json-schema');

      // Test tool-calling strategy
      const toolResult = await facade.getAIDecision('test-actor', {});
      expect(toolResult).toBe(toolCallingResponse);

      // Switch to json-schema strategy
      await facade.configureLLMStrategy('json-schema');
      const jsonResult = await facade.getAIDecision('test-actor', {});
      expect(jsonResult).toBe(jsonSchemaResponse);
    });
  });

  describe('Dispose', () => {
    test('should dispose all services and clear mock data', () => {
      facade.setMockResponse('test', { test: true });
      facade.dispose();

      expect(mockLLMAdapter.dispose).toHaveBeenCalled();
      expect(mockLLMChooser.dispose).toHaveBeenCalled();
      expect(mockPromptPipeline.dispose).toHaveBeenCalled();
      expect(mockResponseProcessor.dispose).toHaveBeenCalled();
      expect(mockDecisionProvider.dispose).toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'LLMServiceFacade: Disposing resources'
      );
    });

    test('should handle services without dispose method', () => {
      const servicesWithoutDispose = {
        llmAdapter: { getAIDecision: jest.fn() },
        llmChooser: { getAIChoice: jest.fn() },
        promptPipeline: { generatePrompt: jest.fn() },
        responseProcessor: { processResponse: jest.fn() },
        decisionProvider: { getDecision: jest.fn() },
        logger: mockLogger,
      };

      const facadeNoDispose = new LLMServiceFacade(servicesWithoutDispose);
      expect(() => facadeNoDispose.dispose()).not.toThrow();
    });
  });

  describe('Default Strategy', () => {
    test('should default to tool-calling strategy', () => {
      expect(facade.getCurrentStrategy()).toBe('tool-calling');
    });

    test('should maintain strategy across multiple calls', async () => {
      await facade.configureLLMStrategy('json-schema');
      expect(facade.getCurrentStrategy()).toBe('json-schema');

      // Multiple calls should maintain the strategy
      mockDecisionProvider.getDecision.mockResolvedValue({ actionId: 'test' });
      await facade.getAIDecision('actor1', {});
      await facade.getAIDecision('actor2', {});

      expect(facade.getCurrentStrategy()).toBe('json-schema');
    });
  });
});
