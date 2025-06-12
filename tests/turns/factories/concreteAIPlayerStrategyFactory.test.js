// tests/turns/factories/concreteAIPlayerStrategyFactory.test.js
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ConcreteAIPlayerStrategyFactory } from '../../../src/turns/factories/concreteAIPlayerStrategyFactory.js';
import { AIPlayerStrategy } from '../../../src/turns/strategies/aiPlayerStrategy.js';

// Mock AIPlayerStrategy to spy on its constructor and return a dummy instance
jest.mock('../../../src/turns/strategies/aiPlayerStrategy.js');
const dummyInstance = {};
AIPlayerStrategy.mockReturnValue(dummyInstance);

// --- Mock Dependencies ---
const mockOrchestrator = { decideOrFallback: jest.fn() };
const mockLogger = { debug: jest.fn(), error: jest.fn() };

describe('ConcreteAIPlayerStrategyFactory', () => {
  let dependencies;

  beforeEach(() => {
    jest.clearAllMocks();
    dependencies = {
      orchestrator: mockOrchestrator,
      logger: mockLogger,
    };
  });

  describe('Constructor', () => {
    it('should throw an error if orchestrator is not provided', () => {
      delete dependencies.orchestrator;
      expect(() => new ConcreteAIPlayerStrategyFactory(dependencies)).toThrow(
        'orchestrator is required'
      );
    });

    it('should throw an error if orchestrator.decideOrFallback is not a function', () => {
      dependencies.orchestrator = {};
      expect(() => new ConcreteAIPlayerStrategyFactory(dependencies)).toThrow(
        'orchestrator is required and must implement decideOrFallback()'
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
    it('should create an AIPlayerStrategy with the cached dependencies', () => {
      const factory = new ConcreteAIPlayerStrategyFactory(dependencies);
      const strategyInstance = factory.create();

      expect(AIPlayerStrategy).toHaveBeenCalledTimes(1);
      expect(AIPlayerStrategy).toHaveBeenCalledWith({
        orchestrator: mockOrchestrator,
        logger: mockLogger,
      });
      expect(strategyInstance).toBe(dummyInstance);
    });
  });
});
