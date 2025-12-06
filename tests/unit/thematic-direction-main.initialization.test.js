import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  afterEach,
} from '@jest/globals';

/**
 * @file Unit tests covering the success paths of thematic-direction-main.js
 * including DI registration, optional service initialization, and DOM ready
 * handling.
 */

describe('thematic-direction-main initialization flows', () => {
  let originalReadyStateDescriptor;
  let addEventListenerSpy;

  beforeEach(() => {
    originalReadyStateDescriptor = Object.getOwnPropertyDescriptor(
      document,
      'readyState'
    );
    addEventListenerSpy = jest.spyOn(document, 'addEventListener');
    jest.clearAllMocks();
    jest.resetModules();
  });

  afterEach(() => {
    if (addEventListenerSpy) {
      addEventListenerSpy.mockRestore();
    }

    if (originalReadyStateDescriptor) {
      Object.defineProperty(
        document,
        'readyState',
        originalReadyStateDescriptor
      );
    } else {
      delete document.readyState;
    }

    jest.restoreAllMocks();
    jest.resetModules();
    jest.clearAllMocks();
  });

  const setDocumentReadyState = (value) => {
    Object.defineProperty(document, 'readyState', {
      configurable: true,
      get: () => value,
    });
  };

  it('bootstraps the thematic direction app and initializes optional services', async () => {
    setDocumentReadyState('loading');

    const mockLogger = { info: jest.fn() };
    const mockCharacterBuilderService = {};
    const mockEventBus = {};
    const mockSchemaValidator = {};
    const mockSchemaLoader = {
      loadAndCompileAllSchemas: jest.fn().mockResolvedValue(undefined),
    };
    const mockLlmAdapter = {
      init: jest.fn().mockResolvedValue(undefined),
    };
    const mockLlmConfigLoader = {};

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

    const mockControllerInstance = { controller: true };
    const ThematicDirectionController = jest
      .fn()
      .mockReturnValue(mockControllerInstance);

    const resolveMock = jest.fn((token) => {
      switch (token) {
        case tokens.ILogger:
          return mockLogger;
        case tokens.CharacterBuilderService:
          return mockCharacterBuilderService;
        case tokens.ISafeEventDispatcher:
          return mockEventBus;
        case tokens.ISchemaValidator:
          return mockSchemaValidator;
        case tokens.SchemaLoader:
          return mockSchemaLoader;
        case tokens.LLMAdapter:
          return mockLlmAdapter;
        case tokens.LlmConfigLoader:
          return mockLlmConfigLoader;
        default:
          return undefined;
      }
    });

    const mockContainer = {
      resolve: resolveMock,
    };

    const singletonFactorySpy = jest.fn();

    const bootstrapMock = jest.fn().mockImplementation(async (config) => {
      expect(config.pageName).toBe('Thematic Direction Generator');
      expect(config.controllerClass).toBe(ThematicDirectionController);
      expect(config.includeModLoading).toBe(true);
      expect(config.customSchemas).toEqual([
        '/data/schemas/llm-configs.schema.json',
      ]);
      expect(config.errorDisplay).toEqual({
        elementId: 'error-display',
        displayDuration: 5000,
        dismissible: true,
      });
      expect(typeof config.hooks.preContainer).toBe('function');

      await config.hooks.preContainer(mockContainer);

      return {
        controller: mockControllerInstance,
        container: mockContainer,
        bootstrapTime: 123.456,
      };
    });

    const CharacterBuilderBootstrap = jest.fn().mockImplementation(() => ({
      bootstrap: bootstrapMock,
    }));

    const Registrar = jest.fn().mockImplementation(() => ({
      singletonFactory: singletonFactorySpy,
    }));

    jest.doMock(
      '../../src/characterBuilder/CharacterBuilderBootstrap.js',
      () => ({
        CharacterBuilderBootstrap,
      })
    );

    jest.doMock('../../src/dependencyInjection/tokens.js', () => ({ tokens }));

    jest.doMock('../../src/utils/registrarHelpers.js', () => ({
      Registrar,
    }));

    jest.doMock(
      '../../src/thematicDirection/controllers/thematicDirectionController.js',
      () => ({
        ThematicDirectionController,
      })
    );

    const consoleLogSpy = jest
      .spyOn(console, 'log')
      .mockImplementation(() => {});
    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    await jest.isolateModulesAsync(async () => {
      const module = await import('../../src/thematic-direction-main.js');
      const { ThematicDirectionApp } = module;

      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'DOMContentLoaded',
        expect.any(Function)
      );

      const app = new ThematicDirectionApp();
      await app.initialize();
    });

    expect(CharacterBuilderBootstrap).toHaveBeenCalledTimes(1);
    expect(bootstrapMock).toHaveBeenCalledTimes(1);
    expect(Registrar).toHaveBeenCalledWith(mockContainer);
    expect(singletonFactorySpy).toHaveBeenCalledTimes(1);

    const [registeredToken, factory] = singletonFactorySpy.mock.calls[0];
    expect(registeredToken).toBe(tokens.ThematicDirectionController);
    const builtController = factory(mockContainer);
    expect(ThematicDirectionController).toHaveBeenCalledWith({
      logger: mockLogger,
      characterBuilderService: mockCharacterBuilderService,
      eventBus: mockEventBus,
      schemaValidator: mockSchemaValidator,
    });
    expect(builtController).toBe(mockControllerInstance);

    expect(mockSchemaLoader.loadAndCompileAllSchemas).toHaveBeenCalledTimes(1);
    expect(resolveMock).toHaveBeenCalledWith(tokens.SchemaLoader);
    expect(resolveMock).toHaveBeenCalledWith(tokens.LLMAdapter);
    expect(mockLlmAdapter.init).toHaveBeenCalledWith({
      llmConfigLoader: mockLlmConfigLoader,
    });
    expect(consoleLogSpy).toHaveBeenCalledWith(
      'Thematic Direction Generator initialized successfully in 123.46ms'
    );
    expect(consoleErrorSpy).not.toHaveBeenCalled();

    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it('skips optional service initialization when adapters are missing', async () => {
    setDocumentReadyState('loading');

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

    const mockLogger = {};
    const mockCharacterBuilderService = {};
    const mockEventBus = {};
    const mockSchemaValidator = {};
    const mockSchemaLoader = {};
    const mockLlmAdapter = {};

    const resolveMock = jest.fn((token) => {
      switch (token) {
        case tokens.ILogger:
          return mockLogger;
        case tokens.CharacterBuilderService:
          return mockCharacterBuilderService;
        case tokens.ISafeEventDispatcher:
          return mockEventBus;
        case tokens.ISchemaValidator:
          return mockSchemaValidator;
        case tokens.SchemaLoader:
          return mockSchemaLoader;
        case tokens.LLMAdapter:
          return mockLlmAdapter;
        case tokens.LlmConfigLoader:
          throw new Error(
            'LlmConfigLoader should not be requested when adapter missing'
          );
        default:
          return undefined;
      }
    });

    const mockContainer = { resolve: resolveMock };

    const singletonFactorySpy = jest.fn();
    const bootstrapMock = jest.fn().mockImplementation(async (config) => {
      await config.hooks.preContainer(mockContainer);
      return {
        controller: {},
        container: mockContainer,
        bootstrapTime: 10,
      };
    });

    const CharacterBuilderBootstrap = jest
      .fn()
      .mockImplementation(() => ({ bootstrap: bootstrapMock }));

    jest.doMock(
      '../../src/characterBuilder/CharacterBuilderBootstrap.js',
      () => ({
        CharacterBuilderBootstrap,
      })
    );

    jest.doMock('../../src/dependencyInjection/tokens.js', () => ({ tokens }));

    jest.doMock('../../src/utils/registrarHelpers.js', () => ({
      Registrar: jest.fn().mockImplementation(() => ({
        singletonFactory: singletonFactorySpy,
      })),
    }));

    jest.doMock(
      '../../src/thematicDirection/controllers/thematicDirectionController.js',
      () => ({
        ThematicDirectionController: jest.fn(() => ({})),
      })
    );

    const consoleLogSpy = jest
      .spyOn(console, 'log')
      .mockImplementation(() => {});

    await jest.isolateModulesAsync(async () => {
      const module = await import('../../src/thematic-direction-main.js');
      const { ThematicDirectionApp } = module;
      const app = new ThematicDirectionApp();
      await app.initialize();
    });

    expect(resolveMock).toHaveBeenCalledWith(tokens.SchemaLoader);
    expect(resolveMock).toHaveBeenCalledWith(tokens.LLMAdapter);
    expect(resolveMock).not.toHaveBeenCalledWith(tokens.LlmConfigLoader);
    expect(consoleLogSpy).toHaveBeenCalledWith(
      'Thematic Direction Generator initialized successfully in 10.00ms'
    );

    consoleLogSpy.mockRestore();
  });

  it('logs an error when bootstrap fails', async () => {
    setDocumentReadyState('loading');

    const tokens = {
      ThematicDirectionController: Symbol('ThematicDirectionController'),
    };

    const error = new Error('bootstrap failure');

    const bootstrapMock = jest.fn().mockRejectedValue(error);
    const CharacterBuilderBootstrap = jest
      .fn()
      .mockImplementation(() => ({ bootstrap: bootstrapMock }));

    jest.doMock(
      '../../src/characterBuilder/CharacterBuilderBootstrap.js',
      () => ({
        CharacterBuilderBootstrap,
      })
    );

    jest.doMock('../../src/dependencyInjection/tokens.js', () => ({ tokens }));

    jest.doMock('../../src/utils/registrarHelpers.js', () => ({
      Registrar: jest.fn().mockImplementation(() => ({
        singletonFactory: jest.fn(),
      })),
    }));

    jest.doMock(
      '../../src/thematicDirection/controllers/thematicDirectionController.js',
      () => ({
        ThematicDirectionController: jest.fn(() => ({})),
      })
    );

    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    await jest.isolateModulesAsync(async () => {
      const module = await import('../../src/thematic-direction-main.js');
      const { ThematicDirectionApp } = module;
      const app = new ThematicDirectionApp();
      await expect(app.initialize()).resolves.toBeUndefined();
    });

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to initialize thematic direction generator:',
      error
    );

    consoleErrorSpy.mockRestore();
  });

  it('immediately initializes when the DOM is already ready', async () => {
    setDocumentReadyState('complete');

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

    const mockLogger = {};
    const mockCharacterBuilderService = {};
    const mockEventBus = {};
    const mockSchemaValidator = {};
    const mockSchemaLoader = {
      loadAndCompileAllSchemas: jest.fn().mockResolvedValue(undefined),
    };
    const mockLlmAdapter = {
      init: jest.fn().mockResolvedValue(undefined),
    };
    const mockLlmConfigLoader = {};

    const resolveMock = jest.fn((token) => {
      switch (token) {
        case tokens.ILogger:
          return mockLogger;
        case tokens.CharacterBuilderService:
          return mockCharacterBuilderService;
        case tokens.ISafeEventDispatcher:
          return mockEventBus;
        case tokens.ISchemaValidator:
          return mockSchemaValidator;
        case tokens.SchemaLoader:
          return mockSchemaLoader;
        case tokens.LLMAdapter:
          return mockLlmAdapter;
        case tokens.LlmConfigLoader:
          return mockLlmConfigLoader;
        default:
          return undefined;
      }
    });

    const mockContainer = { resolve: resolveMock };

    const bootstrapMock = jest.fn().mockImplementation(async (config) => {
      await config.hooks.preContainer(mockContainer);
      return {
        controller: {},
        container: mockContainer,
        bootstrapTime: 5,
      };
    });

    const CharacterBuilderBootstrap = jest
      .fn()
      .mockImplementation(() => ({ bootstrap: bootstrapMock }));

    jest.doMock(
      '../../src/characterBuilder/CharacterBuilderBootstrap.js',
      () => ({
        CharacterBuilderBootstrap,
      })
    );

    jest.doMock('../../src/dependencyInjection/tokens.js', () => ({ tokens }));

    jest.doMock('../../src/utils/registrarHelpers.js', () => ({
      Registrar: jest.fn().mockImplementation(() => ({
        singletonFactory: jest.fn(),
      })),
    }));

    jest.doMock(
      '../../src/thematicDirection/controllers/thematicDirectionController.js',
      () => ({
        ThematicDirectionController: jest.fn(() => ({})),
      })
    );

    const consoleLogSpy = jest
      .spyOn(console, 'log')
      .mockImplementation(() => {});

    await jest.isolateModulesAsync(async () => {
      await import('../../src/thematic-direction-main.js');
      expect(addEventListenerSpy).not.toHaveBeenCalledWith(
        'DOMContentLoaded',
        expect.any(Function)
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(bootstrapMock).toHaveBeenCalledTimes(1);
    expect(consoleLogSpy).toHaveBeenCalledWith(
      'Thematic Direction Generator initialized successfully in 5.00ms'
    );

    consoleLogSpy.mockRestore();
  });
});
