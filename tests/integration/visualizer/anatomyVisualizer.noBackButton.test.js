import {
  jest,
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
} from '@jest/globals';

// Mock the CommonBootstrapper
const mockBootstrap = jest.fn();
const mockDisplayFatalStartupError = jest.fn();

jest.mock('../../../src/bootstrapper/CommonBootstrapper.js', () => ({
  CommonBootstrapper: jest.fn().mockImplementation(() => ({
    bootstrap: mockBootstrap,
    displayFatalStartupError: mockDisplayFatalStartupError,
  })),
}));

// Mock AnatomyVisualizerUI
const mockUIInitialize = jest.fn();
jest.mock('../../../src/domUI/AnatomyVisualizerUI.js', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    initialize: mockUIInitialize,
  })),
}));

// Mock registerVisualizerComponents
jest.mock(
  '../../../src/dependencyInjection/registrations/visualizerRegistrations.js',
  () => ({
    registerVisualizerComponents: jest.fn(),
  })
);

// Mock tokens
jest.mock('../../../src/dependencyInjection/tokens.js', () => ({
  __esModule: true,
  tokens: {
    AnatomyDescriptionService: 'AnatomyDescriptionService',
    VisualizerState: 'VisualizerState',
    AnatomyLoadingDetector: 'AnatomyLoadingDetector',
    VisualizerStateController: 'VisualizerStateController',
    ILogger: 'ILogger',
    IEntityManager: 'IEntityManager',
    IValidatedEventDispatcher: 'IValidatedEventDispatcher',
  },
}));

const loggerMock = {
  info: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn(),
};

const containerMock = {
  resolve: jest.fn((token) => {
    if (token === 'AnatomyDescriptionService') {
      return {};
    }
    if (token === 'VisualizerStateController') {
      return {};
    }
    if (token === 'VisualizerState') {
      return {};
    }
    if (token === 'AnatomyLoadingDetector') {
      return {};
    }
    if (token === 'ILogger') {
      return loggerMock;
    }
    if (token === 'IEntityManager') {
      return {};
    }
    if (token === 'IValidatedEventDispatcher') {
      return {};
    }
  }),
};

const servicesMock = {
  logger: loggerMock,
  registry: {},
  entityManager: {},
  eventDispatcher: {},
};

beforeEach(() => {
  jest.resetModules();
  jest.clearAllMocks();
  // No back-button element to test missing branch
  document.body.innerHTML = '';
  Object.defineProperty(document, 'readyState', {
    value: 'complete',
    writable: true,
  });
  global.alert = jest.fn();

  mockBootstrap.mockImplementation(async (options) => {
    if (options && options.postInitHook) {
      await options.postInitHook(servicesMock, containerMock);
    }
    return { container: containerMock, services: servicesMock };
  });
});

afterEach(() => {
  delete global.alert;
});

describe('anatomy-visualizer back button absence', () => {
  it('initializes even when back button is missing', async () => {
    const getElementSpy = jest.spyOn(document, 'getElementById');

    await jest.isolateModulesAsync(async () => {
      await import('../../../src/anatomy-visualizer.js');
    });
    await Promise.resolve();

    expect(mockBootstrap).toHaveBeenCalledWith({
      containerConfigType: 'minimal',
      worldName: 'default',
      includeAnatomyFormatting: true,
      postInitHook: expect.any(Function),
    });

    expect(mockUIInitialize).toHaveBeenCalled();
    expect(loggerMock.info).toHaveBeenCalledWith(
      'Anatomy Visualizer: Initializing UI...'
    );
    expect(loggerMock.info).toHaveBeenCalledWith(
      'Anatomy Visualizer: Initialization complete'
    );

    expect(getElementSpy).toHaveBeenCalledWith('back-button');
    const backButton = document.getElementById('back-button');
    expect(backButton).toBeNull();
  });
});
