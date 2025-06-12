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
// Import PLAYER_COMPONENT_ID to create a complete set of rules
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

    mockEntityManager = { getEntityInstance: (id) => ({ id }) };
    mockTurnContextFactory = { create: jest.fn() };

    // A comprehensive set of stubs to satisfy the AITurnHandler constructor
    // This is defined before the factory so we can use it to construct the factory.
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
      aiPlayerStrategyFactory: null, // Will be replaced below
      turnContextFactory: mockTurnContextFactory,
      gameStateProvider: {},
      promptContentProvider: {},
      llmResponseProcessor: { processResponse: jest.fn() },
      aiPromptPipeline: mockAiPromptPipeline,
    };

    // MODIFIED: Instantiate the factory with its required dependencies from the stubs.
    aiStrategyFactory = new ConcreteAIPlayerStrategyFactory({
      llmAdapter: stubs.llmAdapter,
      aiPromptPipeline: stubs.aiPromptPipeline,
      llmResponseProcessor: stubs.llmResponseProcessor,
      aiFallbackActionFactory: stubs.aiFallbackActionFactory,
      logger: stubs.logger,
    });

    // MODIFIED: The stubbed strategy needs its own dependencies for its constructor.
    // We pass the `stubs` object directly, as the real `create` method is now parameterless.
    jest
      .spyOn(aiStrategyFactory, 'create')
      .mockImplementation(() => new StubAIPlayerStrategy(stubs));

    // Now, insert the real, spied-upon factory instance into the stubs object.
    stubs.aiPlayerStrategyFactory = aiStrategyFactory;

    // Factory function that creates a real AITurnHandler with all stubbed dependencies
    const createAiHandlerFactory = () => new AITurnHandler(stubs);

    // Define the handler rules array for the new resolver constructor
    const handlerRules = [
      {
        name: 'Player',
        predicate: (actor) => actor.hasComponent(PLAYER_COMPONENT_ID),
        factory: jest.fn(), // Mock player factory, not used in this test
      },
      {
        name: 'AI',
        predicate: (actor) => actor.hasComponent(ACTOR_COMPONENT_ID),
        factory: createAiHandlerFactory, // Use the real AI handler factory
      },
    ];

    // Instantiate the resolver with the new dependency structure
    resolver = new TurnHandlerResolver({
      logger,
      handlerRules,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should successfully start a turn for an AI actor without throwing', async () => {
    // 1. Resolve the handler. The resolver should find the 'AI' rule and use its factory.
    const handler = await resolver.resolveHandler(aiActor);
    expect(handler).toBeInstanceOf(AITurnHandler);

    // 2. Start the turn. This should not throw, proving dependencies were injected correctly.
    await expect(handler.startTurn(aiActor)).resolves.not.toThrow();

    // 3. Verify that key factories and methods inside the handler were called.
    expect(mockTurnContextFactory.create).toHaveBeenCalledTimes(1);
    expect(stubs.aiPlayerStrategyFactory.create).toHaveBeenCalledTimes(1);

    // MODIFIED: The create method is now parameterless, so we just check that it was called.
    expect(stubs.aiPlayerStrategyFactory.create).toHaveBeenCalled();

    expect(mockTurnState.startTurn).toHaveBeenCalledTimes(1);
  });
});
