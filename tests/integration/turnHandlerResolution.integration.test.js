// tests/integration/turnHandlerResolution.integration.test.js
// -----------------------------------------------------------------------------
//  T-08 | Integration Test – AITurnHandler Resolution and Startup
// -----------------------------------------------------------------------------

import {
  describe,
  beforeEach,
  afterEach,
  it,
  expect,
  jest,
} from '@jest/globals';

import { AITurnHandler } from '../../src/turns/handlers/aiTurnHandler.js';
import TurnHandlerResolver from '../../src/turns/services/turnHandlerResolver.js';
import {
  ACTOR_COMPONENT_ID,
  PLAYER_COMPONENT_ID,
} from '../../src/constants/componentIds.js';

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

// --- Test Suite -------------------------------------------------------------
describe('T-08: AITurnHandler Resolution and Startup', () => {
  let resolver;
  let logger;
  let mockTurnState;
  let mockAiPromptPipeline;
  let mockEntityManager;
  let mockTurnContextFactory;
  let stubs;
  const AI_ACTOR_ID = 'ai-npc-1';
  let aiActor;

  beforeEach(() => {
    logger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };
    aiActor = new SimpleEntity(AI_ACTOR_ID, [ACTOR_COMPONENT_ID]);
    mockAiPromptPipeline = { generatePrompt: jest.fn() };

    mockTurnState = {
      startTurn: jest.fn(),
      enterState: jest.fn(),
      exitState: jest.fn(),
      getStateName: () => 'MockInitialState',
    };

    mockEntityManager = { getEntityInstance: (id) => ({ id }) };
    mockTurnContextFactory = { create: jest.fn() };

    stubs = {
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
      // stub strategy factory directly:
      aiPlayerStrategyFactory: {
        create: jest.fn(() => new StubAIPlayerStrategy(stubs)),
      },
      turnContextFactory: mockTurnContextFactory,
      gameStateProvider: {},
      promptContentProvider: {},
      llmResponseProcessor: { processResponse: jest.fn() },
      aiPromptPipeline: mockAiPromptPipeline,
    };

    // Build AITurnHandler factory and resolver rules
    const createAiHandlerFactory = () => new AITurnHandler(stubs);

    const handlerRules = [
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

    resolver = new TurnHandlerResolver({
      logger,
      handlerRules,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should successfully start a turn for an AI actor without throwing', async () => {
    // 1. Resolve the handler.
    const handler = await resolver.resolveHandler(aiActor);
    expect(handler).toBeInstanceOf(AITurnHandler);

    // 2. Start the turn; should not throw.
    await expect(handler.startTurn(aiActor)).resolves.not.toThrow();

    // 3. Verify key calls.
    expect(mockTurnContextFactory.create).toHaveBeenCalledTimes(1);
    expect(stubs.aiPlayerStrategyFactory.create).toHaveBeenCalledTimes(1);
    expect(stubs.aiPlayerStrategyFactory.create).toHaveBeenCalled();
    expect(mockTurnState.startTurn).toHaveBeenCalledTimes(1);
  });
});
