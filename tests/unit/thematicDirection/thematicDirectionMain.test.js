import { jest } from '@jest/globals';

describe('thematic-direction-main bootstrap orchestration', () => {
  const createDomStubs = (readyState = 'loading') => {
    const originalReadyStateDescriptor = Object.getOwnPropertyDescriptor(
      document,
      'readyState'
    );

    Object.defineProperty(document, 'readyState', {
      configurable: true,
      get: () => readyState,
    });

    const addEventListener = jest.spyOn(document, 'addEventListener');
    const removeEventListener = jest.spyOn(document, 'removeEventListener');

    const restore = () => {
      addEventListener.mockRestore();
      removeEventListener.mockRestore();
      if (originalReadyStateDescriptor) {
        Object.defineProperty(
          document,
          'readyState',
          originalReadyStateDescriptor
        );
      } else {
        delete document.readyState;
      }
    };

    return { addEventListener, restore };
  };

  let consoleLogSpy;
  let consoleErrorSpy;
  let restoreDom;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    restoreDom = null;
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    if (typeof restoreDom === 'function') {
      restoreDom();
    }
  });

  it('registers controller factories, loads schemas, and logs bootstrap timing', async () => {
    const { addEventListener, restore } = createDomStubs('loading');
    restoreDom = restore;

    const tokens = {
      ThematicDirectionController: Symbol('ThematicDirectionController'),
      ILogger: Symbol('ILogger'),
      CharacterBuilderService: Symbol('CharacterBuilderService'),
      ISafeEventDispatcher: Symbol('ISafeEventDispatcher'),
      ISchemaValidator: Symbol('ISchemaValidator'),
      SchemaLoader: Symbol('SchemaLoader'),
      LLMAdapter: Symbol('LLMAdapter'),
      LlmConfigLoader: Symbol('LlmConfigLoader'),
    };

    const schemaLoader = {
      loadAndCompileAllSchemas: jest.fn().mockResolvedValue(undefined),
    };
    const llmConfigLoader = { id: 'config' };
    const llmAdapter = { init: jest.fn().mockResolvedValue(undefined) };
    const logger = { info: jest.fn(), warn: jest.fn() };
    const characterBuilderService = { id: 'builder' };
    const eventBus = { id: 'dispatcher' };
    const schemaValidator = { id: 'validator' };

    const dependencyMap = new Map([
      [tokens.SchemaLoader, schemaLoader],
      [tokens.LLMAdapter, llmAdapter],
      [tokens.LlmConfigLoader, llmConfigLoader],
      [tokens.ILogger, logger],
      [tokens.CharacterBuilderService, characterBuilderService],
      [tokens.ISafeEventDispatcher, eventBus],
      [tokens.ISchemaValidator, schemaValidator],
    ]);

    const container = {
      resolve: jest.fn((token) => dependencyMap.get(token)),
    };

    const registrarInstance = {
      singletonFactory: jest.fn().mockImplementation(() => registrarInstance),
    };

    const bootstrapInstance = { bootstrap: jest.fn() };
    const controllerCtor = jest.fn();

    jest.doMock('../../../src/dependencyInjection/tokens.js', () => ({
      tokens,
    }));
    jest.doMock('../../../src/utils/registrarHelpers.js', () => ({
      Registrar: jest.fn(() => registrarInstance),
    }));
    jest.doMock(
      '../../../src/characterBuilder/CharacterBuilderBootstrap.js',
      () => ({
        CharacterBuilderBootstrap: jest.fn(() => bootstrapInstance),
      })
    );
    jest.doMock(
      '../../../src/thematicDirection/controllers/thematicDirectionController.js',
      () => ({ ThematicDirectionController: controllerCtor })
    );

    bootstrapInstance.bootstrap.mockImplementation(async (config) => {
      expect(config.pageName).toBe('Thematic Direction Generator');
      expect(config.controllerClass).toBe(controllerCtor);
      expect(config.includeModLoading).toBe(true);
      expect(config.customSchemas).toEqual([
        '/data/schemas/llm-configs.schema.json',
      ]);
      expect(config.errorDisplay).toEqual({
        elementId: 'error-display',
        displayDuration: 5000,
        dismissible: true,
      });

      await config.hooks.preContainer(container);
      return { controller: {}, container, bootstrapTime: 12.3456 };
    });

    const { ThematicDirectionApp } = await import(
      '../../../src/thematic-direction-main.js'
    );

    const app = new ThematicDirectionApp();
    await app.initialize();

    expect(bootstrapInstance.bootstrap).toHaveBeenCalledTimes(1);
    expect(schemaLoader.loadAndCompileAllSchemas).toHaveBeenCalledTimes(1);
    expect(llmAdapter.init).toHaveBeenCalledWith({ llmConfigLoader });
    expect(registrarInstance.singletonFactory).toHaveBeenCalledWith(
      tokens.ThematicDirectionController,
      expect.any(Function)
    );

    const factory = registrarInstance.singletonFactory.mock.calls[0][1];
    const controller = factory(container);
    expect(controllerCtor).toHaveBeenCalledWith({
      logger,
      characterBuilderService,
      eventBus,
      schemaValidator,
    });
    expect(controller).toBeInstanceOf(controllerCtor);

    expect(consoleLogSpy).toHaveBeenCalledWith(
      'Thematic Direction Generator initialized successfully in 12.35ms'
    );
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it('skips optional schema and adapter initialization when helpers are absent', async () => {
    const { restore } = createDomStubs('loading');
    restoreDom = restore;

    const tokens = {
      ThematicDirectionController: Symbol('ThematicDirectionController'),
      ILogger: Symbol('ILogger'),
      CharacterBuilderService: Symbol('CharacterBuilderService'),
      ISafeEventDispatcher: Symbol('ISafeEventDispatcher'),
      ISchemaValidator: Symbol('ISchemaValidator'),
      SchemaLoader: Symbol('SchemaLoader'),
      LLMAdapter: Symbol('LLMAdapter'),
      LlmConfigLoader: Symbol('LlmConfigLoader'),
    };

    const logger = { info: jest.fn(), warn: jest.fn() };
    const dependencyMap = new Map([
      [tokens.SchemaLoader, {}],
      [tokens.LLMAdapter, {}],
      [tokens.LlmConfigLoader, { id: 'config' }],
      [tokens.ILogger, logger],
      [tokens.CharacterBuilderService, { id: 'builder' }],
      [tokens.ISafeEventDispatcher, { id: 'dispatcher' }],
      [tokens.ISchemaValidator, { id: 'validator' }],
    ]);

    const container = {
      resolve: jest.fn((token) => dependencyMap.get(token)),
    };

    const bootstrapInstance = { bootstrap: jest.fn() };

    jest.doMock('../../../src/dependencyInjection/tokens.js', () => ({
      tokens,
    }));
    jest.doMock('../../../src/utils/registrarHelpers.js', () => ({
      Registrar: jest.fn(() => ({ singletonFactory: jest.fn() })),
    }));
    jest.doMock(
      '../../../src/characterBuilder/CharacterBuilderBootstrap.js',
      () => ({
        CharacterBuilderBootstrap: jest.fn(() => bootstrapInstance),
      })
    );
    jest.doMock(
      '../../../src/thematicDirection/controllers/thematicDirectionController.js',
      () => ({ ThematicDirectionController: jest.fn() })
    );

    bootstrapInstance.bootstrap.mockImplementation(async (config) => {
      await config.hooks.preContainer(container);
      return { controller: {}, container, bootstrapTime: 5 };
    });

    const { ThematicDirectionApp } = await import(
      '../../../src/thematic-direction-main.js'
    );

    const app = new ThematicDirectionApp();
    await app.initialize();

    expect(container.resolve).toHaveBeenCalledWith(tokens.SchemaLoader);
    expect(container.resolve).toHaveBeenCalledWith(tokens.LLMAdapter);
    expect(consoleLogSpy).toHaveBeenCalledWith(
      'Thematic Direction Generator initialized successfully in 5.00ms'
    );
  });

  it('logs an error when the bootstrap process fails', async () => {
    const { restore } = createDomStubs('loading');
    restoreDom = restore;

    const tokens = {
      ThematicDirectionController: Symbol('ThematicDirectionController'),
    };

    const bootstrapInstance = {
      bootstrap: jest.fn().mockRejectedValue(new Error('bootstrap exploded')),
    };

    jest.doMock('../../../src/dependencyInjection/tokens.js', () => ({
      tokens,
    }));
    jest.doMock('../../../src/utils/registrarHelpers.js', () => ({
      Registrar: jest.fn(() => ({ singletonFactory: jest.fn() })),
    }));
    jest.doMock(
      '../../../src/characterBuilder/CharacterBuilderBootstrap.js',
      () => ({
        CharacterBuilderBootstrap: jest.fn(() => bootstrapInstance),
      })
    );
    jest.doMock(
      '../../../src/thematicDirection/controllers/thematicDirectionController.js',
      () => ({ ThematicDirectionController: jest.fn() })
    );

    const { ThematicDirectionApp } = await import(
      '../../../src/thematic-direction-main.js'
    );

    const app = new ThematicDirectionApp();
    await app.initialize();

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to initialize thematic direction generator:',
      expect.any(Error)
    );
  });

  it('defers initialization until DOMContentLoaded when the document is loading', async () => {
    const { addEventListener, restore } = createDomStubs('loading');
    restoreDom = restore;

    jest.doMock('../../../src/dependencyInjection/tokens.js', () => ({
      tokens: { ThematicDirectionController: Symbol('controller') },
    }));
    jest.doMock('../../../src/utils/registrarHelpers.js', () => ({
      Registrar: jest.fn(() => ({ singletonFactory: jest.fn() })),
    }));
    jest.doMock(
      '../../../src/characterBuilder/CharacterBuilderBootstrap.js',
      () => ({
        CharacterBuilderBootstrap: jest.fn(() => ({ bootstrap: jest.fn() })),
      })
    );
    jest.doMock(
      '../../../src/thematicDirection/controllers/thematicDirectionController.js',
      () => ({ ThematicDirectionController: jest.fn() })
    );

    const { ThematicDirectionApp } = await import(
      '../../../src/thematic-direction-main.js'
    );

    const appInitSpy = jest
      .spyOn(ThematicDirectionApp.prototype, 'initialize')
      .mockResolvedValue(undefined);

    expect(addEventListener).toHaveBeenCalledWith(
      'DOMContentLoaded',
      expect.any(Function)
    );
    const [, domReadyCallback] = addEventListener.mock.calls[0];

    await domReadyCallback();
    expect(appInitSpy).toHaveBeenCalledTimes(1);
    appInitSpy.mockRestore();
  });

  it('reports initialization failures surfaced via the DOMContentLoaded handler', async () => {
    const { addEventListener, restore } = createDomStubs('loading');
    restoreDom = restore;

    jest.doMock('../../../src/dependencyInjection/tokens.js', () => ({
      tokens: { ThematicDirectionController: Symbol('controller') },
    }));
    jest.doMock('../../../src/utils/registrarHelpers.js', () => ({
      Registrar: jest.fn(() => ({ singletonFactory: jest.fn() })),
    }));
    jest.doMock(
      '../../../src/characterBuilder/CharacterBuilderBootstrap.js',
      () => ({
        CharacterBuilderBootstrap: jest.fn(() => ({ bootstrap: jest.fn() })),
      })
    );
    jest.doMock(
      '../../../src/thematicDirection/controllers/thematicDirectionController.js',
      () => ({ ThematicDirectionController: jest.fn() })
    );

    const { ThematicDirectionApp } = await import(
      '../../../src/thematic-direction-main.js'
    );

    const appInitSpy = jest
      .spyOn(ThematicDirectionApp.prototype, 'initialize')
      .mockRejectedValue(new Error('init failed'));

    const [, domReadyCallback] = addEventListener.mock.calls[0];

    await domReadyCallback();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to initialize thematic direction generator:',
      expect.any(Error)
    );
    appInitSpy.mockRestore();
  });

  it('starts immediately when the document is already ready', async () => {
    const { restore } = createDomStubs('complete');
    restoreDom = restore;

    const tokens = {
      ThematicDirectionController: Symbol('ThematicDirectionController'),
      ILogger: Symbol('ILogger'),
    };

    const bootstrapInstance = {
      bootstrap: jest.fn().mockResolvedValue({
        controller: {},
        container: { resolve: jest.fn(() => undefined) },
        bootstrapTime: 3.1,
      }),
    };

    jest.doMock('../../../src/dependencyInjection/tokens.js', () => ({
      tokens,
    }));
    jest.doMock('../../../src/utils/registrarHelpers.js', () => ({
      Registrar: jest.fn(() => ({ singletonFactory: jest.fn() })),
    }));
    jest.doMock(
      '../../../src/characterBuilder/CharacterBuilderBootstrap.js',
      () => ({
        CharacterBuilderBootstrap: jest.fn(() => bootstrapInstance),
      })
    );
    jest.doMock(
      '../../../src/thematicDirection/controllers/thematicDirectionController.js',
      () => ({ ThematicDirectionController: jest.fn() })
    );

    await import('../../../src/thematic-direction-main.js');

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(bootstrapInstance.bootstrap).toHaveBeenCalledTimes(1);
  });
});
