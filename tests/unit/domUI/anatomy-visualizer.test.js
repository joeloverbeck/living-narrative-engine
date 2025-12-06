import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';

const mockBootstrap = jest.fn();
const mockDisplayFatalStartupError = jest.fn();
const mockRegisterVisualizerComponents = jest.fn();

const mockTokens = {
  AnatomyDescriptionService: Symbol('AnatomyDescriptionService'),
  VisualizerStateController: Symbol('VisualizerStateController'),
  VisualizationComposer: Symbol('VisualizationComposer'),
  ClothingManagementService: Symbol('ClothingManagementService'),
};

let mockUIInstance = { initialize: jest.fn() };
const MockAnatomyVisualizerUI = jest.fn().mockImplementation(function () {
  return mockUIInstance;
});

const MockCommonBootstrapper = jest.fn().mockImplementation(() => ({
  bootstrap: mockBootstrap,
  displayFatalStartupError: mockDisplayFatalStartupError,
}));

jest.mock('../../../src/bootstrapper/CommonBootstrapper.js', () => ({
  __esModule: true,
  CommonBootstrapper: MockCommonBootstrapper,
}));

jest.mock(
  '../../../src/dependencyInjection/registrations/visualizerRegistrations.js',
  () => ({
    __esModule: true,
    registerVisualizerComponents: mockRegisterVisualizerComponents,
  })
);

jest.mock('../../../src/domUI/AnatomyVisualizerUI.js', () => ({
  __esModule: true,
  default: MockAnatomyVisualizerUI,
}));

jest.mock('../../../src/dependencyInjection/tokens.js', () => ({
  __esModule: true,
  tokens: mockTokens,
}));

const flushPromises = () => new Promise((resolve) => setImmediate(resolve));
describe('anatomy-visualizer bootstrap flow', () => {
  let mockContainer;
  let mockServices;

  beforeEach(() => {
    jest.resetModules();
    mockBootstrap.mockReset();
    mockDisplayFatalStartupError.mockReset();
    mockRegisterVisualizerComponents.mockReset();
    MockCommonBootstrapper.mockClear();
    MockAnatomyVisualizerUI.mockClear();

    mockUIInstance = {
      initialize: jest.fn().mockResolvedValue(),
    };

    document.body.innerHTML = '';
    delete document.readyState;
  });

  afterEach(() => {
    document.body.innerHTML = '';
    delete document.readyState;
  });

  const importVisualizer = async () => {
    await import('../../../src/anatomy-visualizer.js');
  };

  const createBaseDependencies = () => {
    const anatomyDescriptionService = { describe: jest.fn() };
    const visualizerStateController = { setState: jest.fn() };
    const visualizationComposer = { compose: jest.fn() };
    const clothingManagementService = { listItems: jest.fn() };

    mockServices = {
      logger: { info: jest.fn(), warn: jest.fn() },
      registry: { get: jest.fn() },
      entityManager: { entities: [] },
      eventDispatcher: { dispatch: jest.fn() },
    };

    mockContainer = {
      resolve: jest.fn((token) => {
        switch (token) {
          case mockTokens.AnatomyDescriptionService:
            return anatomyDescriptionService;
          case mockTokens.VisualizerStateController:
            return visualizerStateController;
          case mockTokens.VisualizationComposer:
            return visualizationComposer;
          case mockTokens.ClothingManagementService:
            return clothingManagementService;
          default:
            throw new Error(`Unexpected token: ${String(token)}`);
        }
      }),
    };

    return {
      anatomyDescriptionService,
      visualizerStateController,
      visualizationComposer,
      clothingManagementService,
    };
  };

  it('initializes after DOMContentLoaded with full service availability', async () => {
    const addEventListenerSpy = jest.spyOn(document, 'addEventListener');
    Object.defineProperty(document, 'readyState', {
      configurable: true,
      value: 'loading',
    });

    const originalGetElementById = document.getElementById.bind(document);
    const clickHandlers = [];
    const backButtonAddListenerSpy = jest.fn((event, handler) => {
      if (event === 'click') {
        clickHandlers.push(handler);
      }
    });
    const getElementByIdSpy = jest
      .spyOn(document, 'getElementById')
      .mockImplementation((id) => {
        if (id === 'back-button') {
          return { addEventListener: backButtonAddListenerSpy };
        }

        return originalGetElementById(id);
      });

    const dependencies = createBaseDependencies();

    mockBootstrap.mockImplementation(async (config) => {
      expect(config).toEqual(
        expect.objectContaining({
          containerConfigType: 'minimal',
          includeAnatomyFormatting: true,
          worldName: 'default',
          postInitHook: expect.any(Function),
        })
      );

      await config.postInitHook(mockServices, mockContainer);
      return { container: mockContainer, services: mockServices };
    });

    try {
      await importVisualizer();

      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'DOMContentLoaded',
        expect.any(Function)
      );

      document.dispatchEvent(new Event('DOMContentLoaded'));
      await flushPromises();

      expect(mockRegisterVisualizerComponents).toHaveBeenCalledWith(
        mockContainer
      );
      expect(mockContainer.resolve).toHaveBeenNthCalledWith(
        1,
        mockTokens.AnatomyDescriptionService
      );
      expect(mockContainer.resolve).toHaveBeenNthCalledWith(
        2,
        mockTokens.VisualizerStateController
      );
      expect(mockContainer.resolve).toHaveBeenNthCalledWith(
        3,
        mockTokens.VisualizationComposer
      );
      expect(mockContainer.resolve).toHaveBeenNthCalledWith(
        4,
        mockTokens.ClothingManagementService
      );

      expect(MockAnatomyVisualizerUI).toHaveBeenCalledWith({
        logger: mockServices.logger,
        registry: mockServices.registry,
        entityManager: mockServices.entityManager,
        anatomyDescriptionService: dependencies.anatomyDescriptionService,
        eventDispatcher: mockServices.eventDispatcher,
        documentContext: { document },
        visualizerStateController: dependencies.visualizerStateController,
        visualizationComposer: dependencies.visualizationComposer,
        clothingManagementService: dependencies.clothingManagementService,
      });

      expect(mockUIInstance.initialize).toHaveBeenCalledTimes(1);
      expect(mockServices.logger.warn).not.toHaveBeenCalled();
      expect(mockServices.logger.info).toHaveBeenCalledWith(
        'Anatomy Visualizer: Initialization complete'
      );
      expect(backButtonAddListenerSpy).toHaveBeenCalledWith(
        'click',
        expect.any(Function)
      );

      const clickHandler = clickHandlers[0];
      expect(clickHandler).toBeInstanceOf(Function);

      expect(() => clickHandler()).not.toThrow();
    } finally {
      getElementByIdSpy.mockRestore();
      addEventListenerSpy.mockRestore();
    }
  });

  it('logs a warning when clothing management service is unavailable', async () => {
    Object.defineProperty(document, 'readyState', {
      configurable: true,
      value: 'loading',
    });

    document.body.innerHTML = '<button id="back-button"></button>';

    const dependencies = createBaseDependencies();

    mockContainer.resolve.mockImplementation((token) => {
      if (token === mockTokens.ClothingManagementService) {
        throw new Error('Service not registered');
      }
      return dependencies[
        token === mockTokens.AnatomyDescriptionService
          ? 'anatomyDescriptionService'
          : token === mockTokens.VisualizerStateController
            ? 'visualizerStateController'
            : 'visualizationComposer'
      ];
    });

    mockBootstrap.mockImplementation(async (config) => {
      await config.postInitHook(mockServices, mockContainer);
      return { container: mockContainer, services: mockServices };
    });

    await importVisualizer();

    document.dispatchEvent(new Event('DOMContentLoaded'));
    await flushPromises();

    expect(mockServices.logger.warn).toHaveBeenCalledWith(
      'ClothingManagementService not available - equipment panel will be disabled'
    );

    expect(MockAnatomyVisualizerUI).toHaveBeenCalledWith(
      expect.objectContaining({ clothingManagementService: null })
    );
  });

  it('displays a fatal startup error when bootstrap fails immediately', async () => {
    Object.defineProperty(document, 'readyState', {
      configurable: true,
      value: 'complete',
    });

    const fatalError = new Error('Bootstrap failed');
    mockBootstrap.mockRejectedValueOnce(fatalError);

    await importVisualizer();
    await flushPromises();

    expect(mockDisplayFatalStartupError).toHaveBeenCalledWith(
      'Failed to initialize anatomy visualizer: Bootstrap failed',
      fatalError
    );
    expect(mockRegisterVisualizerComponents).not.toHaveBeenCalled();
  });
});
