/**
 * @file Test suite that proves state isolation within the TurnContext.
 * @description This test verifies that per-turn state, such as waiting for an external event,
 * is managed by the TurnContext and does not leak between turns handled by the same AITurnHandler instance.
 * This confirms a key benefit of the refactoring.
 * @see tests/turns/handlers/aiTurnHandler.awaitingExternalEvent.test.js
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { TurnContext } from '../../../src/turns/context/turnContext.js';
import AITurnHandler from '../../../src/turns/handlers/aiTurnHandler.js';

/**
 * @typedef {import('../../../src/entities/entity.js').default} Entity
 */

describe('TurnContext State Isolation', () => {
  let mockTurnContextFactory;
  let mockTurnStateFactory;
  let mockAiPlayerStrategyFactory;
  let mockLogger;
  let mockTurnEndPort;
  let mockServices;

  beforeEach(() => {
    // Mock primary dependencies required by AITurnHandler and its factories
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    const mockTurnState = {
      enterState: jest.fn(),
      exitState: jest.fn(),
      startTurn: jest.fn(),
      getStateName: () => 'MockTurnState',
      destroy: jest.fn(),
      // FIX: Add isEnding and isIdle methods to the mock state object
      // to match the new ITurnState interface used by BaseTurnHandler.
      isEnding: jest.fn().mockReturnValue(false),
      isIdle: jest.fn().mockReturnValue(false),
    };

    mockTurnStateFactory = {
      createInitialState: jest.fn().mockReturnValue(mockTurnState),
      createEndingState: jest.fn().mockReturnValue({
        ...mockTurnState,
        isEnding: jest.fn().mockReturnValue(true),
        getStateName: () => 'MockEndingState',
      }),
      createIdleState: jest.fn().mockReturnValue({
        ...mockTurnState,
        isIdle: jest.fn().mockReturnValue(true),
        getStateName: () => 'MockIdleState',
      }),
    };

    mockTurnEndPort = {
      turnEnded: jest.fn(),
    };

    // This mock object is to simulate the services that the *real* TurnContextFactory
    // would inject into a new TurnContext. It is NOT a direct dependency of AITurnHandler anymore.
    mockServices = {
      gameWorldAccess: {},
      commandProcessor: {},
      commandOutcomeInterpreter: {},
      safeEventDispatcher: {},
      entityManager: {},
      actionDiscoverySystem: {},
    };

    // This is the key mock to spy on TurnContext creation.
    // The factory's `create` method is responsible for internally providing the logger and services.
    // We must simulate this behavior for the test to work.
    mockTurnContextFactory = {
      create: jest.fn((createArgs) => {
        // The real factory supplies the logger and services. We simulate this by combining
        // the arguments from the `create` call with the mocks in the test's scope.
        const fullArgsForConstructor = {
          ...createArgs, // Contains actor, strategy, onEndTurnCallback, etc.
          logger: mockLogger,
          services: {
            // These are the services a real TurnContext needs.
            game: mockServices.gameWorldAccess,
            turnEndPort: mockTurnEndPort,
            commandProcessor: mockServices.commandProcessor,
            commandOutcomeInterpreter: mockServices.commandOutcomeInterpreter,
            safeEventDispatcher: mockServices.safeEventDispatcher,
            entityManager: mockServices.entityManager,
            actionDiscoverySystem: mockServices.actionDiscoverySystem,
          },
        };
        // We return a REAL TurnContext instance so we can test its behavior.
        return new TurnContext(fullArgsForConstructor);
      }),
    };

    mockAiPlayerStrategyFactory = {
      create: jest.fn().mockReturnValue({ decideAction: jest.fn() }),
    };
  });

  it('should ensure `isAwaitingExternalEvent` state is isolated between turns', async () => {
    // --- Arrange ---
    // CORRECTED: The AITurnHandler is now instantiated with only its direct dependencies.
    // The long list of services has been removed as they are now encapsulated
    // within the factories.
    const handler = new AITurnHandler({
      logger: mockLogger,
      turnStateFactory: mockTurnStateFactory,
      turnEndPort: mockTurnEndPort,
      turnContextFactory: mockTurnContextFactory,
      aiPlayerStrategyFactory: mockAiPlayerStrategyFactory,
    });

    const aiActor1 = { id: 'ai-actor-1', hasComponent: () => true };
    const aiActor2 = { id: 'ai-actor-2', hasComponent: () => true };

    // --- TURN 1 for aiActor1 ---

    // Act: Start the first turn. This will create the first TurnContext via the factory.
    await handler.startTurn(aiActor1);

    // Assert: A TurnContext was created for actor 1.
    expect(mockTurnContextFactory.create).toHaveBeenCalledTimes(1);
    const context1CreateArgs = mockTurnContextFactory.create.mock.calls[0][0];
    expect(context1CreateArgs.actor.id).toBe('ai-actor-1');

    // Retrieve the actual TurnContext instance that was created.
    const context1 = mockTurnContextFactory.create.mock.results[0].value;

    // Act: Set the "awaiting event" state ON THE CONTEXT ITSELF.
    context1.setAwaitingExternalEvent(true, aiActor1.id);

    // Assert: The state is correctly set on the first context.
    expect(context1.isAwaitingExternalEvent()).toBe(true);

    // Act: End the first turn by invoking the `onEndTurnCallback` passed to the context.
    // This simulates the turn lifecycle completing and cleans up the first context.
    const onEndTurnCallback1 = context1CreateArgs.onEndTurnCallback;
    expect(onEndTurnCallback1).toBeInstanceOf(Function);
    await onEndTurnCallback1(); // This transitions the handler to idle.

    // --- TURN 2 for aiActor2 ---

    // Act: Start the second turn with a different actor. This will create a NEW TurnContext.
    await handler.startTurn(aiActor2);

    // Assert: A *new* TurnContext was created for actor 2.
    expect(mockTurnContextFactory.create).toHaveBeenCalledTimes(2);
    const context2CreateArgs = mockTurnContextFactory.create.mock.calls[1][0];
    expect(context2CreateArgs.actor.id).toBe('ai-actor-2');
    const context2 = mockTurnContextFactory.create.mock.results[1].value;

    // --- Final Assertion ---
    // Assert that the new context has the default state (false), proving
    // that the state from the first turn's context did not leak.
    expect(context2.isAwaitingExternalEvent()).toBe(false);

    // Sanity check that the handler itself no longer contains these state properties/methods.
    expect(handler).not.toHaveProperty('#aiIsAwaitingExternalEvent');
    expect(handler._getAIIsAwaitingExternalEventFlag).toBeUndefined();
    expect(handler._setAIIsAwaitingExternalEventFlag).toBeUndefined();
  });
});
