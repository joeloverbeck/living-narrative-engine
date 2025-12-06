/**
 * @file Additional integration coverage for CharacterBuilderBootstrap
 * @description Exercises failure and fallback paths using real DI container setup
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { CharacterBuilderBootstrap } from '../../../src/characterBuilder/CharacterBuilderBootstrap.js';
import { tokens } from '../../../src/dependencyInjection/tokens.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../src/constants/systemEventIds.js';
import { TraitsDisplayEnhancer as RealTraitsDisplayEnhancer } from '../../../src/characterBuilder/services/TraitsDisplayEnhancer.js';

/**
 * Minimal controller used in multiple scenarios to satisfy bootstrap requirements.
 */
class NoopController {
  constructor(dependencies = {}) {
    this.dependencies = dependencies;
  }

  async initialize() {
    return true;
  }
}

describe('CharacterBuilderBootstrap - additional resilience scenarios (integration)', () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
    document.body.innerHTML = '';
    jest.useRealTimers();
  });

  const successfulSchemaFetch = () =>
    jest.fn().mockImplementation(async () => ({
      ok: true,
      json: async () => ({ type: 'object' }),
    }));

  it('logs a warning when critical system event registration fails but continues bootstrap', async () => {
    global.fetch = successfulSchemaFetch();
    const bootstrap = new CharacterBuilderBootstrap();

    let logger;

    const { controller } = await bootstrap.bootstrap({
      pageName: 'Critical Event Failure Path',
      controllerClass: NoopController,
      includeModLoading: false,
      hooks: {
        preContainer: async (container) => {
          logger = container.resolve(tokens.ILogger);
          jest.spyOn(logger, 'warn');

          const schemaValidator = container.resolve(tokens.ISchemaValidator);
          jest
            .spyOn(schemaValidator, 'addSchema')
            .mockRejectedValueOnce(new Error('schema registration failed'));
        },
      },
    });

    expect(controller).toBeInstanceOf(NoopController);
    const warnCall = logger.warn.mock.calls.find(([message]) =>
      message.includes('Failed to register critical system event')
    );
    expect(warnCall).toBeDefined();
  });

  it('records schema loading failures when fetch returns a non-ok response', async () => {
    global.fetch = jest.fn().mockImplementation(async (url) => {
      if (String(url).includes('llm-configs')) {
        return { ok: false, status: 500 };
      }

      return {
        ok: true,
        json: async () => ({ type: 'object' }),
      };
    });

    const bootstrap = new CharacterBuilderBootstrap();
    let logger;

    const { controller } = await bootstrap.bootstrap({
      pageName: 'Schema Failure Path',
      controllerClass: NoopController,
      customSchemas: ['/data/schemas/custom-example.schema.json'],
      hooks: {
        preContainer: async (container) => {
          logger = container.resolve(tokens.ILogger);
          jest.spyOn(logger, 'warn');
        },
      },
    });

    expect(controller).toBeInstanceOf(NoopController);
    const warnCall = logger.warn.mock.calls.find(([message]) =>
      message.includes('Failed to load schema')
    );
    expect(warnCall).toBeDefined();
  });

  it('warns when mod loading is requested but the ModsLoader is unavailable', async () => {
    global.fetch = successfulSchemaFetch();
    const bootstrap = new CharacterBuilderBootstrap();
    let logger;

    const { controller } = await bootstrap.bootstrap({
      pageName: 'Missing Mods Loader',
      controllerClass: NoopController,
      includeModLoading: true,
      hooks: {
        preContainer: async (container) => {
          logger = container.resolve(tokens.ILogger);
          jest.spyOn(logger, 'warn');
          container.setOverride(tokens.ModsLoader, undefined);
        },
      },
    });

    expect(controller).toBeInstanceOf(NoopController);
    const warnCall = logger.warn.mock.calls.find(([message]) =>
      message.includes('[CharacterBuilderBootstrap] ModsLoader not available')
    );
    expect(warnCall).toBeDefined();
  });

  it('warns when the LLM adapter lacks a configuration loader', async () => {
    global.fetch = successfulSchemaFetch();
    const bootstrap = new CharacterBuilderBootstrap();
    let logger;

    const { controller } = await bootstrap.bootstrap({
      pageName: 'LLM Config Loader Missing',
      controllerClass: NoopController,
      hooks: {
        preContainer: async (container) => {
          logger = container.resolve(tokens.ILogger);
          jest.spyOn(logger, 'warn');
          container.setOverride(tokens.LlmConfigLoader, undefined);
        },
      },
    });

    expect(controller).toBeInstanceOf(NoopController);
    const warnCall = logger.warn.mock.calls.find(([message]) =>
      message.includes(
        '[CharacterBuilderBootstrap] LlmConfigLoader not available, skipping LLM initialization'
      )
    );
    expect(warnCall).toBeDefined();
  });

  it('logs when the LLM adapter itself is missing', async () => {
    global.fetch = successfulSchemaFetch();
    const bootstrap = new CharacterBuilderBootstrap();
    let logger;

    const { controller } = await bootstrap.bootstrap({
      pageName: 'Missing LLM Adapter',
      controllerClass: NoopController,
      hooks: {
        preContainer: async (container) => {
          logger = container.resolve(tokens.ILogger);
          jest.spyOn(logger, 'debug');
          const adapterStub = {
            getAIDecision: jest.fn(),
          };
          container.setOverride(tokens.LLMAdapter, adapterStub);
        },
      },
    });

    expect(controller).toBeInstanceOf(NoopController);
    const debugCall = logger.debug.mock.calls.find(([message]) =>
      message.includes(
        '[CharacterBuilderBootstrap] LLM adapter not available or already initialized'
      )
    );
    expect(debugCall).toBeDefined();
  });

  it('initializes the LLM configuration manager when available', async () => {
    global.fetch = successfulSchemaFetch();
    const bootstrap = new CharacterBuilderBootstrap();
    let initSpy;

    const { controller } = await bootstrap.bootstrap({
      pageName: 'LLM Config Manager Initialization',
      controllerClass: NoopController,
      hooks: {
        preContainer: async (container) => {
          const managerStub = {
            init: jest.fn().mockResolvedValue(undefined),
            isInitialized: false,
            getActiveConfiguration: jest
              .fn()
              .mockResolvedValue({ configId: 'stub-config' }),
            loadConfiguration: jest.fn().mockResolvedValue(null),
            setActiveConfiguration: jest.fn().mockResolvedValue(true),
          };
          initSpy = managerStub.init;
          container.setOverride(tokens.ILLMConfigurationManager, managerStub);
        },
      },
    });

    expect(controller).toBeInstanceOf(NoopController);
    expect(initSpy).toHaveBeenCalledWith({
      llmConfigLoader: expect.anything(),
    });
  });

  it('surfaces CharacterStorageService failures during bootstrap', async () => {
    global.fetch = successfulSchemaFetch();
    const bootstrap = new CharacterBuilderBootstrap();

    await expect(
      bootstrap.bootstrap({
        pageName: 'Storage Failure',
        controllerClass: NoopController,
        hooks: {
          preContainer: async (container) => {
            const logger = container.resolve(tokens.ILogger);
            jest.spyOn(logger, 'error');
            container.setOverride(tokens.CharacterStorageService, {
              initialize: () => {
                throw new Error('storage init failed');
              },
            });
          },
        },
      })
    ).rejects.toThrow('storage init failed');
  });

  it('logs a warning when custom service registration throws', async () => {
    global.fetch = successfulSchemaFetch();
    const bootstrap = new CharacterBuilderBootstrap();
    let logger;

    const { controller } = await bootstrap.bootstrap({
      pageName: 'Custom Service Registration Failure',
      controllerClass: NoopController,
      services: {
        problemService: class ProblemService {},
      },
      hooks: {
        preContainer: async (container) => {
          logger = container.resolve(tokens.ILogger);
          jest.spyOn(logger, 'warn');

          const originalRegister = container.register.bind(container);
          container.register = (token, service, options) => {
            if (token === 'problemService') {
              throw new Error('Registration failed');
            }
            return originalRegister(token, service, options);
          };
        },
      },
    });

    expect(controller).toBeInstanceOf(NoopController);
    const warnCall = logger.warn.mock.calls.find(([message]) =>
      message.includes(
        '[CharacterBuilderBootstrap] Failed to register service problemService: Registration failed'
      )
    );
    expect(warnCall).toBeDefined();
  });

  it('instantiates known display enhancer services when they are absent from the container', async () => {
    global.fetch = successfulSchemaFetch();
    const bootstrap = new CharacterBuilderBootstrap();
    let capturedDeps;
    let logger;

    class DependencyCaptureController extends NoopController {
      constructor(dependencies) {
        super(dependencies);
        capturedDeps = dependencies;
      }
    }

    const { controller } = await bootstrap.bootstrap({
      pageName: 'Display Enhancer Instantiation',
      controllerClass: DependencyCaptureController,
      services: {
        traitsDisplayEnhancer: RealTraitsDisplayEnhancer,
      },
      hooks: {
        preContainer: async (container) => {
          logger = container.resolve(tokens.ILogger);
          jest.spyOn(logger, 'warn');
          jest.spyOn(logger, 'info');
          container.setOverride(tokens.TraitsDisplayEnhancer, () => {
            throw new Error('not registered');
          });
        },
      },
    });

    expect(controller).toBeInstanceOf(DependencyCaptureController);
    const warnCall = logger.warn.mock.calls.find(([message]) =>
      message.includes(
        "Service 'traitsDisplayEnhancer' (TraitsDisplayEnhancer) not found"
      )
    );
    expect(warnCall).toBeDefined();
    const infoCall = logger.info.mock.calls.find(([message]) =>
      message.includes(
        'Successfully instantiated TraitsDisplayEnhancer with logger dependency.'
      )
    );
    expect(infoCall).toBeDefined();
    expect(capturedDeps.traitsDisplayEnhancer).toBeInstanceOf(
      RealTraitsDisplayEnhancer
    );
  });

  it('reports instantiation errors for known display enhancer classes', async () => {
    global.fetch = successfulSchemaFetch();
    const bootstrap = new CharacterBuilderBootstrap();
    let logger;

    const FailingTraitsDisplayEnhancer = class TraitsDisplayEnhancer {
      constructor() {
        throw new Error('boom');
      }
    };

    const { controller } = await bootstrap.bootstrap({
      pageName: 'Display Enhancer Failure',
      controllerClass: NoopController,
      services: {
        traitsDisplayEnhancer: FailingTraitsDisplayEnhancer,
      },
      hooks: {
        preContainer: async (container) => {
          logger = container.resolve(tokens.ILogger);
          jest.spyOn(logger, 'warn');
          jest.spyOn(logger, 'error');
          container.setOverride(tokens.TraitsDisplayEnhancer, () => {
            throw new Error('not registered');
          });
        },
      },
    });

    expect(controller).toBeInstanceOf(NoopController);
    const warnCall = logger.warn.mock.calls.find(([message]) =>
      message.includes(
        "Service 'traitsDisplayEnhancer' (TraitsDisplayEnhancer) not found"
      )
    );
    expect(warnCall).toBeDefined();
    const errorCall = logger.error.mock.calls.find(([message]) =>
      message.includes('Failed to instantiate TraitsDisplayEnhancer: boom')
    );
    expect(errorCall).toBeDefined();
  });

  it('throws when required CharacterBuilderService dependency is missing', async () => {
    global.fetch = successfulSchemaFetch();
    const bootstrap = new CharacterBuilderBootstrap();

    await expect(
      bootstrap.bootstrap({
        pageName: 'Missing Character Builder Service',
        controllerClass: NoopController,
        hooks: {
          preContainer: async (container) => {
            container.setOverride(
              tokens.CharacterBuilderService,
              () => undefined
            );
          },
        },
      })
    ).rejects.toThrow('CharacterBuilderService not found in container');
  });

  it('throws when the safe event dispatcher dependency is missing', async () => {
    global.fetch = successfulSchemaFetch();
    const bootstrap = new CharacterBuilderBootstrap();

    await expect(
      bootstrap.bootstrap({
        pageName: 'Missing Event Bus',
        controllerClass: NoopController,
        hooks: {
          preContainer: async (container) => {
            const characterBuilderStub = {
              initialize: jest.fn(),
            };
            container.setOverride(
              tokens.CharacterBuilderService,
              characterBuilderStub
            );
            const adapterStub = {
              getAIDecision: jest.fn(),
            };
            container.setOverride(tokens.LLMAdapter, adapterStub);
            container.setOverride(tokens.ISafeEventDispatcher, () => undefined);
          },
        },
      })
    ).rejects.toThrow('SafeEventDispatcher not found in container');
  });

  it('renders and manages the fatal error UI when system errors are dispatched', async () => {
    global.fetch = successfulSchemaFetch();
    const bootstrap = new CharacterBuilderBootstrap();

    const { container } = await bootstrap.bootstrap({
      pageName: 'Error Display Handling',
      controllerClass: NoopController,
      errorDisplay: {
        elementId: 'integration-error-display',
        displayDuration: 100,
      },
      hooks: {
        preContainer: async (container) => {
          const subscribers = new Map();
          const eventBusStub = {
            subscribe: (eventName, listener) => {
              subscribers.set(eventName, listener);
              return () => subscribers.delete(eventName);
            },
            dispatch: async (eventName, payload) => {
              const listener = subscribers.get(eventName);
              if (listener) {
                listener({ payload });
              }
            },
            unsubscribe: jest.fn(),
          };
          container.setOverride(tokens.ISafeEventDispatcher, eventBusStub);
        },
      },
    });

    const eventBus = container.resolve(tokens.ISafeEventDispatcher);
    await eventBus.dispatch(SYSTEM_ERROR_OCCURRED_ID, {
      error: '<b>boom</b>',
    });
    await Promise.resolve();

    const errorContainer = document.getElementById('integration-error-display');
    expect(errorContainer).not.toBeNull();

    const errorMessage = errorContainer.querySelector('.cb-error-text');
    expect(errorMessage.innerHTML).toBe('&lt;b&gt;boom&lt;/b&gt;');

    const dismissButton = errorContainer.querySelector('.cb-error-dismiss');
    expect(dismissButton).not.toBeNull();
    dismissButton.click();
    expect(errorContainer.querySelector('.cb-error-message')).toBeNull();

    await eventBus.dispatch(SYSTEM_ERROR_OCCURRED_ID, {
      error: 'auto remove',
    });
    await Promise.resolve();
    expect(errorContainer.querySelector('.cb-error-message')).not.toBeNull();
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(errorContainer.querySelector('.cb-error-message')).toBeNull();
  });
});
