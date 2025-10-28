import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ActorAwareStrategyFactory } from '../../../../src/turns/factories/actorAwareStrategyFactory.js';
import { GenericTurnStrategy } from '../../../../src/turns/strategies/genericTurnStrategy.js';

describe('ActorAwareStrategyFactory - Entity API Support', () => {
  let humanProvider;
  let llmProvider;
  let goapProvider;
  let logger;
  let choicePipeline;
  let actionFactory;
  let lookup;
  let providers;

  beforeEach(() => {
    humanProvider = { name: 'human' };
    llmProvider = { name: 'llm' };
    goapProvider = { name: 'goap' };
    logger = { debug: jest.fn() };
    choicePipeline = {};
    actionFactory = {};
    providers = { human: humanProvider, llm: llmProvider, goap: goapProvider };
  });

  describe('Entities with getComponentData method', () => {
    it('should use llm provider for entity with getComponentData returning llm type', () => {
      const mockLLMEntity = {
        id: 'llm-entity',
        getComponentData: jest.fn((componentId) => {
          if (componentId === 'core:player_type') {
            return { type: 'llm' };
          }
          return undefined;
        }),
      };

      lookup = jest.fn(() => mockLLMEntity);

      const factory = new ActorAwareStrategyFactory({
        providers,
        logger,
        choicePipeline,
        turnActionFactory: actionFactory,
        actorLookup: lookup,
      });

      const strategy = factory.create('llm-entity');

      expect(strategy).toBeInstanceOf(GenericTurnStrategy);
      expect(strategy.decisionProvider).toBe(llmProvider);
      expect(mockLLMEntity.getComponentData).toHaveBeenCalledWith(
        'core:player_type'
      );
      expect(logger.debug).toHaveBeenCalledWith(
        'ActorAwareStrategyFactory: Creating GenericTurnStrategy for llm-entity using provider type llm.'
      );
    });

    it('should use human provider for entity with getComponentData returning human type', () => {
      const mockHumanEntity = {
        id: 'human-entity',
        getComponentData: jest.fn((componentId) => {
          if (componentId === 'core:player_type') {
            return { type: 'human' };
          }
          return undefined;
        }),
      };

      lookup = jest.fn(() => mockHumanEntity);

      const factory = new ActorAwareStrategyFactory({
        providers,
        logger,
        choicePipeline,
        turnActionFactory: actionFactory,
        actorLookup: lookup,
      });

      const strategy = factory.create('human-entity');

      expect(strategy).toBeInstanceOf(GenericTurnStrategy);
      expect(strategy.decisionProvider).toBe(humanProvider);
      expect(mockHumanEntity.getComponentData).toHaveBeenCalledWith(
        'core:player_type'
      );
    });

    it('normalises whitespace and casing when resolving player_type component values', () => {
      const mockNormalisedEntity = {
        id: 'normalised-entity',
        getComponentData: jest.fn((componentId) => {
          if (componentId === 'core:player_type') {
            return { type: ' Human ' };
          }
          return undefined;
        }),
      };

      lookup = jest.fn(() => mockNormalisedEntity);

      const factory = new ActorAwareStrategyFactory({
        providers,
        logger,
        choicePipeline,
        turnActionFactory: actionFactory,
        actorLookup: lookup,
      });

      const strategy = factory.create('normalised-entity');

      expect(strategy).toBeInstanceOf(GenericTurnStrategy);
      expect(strategy.decisionProvider).toBe(humanProvider);
      expect(mockNormalisedEntity.getComponentData).toHaveBeenCalledWith(
        'core:player_type'
      );
    });

    it('uses provider keys even when player_type is uppercase', () => {
      const mockUppercaseEntity = {
        id: 'uppercase-entity',
        getComponentData: jest.fn((componentId) => {
          if (componentId === 'core:player_type') {
            return { type: 'LLM' };
          }
          return undefined;
        }),
      };

      lookup = jest.fn(() => mockUppercaseEntity);

      const factory = new ActorAwareStrategyFactory({
        providers,
        logger,
        choicePipeline,
        turnActionFactory: actionFactory,
        actorLookup: lookup,
      });

      const strategy = factory.create('uppercase-entity');

      expect(strategy).toBeInstanceOf(GenericTurnStrategy);
      expect(strategy.decisionProvider).toBe(llmProvider);
      expect(mockUppercaseEntity.getComponentData).toHaveBeenCalledWith(
        'core:player_type'
      );
    });

    it('should use goap provider for entity with getComponentData returning goap type', () => {
      const mockGoapEntity = {
        id: 'goap-entity',
        getComponentData: jest.fn((componentId) => {
          if (componentId === 'core:player_type') {
            return { type: 'goap' };
          }
          return undefined;
        }),
      };

      lookup = jest.fn(() => mockGoapEntity);

      const factory = new ActorAwareStrategyFactory({
        providers,
        logger,
        choicePipeline,
        turnActionFactory: actionFactory,
        actorLookup: lookup,
      });

      const strategy = factory.create('goap-entity');

      expect(strategy).toBeInstanceOf(GenericTurnStrategy);
      expect(strategy.decisionProvider).toBe(goapProvider);
      expect(mockGoapEntity.getComponentData).toHaveBeenCalledWith(
        'core:player_type'
      );
    });

    it('should default to human for entity with getComponentData but no player_type', () => {
      const mockEntityNoPlayerType = {
        id: 'no-player-type-entity',
        getComponentData: jest.fn(() => undefined),
      };

      lookup = jest.fn(() => mockEntityNoPlayerType);

      const factory = new ActorAwareStrategyFactory({
        providers,
        logger,
        choicePipeline,
        turnActionFactory: actionFactory,
        actorLookup: lookup,
      });

      const strategy = factory.create('no-player-type-entity');

      expect(strategy).toBeInstanceOf(GenericTurnStrategy);
      expect(strategy.decisionProvider).toBe(humanProvider);
      expect(mockEntityNoPlayerType.getComponentData).toHaveBeenCalledWith(
        'core:player_type'
      );
    });

    it('should handle entity with getComponentData returning null', () => {
      const mockEntityNullReturn = {
        id: 'null-return-entity',
        getComponentData: jest.fn(() => null),
      };

      lookup = jest.fn(() => mockEntityNullReturn);

      const factory = new ActorAwareStrategyFactory({
        providers,
        logger,
        choicePipeline,
        turnActionFactory: actionFactory,
        actorLookup: lookup,
      });

      const strategy = factory.create('null-return-entity');

      expect(strategy).toBeInstanceOf(GenericTurnStrategy);
      expect(strategy.decisionProvider).toBe(humanProvider);
      expect(mockEntityNullReturn.getComponentData).toHaveBeenCalledWith(
        'core:player_type'
      );
    });
  });

  describe('Mixed entity scenarios', () => {
    it('should prefer getComponentData over direct components property', () => {
      const mockMixedEntity = {
        id: 'mixed-entity',
        // Entity has both getComponentData method and components property
        getComponentData: jest.fn((componentId) => {
          if (componentId === 'core:player_type') {
            return { type: 'llm' };
          }
          return undefined;
        }),
        // This should be ignored in favor of getComponentData
        components: {
          'core:player_type': { type: 'human' },
        },
      };

      lookup = jest.fn(() => mockMixedEntity);

      const factory = new ActorAwareStrategyFactory({
        providers,
        logger,
        choicePipeline,
        turnActionFactory: actionFactory,
        actorLookup: lookup,
      });

      const strategy = factory.create('mixed-entity');

      // Should use llm from getComponentData, not human from components
      expect(strategy.decisionProvider).toBe(llmProvider);
      expect(mockMixedEntity.getComponentData).toHaveBeenCalledWith(
        'core:player_type'
      );
    });

    it('should fall back to components property if getComponentData is not a function', () => {
      const mockLegacyEntity = {
        id: 'legacy-entity',
        // No getComponentData method
        components: {
          'core:player_type': { type: 'goap' },
        },
      };

      lookup = jest.fn(() => mockLegacyEntity);

      const factory = new ActorAwareStrategyFactory({
        providers,
        logger,
        choicePipeline,
        turnActionFactory: actionFactory,
        actorLookup: lookup,
      });

      const strategy = factory.create('legacy-entity');

      expect(strategy.decisionProvider).toBe(goapProvider);
    });

    it('should handle entity with getComponentData that throws an error', () => {
      const mockErrorEntity = {
        id: 'error-entity',
        getComponentData: jest.fn(() => {
          throw new Error('Component access error');
        }),
      };

      lookup = jest.fn(() => mockErrorEntity);

      const factory = new ActorAwareStrategyFactory({
        providers,
        logger,
        choicePipeline,
        turnActionFactory: actionFactory,
        actorLookup: lookup,
      });

      // Should not throw, should default to human
      expect(() => factory.create('error-entity')).not.toThrow();

      const strategy = factory.create('error-entity');
      expect(strategy.decisionProvider).toBe(humanProvider);
    });
  });

  describe('Custom provider resolver with Entity API', () => {
    it('should work with custom resolver that uses getComponentData', () => {
      const mockEntity = {
        id: 'custom-entity',
        getComponentData: jest.fn((componentId) => {
          if (componentId === 'core:player_type') {
            return { type: 'llm' };
          }
          if (componentId === 'core:custom_flag') {
            return { override: true };
          }
          return undefined;
        }),
      };

      lookup = jest.fn(() => mockEntity);

      // Custom resolver that checks a custom flag
      const customResolver = (actor) => {
        if (actor && typeof actor.getComponentData === 'function') {
          const customFlag = actor.getComponentData('core:custom_flag');
          if (customFlag?.override) {
            return 'goap'; // Override to use goap
          }
          const playerTypeData = actor.getComponentData('core:player_type');
          if (playerTypeData?.type) {
            return playerTypeData.type;
          }
        }
        return 'human';
      };

      const factory = new ActorAwareStrategyFactory({
        providers,
        providerResolver: customResolver,
        logger,
        choicePipeline,
        turnActionFactory: actionFactory,
        actorLookup: lookup,
      });

      const strategy = factory.create('custom-entity');

      // Should use goap due to custom flag override
      expect(strategy.decisionProvider).toBe(goapProvider);
      expect(mockEntity.getComponentData).toHaveBeenCalledWith(
        'core:custom_flag'
      );
    });
  });

  describe('Debug logging', () => {
    it('should log detailed entity structure when creating strategy', () => {
      const mockEntity = {
        id: 'debug-entity',
        getComponentData: jest.fn((componentId) => {
          if (componentId === 'core:player_type') {
            return { type: 'llm' };
          }
          return undefined;
        }),
        components: {
          'core:name': { text: 'Debug Entity' },
        },
      };

      lookup = jest.fn(() => mockEntity);

      const factory = new ActorAwareStrategyFactory({
        providers,
        logger,
        choicePipeline,
        turnActionFactory: actionFactory,
        actorLookup: lookup,
      });

      factory.create('debug-entity');

      // Check debug logging includes entity structure info
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Actor lookup result'),
        expect.objectContaining({
          hasActor: true,
          hasComponents: true,
          componentKeys: ['core:name'],
        })
      );
    });
  });
});
