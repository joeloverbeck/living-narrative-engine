// tests/integration/turnHandlerResolution.integration.test.js
// -----------------------------------------------------------------------------
//  T-08 | Integration Test – ActorTurnHandler Resolution and Startup
// -----------------------------------------------------------------------------

import {
  describe,
  beforeEach,
  afterEach,
  it,
  expect,
  jest,
} from '@jest/globals';

import ActorTurnHandler from '../../src/turns/handlers/actorTurnHandler.js';
import TurnHandlerResolver from '../../src/turns/services/turnHandlerResolver.js';
import {
  ACTOR_COMPONENT_ID,
  PLAYER_COMPONENT_ID,
} from '../../src/constants/componentIds.js';
import {
  createMockLogger,
  createMockAIPromptPipeline,
} from '../common/mockFactories.js';

// --- Test-Scoped Mocks & Stubs ----------------------------------------------
class SimpleEntity {
  constructor(id, components) {
    this.id = id;
    this._components = new Set(components);
  }

  hasComponent(componentId) {
    return this._components.has(componentId);
  }
}

class StubAIPlayerStrategy {
  constructor(deps) {
    if (!deps.logger) throw new Error('Missing logger');
    if (!deps.llmAdapter) throw new Error('Missing llmAdapter');
    if (!deps.aiPromptPipeline) throw new Error('Missing aiPromptPipeline');
    if (!deps.llmResponseProcessor)
      throw new Error('Missing llmResponseProcessor');
    if (!deps.aiFallbackActionFactory)
      throw new Error('Missing aiFallbackActionFactory');
  }

  decideAction = jest.fn();
}

const AI_ACTOR_ID = 'ai-npc-1';

/**
 * Builds a fully wired ActorTurnHandler integration fixture so tests exercise the
 * production collaborators instead of isolated mocks.
 */
function createActorTurnHandlerTestBed() {
  const logger = createMockLogger();
  const aiActor = new SimpleEntity(AI_ACTOR_ID, [ACTOR_COMPONENT_ID]);
  const mockAiPromptPipeline = createMockAIPromptPipeline();

  const mockTurnState = {
    startTurn: jest.fn(),
    enterState: jest.fn(),
    exitState: jest.fn(),
    getStateName: () => 'MockInitialState',
  };

  const mockEntityManager = { getEntityInstance: (id) => ({ id }) };
  const mockTurnContextBuilder = { build: jest.fn() };

  const stubs = {
    logger,
    turnStateFactory: {
      createInitialState: jest.fn(() => mockTurnState),
    },
    turnEndPort: {},
    gameWorldAccess: {},
    llmAdapter: {
      getAIDecision: jest.fn(),
      cancelOngoingOperations: jest.fn(),
    },
    commandProcessor: {},
    commandOutcomeInterpreter: {},
    safeEventDispatcher: {},
    entityManager: mockEntityManager,
    actionDiscoverySystem: {},
    promptBuilder: {},
    aiFallbackActionFactory: { create: jest.fn() },
    turnContextBuilder: mockTurnContextBuilder,
    gameStateProvider: {},
    promptContentProvider: {},
    llmResponseProcessor: { processResponse: jest.fn() },
    aiPromptPipeline: mockAiPromptPipeline,
  };

  stubs.strategyFactory = {
    create: jest.fn(() => new StubAIPlayerStrategy(stubs)),
  };

  const createAiHandlerFactory = () => new ActorTurnHandler(stubs);

  const defaultHandlerRules = [
    {
      name: 'Player',
      predicate: (actor) => actor.hasComponent(PLAYER_COMPONENT_ID),
      factory: jest.fn(),
    },
    {
      name: 'AI',
      predicate: (actor) => actor.hasComponent(ACTOR_COMPONENT_ID),
      factory: createAiHandlerFactory,
    },
  ];

  const buildResolver = (handlerRules = defaultHandlerRules) =>
    new TurnHandlerResolver({
      logger,
      handlerRules,
    });

  return {
    logger,
    aiActor,
    mockTurnContextBuilder,
    mockTurnState,
    stubs,
    createAiHandlerFactory,
    defaultHandlerRules,
    buildResolver,
  };
}

// --- Test Suite -------------------------------------------------------------
describe('T-08: ActorTurnHandler Resolution and Startup', () => {
  let resolver;
  let logger;
  let mockTurnState;
  let mockTurnContextBuilder;
  let stubs;
  let aiActor;

  beforeEach(() => {
    const fixture = createActorTurnHandlerTestBed();
    ({
      logger,
      mockTurnContextBuilder,
      mockTurnState,
      stubs,
      aiActor,
    } = fixture);
    resolver = fixture.buildResolver();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should successfully start a turn for an AI actor without throwing', async () => {
    // 1. Resolve the handler.
    const handler = await resolver.resolveHandler(aiActor);
    expect(handler).toBeInstanceOf(ActorTurnHandler);

    // 2. Start the turn; should not throw.
    await expect(handler.startTurn(aiActor)).resolves.not.toThrow();

    // 3. Verify key calls.
    expect(mockTurnContextBuilder.build).toHaveBeenCalledTimes(1);
    expect(stubs.strategyFactory.create).toHaveBeenCalledTimes(1);
    expect(stubs.strategyFactory.create).toHaveBeenCalled();
    expect(mockTurnState.startTurn).toHaveBeenCalledTimes(1);
  });
});

describe('TurnHandlerResolver integration edge cases', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('logs a warning and returns null when the actor is invalid', async () => {
    const { buildResolver, logger } = createActorTurnHandlerTestBed();
    const resolver = buildResolver();

    const result = await resolver.resolveHandler(null);

    expect(result).toBeNull();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('invalid or null actor')
    );
  });

  it('continues to later rules when a predicate throws', async () => {
    const fixture = createActorTurnHandlerTestBed();
    const { logger, aiActor, createAiHandlerFactory } = fixture;

    const resolver = fixture.buildResolver([
      {
        name: 'Broken',
        predicate: () => {
          throw new Error('Predicate failure');
        },
        factory: jest.fn(),
      },
      {
        name: 'AI',
        predicate: (actor) => actor.hasComponent(ACTOR_COMPONENT_ID),
        factory: createAiHandlerFactory,
      },
    ]);

    const handler = await resolver.resolveHandler(aiActor);

    expect(handler).toBeInstanceOf(ActorTurnHandler);
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining("Error executing predicate for rule 'Broken'"),
      expect.any(Error)
    );
  });

  it('logs and returns null when a factory produces an invalid handler', async () => {
    const logger = createMockLogger();
    const actor = new SimpleEntity('test-actor', [ACTOR_COMPONENT_ID]);
    const resolver = new TurnHandlerResolver({
      logger,
      handlerRules: [
        {
          name: 'InvalidHandler',
          predicate: () => true,
          factory: () => ({}),
        },
      ],
    });

    const handler = await resolver.resolveHandler(actor);

    expect(handler).toBeNull();
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('factory did not return a valid handler')
    );
  });

  it('logs and returns null when a factory throws an error', async () => {
    const logger = createMockLogger();
    const actor = new SimpleEntity('test-actor', [ACTOR_COMPONENT_ID]);
    const resolver = new TurnHandlerResolver({
      logger,
      handlerRules: [
        {
          name: 'Explosive',
          predicate: () => true,
          factory: () => {
            throw new Error('Factory boom');
          },
        },
      ],
    });

    const handler = await resolver.resolveHandler(actor);

    expect(handler).toBeNull();
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Error creating ExplosiveHandler for actor test-actor'),
      expect.any(Error)
    );
  });

  it('throws and logs when handlerRules is not an array', () => {
    const logger = createMockLogger();

    expect(
      () => new TurnHandlerResolver({ logger, handlerRules: null })
    ).toThrow('TurnHandlerResolver requires handlerRules to be an array.');

    expect(logger.error).toHaveBeenCalledWith(
      'TurnHandlerResolver requires handlerRules to be an array.'
    );
  });
});
