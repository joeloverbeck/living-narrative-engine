/**
 * @file Integration tests for player type routing verification (GOADISANA-024)
 *
 * Verifies that all three player types (human, llm, goap) route correctly
 * to their respective decision providers after GOAP system removal.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';

import { ActorAwareStrategyFactory } from '../../../src/turns/factories/actorAwareStrategyFactory.js';
import { TurnActionChoicePipeline } from '../../../src/turns/pipeline/turnActionChoicePipeline.js';
import { TurnActionFactory } from '../../../src/turns/factories/turnActionFactory.js';
import { createMockLogger } from '../../common/mockFactories.js';

describe('[Integration] Player Type Routing Verification', () => {
  let logger;
  let availableActionsProvider;
  let choicePipeline;
  let turnActionFactory;
  let providers;

  beforeEach(() => {
    logger = createMockLogger();
    availableActionsProvider = {
      get: jest.fn().mockResolvedValue([]),
    };
    choicePipeline = new TurnActionChoicePipeline({
      availableActionsProvider,
      logger,
    });
    turnActionFactory = new TurnActionFactory();
    providers = {
      human: { name: 'human', decide: jest.fn() },
      llm: { name: 'llm', decide: jest.fn() },
      goap: { name: 'goap', decide: jest.fn() },
    };
  });

  describe('Human Player Type Routing', () => {
    it('should route actors with player_type="human" to HumanDecisionProvider', () => {
      const actor = {
        getComponentData: jest.fn().mockReturnValue({ type: 'human' }),
      };

      const factory = new ActorAwareStrategyFactory({
        providers,
        logger,
        choicePipeline,
        turnActionFactory,
        actorLookup: () => actor,
      });

      const strategy = factory.create('human-actor');

      expect(actor.getComponentData).toHaveBeenCalledWith('core:player_type');
      expect(strategy.decisionProvider).toBe(providers.human);
      expect(strategy.decisionProvider.name).toBe('human');
    });

    it('should handle case-insensitive human player type', () => {
      const actor = {
        getComponentData: jest.fn().mockReturnValue({ type: '  HUMAN  ' }),
      };

      const factory = new ActorAwareStrategyFactory({
        providers,
        logger,
        choicePipeline,
        turnActionFactory,
        actorLookup: () => actor,
      });

      const strategy = factory.create('human-actor-uppercase');

      expect(strategy.decisionProvider).toBe(providers.human);
    });
  });

  describe('LLM Player Type Routing', () => {
    it('should route actors with player_type="llm" to LLMDecisionProvider', () => {
      const actor = {
        getComponentData: jest.fn().mockReturnValue({ type: 'llm' }),
      };

      const factory = new ActorAwareStrategyFactory({
        providers,
        logger,
        choicePipeline,
        turnActionFactory,
        actorLookup: () => actor,
      });

      const strategy = factory.create('llm-actor');

      expect(actor.getComponentData).toHaveBeenCalledWith('core:player_type');
      expect(strategy.decisionProvider).toBe(providers.llm);
      expect(strategy.decisionProvider.name).toBe('llm');
    });

    it('should handle case-insensitive llm player type', () => {
      const actor = {
        getComponentData: jest.fn().mockReturnValue({ type: '  LLM  ' }),
      };

      const factory = new ActorAwareStrategyFactory({
        providers,
        logger,
        choicePipeline,
        turnActionFactory,
        actorLookup: () => actor,
      });

      const strategy = factory.create('llm-actor-uppercase');

      expect(strategy.decisionProvider).toBe(providers.llm);
    });
  });

  describe('GOAP Player Type Routing', () => {
    it('should route actors with player_type="goap" to GoapDecisionProvider', () => {
      const actor = {
        getComponentData: jest.fn().mockReturnValue({ type: 'goap' }),
      };

      const factory = new ActorAwareStrategyFactory({
        providers,
        logger,
        choicePipeline,
        turnActionFactory,
        actorLookup: () => actor,
      });

      const strategy = factory.create('goap-actor');

      expect(actor.getComponentData).toHaveBeenCalledWith('core:player_type');
      expect(strategy.decisionProvider).toBe(providers.goap);
      expect(strategy.decisionProvider.name).toBe('goap');
    });

    it('should handle case-insensitive goap player type', () => {
      const actor = {
        getComponentData: jest.fn().mockReturnValue({ type: '  GOAP  ' }),
      };

      const factory = new ActorAwareStrategyFactory({
        providers,
        logger,
        choicePipeline,
        turnActionFactory,
        actorLookup: () => actor,
      });

      const strategy = factory.create('goap-actor-uppercase');

      expect(strategy.decisionProvider).toBe(providers.goap);
    });

    it('should verify GOAP provider returns action index from GOAP controller', async () => {
      const mockActions = [
        { actionId: 'core:sit_down', index: 1, params: { targetId: 'chair-1' } },
        { actionId: 'core:stand_up', index: 2, params: {} },
      ];

      const goapProvider = {
        name: 'goap',
        decide: jest.fn().mockResolvedValue({
          chosenIndex: 1,
          speech: null,
          thoughts: null,
          notes: null,
        }),
      };

      const actor = {
        getComponentData: jest.fn().mockReturnValue({ type: 'goap' }),
      };

      const factory = new ActorAwareStrategyFactory({
        providers: { human: providers.human, llm: providers.llm, goap: goapProvider },
        logger,
        choicePipeline,
        turnActionFactory,
        actorLookup: () => actor,
      });

      const strategy = factory.create('goap-actor-with-actions');

      expect(strategy.decisionProvider).toBe(goapProvider);

      // Simulate decision making with actions
      const result = await strategy.decisionProvider.decide(actor, {}, mockActions);

      expect(result).toEqual({
        chosenIndex: 1,
        speech: null,
        thoughts: null,
        notes: null,
      });
      expect(goapProvider.decide).toHaveBeenCalledWith(actor, {}, mockActions);
    });

    it('should verify GOAP provider returns null when no decision made', async () => {
      const goapProvider = {
        name: 'goap',
        decide: jest.fn().mockResolvedValue({
          chosenIndex: null,
          speech: null,
          thoughts: null,
          notes: null,
        }),
      };

      const actor = {
        getComponentData: jest.fn().mockReturnValue({ type: 'goap' }),
      };

      const factory = new ActorAwareStrategyFactory({
        providers: { human: providers.human, llm: providers.llm, goap: goapProvider },
        logger,
        choicePipeline,
        turnActionFactory,
        actorLookup: () => actor,
      });

      const strategy = factory.create('goap-actor-no-decision');

      expect(strategy.decisionProvider).toBe(goapProvider);

      // Simulate decision making with no goals or failed planning
      const result = await strategy.decisionProvider.decide(actor, {}, []);

      expect(result).toEqual({
        chosenIndex: null,
        speech: null,
        thoughts: null,
        notes: null,
      });
      expect(goapProvider.decide).toHaveBeenCalledWith(actor, {}, []);
    });
  });

  describe('Fallback Behavior', () => {
    it('should fallback to human provider when player_type component is missing', () => {
      const actor = {
        getComponentData: jest.fn(() => {
          throw new Error('component not found');
        }),
      };

      const factory = new ActorAwareStrategyFactory({
        providers,
        logger,
        choicePipeline,
        turnActionFactory,
        actorLookup: () => actor,
      });

      const strategy = factory.create('missing-component-actor');

      expect(actor.getComponentData).toHaveBeenCalledWith('core:player_type');
      expect(strategy.decisionProvider).toBe(providers.human);
    });

    it('should handle empty player_type gracefully', () => {
      const actor = {
        getComponentData: jest.fn().mockReturnValue({ type: '' }),
      };

      const factory = new ActorAwareStrategyFactory({
        providers,
        logger,
        choicePipeline,
        turnActionFactory,
        actorLookup: () => actor,
      });

      const strategy = factory.create('empty-type-actor');

      expect(actor.getComponentData).toHaveBeenCalledWith('core:player_type');
      // Should fallback to human when type is blank
      expect(strategy.decisionProvider).toBe(providers.human);
    });

    it('should handle null player_type gracefully', () => {
      const actor = {
        getComponentData: jest.fn().mockReturnValue({ type: null }),
      };

      const factory = new ActorAwareStrategyFactory({
        providers,
        logger,
        choicePipeline,
        turnActionFactory,
        actorLookup: () => actor,
      });

      const strategy = factory.create('null-type-actor');

      expect(actor.getComponentData).toHaveBeenCalledWith('core:player_type');
      // Should fallback to human when type is null
      expect(strategy.decisionProvider).toBe(providers.human);
    });
  });

  describe('Legacy Compatibility', () => {
    it('should still support legacy aiType property', () => {
      const actor = {
        getComponentData: jest.fn(() => {
          throw new Error('component not found');
        }),
        aiType: 'GOAP',
      };

      const factory = new ActorAwareStrategyFactory({
        providers,
        logger,
        choicePipeline,
        turnActionFactory,
        actorLookup: () => actor,
      });

      const strategy = factory.create('legacy-goap-actor');

      expect(strategy.decisionProvider).toBe(providers.goap);
    });

    it('should still support legacy isAi flag', () => {
      const actor = {
        getComponentData: jest.fn(() => {
          throw new Error('component not found');
        }),
        isAi: true,
      };

      const factory = new ActorAwareStrategyFactory({
        providers,
        logger,
        choicePipeline,
        turnActionFactory,
        actorLookup: () => actor,
      });

      const strategy = factory.create('legacy-ai-actor');

      // Legacy isAi defaults to llm
      expect(strategy.decisionProvider).toBe(providers.llm);
    });
  });

  describe('Error Scenarios', () => {
    it('should throw error for unknown player type', () => {
      const actor = {
        getComponentData: jest.fn().mockReturnValue({ type: 'unknown' }),
      };

      const factory = new ActorAwareStrategyFactory({
        providers,
        logger,
        choicePipeline,
        turnActionFactory,
        actorLookup: () => actor,
      });

      expect(() => factory.create('unknown-type-actor')).toThrow(
        'ActorAwareStrategyFactory: No decision provider for actor type "unknown"'
      );
    });

    it('should not throw GOAP service resolution errors', () => {
      // This test ensures no references to deleted GOAP services remain
      const actor = {
        getComponentData: jest.fn().mockReturnValue({ type: 'goap' }),
      };

      const factory = new ActorAwareStrategyFactory({
        providers,
        logger,
        choicePipeline,
        turnActionFactory,
        actorLookup: () => actor,
      });

      // Should not throw errors about missing GOAP services
      expect(() => factory.create('goap-actor')).not.toThrow();

      const strategy = factory.create('goap-actor-no-errors');
      expect(strategy.decisionProvider).toBe(providers.goap);
    });
  });

  describe('Complete Routing Flow', () => {
    it('should verify all three player types can be routed in sequence', () => {
      const actors = {
        humanActor: { getComponentData: jest.fn().mockReturnValue({ type: 'human' }) },
        llmActor: { getComponentData: jest.fn().mockReturnValue({ type: 'llm' }) },
        goapActor: { getComponentData: jest.fn().mockReturnValue({ type: 'goap' }) },
      };

      const factory = new ActorAwareStrategyFactory({
        providers,
        logger,
        choicePipeline,
        turnActionFactory,
        actorLookup: (id) => actors[id],
      });

      const humanStrategy = factory.create('humanActor');
      const llmStrategy = factory.create('llmActor');
      const goapStrategy = factory.create('goapActor');

      expect(humanStrategy.decisionProvider).toBe(providers.human);
      expect(llmStrategy.decisionProvider).toBe(providers.llm);
      expect(goapStrategy.decisionProvider).toBe(providers.goap);
    });
  });
});
