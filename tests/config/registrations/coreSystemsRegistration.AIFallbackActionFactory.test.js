// tests/config/registrations/coreSystemsRegistration.AIFallbackActionFactory.test.js

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
 * @typedef {import('../../../src/entities/entity.js').default} Entity
 */

describe('Core Systems Registrations: Turn Handler Creation', () => {
  let container;

  beforeEach(() => {
    // Reset DOM for UI registrations
    document.body.innerHTML = '';
    const outputDiv = document.createElement('div');
    outputDiv.id = 'outputDiv';
    const messageList = document.createElement('div');
    messageList.id = 'message-list';
    const inputElement = document.createElement('input');
    inputElement.id = 'inputElement';
    const titleElement = document.createElement('h1');
    titleElement.id = 'titleElement';
    document.body.append(outputDiv, messageList, inputElement, titleElement);

    // Create & configure the real container
    container = new AppContainer();
    configureContainer(container, {
      outputDiv,
      inputElement,
      titleElement,
      document,
    });

    // Stub out PromptBuilder & AI-pipeline
    container.register(tokens.IPromptBuilder, () => ({ build: () => '' }), {
      lifecycle: 'singletonFactory',
    });
    container.register(tokens.IAIPromptPipeline, () => ({}), {
      lifecycle: 'singletonFactory',
    });

    // Stub out ITurnContextFactory so AITurnHandler constructor passes
    container.register(tokens.ITurnContextFactory, () => ({}), {
      lifecycle: 'singletonFactory',
    });

    // Stub out IAIPlayerStrategyFactory so resolver can build the handler
    container.register(
      tokens.IAIPlayerStrategyFactory,
      () => ({
        create: () => ({
          // dummy strategy; TurnHandlerResolver doesn’t execute it here
        }),
      }),
      { lifecycle: 'singletonFactory' }
    );
  });

  it('should successfully create an AITurnHandler via the TurnHandlerResolver', async () => {
    // Arrange
    const mockAiActor = {
      id: 'ai-actor-123',
      hasComponent: (comp) =>
        comp === ACTOR_COMPONENT_ID
          ? true
          : comp === PLAYER_COMPONENT_ID
            ? false
            : false,
    };

    // Act
    const resolver = container.resolve(tokens.TurnHandlerResolver);
    expect(resolver).toBeInstanceOf(TurnHandlerResolver);

    let handler;
    await expect(async () => {
      handler = await resolver.resolveHandler(
        /** @type {Entity} */ (mockAiActor)
      );
    }).not.toThrow();

    // Assert
    expect(handler).toBeDefined();
    expect(handler).toBeInstanceOf(AITurnHandler);
  });

  it('should throw an error if AITurnHandler constructor dependencies are manually misconfigured', () => {
    // Arrange
    const brokenContainer = new AppContainer();
    configureContainer(brokenContainer, {
      outputDiv: document.getElementById('outputDiv'),
      inputElement: document.getElementById('inputElement'),
      titleElement: document.getElementById('titleElement'),
      document,
    });

    // Stub same two services
    brokenContainer.register(
      tokens.IPromptBuilder,
      () => ({ build: () => '' }),
      { lifecycle: 'singletonFactory' }
    );
    brokenContainer.register(tokens.IAIPromptPipeline, () => ({}), {
      lifecycle: 'singletonFactory',
    });

    // Stub action discovery and indexing
    brokenContainer.register(
      tokens.IActionDiscoveryService,
      () => ({ getValidActions: () => [] }),
      { lifecycle: 'singletonFactory' }
    );
    brokenContainer.register(
      tokens.ActionIndexingService,
      () => ({ indexActions: () => [] }),
      { lifecycle: 'singletonFactory' }
    );

    // ── Stub IAIPlayerStrategyFactory properly ──
    brokenContainer.register(
      tokens.IAIPlayerStrategyFactory,
      () => ({
        create: () => ({
          // dummy strategy; not invoked here
        }),
      }),
      { lifecycle: 'singletonFactory' }
    );

    // Override AITurnHandler without turnContextFactory
    brokenContainer.register(
      tokens.AITurnHandler,
      (c) =>
        new AITurnHandler({
          logger: c.resolve(tokens.ILogger),
          turnStateFactory: c.resolve(tokens.ITurnStateFactory),
          turnEndPort: c.resolve(tokens.ITurnEndPort),
          aiPlayerStrategyFactory: c.resolve(tokens.IAIPlayerStrategyFactory),
          // turnContextFactory intentionally omitted
        }),
      { lifecycle: 'transient' }
    );

    // Act & Assert
    expect(() => brokenContainer.resolve(tokens.AITurnHandler)).toThrow(
      'AITurnHandler: Invalid ITurnContextFactory'
    );
  });
});
