import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  beforeAll,
  afterAll,
  jest,
} from '@jest/globals';

const mockBootstrap = jest.fn();
const mockDisplayFatalStartupError = jest.fn();
const mockRegisterVisualizerComponents = jest.fn();
const mockVisualizerInitialize = jest.fn();
const mockTokens = {
  AnatomyDescriptionService: 'AnatomyDescriptionService',
  VisualizerStateController: 'VisualizerStateController',
  VisualizationComposer: 'VisualizationComposer',
  ClothingManagementService: 'ClothingManagementService',
};
const mockAnatomyVisualizerUIConstructor = jest.fn().mockImplementation(() => ({
  initialize: mockVisualizerInitialize,
}));

jest.mock('../../src/bootstrapper/CommonBootstrapper.js', () => ({
  __esModule: true,
  CommonBootstrapper: jest.fn().mockImplementation(() => ({
    bootstrap: mockBootstrap,
    displayFatalStartupError: mockDisplayFatalStartupError,
  })),
}));

jest.mock(
  '../../src/dependencyInjection/registrations/visualizerRegistrations.js',
  () => ({
    __esModule: true,
    registerVisualizerComponents: mockRegisterVisualizerComponents,
  })
);

jest.mock('../../src/domUI/AnatomyVisualizerUI.js', () => ({
  __esModule: true,
  default: mockAnatomyVisualizerUIConstructor,
}));

jest.mock('../../src/dependencyInjection/tokens.js', () => ({
  __esModule: true,
  tokens: mockTokens,
}));

const flushPromises = () => new Promise((resolve) => setImmediate(resolve));

const originalReadyStateDescriptor = Object.getOwnPropertyDescriptor(
  document,
  'readyState'
);
let mockedReadyState = 'loading';

beforeAll(() => {
  Object.defineProperty(document, 'readyState', {
    configurable: true,
    get: () => mockedReadyState,
  });
});

afterAll(() => {
  if (originalReadyStateDescriptor) {
    Object.defineProperty(document, 'readyState', originalReadyStateDescriptor);
  } else {
    delete document.readyState;
  }
});

beforeEach(() => {
  jest.resetModules();
  mockBootstrap.mockReset();
  mockDisplayFatalStartupError.mockReset();
  mockRegisterVisualizerComponents.mockReset();
  mockVisualizerInitialize.mockReset();
  mockAnatomyVisualizerUIConstructor.mockReset();
  mockAnatomyVisualizerUIConstructor.mockImplementation(() => ({
    initialize: mockVisualizerInitialize,
  }));
  mockBootstrap.mockImplementation(() => {
    throw new Error('bootstrapMock not implemented for this test');
  });
  document.body.innerHTML = '';
  mockedReadyState = 'loading';
});

afterEach(() => {
  jest.clearAllTimers();
});

describe('anatomy-visualizer initialize', () => {
  it('registers components and initializes UI when DOM is loading', async () => {
    mockedReadyState = 'loading';
    const addEventListenerSpy = jest.spyOn(document, 'addEventListener');

    const backButton = document.createElement('button');
    backButton.id = 'back-button';
    const backButtonAddListenerSpy = jest.spyOn(backButton, 'addEventListener');
    document.body.appendChild(backButton);

    const logger = { info: jest.fn(), warn: jest.fn() };
    const registry = { id: 'registry' };
    const entityManager = { id: 'entityManager' };
    const eventDispatcher = { id: 'eventDispatcher' };

    const resolvedServices = {
      [mockTokens.AnatomyDescriptionService]: { id: 'anatomyService' },
      [mockTokens.VisualizerStateController]: { id: 'stateController' },
      [mockTokens.VisualizationComposer]: { id: 'composer' },
      [mockTokens.ClothingManagementService]: { id: 'clothingService' },
    };

    const container = {
      resolve: jest.fn((token) => {
        if (!(token in resolvedServices)) {
          throw new Error(`Unexpected token: ${String(token)}`);
        }
        return resolvedServices[token];
      }),
    };

    mockBootstrap.mockImplementation(async ({ postInitHook, ...options }) => {
      expect(options).toEqual(
        expect.objectContaining({
          containerConfigType: 'minimal',
          worldName: 'default',
          includeAnatomyFormatting: true,
        })
      );

      await postInitHook(
        { logger, registry, entityManager, eventDispatcher },
        container
      );

      return {
        container,
        services: { logger, registry, entityManager, eventDispatcher },
      };
    });

    const { initialize } = await import('../../src/anatomy-visualizer.js');

    expect(addEventListenerSpy).toHaveBeenCalledWith(
      'DOMContentLoaded',
      expect.any(Function)
    );

    const readyHandler = addEventListenerSpy.mock.calls[0][1];
    await readyHandler();

    expect(mockRegisterVisualizerComponents).toHaveBeenCalledWith(container);
    expect(container.resolve).toHaveBeenCalledWith(
      mockTokens.AnatomyDescriptionService
    );
    expect(container.resolve).toHaveBeenCalledWith(
      mockTokens.VisualizerStateController
    );
    expect(container.resolve).toHaveBeenCalledWith(
      mockTokens.VisualizationComposer
    );
    expect(container.resolve).toHaveBeenCalledWith(
      mockTokens.ClothingManagementService
    );

    expect(mockAnatomyVisualizerUIConstructor).toHaveBeenCalledWith({
      logger,
      registry,
      entityManager,
      anatomyDescriptionService:
        resolvedServices[mockTokens.AnatomyDescriptionService],
      eventDispatcher,
      documentContext: { document },
      visualizerStateController:
        resolvedServices[mockTokens.VisualizerStateController],
      visualizationComposer: resolvedServices[mockTokens.VisualizationComposer],
      clothingManagementService:
        resolvedServices[mockTokens.ClothingManagementService],
    });

    expect(mockVisualizerInitialize).toHaveBeenCalledTimes(1);

    expect(backButtonAddListenerSpy).toHaveBeenCalledWith(
      'click',
      expect.any(Function)
    );

    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith(
      'Anatomy Visualizer: Initializing UI...'
    );
    expect(logger.info).toHaveBeenCalledWith(
      'Anatomy Visualizer: Initialization complete'
    );

    addEventListenerSpy.mockRestore();
    backButtonAddListenerSpy.mockRestore();
    void initialize;
  });

  it('continues initialization when clothing service is missing', async () => {
    mockedReadyState = 'loading';

    const logger = { info: jest.fn(), warn: jest.fn() };
    const registry = { id: 'registry' };
    const entityManager = { id: 'entityManager' };
    const eventDispatcher = { id: 'eventDispatcher' };

    const resolvedServices = {
      [mockTokens.AnatomyDescriptionService]: { id: 'anatomyService' },
      [mockTokens.VisualizerStateController]: { id: 'stateController' },
      [mockTokens.VisualizationComposer]: { id: 'composer' },
    };

    const container = {
      resolve: jest.fn((token) => {
        if (token === mockTokens.ClothingManagementService) {
          throw new Error('Clothing service unavailable');
        }
        if (!(token in resolvedServices)) {
          throw new Error(`Unexpected token: ${String(token)}`);
        }
        return resolvedServices[token];
      }),
    };

    mockBootstrap.mockImplementation(async ({ postInitHook }) => {
      await postInitHook(
        { logger, registry, entityManager, eventDispatcher },
        container
      );
      return {
        container,
        services: { logger, registry, entityManager, eventDispatcher },
      };
    });

    const { initialize } = await import('../../src/anatomy-visualizer.js');

    await initialize();

    expect(mockRegisterVisualizerComponents).toHaveBeenCalledWith(container);
    expect(container.resolve).toHaveBeenCalledWith(
      mockTokens.ClothingManagementService
    );

    expect(logger.warn).toHaveBeenCalledWith(
      'ClothingManagementService not available - equipment panel will be disabled'
    );

    expect(mockAnatomyVisualizerUIConstructor).toHaveBeenCalledWith({
      logger,
      registry,
      entityManager,
      anatomyDescriptionService:
        resolvedServices[mockTokens.AnatomyDescriptionService],
      eventDispatcher,
      documentContext: { document },
      visualizerStateController:
        resolvedServices[mockTokens.VisualizerStateController],
      visualizationComposer: resolvedServices[mockTokens.VisualizationComposer],
      clothingManagementService: null,
    });

    expect(mockVisualizerInitialize).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledWith(
      'Anatomy Visualizer: Initialization complete'
    );
  });

  it('reports a fatal error when initialization fails', async () => {
    mockedReadyState = 'loading';

    const logger = { info: jest.fn(), warn: jest.fn() };
    const registry = { id: 'registry' };
    const entityManager = { id: 'entityManager' };
    const eventDispatcher = { id: 'eventDispatcher' };

    const resolvedServices = {
      [mockTokens.AnatomyDescriptionService]: { id: 'anatomyService' },
      [mockTokens.VisualizerStateController]: { id: 'stateController' },
      [mockTokens.VisualizationComposer]: { id: 'composer' },
    };

    const container = {
      resolve: jest.fn((token) => {
        if (!(token in resolvedServices)) {
          throw new Error(`Unexpected token: ${String(token)}`);
        }
        return resolvedServices[token];
      }),
    };

    const fatalError = new Error('UI failed to initialize');
    mockVisualizerInitialize.mockRejectedValueOnce(fatalError);

    mockBootstrap.mockImplementation(async ({ postInitHook }) => {
      await postInitHook(
        { logger, registry, entityManager, eventDispatcher },
        container
      );
      return {
        container,
        services: { logger, registry, entityManager, eventDispatcher },
      };
    });

    const { initialize } = await import('../../src/anatomy-visualizer.js');

    await expect(initialize()).resolves.toBeUndefined();

    expect(mockDisplayFatalStartupError).toHaveBeenCalledWith(
      'Failed to initialize anatomy visualizer: UI failed to initialize',
      fatalError
    );
  });

  it('immediately initializes when DOM is already ready', async () => {
    mockedReadyState = 'complete';

    const addEventListenerSpy = jest.spyOn(document, 'addEventListener');

    const backButton = document.createElement('button');
    backButton.id = 'back-button';
    document.body.appendChild(backButton);

    const logger = { info: jest.fn(), warn: jest.fn() };
    const registry = { id: 'registry' };
    const entityManager = { id: 'entityManager' };
    const eventDispatcher = { id: 'eventDispatcher' };

    const resolvedServices = {
      [mockTokens.AnatomyDescriptionService]: { id: 'anatomyService' },
      [mockTokens.VisualizerStateController]: { id: 'stateController' },
      [mockTokens.VisualizationComposer]: { id: 'composer' },
      [mockTokens.ClothingManagementService]: { id: 'clothingService' },
    };

    const container = {
      resolve: jest.fn((token) => {
        if (!(token in resolvedServices)) {
          throw new Error(`Unexpected token: ${String(token)}`);
        }
        return resolvedServices[token];
      }),
    };

    mockBootstrap.mockImplementation(async ({ postInitHook }) => {
      await postInitHook(
        { logger, registry, entityManager, eventDispatcher },
        container
      );
      return {
        container,
        services: { logger, registry, entityManager, eventDispatcher },
      };
    });

    await import('../../src/anatomy-visualizer.js');

    await flushPromises();
    await flushPromises();

    expect(addEventListenerSpy).not.toHaveBeenCalledWith(
      'DOMContentLoaded',
      expect.anything()
    );
    expect(mockBootstrap).toHaveBeenCalledTimes(1);
    expect(mockAnatomyVisualizerUIConstructor).toHaveBeenCalledTimes(1);

    addEventListenerSpy.mockRestore();
  });
});
