/**
 * @file Unit tests for the ConcreteAIPlayerStrategyFactory class.
 * @description These tests ensure that the factory correctly validates its dependencies and
 * properly constructs AIPlayerStrategy instances with all required services.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ConcreteAIPlayerStrategyFactory } from '../../../src/turns/factories/ConcreteAIPlayerStrategyFactory.js';
import { AIPlayerStrategy } from '../../../src/turns/strategies/aiPlayerStrategy.js';

// Mock the AIPlayerStrategy class, which is the output of the factory.
// This allows us to spy on its constructor without testing its internal logic.
jest.mock('../../../src/turns/strategies/aiPlayerStrategy.js');

// --- Mock Dependencies ---
// These are simple objects that satisfy the factory's constructor checks.
const mockLlmAdapter = {};
const mockAiPromptPipeline = {};
const mockLlmResponseProcessor = {};
const mockAiFallbackActionFactory = {};
const mockLogger = { debug: jest.fn(), error: jest.fn() };

describe('ConcreteAIPlayerStrategyFactory', () => {
  let dependencies;

  beforeEach(() => {
    // Clear mock history before each test
    jest.clearAllMocks();

    // Group all dependencies for easy use in tests
    dependencies = {
      llmAdapter: mockLlmAdapter,
      aiPromptPipeline: mockAiPromptPipeline,
      llmResponseProcessor: mockLlmResponseProcessor,
      aiFallbackActionFactory: mockAiFallbackActionFactory,
      logger: mockLogger,
    };
  });

  describe('Constructor', () => {
    // Test each dependency guard clause individually
    it('should throw an error if llmAdapter is not provided', () => {
      delete dependencies.llmAdapter;
      expect(() => new ConcreteAIPlayerStrategyFactory(dependencies)).toThrow(
        'AIPlayerStrategyFactory: llmAdapter is required.'
      );
    });

    it('should throw an error if aiPromptPipeline is not provided', () => {
      delete dependencies.aiPromptPipeline;
      expect(() => new ConcreteAIPlayerStrategyFactory(dependencies)).toThrow(
        'AIPlayerStrategyFactory: aiPromptPipeline is required.'
      );
    });

    it('should throw an error if llmResponseProcessor is not provided', () => {
      delete dependencies.llmResponseProcessor;
      expect(() => new ConcreteAIPlayerStrategyFactory(dependencies)).toThrow(
        'AIPlayerStrategyFactory: llmResponseProcessor is required.'
      );
    });

    it('should throw an error if aiFallbackActionFactory is not provided', () => {
      delete dependencies.aiFallbackActionFactory;
      expect(() => new ConcreteAIPlayerStrategyFactory(dependencies)).toThrow(
        'AIPlayerStrategyFactory: aiFallbackActionFactory is required.'
      );
    });

    it('should throw an error if logger is not provided', () => {
      delete dependencies.logger;
      expect(() => new ConcreteAIPlayerStrategyFactory(dependencies)).toThrow(
        'AIPlayerStrategyFactory: logger is required.'
      );
    });

    it('should successfully construct if all dependencies are provided', () => {
      expect(
        () => new ConcreteAIPlayerStrategyFactory(dependencies)
      ).not.toThrow();
    });
  });

  describe('create', () => {
    it('should create an AIPlayerStrategy with the cached dependencies', () => {
      // Arrange: Create the factory with a valid set of dependencies
      const factory = new ConcreteAIPlayerStrategyFactory(dependencies);

      // Act: Call the create method
      const strategyInstance = factory.create();

      // Assert:
      // 1. The AIPlayerStrategy constructor was called exactly once.
      expect(AIPlayerStrategy).toHaveBeenCalledTimes(1);

      // 2. The constructor was called with the exact same dependencies
      //    that were provided to the factory.
      expect(AIPlayerStrategy).toHaveBeenCalledWith({
        llmAdapter: mockLlmAdapter,
        aiPromptPipeline: mockAiPromptPipeline,
        llmResponseProcessor: mockLlmResponseProcessor,
        aiFallbackActionFactory: mockAiFallbackActionFactory,
        logger: mockLogger,
      });

      // 3. The factory returned the instance created by the mock constructor.
      //    The `toBeInstanceOf` check works here because jest.mock returns a mocked constructor.
      expect(strategyInstance).toBeInstanceOf(AIPlayerStrategy);
    });
  });
});
