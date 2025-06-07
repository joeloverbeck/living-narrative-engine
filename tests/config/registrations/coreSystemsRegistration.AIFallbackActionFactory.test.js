// src/tests/dependencyInjection/coreSystemsRegistrations.test.js
import { describe, it, expect, beforeEach } from '@jest/globals';

// --- DI Container & Configuration ---
import AppContainer from '../../../src/dependencyInjection/appContainer.js';
import { configureContainer } from '../../../src/dependencyInjection/containerConfig.js';
import { tokens } from '../../../src/dependencyInjection/tokens.js';

// --- Components Under Test & Mocks ---
import TurnHandlerResolver from '../../../src/turns/services/turnHandlerResolver.js';
import AITurnHandler from '../../../src/turns/handlers/aiTurnHandler.js';
import {
  PLAYER_COMPONENT_ID,
  ACTOR_COMPONENT_ID,
} from '../../../src/constants/componentIds.js';

/**
 * @typedef {import('../../src/entities/entity.js').default} Entity
 */

describe('Core Systems Registrations: Turn Handler Creation', () => {
  let container;

  beforeEach(() => {
    // 1. Create a fresh, fully configured container for each test.
    // This ensures we are testing the actual registration logic as it runs in the app.
    container = new AppContainer();
    configureContainer(container, {
      // Provide mock DOM elements required by the full configuration
      outputDiv: document.createElement('div'),
      inputElement: document.createElement('input'),
      titleElement: document.createElement('h1'),
    });
  });

  it('should successfully create an AITurnHandler via the TurnHandlerResolver', async () => {
    // --- Arrange ---
    // 1. Define a mock entity that represents an AI actor.
    // The resolver identifies an AI by the presence of 'actor' and absence of 'player'.
    const mockAiActor = {
      id: 'ai-actor-123',
      /** @param {string} componentId */
      hasComponent: (componentId) => {
        return (
          componentId === ACTOR_COMPONENT_ID &&
          componentId !== PLAYER_COMPONENT_ID
        );
      },
    };

    // --- Act ---
    // 2. Resolve the TurnHandlerResolver from the container. This is the service
    // responsible for creating handlers.
    const resolver = container.resolve(tokens.TurnHandlerResolver);
    expect(resolver).toBeInstanceOf(TurnHandlerResolver);

    // 3. Attempt to create the AI handler. The key assertion is that this does NOT throw.
    // The original bug would cause a "Invalid IAIFallbackActionFactory" error here.
    let handler;
    await expect(async () => {
      handler = await resolver.resolveHandler(
        /** @type {Entity} */ (mockAiActor)
      );
    }).not.toThrow();

    // --- Assert ---
    // 4. Verify that the created handler is of the correct type and is not null.
    // This confirms the resolution logic worked correctly and passed all dependencies.
    expect(handler).toBeDefined();
    expect(handler).not.toBeNull();
    expect(handler).toBeInstanceOf(AITurnHandler);
  });

  it('should throw an error if AITurnHandler constructor dependencies are manually misconfigured', () => {
    // --- Arrange ---
    // This is a sanity check to prove our test works. We'll register a broken
    // factory for AITurnHandler that omits the dependency.

    const brokenContainer = new AppContainer();
    configureContainer(brokenContainer, {
      outputDiv: document.createElement('div'),
      inputElement: document.createElement('input'),
      titleElement: document.createElement('h1'),
    });

    // Override the correct registration with a broken one
    brokenContainer.register(
      tokens.AITurnHandler,
      (c) => {
        // Intentionally create an AITurnHandler without aiFallbackActionFactory
        return new AITurnHandler({
          logger: c.resolve(tokens.ILogger),
          turnStateFactory: c.resolve(tokens.ITurnStateFactory),
          gameWorldAccess: c.resolve(tokens.IWorldContext),
          turnEndPort: c.resolve(tokens.ITurnEndPort),
          illmAdapter: c.resolve(tokens.ILLMAdapter),
          commandProcessor: c.resolve(tokens.ICommandProcessor),
          commandOutcomeInterpreter: c.resolve(
            tokens.ICommandOutcomeInterpreter
          ),
          safeEventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
          subscriptionManager: c.resolve(tokens.SubscriptionLifecycleManager),
          entityManager: c.resolve(tokens.IEntityManager),
          actionDiscoverySystem: c.resolve(tokens.IActionDiscoveryService),
          promptBuilder: c.resolve(tokens.IPromptBuilder),
          // --- INTENTIONALLY MISSING ---
          // aiFallbackActionFactory: c.resolve(tokens.IAIFallbackActionFactory),
          // --- INTENTIONALLY MISSING ---
          aiPlayerStrategyFactory: c.resolve(tokens.IAIPlayerStrategyFactory),
          turnContextFactory: c.resolve(tokens.ITurnContextFactory),
          gameStateProvider: c.resolve(tokens.IAIGameStateProvider),
          promptContentProvider: c.resolve(tokens.IAIPromptContentProvider),
          llmResponseProcessor: c.resolve(tokens.ILLMResponseProcessor),
        });
      },
      { lifecycle: 'transient' }
    ); // Use transient to ensure our factory is called

    // --- Act & Assert ---
    // We expect the resolution of this misconfigured handler to fail with the exact error message.
    expect(() => brokenContainer.resolve(tokens.AITurnHandler)).toThrow(
      'AITurnHandler: Invalid IAIFallbackActionFactory'
    );
  });
});
