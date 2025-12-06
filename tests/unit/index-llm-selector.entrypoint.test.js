import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';

const flushPromises = () => new Promise((resolve) => setImmediate(resolve));

describe('index-llm-selector entrypoint', () => {
  const originalReadyStateDescriptor = Object.getOwnPropertyDescriptor(
    document,
    'readyState'
  );
  const originalMutationObserver = global.MutationObserver;
  const originalAddEventListener = document.addEventListener;

  let consoleInfoSpy;
  let consoleErrorSpy;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    document.body.innerHTML = '';

    consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleInfoSpy.mockRestore();
    consoleErrorSpy.mockRestore();

    if (originalReadyStateDescriptor) {
      Object.defineProperty(
        document,
        'readyState',
        originalReadyStateDescriptor
      );
    } else {
      delete document.readyState;
    }

    global.MutationObserver = originalMutationObserver;
    document.addEventListener = originalAddEventListener;
  });

  it('initializes immediately when the DOM is ready and registers the modal on demand', async () => {
    Object.defineProperty(document, 'readyState', {
      value: 'complete',
      configurable: true,
    });

    const llmNameElement = document.createElement('span');
    llmNameElement.id = 'current-llm-name';
    llmNameElement.textContent = 'untouched';
    document.body.appendChild(llmNameElement);

    const modalElement = document.createElement('div');
    modalElement.id = 'llm-selection-modal';
    document.body.appendChild(modalElement);

    const observerInstances = [];
    class MockMutationObserver {
      constructor(callback) {
        this.callback = callback;
        observerInstances.push(this);
      }

      observe = jest.fn();

      disconnect = jest.fn();
    }
    global.MutationObserver = MockMutationObserver;

    const tokens = {
      LLMAdapter: Symbol('LLMAdapter'),
      LlmSelectionModal: Symbol('LlmSelectionModal'),
      DocumentContext: Symbol('DocumentContext'),
      ILogger: Symbol('ILogger'),
      IValidatedEventDispatcher: Symbol('IValidatedEventDispatcher'),
    };

    const logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    const llmAdapter = {
      getCurrentActiveLlmId: jest.fn().mockResolvedValue('anthropic-claude'),
      getAvailableLlmOptions: jest
        .fn()
        .mockResolvedValue([
          { configId: 'anthropic-claude', displayName: 'Anthropic Claude' },
        ]),
    };

    const validatedDispatcher = { dispatch: jest.fn() };

    const registrations = new Map();
    const singletonInstances = new Map();
    const resolvedTokens = new Map([
      [tokens.ILogger, logger],
      [tokens.LLMAdapter, llmAdapter],
      [tokens.IValidatedEventDispatcher, validatedDispatcher],
    ]);

    const DocumentContextMock = jest.fn(function DocumentContextMock(doc) {
      this.doc = doc;
    });

    const llmSelectionModalInstance = { open: jest.fn() };
    const LlmSelectionModalMock = jest
      .fn()
      .mockReturnValue(llmSelectionModalInstance);

    const container = {
      resolve: jest.fn((token) => {
        if (
          token === tokens.LlmSelectionModal &&
          !registrations.has(token) &&
          !singletonInstances.has(token)
        ) {
          throw new Error('LlmSelectionModal not registered');
        }

        if (singletonInstances.has(token)) {
          return singletonInstances.get(token);
        }

        if (registrations.has(token)) {
          const { factory, options } = registrations.get(token);
          const instance = factory();
          if (options?.lifecycle === 'singleton') {
            singletonInstances.set(token, instance);
          }
          return instance;
        }

        if (resolvedTokens.has(token)) {
          return resolvedTokens.get(token);
        }

        throw new Error(`Unknown token: ${String(token)}`);
      }),
      register: jest.fn((token, factory, options) => {
        registrations.set(token, { factory, options });
      }),
      isRegistered: jest.fn(
        (token) =>
          registrations.has(token) ||
          singletonInstances.has(token) ||
          resolvedTokens.has(token)
      ),
    };

    const createdControllers = [];
    const bootstrapMock = jest.fn(async ({ controllerClass, ...rest }) => {
      const controller = new controllerClass({ container });
      createdControllers.push(controller);
      await controller.initialize();
      return { controller, container, options: rest };
    });

    jest.doMock(
      '../../src/characterBuilder/CharacterBuilderBootstrap.js',
      () => ({
        CharacterBuilderBootstrap: jest.fn(() => ({
          bootstrap: bootstrapMock,
        })),
      })
    );
    jest.doMock('../../src/dependencyInjection/tokens.js', () => ({ tokens }));
    jest.doMock('../../src/domUI/documentContext.js', () => ({
      __esModule: true,
      default: DocumentContextMock,
    }));
    jest.doMock('../../src/domUI/llmSelectionModal.js', () => ({
      __esModule: true,
      LlmSelectionModal: LlmSelectionModalMock,
    }));
    jest.doMock('../../src/llms/services/llmSelectionPersistence.js', () => ({
      LLMSelectionPersistence: class {},
    }));

    await jest.isolateModulesAsync(async () => {
      await import('../../src/index-llm-selector.js');
    });

    await flushPromises();
    await flushPromises();

    expect(bootstrapMock).toHaveBeenCalledWith(
      expect.objectContaining({
        pageName: 'Index LLM Selector',
        controllerClass: expect.any(Function),
        includeModLoading: false,
      })
    );

    expect(container.register).toHaveBeenCalledWith(
      tokens.DocumentContext,
      expect.any(Function),
      { lifecycle: 'singleton' }
    );
    expect(container.register).toHaveBeenCalledWith(
      tokens.LlmSelectionModal,
      expect.any(Function),
      { lifecycle: 'singleton' }
    );

    expect(DocumentContextMock).toHaveBeenCalledWith(document);
    const modalArgs = LlmSelectionModalMock.mock.calls[0][0];
    expect(modalArgs.logger).toBe(logger);
    expect(modalArgs.documentContext).toBe(
      DocumentContextMock.mock.instances[0]
    );
    expect(modalArgs.llmAdapter).toBe(llmAdapter);
    expect(modalArgs.validatedEventDispatcher).toBe(validatedDispatcher);

    expect(llmAdapter.getCurrentActiveLlmId).toHaveBeenCalledTimes(1);
    expect(llmAdapter.getAvailableLlmOptions).toHaveBeenCalledTimes(1);
    expect(llmNameElement.textContent).toBe('Anthropic Claude');

    expect(observerInstances).toHaveLength(1);
    const observer = observerInstances[0];
    expect(observer.observe).toHaveBeenCalledWith(modalElement, {
      attributes: true,
      attributeFilter: ['style'],
    });

    modalElement.style.display = 'block';
    observer.callback([{ type: 'attributes', attributeName: 'class' }]);

    modalElement.style.display = 'block';
    observer.callback([{ type: 'attributes', attributeName: 'style' }]);

    modalElement.style.display = 'none';
    observer.callback([{ type: 'attributes', attributeName: 'style' }]);
    await flushPromises();
    expect(llmAdapter.getCurrentActiveLlmId).toHaveBeenCalledTimes(2);

    llmAdapter.getCurrentActiveLlmId.mockResolvedValueOnce('mystery-llm');
    llmAdapter.getAvailableLlmOptions.mockResolvedValueOnce([]);
    await createdControllers[0].updateCurrentLLMDisplay();
    expect(llmNameElement.textContent).toBe('mystery-llm');

    llmAdapter.getCurrentActiveLlmId.mockResolvedValueOnce('nameless-llm');
    llmAdapter.getAvailableLlmOptions.mockResolvedValueOnce([
      { configId: 'nameless-llm', displayName: '' },
    ]);
    await createdControllers[0].updateCurrentLLMDisplay();
    expect(llmNameElement.textContent).toBe('nameless-llm');

    llmAdapter.getCurrentActiveLlmId.mockResolvedValueOnce(null);
    await createdControllers[0].updateCurrentLLMDisplay();
    expect(llmNameElement.textContent).toBe('Default LLM');

    llmNameElement.remove();
    await expect(
      createdControllers[0].updateCurrentLLMDisplay()
    ).resolves.toBeUndefined();

    // Re-run initialization with a pre-registered DocumentContext to cover the
    // guard branch that skips registration.
    registrations.delete(tokens.LlmSelectionModal);
    singletonInstances.delete(tokens.LlmSelectionModal);
    registrations.delete(tokens.DocumentContext);
    singletonInstances.set(
      tokens.DocumentContext,
      DocumentContextMock.mock.instances[0]
    );

    const registerCallCount = container.register.mock.calls.length;
    await createdControllers[0].init();
    await flushPromises();

    expect(DocumentContextMock).toHaveBeenCalledTimes(1);
    const lastRegisterCall =
      container.register.mock.calls[container.register.mock.calls.length - 1];
    expect(lastRegisterCall[0]).toBe(tokens.LlmSelectionModal);
    expect(container.register.mock.calls.length).toBeGreaterThan(
      registerCallCount
    );

    expect(consoleInfoSpy).toHaveBeenCalledWith(
      'LLM selector initialized successfully on index page'
    );
    expect(consoleInfoSpy).toHaveBeenCalledWith(
      'Index page LLM selector initialized successfully'
    );
  });

  it('defers initialization until DOMContentLoaded and surfaces adapter errors', async () => {
    Object.defineProperty(document, 'readyState', {
      value: 'loading',
      configurable: true,
    });

    const listeners = new Map();
    document.addEventListener = jest.fn((event, callback) => {
      listeners.set(event, callback);
    });

    const llmNameElement = document.createElement('span');
    llmNameElement.id = 'current-llm-name';
    document.body.appendChild(llmNameElement);

    const tokens = {
      LLMAdapter: Symbol('LLMAdapter'),
      LlmSelectionModal: Symbol('LlmSelectionModal'),
      DocumentContext: Symbol('DocumentContext'),
      ILogger: Symbol('ILogger'),
      IValidatedEventDispatcher: Symbol('IValidatedEventDispatcher'),
    };

    const logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    const llmAdapterError = new Error('adapter failure');
    const llmAdapter = {
      getCurrentActiveLlmId: jest.fn().mockRejectedValue(llmAdapterError),
      getAvailableLlmOptions: jest.fn(),
    };

    const container = {
      resolve: jest.fn((token) => {
        switch (token) {
          case tokens.LLMAdapter:
            return llmAdapter;
          case tokens.LlmSelectionModal:
            return { open: jest.fn() };
          case tokens.ILogger:
            return logger;
          case tokens.IValidatedEventDispatcher:
            return { dispatch: jest.fn() };
          default:
            throw new Error(`Unexpected token: ${String(token)}`);
        }
      }),
      register: jest.fn(),
      isRegistered: jest.fn().mockReturnValue(true),
    };

    const bootstrapMock = jest.fn(async ({ controllerClass }) => {
      const controller = new controllerClass({ container });
      await controller.initialize();
      return { controller, container };
    });

    jest.doMock(
      '../../src/characterBuilder/CharacterBuilderBootstrap.js',
      () => ({
        CharacterBuilderBootstrap: jest.fn(() => ({
          bootstrap: bootstrapMock,
        })),
      })
    );
    jest.doMock('../../src/dependencyInjection/tokens.js', () => ({ tokens }));
    jest.doMock('../../src/domUI/llmSelectionModal.js', () => ({
      __esModule: true,
      LlmSelectionModal: jest.fn(() => ({ open: jest.fn() })),
    }));
    jest.doMock('../../src/domUI/documentContext.js', () => ({
      __esModule: true,
      default: jest.fn(() => ({ document })),
    }));
    jest.doMock('../../src/llms/services/llmSelectionPersistence.js', () => ({
      LLMSelectionPersistence: class {},
    }));

    await jest.isolateModulesAsync(async () => {
      await import('../../src/index-llm-selector.js');
    });

    expect(document.addEventListener).toHaveBeenCalledWith(
      'DOMContentLoaded',
      expect.any(Function)
    );
    expect(bootstrapMock).not.toHaveBeenCalled();

    const domReadyCallback = listeners.get('DOMContentLoaded');
    await domReadyCallback();
    await flushPromises();

    expect(bootstrapMock).toHaveBeenCalledTimes(1);
    expect(llmAdapter.getCurrentActiveLlmId).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to update LLM display',
      llmAdapterError
    );
    expect(llmNameElement.textContent).toBe('Error loading');
    expect(llmNameElement.style.color).toBe('rgb(255, 107, 107)');
  });

  it('renders an error indicator when bootstrapping fails', async () => {
    Object.defineProperty(document, 'readyState', {
      value: 'loading',
      configurable: true,
    });

    const listeners = new Map();
    document.addEventListener = jest.fn((event, callback) => {
      listeners.set(event, callback);
    });

    const llmNameElement = document.createElement('span');
    llmNameElement.id = 'current-llm-name';
    document.body.appendChild(llmNameElement);

    const tokens = {
      LLMAdapter: Symbol('LLMAdapter'),
      LlmSelectionModal: Symbol('LlmSelectionModal'),
      DocumentContext: Symbol('DocumentContext'),
      ILogger: Symbol('ILogger'),
      IValidatedEventDispatcher: Symbol('IValidatedEventDispatcher'),
    };

    const bootstrapError = new Error('bootstrap failed');

    jest.doMock(
      '../../src/characterBuilder/CharacterBuilderBootstrap.js',
      () => ({
        CharacterBuilderBootstrap: jest.fn(() => ({
          bootstrap: jest.fn().mockRejectedValue(bootstrapError),
        })),
      })
    );
    jest.doMock('../../src/dependencyInjection/tokens.js', () => ({ tokens }));
    jest.doMock('../../src/domUI/llmSelectionModal.js', () => ({
      __esModule: true,
      LlmSelectionModal: jest.fn(() => ({})),
    }));
    jest.doMock('../../src/domUI/documentContext.js', () => ({
      __esModule: true,
      default: jest.fn(() => ({ document })),
    }));
    jest.doMock('../../src/llms/services/llmSelectionPersistence.js', () => ({
      LLMSelectionPersistence: class {},
    }));

    await jest.isolateModulesAsync(async () => {
      await import('../../src/index-llm-selector.js');
    });

    const domReadyCallback = listeners.get('DOMContentLoaded');
    document.body.removeChild(llmNameElement);
    await domReadyCallback();
    await flushPromises();

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to initialize index page LLM selector:',
      bootstrapError
    );
    expect(document.body.contains(llmNameElement)).toBe(false);
  });
});
