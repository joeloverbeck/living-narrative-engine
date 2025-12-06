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

let mockUIInitialize;
const mockAnatomyVisualizerUI = jest.fn(() => ({
  initialize: mockUIInitialize,
}));

const mockTokens = {
  AnatomyDescriptionService: Symbol('AnatomyDescriptionService'),
  VisualizerStateController: Symbol('VisualizerStateController'),
  VisualizationComposer: Symbol('VisualizationComposer'),
  ClothingManagementService: Symbol('ClothingManagementService'),
};

jest.mock('../../../src/bootstrapper/CommonBootstrapper.js', () => ({
  __esModule: true,
  CommonBootstrapper: jest.fn(() => ({
    bootstrap: mockBootstrap,
    displayFatalStartupError: mockDisplayFatalStartupError,
  })),
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
  default: mockAnatomyVisualizerUI,
}));

jest.mock('../../../src/dependencyInjection/tokens.js', () => ({
  __esModule: true,
  tokens: mockTokens,
}));

const originalReadyStateDescriptor = Object.getOwnPropertyDescriptor(
  document,
  'readyState'
);

const setReadyState = (state) => {
  Object.defineProperty(document, 'readyState', {
    configurable: true,
    enumerable: originalReadyStateDescriptor
      ? originalReadyStateDescriptor.enumerable
      : true,
    get: () => state,
  });
};

describe('anatomy-visualizer back navigation', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    mockUIInitialize = jest.fn().mockResolvedValue(undefined);
    mockAnatomyVisualizerUI.mockImplementation(() => ({
      initialize: mockUIInitialize,
    }));

    setReadyState('complete');
    document.body.innerHTML = '';
  });

  afterEach(() => {
    document.body.innerHTML = '';

    if (originalReadyStateDescriptor) {
      Object.defineProperty(
        document,
        'readyState',
        originalReadyStateDescriptor
      );
    } else {
      delete document.readyState;
    }
  });

  it('navigates back to index when the back button is clicked after initialization', async () => {
    setReadyState('loading');

    const documentAddEventListenerSpy = jest.spyOn(
      document,
      'addEventListener'
    );

    const backButton = document.createElement('button');
    backButton.id = 'back-button';
    const backButtonAddListenerSpy = jest.spyOn(backButton, 'addEventListener');
    document.body.appendChild(backButton);

    const logger = {
      info: jest.fn(),
      warn: jest.fn(),
    };

    const resolvedServices = {
      [mockTokens.AnatomyDescriptionService]: { id: 'anatomy-service' },
      [mockTokens.VisualizerStateController]: { id: 'state-controller' },
      [mockTokens.VisualizationComposer]: { id: 'composer' },
      [mockTokens.ClothingManagementService]: { id: 'clothing-service' },
    };

    const container = {
      resolve: jest.fn((token) => {
        if (!(token in resolvedServices)) {
          throw new Error(`Unexpected token: ${String(token)}`);
        }
        return resolvedServices[token];
      }),
    };

    const services = {
      logger,
      registry: { id: 'registry' },
      entityManager: { id: 'entityManager' },
      eventDispatcher: { id: 'eventDispatcher' },
    };

    mockBootstrap.mockImplementation(async ({ postInitHook, ...options }) => {
      expect(options).toEqual(
        expect.objectContaining({
          containerConfigType: 'minimal',
          worldName: 'default',
          includeAnatomyFormatting: true,
        })
      );

      await postInitHook(services, container);

      return { container, services };
    });

    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    await jest.isolateModulesAsync(async () => {
      await import('../../../src/anatomy-visualizer.js');
    });

    expect(documentAddEventListenerSpy).toHaveBeenCalledWith(
      'DOMContentLoaded',
      expect.any(Function)
    );

    const domReadyHandler = documentAddEventListenerSpy.mock.calls[0][1];
    await domReadyHandler();

    expect(mockRegisterVisualizerComponents).toHaveBeenCalledWith(container);
    expect(mockAnatomyVisualizerUI).toHaveBeenCalledWith({
      logger,
      registry: services.registry,
      entityManager: services.entityManager,
      anatomyDescriptionService:
        resolvedServices[mockTokens.AnatomyDescriptionService],
      eventDispatcher: services.eventDispatcher,
      documentContext: { document },
      visualizerStateController:
        resolvedServices[mockTokens.VisualizerStateController],
      visualizationComposer: resolvedServices[mockTokens.VisualizationComposer],
      clothingManagementService:
        resolvedServices[mockTokens.ClothingManagementService],
    });

    expect(backButtonAddListenerSpy).toHaveBeenCalledWith(
      'click',
      expect.any(Function)
    );

    const clickHandler = backButtonAddListenerSpy.mock.calls[0][1];
    expect(() => clickHandler()).not.toThrow();

    const [navigationError] = consoleErrorSpy.mock.calls[0] ?? [];
    expect(String(navigationError)).toContain('Not implemented: navigation');
    if (navigationError && typeof navigationError === 'object') {
      expect(navigationError.type).toBe('not implemented');
    }

    expect(logger.info).toHaveBeenCalledWith(
      'Anatomy Visualizer: Initialization complete'
    );

    documentAddEventListenerSpy.mockRestore();
    backButtonAddListenerSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });
});
