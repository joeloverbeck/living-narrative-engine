// tests/config/registrations/coreSystemsRegistration.AIFallbackActionFactory.test.js

import { describe, it, expect, beforeEach } from '@jest/globals';

// --- DI Container & Configuration ---
import AppContainer from '../../../../src/dependencyInjection/appContainer.js';
import { configureContainer } from '../../../../src/dependencyInjection/containerConfig.js';
import { tokens } from '../../../../src/dependencyInjection/tokens.js';

// --- Components Under Test & Mocks ---
import TurnHandlerResolver from '../../../../src/turns/services/turnHandlerResolver.js';
import ActorTurnHandler from '../../../../src/turns/handlers/actorTurnHandler.js';
import {
  PLAYER_COMPONENT_ID,
  ACTOR_COMPONENT_ID,
} from '../../../../src/constants/componentIds.js';

/**
 * @typedef {import('../../../../src/entities/entity.js').default} Entity
 */

describe('Core Systems Registrations: Turn Handler Creation', () => {
  let container;

  beforeEach(async () => {
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

    // Mock fetch to prevent HTTP requests for config files
    // This allows config loaders to fail fast without retries
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      headers: new Map(),
    });

    // Create & configure the real container
    container = new AppContainer();
    await configureContainer(container, {
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

    // Stub out TurnContextBuilder so ActorTurnHandler constructor passes
    container.register(tokens.TurnContextBuilder, () => ({}), {
      lifecycle: 'singletonFactory',
    });

    // Stub out IAIPlayerStrategyFactory so resolver can build the handler
    container.register(
      tokens.TurnStrategyFactory,
      () => ({
        create: () => ({
          // dummy strategy; TurnHandlerResolver doesn't execute it here
        }),
      }),
      { lifecycle: 'singletonFactory' }
    );
  });

  it('should successfully create an ActorTurnHandler via the TurnHandlerResolver', async () => {
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
    expect(handler).toBeInstanceOf(ActorTurnHandler);
  });

  it('should throw an error if ActorTurnHandler constructor dependencies are manually misconfigured', async () => {
    // Arrange
    // Mock fetch to prevent HTTP requests for config files
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      headers: new Map(),
    });

    const brokenContainer = new AppContainer();
    await configureContainer(brokenContainer, {
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
      tokens.TurnStrategyFactory,
      () => ({
        create: () => ({
          // dummy strategy; not invoked here
        }),
      }),
      { lifecycle: 'singletonFactory' }
    );

    // Override ActorTurnHandler without turnContextBuilder
    brokenContainer.register(
      tokens.ActorTurnHandler,
      (c) =>
        new ActorTurnHandler({
          logger: c.resolve(tokens.ILogger),
          turnStateFactory: c.resolve(tokens.ITurnStateFactory),
          turnEndPort: c.resolve(tokens.ITurnEndPort),
          strategyFactory: c.resolve(tokens.TurnStrategyFactory),
          // turnContextBuilder intentionally omitted
        }),
      { lifecycle: 'transient' }
    );

    // Act & Assert
    expect(() => brokenContainer.resolve(tokens.ActorTurnHandler)).toThrow(
      'GenericTurnHandler: turnContextBuilder is required'
    );
  });
});
