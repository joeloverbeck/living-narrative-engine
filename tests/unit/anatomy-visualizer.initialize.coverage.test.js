import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';

const flushTasks = () => new Promise((resolve) => setImmediate(resolve));

describe('anatomy-visualizer.js initialization coverage', () => {
  let originalReadyStateDescriptor;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
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
  });

  const createTokens = () => ({
    AnatomyDescriptionService: Symbol('AnatomyDescriptionService'),
    VisualizerStateController: Symbol('VisualizerStateController'),
    VisualizationComposer: Symbol('VisualizationComposer'),
    ClothingManagementService: Symbol('ClothingManagementService'),
  });

  const createServices = () => ({
    logger: {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    },
    registry: { id: 'registry' },
    entityManager: { id: 'entity-manager' },
    eventDispatcher: { dispatch: jest.fn() },
  });

  it('bootstraps immediately when DOM is ready and wires dependencies including back button', async () => {
    Object.defineProperty(document, 'readyState', {
      configurable: true,
      value: 'complete',
    });

    const backButton = document.createElement('button');
    backButton.id = 'back-button';
    document.body.appendChild(backButton);
    const backButtonListenerSpy = jest.spyOn(backButton, 'addEventListener');

    const tokens = createTokens();
    const services = createServices();
    const resolvedTokens = new Map([
      [tokens.AnatomyDescriptionService, { id: 'anatomy' }],
      [tokens.VisualizerStateController, { id: 'state' }],
      [tokens.VisualizationComposer, { id: 'composer' }],
      [tokens.ClothingManagementService, { id: 'clothing' }],
    ]);

    const container = {
      resolve: jest.fn((token) => {
        if (!resolvedTokens.has(token)) {
          throw new Error(`unknown token ${String(token)}`);
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

    await flushTasks();

    expect(CommonBootstrapper).toHaveBeenCalledTimes(1);
    expect(bootstrapperInstance.bootstrap).toHaveBeenCalledWith({
      containerConfigType: 'minimal',
      worldName: 'default',
      includeAnatomyFormatting: true,
      postInitHook: expect.any(Function),
    });

    expect(registerVisualizerComponents).toHaveBeenCalledWith(container);
    expect(AnatomyVisualizerUI).toHaveBeenCalledWith({
      logger: services.logger,
      registry: services.registry,
      entityManager: services.entityManager,
      anatomyDescriptionService: resolvedTokens.get(
        tokens.AnatomyDescriptionService
      ),
      eventDispatcher: services.eventDispatcher,
      documentContext: { document },
      visualizerStateController: resolvedTokens.get(
        tokens.VisualizerStateController
      ),
      visualizationComposer: resolvedTokens.get(tokens.VisualizationComposer),
      clothingManagementService: resolvedTokens.get(
        tokens.ClothingManagementService
      ),
    });
    expect(uiInitialize).toHaveBeenCalledTimes(1);

    expect(backButtonListenerSpy).toHaveBeenCalledWith(
      'click',
      expect.any(Function)
    );
    const clickHandler = backButtonListenerSpy.mock.calls[0][1];
    expect(() => clickHandler()).not.toThrow();

    backButtonListenerSpy.mockRestore();
  });

  it('logs a warning when optional clothing service cannot be resolved', async () => {
    Object.defineProperty(document, 'readyState', {
      configurable: true,
      value: 'complete',
    });

    const tokens = createTokens();
    const services = createServices();
    const resolvedTokens = new Map([
      [tokens.AnatomyDescriptionService, { id: 'anatomy' }],
      [tokens.VisualizerStateController, { id: 'state' }],
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
    const AnatomyVisualizerUI = jest.fn(() => ({ initialize: jest.fn() }));

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

    await flushTasks();

    expect(container.resolve).toHaveBeenCalledTimes(4);
    expect(services.logger.warn).toHaveBeenCalledWith(
      'ClothingManagementService not available - equipment panel will be disabled'
    );

    const constructorArgs = AnatomyVisualizerUI.mock.calls[0][0];
    expect(constructorArgs.clothingManagementService).toBeNull();
  });

  it('waits for DOMContentLoaded when document is still loading', async () => {
    Object.defineProperty(document, 'readyState', {
      configurable: true,
      value: 'loading',
    });

    const tokens = createTokens();
    const services = createServices();

    const container = {
      resolve: jest.fn(() => ({})),
    };

    const registerVisualizerComponents = jest.fn();
    const AnatomyVisualizerUI = jest.fn(() => ({
      initialize: jest.fn().mockResolvedValue(undefined),
    }));

    const bootstrapperInstance = {
      bootstrap: jest.fn(async ({ postInitHook }) => {
        await postInitHook(services, container);
        return { container, services };
      }),
      displayFatalStartupError: jest.fn(),
    };

    const CommonBootstrapper = jest.fn(() => bootstrapperInstance);
    const domListeners = new Map();

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

    expect(addEventListenerSpy).toHaveBeenCalledWith(
      'DOMContentLoaded',
      expect.any(Function)
    );
    const listener = domListeners.get('DOMContentLoaded');
    await listener();
    await flushTasks();

    expect(registerVisualizerComponents).toHaveBeenCalledWith(container);
    expect(AnatomyVisualizerUI).toHaveBeenCalledTimes(1);

    addEventListenerSpy.mockRestore();
  });

  it('reports bootstrap failures through the fatal startup handler', async () => {
    Object.defineProperty(document, 'readyState', {
      configurable: true,
      value: 'complete',
    });

    const tokens = createTokens();
    const services = createServices();

    const container = { resolve: jest.fn(() => ({})) };

    const bootstrapError = new Error('bootstrap failed');

    const bootstrapperInstance = {
      bootstrap: jest.fn(async () => {
        throw bootstrapError;
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
        () => ({ registerVisualizerComponents: jest.fn() })
      );
      jest.doMock('../../src/domUI/AnatomyVisualizerUI.js', () => ({
        __esModule: true,
        default: jest.fn(() => ({ initialize: jest.fn() })),
      }));

      await import('../../src/anatomy-visualizer.js');
    });

    await flushTasks();

    expect(bootstrapperInstance.displayFatalStartupError).toHaveBeenCalledWith(
      'Failed to initialize anatomy visualizer: bootstrap failed',
      bootstrapError
    );
  });

  it('propagates post-initialization failures to the fatal startup handler', async () => {
    Object.defineProperty(document, 'readyState', {
      configurable: true,
      value: 'complete',
    });

    const tokens = createTokens();
    const services = createServices();

    const resolvedTokens = new Map([
      [tokens.AnatomyDescriptionService, { id: 'anatomy-service' }],
      [tokens.VisualizerStateController, { id: 'state-controller' }],
      [tokens.VisualizationComposer, { id: 'composer' }],
      [tokens.ClothingManagementService, { id: 'clothing' }],
    ]);

    const container = {
      resolve: jest.fn((token) => {
        if (!resolvedTokens.has(token)) {
          throw new Error(`unexpected token ${String(token)}`);
        }
        return resolvedTokens.get(token);
      }),
    };

    const postInitError = new Error('post init failure');

    const registerVisualizerComponents = jest.fn(() => {
      throw postInitError;
    });

    const AnatomyVisualizerUI = jest.fn(() => ({ initialize: jest.fn() }));

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

    await flushTasks();

    expect(registerVisualizerComponents).toHaveBeenCalledWith(container);
    expect(bootstrapperInstance.displayFatalStartupError).toHaveBeenCalledWith(
      'Failed to initialize anatomy visualizer: post init failure',
      postInitError
    );
    expect(bootstrapperInstance.displayFatalStartupError).toHaveBeenCalledTimes(
      1
    );
  });
});
