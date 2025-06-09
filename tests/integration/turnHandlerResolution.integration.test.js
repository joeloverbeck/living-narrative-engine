// tests/integration/turnHandlerResolution.integration.test.js
// ****** MODIFIED FILE ******

// -----------------------------------------------------------------------------
//  T-08 | Integration Test – AITurnHandler Resolution and Startup
// -----------------------------------------------------------------------------
//  Validates that:
//   1. TurnHandlerResolver can create a valid AITurnHandler instance via a factory.
//   2. The AITurnHandler is instantiated with all its required dependencies,
//      including the complex chain needed for AI decision-making.
//   3. Calling startTurn() on the handler does NOT throw an error, proving
//      the dependencies were correctly received and used.
//   4. The turn logic proceeds to the point of calling the AI's strategy,
//      confirming the internal wiring is correct.
// -----------------------------------------------------------------------------

// --- Jest Globals -----------------------------------------------------------
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
import { ConcreteAIPlayerStrategyFactory } from '../../src/turns/factories/concreteAIPlayerStrategyFactory.js';
import { ACTOR_COMPONENT_ID } from '../../src/constants/componentIds.js';

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

describe('T-08: AITurnHandler Resolution and Startup', () => {
  let resolver;
  let logger;
  let mockTurnState;
  let mockAiPromptPipeline;
  let aiStrategyFactory;
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

    aiStrategyFactory = new ConcreteAIPlayerStrategyFactory();
    jest
      .spyOn(aiStrategyFactory, 'create')
      .mockImplementation((deps) => new StubAIPlayerStrategy(deps));
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
      aiPlayerStrategyFactory: aiStrategyFactory,
      turnContextFactory: mockTurnContextFactory,
      gameStateProvider: {},
      promptContentProvider: {},
      llmResponseProcessor: { processResponse: jest.fn() },
      aiPromptPipeline: mockAiPromptPipeline,
    };

    const createAiHandlerFactory = () => new AITurnHandler(stubs);

    resolver = new TurnHandlerResolver({
      logger,
      createPlayerTurnHandler: jest.fn(),
      createAiTurnHandler: createAiHandlerFactory,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should successfully start a turn for an AI actor without throwing', async () => {
    const handler = await resolver.resolveHandler(aiActor);
    expect(handler).toBeInstanceOf(AITurnHandler);

    await expect(handler.startTurn(aiActor)).resolves.not.toThrow();

    expect(mockTurnContextFactory.create).toHaveBeenCalledTimes(1);
    expect(stubs.aiPlayerStrategyFactory.create).toHaveBeenCalledTimes(1);
    expect(stubs.aiPlayerStrategyFactory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        aiPromptPipeline: mockAiPromptPipeline,
        logger,
      })
    );
    expect(mockTurnState.startTurn).toHaveBeenCalledTimes(1);
  });
});
