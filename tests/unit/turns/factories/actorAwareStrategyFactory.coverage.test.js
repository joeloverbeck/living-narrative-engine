import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ActorAwareStrategyFactory } from '../../../../src/turns/factories/actorAwareStrategyFactory.js';
import { GenericTurnStrategy } from '../../../../src/turns/strategies/genericTurnStrategy.js';

describe('ActorAwareStrategyFactory - Coverage Tests', () => {
  let humanProvider;
  let llmProvider;
  let logger;
  let choicePipeline;
  let turnActionFactory;
  let entityManager;

  beforeEach(() => {
    humanProvider = { name: 'human' };
    llmProvider = { name: 'llm' };
    logger = { debug: jest.fn() };
    choicePipeline = {};
    turnActionFactory = {};
    entityManager = {
      getEntityInstance: jest.fn((id) => ({ id })),
    };
  });

  describe('Legacy provider initialization (lines 89-92)', () => {
    it('should use humanProvider and aiProvider when providers map is not provided', () => {
      const factory = new ActorAwareStrategyFactory({
        humanProvider,
        aiProvider: llmProvider,
        logger,
        choicePipeline,
        turnActionFactory,
        entityManager,
      });

      // Test that it creates strategies correctly with legacy providers
      const humanStrategy = factory.create('human1');
      expect(humanStrategy).toBeInstanceOf(GenericTurnStrategy);

      // Create an AI actor to test llm provider selection
      entityManager.getEntityInstance.mockReturnValue({
        id: 'ai1',
        isAi: true,
      });
      const aiStrategy = factory.create('ai1');
      expect(aiStrategy).toBeInstanceOf(GenericTurnStrategy);
    });

    it('should throw error when providers, humanProvider, and aiProvider are all missing', () => {
      expect(() => {
        new ActorAwareStrategyFactory({
          logger,
          choicePipeline,
          turnActionFactory,
          entityManager,
        });
      }).toThrow('ActorAwareStrategyFactory: providers map is required');
    });

    it('should throw error when providers is null and only humanProvider is provided', () => {
      expect(() => {
        new ActorAwareStrategyFactory({
          humanProvider,
          logger,
          choicePipeline,
          turnActionFactory,
          entityManager,
        });
      }).toThrow('ActorAwareStrategyFactory: providers map is required');
    });

    it('should throw error when providers is null and only aiProvider is provided', () => {
      expect(() => {
        new ActorAwareStrategyFactory({
          aiProvider: llmProvider,
          logger,
          choicePipeline,
          turnActionFactory,
          entityManager,
        });
      }).toThrow('ActorAwareStrategyFactory: providers map is required');
    });
  });

  describe('Constructor validation errors', () => {
    it('should throw error when providerResolver is not a function (line 96)', () => {
      expect(() => {
        new ActorAwareStrategyFactory({
          providers: { human: humanProvider, llm: llmProvider },
          providerResolver: 'not a function',
          logger,
          choicePipeline,
          turnActionFactory,
          entityManager,
        });
      }).toThrow(
        'ActorAwareStrategyFactory: providerResolver must be a function'
      );
    });

    it('should throw error when logger is missing (line 100)', () => {
      expect(() => {
        new ActorAwareStrategyFactory({
          providers: { human: humanProvider, llm: llmProvider },
          choicePipeline,
          turnActionFactory,
          entityManager,
        });
      }).toThrow('ActorAwareStrategyFactory: logger is required');
    });

    it('should throw error when choicePipeline is missing (line 102)', () => {
      expect(() => {
        new ActorAwareStrategyFactory({
          providers: { human: humanProvider, llm: llmProvider },
          logger,
          turnActionFactory,
          entityManager,
        });
      }).toThrow('ActorAwareStrategyFactory: choicePipeline is required');
    });

    it('should throw error when turnActionFactory is missing (line 104)', () => {
      expect(() => {
        new ActorAwareStrategyFactory({
          providers: { human: humanProvider, llm: llmProvider },
          logger,
          choicePipeline,
          entityManager,
        });
      }).toThrow('ActorAwareStrategyFactory: turnActionFactory is required');
    });
  });

  describe('actorLookup initialization branches (lines 117-123)', () => {
    it('should use entityManager.getEntityInstance when actorLookup is not provided', () => {
      const mockEntityManager = {
        getEntityInstance: jest.fn((id) => ({ id, fromEntityManager: true })),
      };

      const factory = new ActorAwareStrategyFactory({
        providers: { human: humanProvider, llm: llmProvider },
        logger,
        choicePipeline,
        turnActionFactory,
        entityManager: mockEntityManager,
      });

      // Test that it uses entityManager correctly
      const strategy = factory.create('test-entity');
      expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(
        'test-entity'
      );
      expect(strategy).toBeInstanceOf(GenericTurnStrategy);
    });

    it('should throw error when neither actorLookup nor entityManager is provided', () => {
      expect(() => {
        new ActorAwareStrategyFactory({
          providers: { human: humanProvider, llm: llmProvider },
          logger,
          choicePipeline,
          turnActionFactory,
        });
      }).toThrow(
        'ActorAwareStrategyFactory: actorLookup callback or entityManager is required'
      );
    });

    it('should throw error when entityManager does not have getEntityInstance method', () => {
      expect(() => {
        new ActorAwareStrategyFactory({
          providers: { human: humanProvider, llm: llmProvider },
          logger,
          choicePipeline,
          turnActionFactory,
          entityManager: {}, // Missing getEntityInstance
        });
      }).toThrow(
        'ActorAwareStrategyFactory: actorLookup callback or entityManager is required'
      );
    });

    it('should use actorLookup over entityManager when both are provided', () => {
      const customLookup = jest.fn((id) => ({ id, fromCustomLookup: true }));
      const mockEntityManager = {
        getEntityInstance: jest.fn((id) => ({ id, fromEntityManager: true })),
      };

      const factory = new ActorAwareStrategyFactory({
        providers: { human: humanProvider, llm: llmProvider },
        logger,
        choicePipeline,
        turnActionFactory,
        actorLookup: customLookup,
        entityManager: mockEntityManager,
      });

      factory.create('test-entity');

      // Should use custom lookup, not entityManager
      expect(customLookup).toHaveBeenCalledWith('test-entity');
      expect(mockEntityManager.getEntityInstance).not.toHaveBeenCalled();
    });
  });

  describe('Missing provider error (line 149)', () => {
    it('should throw error when provider for resolved type does not exist', () => {
      const customResolver = () => 'unknown-type';

      const factory = new ActorAwareStrategyFactory({
        providers: { human: humanProvider, llm: llmProvider },
        providerResolver: customResolver,
        logger,
        choicePipeline,
        turnActionFactory,
        entityManager,
      });

      expect(() => {
        factory.create('test-entity');
      }).toThrow(
        'ActorAwareStrategyFactory: No decision provider for actor type "unknown-type"'
      );
    });

    it('should throw error with correct actor type in message', () => {
      const customResolver = (actor) => actor?.customType || 'missing-provider';

      const factory = new ActorAwareStrategyFactory({
        providers: { human: humanProvider, llm: llmProvider },
        providerResolver: customResolver,
        logger,
        choicePipeline,
        turnActionFactory,
        entityManager,
      });

      entityManager.getEntityInstance.mockReturnValue({
        id: 'test',
        customType: 'custom-ai',
      });

      expect(() => {
        factory.create('test');
      }).toThrow(
        'ActorAwareStrategyFactory: No decision provider for actor type "custom-ai"'
      );
    });
  });

  describe('Edge cases and additional coverage', () => {
    it('should handle when getComponentData throws error in default resolver', () => {
      const mockEntity = {
        id: 'error-entity',
        getComponentData: jest.fn(() => {
          throw new Error('Component error');
        }),
        components: {
          ai: { type: 'llm' }, // Should fall back to this
        },
      };

      entityManager.getEntityInstance.mockReturnValue(mockEntity);

      const factory = new ActorAwareStrategyFactory({
        providers: { human: humanProvider, llm: llmProvider },
        logger,
        choicePipeline,
        turnActionFactory,
        entityManager,
      });

      const strategy = factory.create('error-entity');
      expect(strategy.decisionProvider).toBe(llmProvider);
      expect(mockEntity.getComponentData).toHaveBeenCalled();
    });

    it('should handle when entityManager.getEntityInstance is not a function', () => {
      const invalidEntityManager = {
        getEntityInstance: 'not a function',
      };

      expect(() => {
        new ActorAwareStrategyFactory({
          providers: { human: humanProvider, llm: llmProvider },
          logger,
          choicePipeline,
          turnActionFactory,
          entityManager: invalidEntityManager,
        });
      }).toThrow(
        'ActorAwareStrategyFactory: actorLookup callback or entityManager is required'
      );
    });
  });
});
