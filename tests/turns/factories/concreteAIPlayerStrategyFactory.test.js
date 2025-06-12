/**
 * @file Unit tests for the ConcreteAIPlayerStrategyFactory class.
 * @description These tests ensure that the factory correctly validates its dependencies and
 * properly constructs AIPlayerStrategy instances with all required services.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ConcreteAIPlayerStrategyFactory } from '../../../src/turns/factories/concreteAIPlayerStrategyFactory.js';
import { AIPlayerStrategy } from '../../../src/turns/strategies/aiPlayerStrategy.js';

// Mock the AIPlayerStrategy class, which is the output of the factory.
// This allows us to spy on its constructor without testing its internal logic.
jest.mock('../../../src/turns/strategies/aiPlayerStrategy.js');

// --- Mock Dependencies ---
const mockLlmAdapter = {};
const mockAiPromptPipeline = {};
const mockLlmResponseProcessor = {};
const mockAiFallbackActionFactory = {};
const mockActionDiscoveryService = {};
const mockActionIndexingService = {};
const mockLogger = { debug: jest.fn(), error: jest.fn() };

describe('ConcreteAIPlayerStrategyFactory', () => {
  let dependencies;

  beforeEach(() => {
    jest.clearAllMocks();
    dependencies = {
      llmAdapter: mockLlmAdapter,
      aiPromptPipeline: mockAiPromptPipeline,
      llmResponseProcessor: mockLlmResponseProcessor,
      aiFallbackActionFactory: mockAiFallbackActionFactory,
      actionDiscoveryService: mockActionDiscoveryService,
      actionIndexingService: mockActionIndexingService,
      logger: mockLogger,
    };
  });

  describe('Constructor', () => {
    it('should throw an error if llmAdapter is not provided', () => {
      delete dependencies.llmAdapter;
      expect(() => new ConcreteAIPlayerStrategyFactory(dependencies)).toThrow(
        'llmAdapter is required.'
      );
    });

    it('should throw an error if aiPromptPipeline is not provided', () => {
      delete dependencies.aiPromptPipeline;
      expect(() => new ConcreteAIPlayerStrategyFactory(dependencies)).toThrow(
        'aiPromptPipeline is required.'
      );
    });

    it('should throw an error if llmResponseProcessor is not provided', () => {
      delete dependencies.llmResponseProcessor;
      expect(() => new ConcreteAIPlayerStrategyFactory(dependencies)).toThrow(
        'llmResponseProcessor is required.'
      );
    });

    it('should throw an error if aiFallbackActionFactory is not provided', () => {
      delete dependencies.aiFallbackActionFactory;
      expect(() => new ConcreteAIPlayerStrategyFactory(dependencies)).toThrow(
        'aiFallbackActionFactory is required.'
      );
    });

    it('should throw an error if actionDiscoveryService is not provided', () => {
      delete dependencies.actionDiscoveryService;
      expect(() => new ConcreteAIPlayerStrategyFactory(dependencies)).toThrow(
        'actionDiscoveryService is required.'
      );
    });

    it('should throw an error if actionIndexingService is not provided', () => {
      delete dependencies.actionIndexingService;
      expect(() => new ConcreteAIPlayerStrategyFactory(dependencies)).toThrow(
        'actionIndexingService is required.'
      );
    });

    it('should throw an error if logger is not provided', () => {
      delete dependencies.logger;
      expect(() => new ConcreteAIPlayerStrategyFactory(dependencies)).toThrow(
        'logger is required.'
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
      const factory = new ConcreteAIPlayerStrategyFactory(dependencies);
      const strategyInstance = factory.create();

      expect(AIPlayerStrategy).toHaveBeenCalledTimes(1);
      expect(AIPlayerStrategy).toHaveBeenCalledWith({
        llmAdapter: mockLlmAdapter,
        aiPromptPipeline: mockAiPromptPipeline,
        llmResponseProcessor: mockLlmResponseProcessor,
        aiFallbackActionFactory: mockAiFallbackActionFactory,
        actionDiscoveryService: mockActionDiscoveryService,
        actionIndexingService: mockActionIndexingService,
        logger: mockLogger,
      });
      expect(strategyInstance).toBeInstanceOf(AIPlayerStrategy);
    });
  });
});
