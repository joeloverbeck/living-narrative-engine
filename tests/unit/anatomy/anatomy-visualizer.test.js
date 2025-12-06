import {
  describe,
  it,
  beforeEach,
  afterEach,
  expect,
  jest,
} from '@jest/globals';

const mockBootstrapperCtor = jest.fn();
const mockRegisterVisualizerComponents = jest.fn();
const mockAnatomyVisualizerUIConstructor = jest.fn();

const tokensMock = {
  AnatomyDescriptionService: 'AnatomyDescriptionService',
  VisualizerStateController: 'VisualizerStateController',
  VisualizationComposer: 'VisualizationComposer',
  ClothingManagementService: 'ClothingManagementService',
};

jest.mock('../../../src/bootstrapper/CommonBootstrapper.js', () => ({
  CommonBootstrapper: mockBootstrapperCtor,
}));

jest.mock(
  '../../../src/dependencyInjection/registrations/visualizerRegistrations.js',
  () => ({
    registerVisualizerComponents: mockRegisterVisualizerComponents,
  })
);

jest.mock('../../../src/dependencyInjection/tokens.js', () => ({
  tokens: tokensMock,
}));

jest.mock('../../../src/domUI/AnatomyVisualizerUI.js', () => ({
  __esModule: true,
  default: mockAnatomyVisualizerUIConstructor,
}));

const flushPromises = async () => {
  await new Promise((resolve) => setImmediate(resolve));
};

const setReadyState = (state) => {
  Object.defineProperty(document, 'readyState', {
    configurable: true,
    get: () => state,
  });
};

describe('anatomy-visualizer initialize', () => {
  let mockBootstrapperInstance;
  let mockServices;
  let mockContainer;
  let mockUIInstance;
  let originalHref;

  beforeEach(() => {
    jest.resetModules();
    mockBootstrapperCtor.mockReset();
    mockRegisterVisualizerComponents.mockReset();
    mockAnatomyVisualizerUIConstructor.mockReset();

    mockBootstrapperInstance = {
      bootstrap: jest.fn(),
      displayFatalStartupError: jest.fn(),
    };

    mockBootstrapperCtor.mockImplementation(() => mockBootstrapperInstance);

    mockServices = {
      logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      },
      registry: { id: 'registry' },
      entityManager: { id: 'entityManager' },
      eventDispatcher: { id: 'eventDispatcher' },
    };

    mockContainer = {
      resolve: jest.fn((token) => {
        switch (token) {
          case tokensMock.AnatomyDescriptionService:
            return { id: 'anatomyDescriptionService' };
          case tokensMock.VisualizerStateController:
            return { id: 'visualizerStateController' };
          case tokensMock.VisualizationComposer:
            return { id: 'visualizationComposer' };
          case tokensMock.ClothingManagementService:
            return { id: 'clothingManagementService' };
          default:
            throw new Error(`Unexpected token: ${token}`);
        }
      }),
    };

    mockUIInstance = {
      initialize: jest.fn().mockResolvedValue(undefined),
    };

    mockAnatomyVisualizerUIConstructor.mockImplementation(() => mockUIInstance);

    document.body.innerHTML = '';
    originalHref = window.location.href;
    setReadyState('loading');
  });

  afterEach(() => {
    window.location.href = originalHref;
    setReadyState('complete');
    jest.restoreAllMocks();
  });

  it('initializes the visualizer UI with clothing support and back navigation', async () => {
    document.body.innerHTML = '<button id="back-button"></button>';
    const backButton = document.getElementById('back-button');
    const addEventListenerSpy = jest.spyOn(backButton, 'addEventListener');

    mockBootstrapperInstance.bootstrap.mockImplementation(async (options) => {
      expect(options).toMatchObject({
        containerConfigType: 'minimal',
        worldName: 'default',
        includeAnatomyFormatting: true,
      });
      expect(typeof options.postInitHook).toBe('function');
      await options.postInitHook(mockServices, mockContainer);
      return { container: mockContainer, services: mockServices };
    });

    const module = await import('../../../src/anatomy-visualizer.js');
    await module.initialize();

    expect(mockRegisterVisualizerComponents).toHaveBeenCalledWith(
      mockContainer
    );
    expect(mockContainer.resolve).toHaveBeenCalledWith(
      tokensMock.AnatomyDescriptionService
    );
    expect(mockContainer.resolve).toHaveBeenCalledWith(
      tokensMock.VisualizerStateController
    );
    expect(mockContainer.resolve).toHaveBeenCalledWith(
      tokensMock.VisualizationComposer
    );
    expect(mockContainer.resolve).toHaveBeenCalledWith(
      tokensMock.ClothingManagementService
    );

    expect(mockAnatomyVisualizerUIConstructor).toHaveBeenCalledTimes(1);
    const constructorArgs = mockAnatomyVisualizerUIConstructor.mock.calls[0][0];
    expect(constructorArgs).toMatchObject({
      logger: mockServices.logger,
      registry: mockServices.registry,
      entityManager: mockServices.entityManager,
      anatomyDescriptionService: { id: 'anatomyDescriptionService' },
      eventDispatcher: mockServices.eventDispatcher,
      documentContext: { document },
      visualizerStateController: { id: 'visualizerStateController' },
      visualizationComposer: { id: 'visualizationComposer' },
      clothingManagementService: { id: 'clothingManagementService' },
    });

    expect(mockUIInstance.initialize).toHaveBeenCalledTimes(1);

    expect(mockServices.logger.info).toHaveBeenNthCalledWith(
      1,
      'Anatomy Visualizer: Initializing UI...'
    );
    expect(mockServices.logger.info).toHaveBeenNthCalledWith(
      2,
      'Anatomy Visualizer: Initialization complete'
    );

    expect(
      mockBootstrapperInstance.displayFatalStartupError
    ).not.toHaveBeenCalled();

    expect(addEventListenerSpy).toHaveBeenCalledWith(
      'click',
      expect.any(Function)
    );
    const clickHandler = addEventListenerSpy.mock.calls[0][1];
    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    try {
      clickHandler();
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it('logs a warning when the optional clothing service is unavailable', async () => {
    const clothingError = new Error('missing clothing');
    mockContainer.resolve.mockImplementation((token) => {
      if (token === tokensMock.ClothingManagementService) {
        throw clothingError;
      }
      return {
        [tokensMock.AnatomyDescriptionService]: {
          id: 'anatomyDescriptionService',
        },
        [tokensMock.VisualizerStateController]: {
          id: 'visualizerStateController',
        },
        [tokensMock.VisualizationComposer]: { id: 'visualizationComposer' },
      }[token];
    });

    mockBootstrapperInstance.bootstrap.mockImplementation(async (options) => {
      await options.postInitHook(mockServices, mockContainer);
      return { container: mockContainer, services: mockServices };
    });

    const module = await import('../../../src/anatomy-visualizer.js');
    await module.initialize();

    expect(mockServices.logger.warn).toHaveBeenCalledWith(
      'ClothingManagementService not available - equipment panel will be disabled'
    );
    const constructorArgs = mockAnatomyVisualizerUIConstructor.mock.calls[0][0];
    expect(constructorArgs.clothingManagementService).toBeNull();
  });

  it('reports fatal startup errors when UI initialization fails', async () => {
    const failure = new Error('UI init failure');
    mockUIInstance.initialize.mockRejectedValueOnce(failure);

    mockBootstrapperInstance.bootstrap.mockImplementation(async (options) => {
      await options.postInitHook(mockServices, mockContainer);
      return { container: mockContainer, services: mockServices };
    });

    const module = await import('../../../src/anatomy-visualizer.js');
    await module.initialize();

    expect(
      mockBootstrapperInstance.displayFatalStartupError
    ).toHaveBeenCalledWith(
      'Failed to initialize anatomy visualizer: UI init failure',
      failure
    );
    expect(mockServices.logger.info).toHaveBeenCalledWith(
      'Anatomy Visualizer: Initializing UI...'
    );
    expect(mockServices.logger.info).not.toHaveBeenCalledWith(
      'Anatomy Visualizer: Initialization complete'
    );
  });

  it('defers initialization until DOMContentLoaded when the document is loading', async () => {
    const addEventListenerSpy = jest.spyOn(document, 'addEventListener');
    let domReadyHandler;
    addEventListenerSpy.mockImplementation((event, handler) => {
      if (event === 'DOMContentLoaded') {
        domReadyHandler = handler;
      }
    });

    mockBootstrapperInstance.bootstrap.mockImplementation(async (options) => {
      await options.postInitHook(mockServices, mockContainer);
      return { container: mockContainer, services: mockServices };
    });

    const module = await import('../../../src/anatomy-visualizer.js');

    expect(domReadyHandler).toBe(module.initialize);
    expect(mockBootstrapperInstance.bootstrap).not.toHaveBeenCalled();

    await domReadyHandler();

    expect(mockBootstrapperInstance.bootstrap).toHaveBeenCalledTimes(1);
    expect(mockUIInstance.initialize).toHaveBeenCalledTimes(1);
    addEventListenerSpy.mockRestore();
  });

  it('initializes immediately when the document is already ready', async () => {
    const addEventListenerSpy = jest.spyOn(document, 'addEventListener');
    setReadyState('complete');

    mockBootstrapperInstance.bootstrap.mockImplementation(async (options) => {
      await options.postInitHook(mockServices, mockContainer);
      return { container: mockContainer, services: mockServices };
    });

    await import('../../../src/anatomy-visualizer.js');
    await flushPromises();

    expect(addEventListenerSpy).not.toHaveBeenCalledWith(
      'DOMContentLoaded',
      expect.any(Function)
    );
    expect(mockBootstrapperInstance.bootstrap).toHaveBeenCalledTimes(1);
    expect(mockUIInstance.initialize).toHaveBeenCalledTimes(1);
    addEventListenerSpy.mockRestore();
  });
});
