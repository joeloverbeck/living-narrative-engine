import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';

const flushMicrotasks = () => new Promise((resolve) => setImmediate(resolve));

describe('anatomy-visualizer.js - additional coverage', () => {
  let originalWindow;
  let originalReadyStateDescriptor;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    originalWindow = global.window;
    originalReadyStateDescriptor = Object.getOwnPropertyDescriptor(
      document,
      'readyState'
    );
  });

  afterEach(() => {
    if (originalReadyStateDescriptor) {
      Object.defineProperty(
        document,
        'readyState',
        originalReadyStateDescriptor
      );
    }
    document.body.innerHTML = '';
    global.window = originalWindow;
  });

  it('registers DOMContentLoaded handler when document is loading and tolerates missing back button', async () => {
    Object.defineProperty(document, 'readyState', {
      configurable: true,
      value: 'loading',
    });
    document.body.innerHTML = '';

    const addEventListenerSpy = jest.spyOn(document, 'addEventListener');

    const tokens = {
      AnatomyDescriptionService: Symbol('AnatomyDescriptionService'),
      VisualizerStateController: Symbol('VisualizerStateController'),
      VisualizationComposer: Symbol('VisualizationComposer'),
      ClothingManagementService: Symbol('ClothingManagementService'),
    };

    const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
    const services = {
      logger,
      registry: { id: 'registry' },
      entityManager: { id: 'entity-manager' },
      eventDispatcher: { dispatch: jest.fn() },
    };

    const resolvedTokens = new Map([
      [tokens.AnatomyDescriptionService, { id: 'anatomy-service' }],
      [tokens.VisualizerStateController, { id: 'state-controller' }],
      [tokens.VisualizationComposer, { id: 'composer' }],
    ]);

    const container = {
      resolve: jest.fn((token) => {
        if (!resolvedTokens.has(token)) {
          throw new Error('missing token');
        }
        return resolvedTokens.get(token);
      }),
    };

    const registerVisualizerComponents = jest.fn();
    const uiInitialize = jest.fn().mockResolvedValue(undefined);
    const AnatomyVisualizerUI = jest.fn(() => ({ initialize: uiInitialize }));

    const bootstrapperInstance = {
      bootstrap: jest.fn(async ({ postInitHook }) => {
        await postInitHook(services, container);
        return { container, services };
      }),
      displayFatalStartupError: jest.fn(),
    };

    const CommonBootstrapper = jest.fn(() => bootstrapperInstance);

    await jest.isolateModulesAsync(async () => {
      jest.doMock('../../src/bootstrapper/CommonBootstrapper.js', () => ({
        CommonBootstrapper,
      }));
      jest.doMock('../../src/dependencyInjection/tokens.js', () => ({
        tokens,
      }));
      jest.doMock(
        '../../src/dependencyInjection/registrations/visualizerRegistrations.js',
        () => ({ registerVisualizerComponents })
      );
      jest.doMock('../../src/domUI/AnatomyVisualizerUI.js', () => ({
        __esModule: true,
        default: AnatomyVisualizerUI,
      }));

      await import('../../src/anatomy-visualizer.js');
    });

    expect(addEventListenerSpy).toHaveBeenCalledTimes(1);
    expect(addEventListenerSpy).toHaveBeenCalledWith(
      'DOMContentLoaded',
      expect.any(Function)
    );

    const initializationTrigger = addEventListenerSpy.mock.calls[0][1];
    await initializationTrigger();
    await flushMicrotasks();

    expect(CommonBootstrapper).toHaveBeenCalledTimes(1);
    expect(bootstrapperInstance.bootstrap).toHaveBeenCalledTimes(1);
    expect(registerVisualizerComponents).toHaveBeenCalledWith(container);
    expect(container.resolve).toHaveBeenCalledWith(
      tokens.ClothingManagementService
    );
    expect(logger.warn).toHaveBeenCalledWith(
      'ClothingManagementService not available - equipment panel will be disabled'
    );
    expect(document.getElementById('back-button')).toBeNull();
    expect(uiInitialize).toHaveBeenCalledTimes(1);

    addEventListenerSpy.mockRestore();
  });

  it('initializes immediately when DOM is ready and wires the back button navigation', async () => {
    Object.defineProperty(document, 'readyState', {
      configurable: true,
      value: 'complete',
    });

    document.body.innerHTML = '<button id="back-button"></button>';
    const backButton = document.getElementById('back-button');
    const backButtonAddEventListener = jest.spyOn(
      backButton,
      'addEventListener'
    );
    const documentAddEventListener = jest.spyOn(document, 'addEventListener');

    const tokens = {
      AnatomyDescriptionService: Symbol('AnatomyDescriptionService'),
      VisualizerStateController: Symbol('VisualizerStateController'),
      VisualizationComposer: Symbol('VisualizationComposer'),
      ClothingManagementService: Symbol('ClothingManagementService'),
    };

    const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
    const services = {
      logger,
      registry: { id: 'registry' },
      entityManager: { id: 'entity-manager' },
      eventDispatcher: { dispatch: jest.fn() },
    };

    const resolvedTokens = new Map([
      [tokens.AnatomyDescriptionService, { id: 'anatomy-service' }],
      [tokens.VisualizerStateController, { id: 'state-controller' }],
      [tokens.VisualizationComposer, { id: 'composer' }],
      [tokens.ClothingManagementService, { id: 'clothing' }],
    ]);

    const container = {
      resolve: jest.fn((token) => resolvedTokens.get(token)),
    };

    const registerVisualizerComponents = jest.fn();
    const uiInitialize = jest.fn().mockResolvedValue(undefined);
    const AnatomyVisualizerUI = jest.fn(() => ({ initialize: uiInitialize }));

    const bootstrapperInstance = {
      bootstrap: jest.fn(async ({ postInitHook }) => {
        await postInitHook(services, container);
        return { container, services };
      }),
      displayFatalStartupError: jest.fn(),
    };

    const CommonBootstrapper = jest.fn(() => bootstrapperInstance);

    await jest.isolateModulesAsync(async () => {
      jest.doMock('../../src/bootstrapper/CommonBootstrapper.js', () => ({
        CommonBootstrapper,
      }));
      jest.doMock('../../src/dependencyInjection/tokens.js', () => ({
        tokens,
      }));
      jest.doMock(
        '../../src/dependencyInjection/registrations/visualizerRegistrations.js',
        () => ({ registerVisualizerComponents })
      );
      jest.doMock('../../src/domUI/AnatomyVisualizerUI.js', () => ({
        __esModule: true,
        default: AnatomyVisualizerUI,
      }));

      await import('../../src/anatomy-visualizer.js');
    });

    await flushMicrotasks();

    expect(documentAddEventListener).not.toHaveBeenCalledWith(
      'DOMContentLoaded',
      expect.any(Function)
    );
    expect(backButtonAddEventListener).toHaveBeenCalledWith(
      'click',
      expect.any(Function)
    );

    const clickHandler = backButtonAddEventListener.mock.calls[0][1];
    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    expect(clickHandler.toString()).toContain(
      "window.location.href = 'index.html'"
    );
    const previousHref = window.location.href;
    let thrownError = null;
    try {
      clickHandler();
    } catch (error) {
      thrownError = error;
    }
    if (thrownError) {
      expect(thrownError.message).toContain(
        'Not implemented: navigation (except hash changes)'
      );
    } else {
      window.location.href = previousHref;
    }
    consoleErrorSpy.mockRestore();

    expect(registerVisualizerComponents).toHaveBeenCalledWith(container);
    expect(uiInitialize).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledWith(
      'Anatomy Visualizer: Initializing UI...'
    );
    expect(logger.info).toHaveBeenCalledWith(
      'Anatomy Visualizer: Initialization complete'
    );

    backButtonAddEventListener.mockRestore();
    documentAddEventListener.mockRestore();
  });

  it('surfaces initialization failures through the fatal startup handler', async () => {
    Object.defineProperty(document, 'readyState', {
      configurable: true,
      value: 'complete',
    });

    document.body.innerHTML = '';

    const tokens = {
      AnatomyDescriptionService: Symbol('AnatomyDescriptionService'),
      VisualizerStateController: Symbol('VisualizerStateController'),
      VisualizationComposer: Symbol('VisualizationComposer'),
      ClothingManagementService: Symbol('ClothingManagementService'),
    };

    const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
    const services = {
      logger,
      registry: { id: 'registry' },
      entityManager: { id: 'entity-manager' },
      eventDispatcher: { dispatch: jest.fn() },
    };

    const resolvedTokens = new Map([
      [tokens.AnatomyDescriptionService, { id: 'anatomy-service' }],
      [tokens.VisualizerStateController, { id: 'state-controller' }],
      [tokens.VisualizationComposer, { id: 'composer' }],
      [tokens.ClothingManagementService, { id: 'clothing' }],
    ]);

    const container = {
      resolve: jest.fn((token) => resolvedTokens.get(token)),
    };

    const registerVisualizerComponents = jest.fn();
    const initializationError = new Error('UI failure');
    const uiInitialize = jest.fn().mockRejectedValue(initializationError);
    const AnatomyVisualizerUI = jest.fn(() => ({ initialize: uiInitialize }));

    const bootstrapperInstance = {
      bootstrap: jest.fn(async ({ postInitHook }) => {
        await postInitHook(services, container);
        return { container, services };
      }),
      displayFatalStartupError: jest.fn(),
    };

    const CommonBootstrapper = jest.fn(() => bootstrapperInstance);

    await jest.isolateModulesAsync(async () => {
      jest.doMock('../../src/bootstrapper/CommonBootstrapper.js', () => ({
        CommonBootstrapper,
      }));
      jest.doMock('../../src/dependencyInjection/tokens.js', () => ({
        tokens,
      }));
      jest.doMock(
        '../../src/dependencyInjection/registrations/visualizerRegistrations.js',
        () => ({ registerVisualizerComponents })
      );
      jest.doMock('../../src/domUI/AnatomyVisualizerUI.js', () => ({
        __esModule: true,
        default: AnatomyVisualizerUI,
      }));

      await import('../../src/anatomy-visualizer.js');
    });

    await flushMicrotasks();
    await flushMicrotasks();

    expect(registerVisualizerComponents).toHaveBeenCalledWith(container);
    expect(uiInitialize).toHaveBeenCalledTimes(1);
    expect(bootstrapperInstance.displayFatalStartupError).toHaveBeenCalledWith(
      'Failed to initialize anatomy visualizer: UI failure',
      initializationError
    );
  });
});
