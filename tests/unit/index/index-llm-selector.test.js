import {
  jest,
  describe,
  it,
  beforeEach,
  afterEach,
  expect,
} from '@jest/globals';

const bootstrapMock = jest.fn();
const mockCharacterBuilderBootstrapConstructor = jest
  .fn()
  .mockImplementation(function MockCharacterBuilderBootstrap() {
    this.bootstrap = (...args) => bootstrapMock(...args);
  });

const tokensMock = {
  LLMAdapter: 'LLMAdapter',
  LlmSelectionModal: 'LlmSelectionModal',
  DocumentContext: 'DocumentContext',
  ILogger: 'ILogger',
  IValidatedEventDispatcher: 'IValidatedEventDispatcher',
};

const mockLlmSelectionModalConstructor = jest
  .fn()
  .mockImplementation(function llmSelectionModal(options) {
    this.options = options;
    return { __llmModal: true, options };
  });

const mockDocumentContextConstructor = jest
  .fn()
  .mockImplementation(function documentContext(doc) {
    this.document = doc;
    return { __documentContext: true, document: doc };
  });

jest.mock('../../../src/characterBuilder/CharacterBuilderBootstrap.js', () => ({
  __esModule: true,
  CharacterBuilderBootstrap: mockCharacterBuilderBootstrapConstructor,
}));

jest.mock('../../../src/dependencyInjection/tokens.js', () => ({
  __esModule: true,
  tokens: tokensMock,
}));

jest.mock('../../../src/domUI/llmSelectionModal.js', () => ({
  __esModule: true,
  LlmSelectionModal: mockLlmSelectionModalConstructor,
}));

jest.mock('../../../src/domUI/documentContext.js', () => ({
  __esModule: true,
  default: mockDocumentContextConstructor,
}));

jest.mock('../../../src/llms/services/llmSelectionPersistence.js', () => ({
  __esModule: true,
  LLMSelectionPersistence: jest.fn(),
}));

let consoleInfoSpy;
let consoleErrorSpy;

const setDocumentReadyState = (state) => {
  Object.defineProperty(document, 'readyState', {
    value: state,
    configurable: true,
  });
};

const createLLMAdapter = ({
  activeId = 'llm-default',
  available = [],
  throwOnGetCurrent = false,
} = {}) => ({
  getCurrentActiveLlmId: throwOnGetCurrent
    ? jest.fn().mockRejectedValue(new Error('llm failure'))
    : jest.fn().mockResolvedValue(activeId),
  getAvailableLlmOptions: jest.fn().mockResolvedValue(available),
});

const createContainer = ({
  llmAdapter,
  modal,
  resolveOverrides = {},
  registerImpl,
  isRegisteredImpl,
} = {}) => {
  const resolveMock = jest.fn((token) => {
    if (resolveOverrides[token]) {
      return resolveOverrides[token]();
    }

    if (token === tokensMock.LLMAdapter) {
      return llmAdapter;
    }
    if (token === tokensMock.LlmSelectionModal) {
      if (modal && typeof modal.get === 'function') {
        return modal.get();
      }
      if (modal) {
        return modal;
      }
    }
    if (token === tokensMock.DocumentContext) {
      return resolveOverrides[tokensMock.DocumentContext]
        ? resolveOverrides[tokensMock.DocumentContext]()
        : undefined;
    }
    if (token === tokensMock.ILogger) {
      return { info: jest.fn(), error: jest.fn() };
    }
    if (token === tokensMock.IValidatedEventDispatcher) {
      return { dispatch: jest.fn() };
    }

    throw new Error(`Unexpected token: ${String(token)}`);
  });

  return {
    resolve: resolveMock,
    register: registerImpl || jest.fn(),
    isRegistered: isRegisteredImpl || jest.fn().mockReturnValue(true),
  };
};

const importModule = async () => import('../../../src/index-llm-selector.js');

describe('index-llm-selector bootstrap flow', () => {
  beforeEach(() => {
    jest.resetModules();
    bootstrapMock.mockReset();
    mockCharacterBuilderBootstrapConstructor.mockClear();
    mockLlmSelectionModalConstructor.mockClear();
    mockDocumentContextConstructor.mockClear();

    consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    document.addEventListener = jest.fn();
    document.getElementById = jest.fn();

    global.MutationObserver = jest.fn().mockImplementation(() => ({
      observe: jest.fn(),
      disconnect: jest.fn(),
    }));
  });

  afterEach(() => {
    consoleInfoSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it('initializes immediately when the DOM is ready', async () => {
    setDocumentReadyState('complete');

    let capturedOptions;
    bootstrapMock.mockImplementation(async (options) => {
      capturedOptions = options;
      return { controller: {}, container: {} };
    });

    await importModule();

    expect(mockCharacterBuilderBootstrapConstructor).toHaveBeenCalledTimes(1);
    expect(bootstrapMock).toHaveBeenCalledTimes(1);
    expect(capturedOptions).toMatchObject({
      pageName: 'Index LLM Selector',
      includeModLoading: false,
    });
    expect(typeof capturedOptions.controllerClass).toBe('function');
    expect(consoleInfoSpy).toHaveBeenCalledWith(
      'Index page LLM selector initialized successfully'
    );
    expect(document.addEventListener).not.toHaveBeenCalled();
  });

  it('registers a DOMContentLoaded listener and wires modal updates when DOM is loading', async () => {
    setDocumentReadyState('loading');

    const llmNameElement = { textContent: '', style: {} };
    const modalElement = { style: { display: 'block' } };
    document.getElementById = jest.fn((id) => {
      if (id === 'current-llm-name') return llmNameElement;
      if (id === 'llm-selection-modal') return modalElement;
      return null;
    });

    let capturedCallback;
    document.addEventListener = jest.fn((event, callback) => {
      if (event === 'DOMContentLoaded') {
        capturedCallback = callback;
      }
    });

    let observerCallback;
    const observeMock = jest.fn();
    global.MutationObserver = jest.fn().mockImplementation((callback) => {
      observerCallback = callback;
      return {
        observe: observeMock,
        disconnect: jest.fn(),
      };
    });

    const llmAdapter = createLLMAdapter({
      activeId: 'alpha',
      available: [
        { configId: 'alpha', displayName: 'LLM Alpha' },
        { configId: 'beta', displayName: 'LLM Beta' },
      ],
    });

    const container = createContainer({ llmAdapter, modal: { __modal: true } });
    let updateSpy;

    bootstrapMock.mockImplementation(async (options) => {
      const controller = new options.controllerClass({ container });
      updateSpy = jest.spyOn(controller, 'updateCurrentLLMDisplay');
      await controller.init();
      return { controller, container };
    });

    await importModule();

    expect(capturedCallback).toBeInstanceOf(Function);
    expect(mockCharacterBuilderBootstrapConstructor).not.toHaveBeenCalled();

    await capturedCallback();

    expect(mockCharacterBuilderBootstrapConstructor).toHaveBeenCalledTimes(1);
    expect(bootstrapMock).toHaveBeenCalledTimes(1);
    expect(updateSpy).toHaveBeenCalledTimes(1);
    expect(llmNameElement.textContent).toBe('LLM Alpha');
    expect(observeMock).toHaveBeenCalledWith(modalElement, {
      attributes: true,
      attributeFilter: ['style'],
    });

    observerCallback([
      {
        type: 'childList',
      },
    ]);
    await Promise.resolve();
    expect(updateSpy).toHaveBeenCalledTimes(1);

    modalElement.style.display = 'block';
    observerCallback([
      {
        type: 'attributes',
        attributeName: 'style',
      },
    ]);
    await Promise.resolve();
    expect(updateSpy).toHaveBeenCalledTimes(1);

    modalElement.style.display = 'none';
    observerCallback([
      {
        type: 'attributes',
        attributeName: 'style',
      },
    ]);
    await Promise.resolve();

    expect(updateSpy).toHaveBeenCalledTimes(2);
    expect(consoleInfoSpy).toHaveBeenCalledWith(
      'LLM selector initialized successfully on index page'
    );
  });

  it('registers missing UI dependencies when modal resolution fails initially', async () => {
    setDocumentReadyState('loading');

    const llmNameElement = { textContent: '', style: {} };
    const modalElement = { style: { display: 'block' } };
    document.getElementById = jest.fn((id) => {
      if (id === 'current-llm-name') return llmNameElement;
      if (id === 'llm-selection-modal') return modalElement;
      return null;
    });

    let capturedCallback;
    document.addEventListener = jest.fn((event, callback) => {
      if (event === 'DOMContentLoaded') {
        capturedCallback = callback;
      }
    });

    let documentContextInstance;
    let modalInstance;
    const factories = new Map();

    const llmAdapter = createLLMAdapter({
      activeId: 'omega',
      available: [{ configId: 'omega', displayName: 'LLM Omega' }],
    });

    let modalRegistered = false;
    const registerMock = jest.fn((token, factory) => {
      factories.set(token, factory);
      if (token === tokensMock.DocumentContext) {
        documentContextInstance = factory();
      }
      if (token === tokensMock.LlmSelectionModal) {
        modalInstance = factory();
        modalRegistered = true;
      }
    });

    const resolveMock = jest.fn((token) => {
      if (token === tokensMock.LLMAdapter) {
        return llmAdapter;
      }
      if (token === tokensMock.LlmSelectionModal) {
        if (!modalRegistered) {
          throw new Error('not registered');
        }
        return modalInstance;
      }
      if (token === tokensMock.DocumentContext) {
        return documentContextInstance;
      }
      if (token === tokensMock.ILogger) {
        return { info: jest.fn(), error: jest.fn() };
      }
      if (token === tokensMock.IValidatedEventDispatcher) {
        return { dispatch: jest.fn() };
      }
      throw new Error(`Unexpected token ${String(token)}`);
    });

    const container = {
      resolve: resolveMock,
      register: registerMock,
      isRegistered: jest
        .fn()
        .mockImplementation((token) =>
          token === tokensMock.DocumentContext ? false : true
        ),
    };

    let updateSpy;
    bootstrapMock.mockImplementation(async (options) => {
      const controller = new options.controllerClass({ container });
      updateSpy = jest.spyOn(controller, 'updateCurrentLLMDisplay');
      await controller.init();
      return { controller, container };
    });

    await importModule();
    await capturedCallback();

    expect(registerMock).toHaveBeenCalledWith(
      tokensMock.DocumentContext,
      expect.any(Function),
      { lifecycle: 'singleton' }
    );
    expect(registerMock).toHaveBeenCalledWith(
      tokensMock.LlmSelectionModal,
      expect.any(Function),
      { lifecycle: 'singleton' }
    );
    expect(mockDocumentContextConstructor).toHaveBeenCalledWith(document);
    expect(mockLlmSelectionModalConstructor).toHaveBeenCalledWith({
      logger: expect.any(Object),
      documentContext: documentContextInstance,
      llmAdapter: llmAdapter,
      validatedEventDispatcher: expect.any(Object),
    });
    expect(modalInstance).toMatchObject({ __llmModal: true });
    expect(updateSpy).toHaveBeenCalledTimes(1);
    expect(consoleInfoSpy).toHaveBeenCalledWith(
      'LLM selector initialized successfully on index page'
    );
  });

  it('reuses existing DocumentContext registration when available', async () => {
    setDocumentReadyState('loading');

    const llmNameElement = { textContent: '', style: {} };
    const modalElement = { style: { display: 'block' } };
    document.getElementById = jest.fn((id) => {
      if (id === 'current-llm-name') return llmNameElement;
      if (id === 'llm-selection-modal') return modalElement;
      return null;
    });

    let capturedCallback;
    document.addEventListener = jest.fn((event, callback) => {
      if (event === 'DOMContentLoaded') {
        capturedCallback = callback;
      }
    });

    const documentContextInstance = { __existingContext: true };
    const llmAdapter = createLLMAdapter({
      activeId: 'sigma',
      available: [{ configId: 'sigma', displayName: 'LLM Sigma' }],
    });

    let modalInstance;
    const registerMock = jest.fn((token, factory) => {
      if (token === tokensMock.LlmSelectionModal) {
        modalInstance = factory();
      }
    });

    const resolveMock = jest.fn((token) => {
      if (token === tokensMock.LLMAdapter) {
        return llmAdapter;
      }
      if (token === tokensMock.LlmSelectionModal) {
        if (!modalInstance) {
          throw new Error('missing modal');
        }
        return modalInstance;
      }
      if (token === tokensMock.DocumentContext) {
        return documentContextInstance;
      }
      if (token === tokensMock.ILogger) {
        return { info: jest.fn(), error: jest.fn() };
      }
      if (token === tokensMock.IValidatedEventDispatcher) {
        return { dispatch: jest.fn() };
      }
      throw new Error(`Unexpected token ${String(token)}`);
    });

    const container = {
      resolve: resolveMock,
      register: registerMock,
      isRegistered: jest
        .fn()
        .mockImplementation((token) =>
          token === tokensMock.DocumentContext ? true : true
        ),
    };

    bootstrapMock.mockImplementation(async (options) => {
      const controller = new options.controllerClass({ container });
      await controller.init();
      return { controller, container };
    });

    await importModule();
    await capturedCallback();

    expect(registerMock).toHaveBeenCalledTimes(1);
    expect(registerMock).toHaveBeenCalledWith(
      tokensMock.LlmSelectionModal,
      expect.any(Function),
      { lifecycle: 'singleton' }
    );
    expect(mockDocumentContextConstructor).not.toHaveBeenCalled();
    expect(mockLlmSelectionModalConstructor).toHaveBeenCalledWith({
      logger: expect.any(Object),
      documentContext: documentContextInstance,
      llmAdapter: llmAdapter,
      validatedEventDispatcher: expect.any(Object),
    });
  });

  it('skips observer wiring when the modal element is not present', async () => {
    setDocumentReadyState('loading');

    const llmNameElement = { textContent: '', style: {} };
    document.getElementById = jest.fn((id) =>
      id === 'current-llm-name' ? llmNameElement : null
    );

    let capturedCallback;
    document.addEventListener = jest.fn((event, callback) => {
      if (event === 'DOMContentLoaded') {
        capturedCallback = callback;
      }
    });

    const llmAdapter = createLLMAdapter({ activeId: 'tau' });
    const container = createContainer({ llmAdapter, modal: { __modal: true } });

    const mutationObserverMock = jest.fn().mockImplementation(() => ({
      observe: jest.fn(),
      disconnect: jest.fn(),
    }));
    global.MutationObserver = mutationObserverMock;

    bootstrapMock.mockImplementation(async (options) => {
      const controller = new options.controllerClass({ container });
      await controller.init();
      return { controller, container };
    });

    await importModule();
    await capturedCallback();

    expect(mutationObserverMock).not.toHaveBeenCalled();
  });

  it('logs errors and updates the UI when bootstrap fails', async () => {
    setDocumentReadyState('complete');

    const llmNameElement = { textContent: 'unchanged', style: {} };
    document.getElementById = jest.fn((id) =>
      id === 'current-llm-name' ? llmNameElement : null
    );

    const failure = new Error('bootstrap failure');
    bootstrapMock.mockRejectedValue(failure);

    await importModule();

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to initialize index page LLM selector:',
      failure
    );
    expect(llmNameElement.textContent).toBe('Error loading');
    expect(llmNameElement.style.color).toBe('#ff6b6b');
  });

  it('logs bootstrap failure even when the status element is missing', async () => {
    setDocumentReadyState('complete');

    document.getElementById = jest.fn().mockReturnValue(null);

    const failure = new Error('bootstrap failure');
    bootstrapMock.mockRejectedValue(failure);

    await importModule();

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to initialize index page LLM selector:',
      failure
    );
    expect(document.getElementById).toHaveBeenCalledWith('current-llm-name');
  });
});

describe('IndexLLMController updateCurrentLLMDisplay', () => {
  beforeEach(() => {
    jest.resetModules();
    bootstrapMock.mockReset();
    mockCharacterBuilderBootstrapConstructor.mockClear();
    consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    document.getElementById = jest.fn();
    document.addEventListener = jest.fn();
  });

  afterEach(() => {
    consoleInfoSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  const getControllerClass = async () => {
    setDocumentReadyState('loading');

    document.addEventListener = jest.fn();
    bootstrapMock.mockImplementation(async (options) => ({
      controller: {},
      container: {},
      controllerClass: options.controllerClass,
    }));

    await importModule();
    const callback = document.addEventListener.mock.calls[0][1];

    let capturedClass;
    bootstrapMock.mockImplementation(async (options) => {
      capturedClass = options.controllerClass;
      return { controller: {}, container: {} };
    });

    await callback();
    return capturedClass;
  };

  it('does nothing when the display element is missing', async () => {
    const Controller = await getControllerClass();
    const llmAdapter = createLLMAdapter();
    const container = createContainer({ llmAdapter });

    document.getElementById = jest.fn().mockReturnValue(null);

    const controller = new Controller({ container });
    await controller.updateCurrentLLMDisplay();

    expect(llmAdapter.getCurrentActiveLlmId).not.toHaveBeenCalled();
  });

  it('shows the friendly display name when available', async () => {
    const Controller = await getControllerClass();
    const llmAdapter = createLLMAdapter({
      activeId: 'friendly',
      available: [
        { configId: 'friendly', displayName: 'Friendly LLM' },
        { configId: 'other', displayName: 'Other LLM' },
      ],
    });
    const container = createContainer({ llmAdapter });

    const llmNameElement = { textContent: '', style: {} };
    document.getElementById = jest.fn((id) =>
      id === 'current-llm-name' ? llmNameElement : null
    );

    const controller = new Controller({ container });
    await controller.updateCurrentLLMDisplay();

    expect(llmAdapter.getCurrentActiveLlmId).toHaveBeenCalled();
    expect(llmAdapter.getAvailableLlmOptions).toHaveBeenCalled();
    expect(llmNameElement.textContent).toBe('Friendly LLM');
  });

  it('falls back to the config id when display name is missing', async () => {
    const Controller = await getControllerClass();
    const llmAdapter = createLLMAdapter({
      activeId: 'config-id',
      available: [{ configId: 'other', displayName: 'Other' }],
    });
    const container = createContainer({ llmAdapter });

    const llmNameElement = { textContent: '', style: {} };
    document.getElementById = jest.fn((id) =>
      id === 'current-llm-name' ? llmNameElement : null
    );

    const controller = new Controller({ container });
    await controller.updateCurrentLLMDisplay();

    expect(llmNameElement.textContent).toBe('config-id');
  });

  it('uses the config id when the matching option has an empty display name', async () => {
    const Controller = await getControllerClass();
    const llmAdapter = createLLMAdapter({
      activeId: 'config-id',
      available: [{ configId: 'config-id', displayName: '' }],
    });
    const container = createContainer({ llmAdapter });

    const llmNameElement = { textContent: '', style: {} };
    document.getElementById = jest.fn((id) =>
      id === 'current-llm-name' ? llmNameElement : null
    );

    const controller = new Controller({ container });
    await controller.updateCurrentLLMDisplay();

    expect(llmNameElement.textContent).toBe('config-id');
  });

  it('shows default text when there is no active LLM', async () => {
    const Controller = await getControllerClass();
    const llmAdapter = createLLMAdapter({ activeId: null });
    const container = createContainer({ llmAdapter });

    const llmNameElement = { textContent: '', style: {} };
    document.getElementById = jest.fn((id) =>
      id === 'current-llm-name' ? llmNameElement : null
    );

    const controller = new Controller({ container });
    await controller.updateCurrentLLMDisplay();

    expect(llmAdapter.getAvailableLlmOptions).not.toHaveBeenCalled();
    expect(llmNameElement.textContent).toBe('Default LLM');
  });

  it('shows error state when resolving the active LLM fails', async () => {
    const Controller = await getControllerClass();
    const llmAdapter = createLLMAdapter({ throwOnGetCurrent: true });
    const container = createContainer({ llmAdapter });

    const llmNameElement = { textContent: '', style: {} };
    document.getElementById = jest.fn((id) =>
      id === 'current-llm-name' ? llmNameElement : null
    );

    const controller = new Controller({ container });
    await controller.updateCurrentLLMDisplay();

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to update LLM display',
      expect.any(Error)
    );
    expect(llmNameElement.textContent).toBe('Error loading');
    expect(llmNameElement.style.color).toBe('#ff6b6b');
  });

  it('delegates initialize to init', async () => {
    const Controller = await getControllerClass();
    const llmAdapter = createLLMAdapter({ activeId: null });
    const container = createContainer({ llmAdapter });
    const controller = new Controller({ container });
    const initSpy = jest
      .spyOn(controller, 'init')
      .mockResolvedValue('initialized');

    const result = await controller.initialize();

    expect(initSpy).toHaveBeenCalled();
    expect(result).toBe('initialized');
  });
});
