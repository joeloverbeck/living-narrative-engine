import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';

const flushMicrotasks = () => new Promise((resolve) => setImmediate(resolve));

describe('anatomy-visualizer.js bootstrap orchestration', () => {
  let originalDocument;
  let originalWindow;
  let originalAlert;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    originalDocument = global.document;
    originalWindow = global.window;
    originalAlert = global.alert;
    global.alert = jest.fn();
  });

  afterEach(() => {
    global.document = originalDocument;
    global.window = originalWindow;
    global.alert = originalAlert;
  });

  it('initializes the visualizer immediately when the DOM is ready', async () => {
    const tokens = {
      AnatomyDescriptionService: Symbol('AnatomyDescriptionService'),
      VisualizerStateController: Symbol('VisualizerStateController'),
      VisualizationComposer: Symbol('VisualizationComposer'),
      ClothingManagementService: Symbol('ClothingManagementService'),
    };

    const registerVisualizerComponents = jest.fn();
    const uiInitialize = jest.fn().mockResolvedValue(undefined);
    const AnatomyVisualizerUI = jest.fn(() => ({ initialize: uiInitialize }));

    const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
    const services = {
      logger,
      registry: { id: 'registry' },
      entityManager: { id: 'entity-manager' },
      eventDispatcher: { dispatch: jest.fn() },
    };

    const resolved = new Map([
      [tokens.AnatomyDescriptionService, { service: 'anatomy' }],
      [tokens.VisualizerStateController, { service: 'state' }],
      [tokens.VisualizationComposer, { service: 'composer' }],
      [tokens.ClothingManagementService, { service: 'clothing' }],
    ]);

    const container = {
      resolve: jest.fn((token) => {
        if (!resolved.has(token))
          throw new Error(`Unknown token: ${String(token)}`);
        return resolved.get(token);
      }),
    };

    const bootstrapperInstance = {
      bootstrap: jest.fn(async ({ postInitHook }) => {
        await postInitHook(services, container);
        return { container, services };
      }),
      displayFatalStartupError: jest.fn(),
    };

    const CommonBootstrapper = jest.fn(() => bootstrapperInstance);

    const originalReadyStateDescriptor = Object.getOwnPropertyDescriptor(
      document,
      'readyState'
    );
    Object.defineProperty(document, 'readyState', {
      configurable: true,
      enumerable: true,
      value: 'complete',
    });

    const backButton = document.createElement('button');
    backButton.id = 'back-button';
    document.body.appendChild(backButton);
    const addEventListenerSpy = jest.spyOn(backButton, 'addEventListener');

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

    expect(CommonBootstrapper).toHaveBeenCalledTimes(1);
    expect(bootstrapperInstance.bootstrap).toHaveBeenCalledWith({
      containerConfigType: 'minimal',
      worldName: 'default',
      includeAnatomyFormatting: true,
      postInitHook: expect.any(Function),
    });

    expect(registerVisualizerComponents).toHaveBeenCalledWith(container);
    expect(AnatomyVisualizerUI).toHaveBeenCalledWith({
      logger,
      registry: services.registry,
      entityManager: services.entityManager,
      anatomyDescriptionService: resolved.get(tokens.AnatomyDescriptionService),
      eventDispatcher: services.eventDispatcher,
      documentContext: { document },
      visualizerStateController: resolved.get(tokens.VisualizerStateController),
      visualizationComposer: resolved.get(tokens.VisualizationComposer),
      clothingManagementService: resolved.get(tokens.ClothingManagementService),
    });
    expect(uiInitialize).toHaveBeenCalledTimes(1);

    expect(addEventListenerSpy).toHaveBeenCalledWith(
      'click',
      expect.any(Function)
    );
    const clickHandler = addEventListenerSpy.mock.calls[0][1];
    expect(() => clickHandler()).not.toThrow();

    addEventListenerSpy.mockRestore();
    document.body.innerHTML = '';
    if (originalReadyStateDescriptor) {
      Object.defineProperty(
        document,
        'readyState',
        originalReadyStateDescriptor
      );
    }
  });

  it('waits for DOMContentLoaded when the document is still loading', async () => {
    const tokens = {
      AnatomyDescriptionService: Symbol('AnatomyDescriptionService'),
      VisualizerStateController: Symbol('VisualizerStateController'),
      VisualizationComposer: Symbol('VisualizationComposer'),
      ClothingManagementService: Symbol('ClothingManagementService'),
    };

    const registerVisualizerComponents = jest.fn();
    const AnatomyVisualizerUI = jest.fn(() => ({ initialize: jest.fn() }));

    const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
    const services = {
      logger,
      registry: {},
      entityManager: {},
      eventDispatcher: {},
    };

    const container = {
      resolve: jest.fn(() => ({})),
    };

    const domListeners = new Map();

    const bootstrapperInstance = {
      bootstrap: jest.fn(async ({ postInitHook }) => {
        await postInitHook(services, container);
        return { container, services };
      }),
      displayFatalStartupError: jest.fn(),
    };

    const CommonBootstrapper = jest.fn(() => bootstrapperInstance);

    const originalReadyStateDescriptor = Object.getOwnPropertyDescriptor(
      document,
      'readyState'
    );
    Object.defineProperty(document, 'readyState', {
      configurable: true,
      enumerable: true,
      value: 'loading',
    });

    const addEventListenerSpy = jest
      .spyOn(document, 'addEventListener')
      .mockImplementation((event, handler) => {
        domListeners.set(event, handler);
      });

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

    expect(bootstrapperInstance.bootstrap).not.toHaveBeenCalled();
    expect(domListeners.has('DOMContentLoaded')).toBe(true);

    await domListeners.get('DOMContentLoaded')();
    await flushMicrotasks();

    expect(bootstrapperInstance.bootstrap).toHaveBeenCalledTimes(1);
    expect(registerVisualizerComponents).toHaveBeenCalledTimes(1);

    addEventListenerSpy.mockRestore();
    if (originalReadyStateDescriptor) {
      Object.defineProperty(
        document,
        'readyState',
        originalReadyStateDescriptor
      );
    }
  });

  it('logs a warning when the clothing service cannot be resolved', async () => {
    const tokens = {
      AnatomyDescriptionService: Symbol('AnatomyDescriptionService'),
      VisualizerStateController: Symbol('VisualizerStateController'),
      VisualizationComposer: Symbol('VisualizationComposer'),
      ClothingManagementService: Symbol('ClothingManagementService'),
    };

    const registerVisualizerComponents = jest.fn();
    const uiInitialize = jest.fn().mockResolvedValue(undefined);
    const AnatomyVisualizerUI = jest.fn(() => ({ initialize: uiInitialize }));

    const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
    const services = {
      logger,
      registry: {},
      entityManager: {},
      eventDispatcher: {},
    };

    const resolved = new Map([
      [tokens.AnatomyDescriptionService, { service: 'anatomy' }],
      [tokens.VisualizerStateController, { service: 'state' }],
      [tokens.VisualizationComposer, { service: 'composer' }],
    ]);

    const container = {
      resolve: jest.fn((token) => {
        if (token === tokens.ClothingManagementService) {
          throw new Error('Clothing service missing');
        }
        return resolved.get(token) ?? {};
      }),
    };

    const bootstrapperInstance = {
      bootstrap: jest.fn(async ({ postInitHook }) => {
        await postInitHook(services, container);
        return { container, services };
      }),
      displayFatalStartupError: jest.fn(),
    };

    const CommonBootstrapper = jest.fn(() => bootstrapperInstance);

    const readyStateDescriptor = Object.getOwnPropertyDescriptor(
      document,
      'readyState'
    );
    Object.defineProperty(document, 'readyState', {
      configurable: true,
      enumerable: true,
      value: 'complete',
    });

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

    expect(logger.warn).toHaveBeenCalledWith(
      'ClothingManagementService not available - equipment panel will be disabled'
    );
    expect(container.resolve).toHaveBeenCalledWith(
      tokens.ClothingManagementService
    );
    expect(AnatomyVisualizerUI).toHaveBeenCalledWith(
      expect.objectContaining({ clothingManagementService: null })
    );
    expect(uiInitialize).toHaveBeenCalledTimes(1);

    if (readyStateDescriptor) {
      Object.defineProperty(document, 'readyState', readyStateDescriptor);
    }
  });

  it('reports bootstrap failures via the fatal error handler', async () => {
    const tokens = {
      AnatomyDescriptionService: Symbol('AnatomyDescriptionService'),
      VisualizerStateController: Symbol('VisualizerStateController'),
      VisualizationComposer: Symbol('VisualizationComposer'),
      ClothingManagementService: Symbol('ClothingManagementService'),
    };

    const registerVisualizerComponents = jest.fn();
    const AnatomyVisualizerUI = jest.fn(() => ({ initialize: jest.fn() }));

    const bootstrapError = new Error('bootstrap failed');

    const bootstrapperInstance = {
      bootstrap: jest.fn(async () => {
        throw bootstrapError;
      }),
      displayFatalStartupError: jest.fn(),
    };

    const CommonBootstrapper = jest.fn(() => bootstrapperInstance);

    const readyStateDescriptor = Object.getOwnPropertyDescriptor(
      document,
      'readyState'
    );
    Object.defineProperty(document, 'readyState', {
      configurable: true,
      enumerable: true,
      value: 'complete',
    });

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

    expect(CommonBootstrapper).toHaveBeenCalledTimes(1);
    expect(bootstrapperInstance.displayFatalStartupError).toHaveBeenCalledWith(
      'Failed to initialize anatomy visualizer: bootstrap failed',
      bootstrapError
    );
    expect(registerVisualizerComponents).not.toHaveBeenCalled();

    if (readyStateDescriptor) {
      Object.defineProperty(document, 'readyState', readyStateDescriptor);
    }
  });

  it('propagates post-init errors to the fatal startup handler', async () => {
    const tokens = {
      AnatomyDescriptionService: Symbol('AnatomyDescriptionService'),
      VisualizerStateController: Symbol('VisualizerStateController'),
      VisualizationComposer: Symbol('VisualizationComposer'),
      ClothingManagementService: Symbol('ClothingManagementService'),
    };

    const registerVisualizerComponents = jest.fn();
    const postInitError = new Error('UI initialization failed');
    const uiInitialize = jest.fn().mockRejectedValue(postInitError);
    const AnatomyVisualizerUI = jest.fn(() => ({ initialize: uiInitialize }));

    const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
    const services = {
      logger,
      registry: {},
      entityManager: {},
      eventDispatcher: {},
    };

    const container = {
      resolve: jest.fn(() => ({})),
    };

    const bootstrapperInstance = {
      bootstrap: jest.fn(async ({ postInitHook }) => {
        await postInitHook(services, container);
        return { container, services };
      }),
      displayFatalStartupError: jest.fn(),
    };

    const CommonBootstrapper = jest.fn(() => bootstrapperInstance);

    const readyStateDescriptor = Object.getOwnPropertyDescriptor(
      document,
      'readyState'
    );
    Object.defineProperty(document, 'readyState', {
      configurable: true,
      enumerable: true,
      value: 'complete',
    });

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
      'Failed to initialize anatomy visualizer: UI initialization failed',
      postInitError
    );

    if (readyStateDescriptor) {
      Object.defineProperty(document, 'readyState', readyStateDescriptor);
    }
  });
});
