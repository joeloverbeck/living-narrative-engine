import { describe, beforeEach, it, expect, jest } from '@jest/globals';
import AppContainer from '../../src/dependencyInjection/appContainer.js';
import { registerAI } from '../../src/dependencyInjection/registrations/aiRegistrations.js';
import { tokens } from '../../src/dependencyInjection/tokens.js';
import { ConfigurableLLMAdapter } from '../../src/turns/adapters/configurableLLMAdapter.js';
import ActorTurnHandler from '../../src/turns/handlers/actorTurnHandler.js';

describe('registerAI', () => {
  /** @type {AppContainer} */
  let container;

  beforeEach(() => {
    container = new AppContainer();
    const logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    container.register(tokens.ILogger, logger);
    container.register(tokens.ProxyUrl, 'http://proxy.test');
    container.register(tokens.ISafeEventDispatcher, { dispatch: jest.fn() });
    container.register(tokens.IValidatedEventDispatcher, {
      dispatch: jest.fn(),
    });
    container.register(tokens.ISchemaValidator, {
      validate: jest.fn(),
      isSchemaLoaded: jest.fn(),
      loadSchema: jest.fn(),
    });
    container.register(tokens.IActionDiscoveryService, {
      getValidActions: jest.fn(),
    });
    container.register(tokens.IEntityManager, { getEntityInstance: jest.fn() });
    container.register(tokens.ActionIndexingService, {
      indexActions: jest.fn(),
      resolve: jest.fn(),
      beginTurn: jest.fn(),
    });
    container.register(tokens.JsonLogicEvaluationService, {
      evaluate: jest.fn(),
    });
    container.register(tokens.ITurnStateFactory, {
      createInitialState: jest.fn().mockReturnValue({ enterState: jest.fn() }),
    });
    container.register(tokens.ITurnEndPort, {});
    container.register(tokens.ICommandProcessor, {});
    container.register(tokens.TurnStrategyFactory, {});
    container.register(tokens.TurnContextBuilder, {});
  });

  it('registers and resolves core AI services', () => {
    registerAI(container);

    const adapter1 = container.resolve(tokens.LLMAdapter);
    const adapter2 = container.resolve(tokens.LLMAdapter);
    expect(adapter1).toBeInstanceOf(ConfigurableLLMAdapter);
    expect(adapter1).toBe(adapter2); // singleton

    // ActorTurnHandler is registered as a transient factory
    // but resolving it requires a fully wired turn lifecycle.
    // Here we simply verify that the registration exists.
    expect(container.isRegistered(tokens.ActorTurnHandler)).toBe(true);
  });
});
