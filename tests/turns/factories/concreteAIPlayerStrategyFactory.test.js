// tests/turns/factories/concreteAIPlayerStrategyFactory.test.js

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ConcreteAIPlayerStrategyFactory } from '../../../src/turns/factories/concreteAIPlayerStrategyFactory.js';
import { GenericTurnStrategy } from '../../../src/turns/strategies/genericTurnStrategy.js';

// Mock GenericTurnStrategy to spy on its constructor and return a dummy instance
jest.mock('../../../src/turns/strategies/genericTurnStrategy.js');
const dummyInstance = {};
GenericTurnStrategy.mockReturnValue(dummyInstance);

// --- Mock Dependencies ---
const mockChoicePipeline = { buildChoices: jest.fn() };
const mockLLMProvider = { decide: jest.fn() };
const mockTurnActionFactory = { create: jest.fn() };
const mockLogger = { debug: jest.fn(), error: jest.fn() };

describe('ConcreteAIPlayerStrategyFactory', () => {
  let dependencies;

  beforeEach(() => {
    jest.clearAllMocks();
    dependencies = {
      choicePipeline: mockChoicePipeline,
      llmProvider: mockLLMProvider,
      turnActionFactory: mockTurnActionFactory,
      logger: mockLogger,
    };
  });

  describe('Constructor', () => {
    it('should throw an error if choicePipeline is not provided', () => {
      delete dependencies.choicePipeline;
      expect(() => new ConcreteAIPlayerStrategyFactory(dependencies)).toThrow(
        'choicePipeline is required'
      );
    });

    it('should throw an error if choicePipeline.buildChoices is not a function', () => {
      dependencies.choicePipeline = {};
      expect(() => new ConcreteAIPlayerStrategyFactory(dependencies)).toThrow(
        'choicePipeline is required and must implement buildChoices()'
      );
    });

    it('should throw an error if llmProvider is not provided', () => {
      delete dependencies.llmProvider;
      expect(() => new ConcreteAIPlayerStrategyFactory(dependencies)).toThrow(
        'llmProvider is required'
      );
    });

    it('should throw an error if llmProvider.decide is not a function', () => {
      dependencies.llmProvider = {};
      expect(() => new ConcreteAIPlayerStrategyFactory(dependencies)).toThrow(
        'llmProvider is required and must implement decide()'
      );
    });

    it('should throw an error if turnActionFactory is not provided', () => {
      delete dependencies.turnActionFactory;
      expect(() => new ConcreteAIPlayerStrategyFactory(dependencies)).toThrow(
        'turnActionFactory is required'
      );
    });

    it('should throw an error if turnActionFactory.create is not a function', () => {
      dependencies.turnActionFactory = {};
      expect(() => new ConcreteAIPlayerStrategyFactory(dependencies)).toThrow(
        'turnActionFactory is required and must implement create()'
      );
    });

    it('should throw an error if logger is not provided', () => {
      delete dependencies.logger;
      expect(() => new ConcreteAIPlayerStrategyFactory(dependencies)).toThrow(
        'logger is required'
      );
    });

    it('should throw an error if logger.debug is not a function', () => {
      dependencies.logger = {};
      expect(() => new ConcreteAIPlayerStrategyFactory(dependencies)).toThrow(
        'logger is required and must implement debug()'
      );
    });

    it('should successfully construct if all dependencies are provided', () => {
      expect(
        () => new ConcreteAIPlayerStrategyFactory(dependencies)
      ).not.toThrow();
    });
  });

  describe('create', () => {
    it('should create a GenericTurnStrategy with the cached dependencies', () => {
      const factory = new ConcreteAIPlayerStrategyFactory(dependencies);
      const strategyInstance = factory.create();

      expect(GenericTurnStrategy).toHaveBeenCalledTimes(1);
      expect(GenericTurnStrategy).toHaveBeenCalledWith({
        choicePipeline: mockChoicePipeline,
        decisionProvider: mockLLMProvider,
        turnActionFactory: mockTurnActionFactory,
        logger: mockLogger,
      });
      expect(strategyInstance).toBe(dummyInstance);
    });
  });
});
