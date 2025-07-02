// tests/integration/playerTypeDetection.integration.test.js
// -----------------------------------------------------------------------------
//  Integration Test – Player Type Detection with core:player_type Component
// -----------------------------------------------------------------------------

import { describe, beforeEach, it, expect, jest } from '@jest/globals';

import AppContainer from '../../src/dependencyInjection/appContainer.js';
import { Registrar } from '../../src/utils/registrarHelpers.js';
import { tokens } from '../../src/dependencyInjection/tokens.js';
import { ActorAwareStrategyFactory } from '../../src/turns/factories/actorAwareStrategyFactory.js';
import { TurnActionChoicePipeline } from '../../src/turns/pipeline/turnActionChoicePipeline.js';
import { TurnActionFactory } from '../../src/turns/factories/turnActionFactory.js';
import { createMockLogger } from '../common/mockFactories.js';

describe('[Integration] Player Type Detection', () => {
  let container;
  let r;
  let logger;
  let humanProvider;
  let llmProvider;
  let goapProvider;
  let entityManager;
  let factory;

  beforeEach(() => {
    container = new AppContainer();
    r = new Registrar(container);
    logger = createMockLogger();

    // Mock providers to track which one is used
    humanProvider = {
      name: 'human',
      decideAction: jest.fn().mockResolvedValue({
        kind: 'success',
        action: { actionDefinitionId: 'core:wait' },
      }),
    };
    llmProvider = {
      name: 'llm',
      decideAction: jest.fn().mockResolvedValue({
        kind: 'success',
        action: { actionDefinitionId: 'core:wait' },
      }),
    };
    goapProvider = {
      name: 'goap',
      decideAction: jest.fn().mockResolvedValue({
        kind: 'success',
        action: { actionDefinitionId: 'core:wait' },
      }),
    };

    // Mock entity manager
    const entities = {};
    entityManager = {
      getEntityInstance: jest.fn((id) => entities[id]),
      createEntity: jest.fn((def) => {
        entities[def.id] = def;
        return def;
      }),
    };

    // Register dependencies
    r.instance(tokens.ILogger, logger);
    r.instance(tokens.IEntityManager, entityManager);
    r.instance(tokens.IHumanDecisionProvider, humanProvider);
    r.instance(tokens.ILLMDecisionProvider, llmProvider);
    r.instance(tokens.IGoapDecisionProvider, goapProvider);

    // Mock available actions provider
    r.instance(tokens.IAvailableActionsProvider, {
      get: jest.fn().mockResolvedValue([]),
    });

    // Register pipeline and factory
    r.singletonFactory(
      tokens.TurnActionChoicePipeline,
      (c) =>
        new TurnActionChoicePipeline({
          availableActionsProvider: c.resolve(tokens.IAvailableActionsProvider),
          logger: c.resolve(tokens.ILogger),
        })
    );

    r.singletonFactory(
      tokens.ITurnActionFactory,
      () => new TurnActionFactory()
    );

    // Create factory with custom provider resolver to test
    factory = new ActorAwareStrategyFactory({
      providers: {
        human: humanProvider,
        llm: llmProvider,
        goap: goapProvider,
      },
      logger: logger,
      choicePipeline: container.resolve(tokens.TurnActionChoicePipeline),
      turnActionFactory: container.resolve(tokens.ITurnActionFactory),
      actorLookup: (id) => entityManager.getEntityInstance(id),
    });
  });

  describe('Entity with core:player_type component', () => {
    it('should use human provider for player_type: human', () => {
      // Create entity with human player type
      entityManager.createEntity({
        id: 'test-human',
        components: {
          'core:actor': {},
          'core:player_type': { type: 'human' },
          'core:name': { text: 'Test Human' },
        },
      });

      // Create strategy for entity
      const strategy = factory.create('test-human');

      // Verify human provider was selected
      expect(strategy).toBeDefined();
      expect(strategy.decisionProvider).toBe(humanProvider);
    });

    it('should use llm provider for player_type: llm', () => {
      // Create entity with llm player type
      entityManager.createEntity({
        id: 'test-llm',
        components: {
          'core:actor': {},
          'core:player_type': { type: 'llm' },
          'core:name': { text: 'Test LLM' },
        },
      });

      // Create strategy for entity
      const strategy = factory.create('test-llm');

      // Verify llm provider was selected
      expect(strategy).toBeDefined();
      expect(strategy.decisionProvider).toBe(llmProvider);
    });

    it('should use goap provider for player_type: goap', () => {
      // Create entity with goap player type
      entityManager.createEntity({
        id: 'test-goap',
        components: {
          'core:actor': {},
          'core:player_type': { type: 'goap' },
          'core:name': { text: 'Test GOAP' },
        },
      });

      // Create strategy for entity
      const strategy = factory.create('test-goap');

      // Verify goap provider was selected
      expect(strategy).toBeDefined();
      expect(strategy.decisionProvider).toBe(goapProvider);
    });
  });

  describe('Legacy entity detection', () => {
    it('should default to human provider for entity without player type', () => {
      // Create entity without player_type component
      entityManager.createEntity({
        id: 'test-unknown',
        components: {
          'core:actor': {},
          'core:name': { text: 'Test Unknown' },
        },
      });

      // Create strategy for entity
      const strategy = factory.create('test-unknown');

      // Verify human provider was selected by default
      expect(strategy).toBeDefined();
      expect(strategy.decisionProvider).toBe(humanProvider);
    });

    it('should use llm provider for legacy isAi property', () => {
      // Create entity with legacy isAi property
      entityManager.createEntity({
        id: 'test-legacy-ai',
        components: {
          'core:actor': {},
          'core:name': { text: 'Test Legacy AI' },
        },
        isAi: true,
      });

      // Create strategy for entity
      const strategy = factory.create('test-legacy-ai');

      // Verify llm provider was selected
      expect(strategy).toBeDefined();
      expect(strategy.decisionProvider).toBe(llmProvider);
    });
  });

  describe('Real-world scenario: Joel Overberus', () => {
    it('should correctly identify Joel Overberus as human player', () => {
      // Create Joel Overberus with proper player_type
      entityManager.createEntity({
        id: 'isekai:hero_instance',
        components: {
          'core:actor': {},
          'core:player_type': { type: 'human' },
          'core:name': { text: 'Joel Overberus' },
          'core:description': {
            text: 'A rugged-looking man, likely in his late 30s to 40s...',
          },
          'core:position': { locationId: 'isekai:adventurers_guild_instance' },
          'core:perception_log': { maxEntries: 50, logEntries: [] },
          'core:movement': { locked: false },
        },
      });

      // Create strategy for Joel
      const strategy = factory.create('isekai:hero_instance');

      // Verify human provider was selected
      expect(strategy).toBeDefined();
      expect(strategy.decisionProvider).toBe(humanProvider);

      // Verify that the expected log was called
      expect(logger.debug).toHaveBeenCalledWith(
        'ActorAwareStrategyFactory: Creating GenericTurnStrategy for isekai:hero_instance using provider type human.'
      );
    });
  });
});
