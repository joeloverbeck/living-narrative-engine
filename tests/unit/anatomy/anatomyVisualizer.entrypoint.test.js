import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';

let mockBootstrapperInstance;
const bootstrapMock = jest.fn();
const displayFatalStartupErrorMock = jest.fn();

jest.mock('../../../src/bootstrapper/CommonBootstrapper.js', () => ({
  CommonBootstrapper: jest.fn(() => mockBootstrapperInstance),
}));

const sharedMocks = {};

jest.mock(
  '../../../src/dependencyInjection/registrations/visualizerRegistrations.js',
  () => {
    sharedMocks.registerVisualizerComponents = jest.fn();
    return {
      registerVisualizerComponents: sharedMocks.registerVisualizerComponents,
    };
  }
);

let mockUIInitialize;
jest.mock('../../../src/domUI/AnatomyVisualizerUI.js', () => {
  sharedMocks.anatomyVisualizerUIConstructor = jest.fn(() => ({
    initialize: mockUIInitialize,
  }));

  return {
    __esModule: true,
    default: sharedMocks.anatomyVisualizerUIConstructor,
  };
});

jest.mock('../../../src/dependencyInjection/tokens.js', () => {
  const tokens = {
    AnatomyDescriptionService: Symbol('AnatomyDescriptionService'),
    VisualizerStateController: Symbol('VisualizerStateController'),
    VisualizationComposer: Symbol('VisualizationComposer'),
    ClothingManagementService: Symbol('ClothingManagementService'),
  };

  return { tokens };
});

import { tokens } from '../../../src/dependencyInjection/tokens.js';
import { CommonBootstrapper } from '../../../src/bootstrapper/CommonBootstrapper.js';
import { registerVisualizerComponents } from '../../../src/dependencyInjection/registrations/visualizerRegistrations.js';
import AnatomyVisualizerUI from '../../../src/domUI/AnatomyVisualizerUI.js';

const originalReadyStateDescriptor = Object.getOwnPropertyDescriptor(
  document,
  'readyState'
);
const originalLocationDescriptor = Object.getOwnPropertyDescriptor(
  window,
  'location'
);

const flushMicrotasks = () => new Promise((resolve) => setImmediate(resolve));

describe('anatomy-visualizer entrypoint', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    bootstrapMock.mockReset();
    displayFatalStartupErrorMock.mockReset();

    mockBootstrapperInstance = {
      bootstrap: bootstrapMock,
      displayFatalStartupError: displayFatalStartupErrorMock,
    };

    CommonBootstrapper.mockReset();
    CommonBootstrapper.mockImplementation(() => mockBootstrapperInstance);

    sharedMocks.registerVisualizerComponents.mockReset();

    sharedMocks.anatomyVisualizerUIConstructor.mockReset();
    mockUIInitialize = jest.fn().mockResolvedValue(undefined);
    sharedMocks.anatomyVisualizerUIConstructor.mockImplementation(() => ({
      initialize: mockUIInitialize,
    }));

    document.body.innerHTML = '';

    if (originalReadyStateDescriptor) {
      Object.defineProperty(document, 'readyState', {
        configurable: true,
        enumerable: originalReadyStateDescriptor.enumerable,
        value: 'complete',
      });
    }

    if (originalLocationDescriptor) {
      Object.defineProperty(window, 'location', originalLocationDescriptor);
    }
  });

  afterEach(() => {
    document.body.innerHTML = '';

    if (originalReadyStateDescriptor) {
      Object.defineProperty(
        document,
        'readyState',
        originalReadyStateDescriptor
      );
    }

    if (originalLocationDescriptor) {
      Object.defineProperty(window, 'location', originalLocationDescriptor);
    }
  });

  it('initializes through DOMContentLoaded and configures visualizer UI', async () => {
    const backButton = document.createElement('button');
    backButton.id = 'back-button';
    backButton.addEventListener = jest.fn();
    document.body.appendChild(backButton);

    Object.defineProperty(document, 'readyState', {
      configurable: true,
      value: 'loading',
    });

    const logger = {
      info: jest.fn(),
      warn: jest.fn(),
    };
    const services = {
      logger,
      registry: 'registry-service',
      entityManager: 'entity-manager',
      eventDispatcher: 'dispatcher',
    };

    const resolvedValues = {
      [tokens.AnatomyDescriptionService]: 'anatomy-service',
      [tokens.VisualizerStateController]: 'state-controller',
      [tokens.VisualizationComposer]: 'composer',
      [tokens.ClothingManagementService]: 'clothing-service',
    };
    const resolveMock = jest.fn((token) => resolvedValues[token]);
    const container = { resolve: resolveMock };

    bootstrapMock.mockImplementation(async (options) => {
      await options.postInitHook(services, container);
      return { container, services };
    });

    const addEventListenerSpy = jest.spyOn(document, 'addEventListener');

    await jest.isolateModulesAsync(async () => {
      await import('../../../src/anatomy-visualizer.js');
    });

    expect(addEventListenerSpy).toHaveBeenCalledWith(
      'DOMContentLoaded',
      expect.any(Function)
    );

    const domReadyHandler = addEventListenerSpy.mock.calls[0][1];
    await domReadyHandler();

    expect(bootstrapMock).toHaveBeenCalledTimes(1);
    const bootstrapOptions = bootstrapMock.mock.calls[0][0];
    expect(bootstrapOptions).toMatchObject({
      containerConfigType: 'minimal',
      worldName: 'default',
      includeAnatomyFormatting: true,
    });
    expect(typeof bootstrapOptions.postInitHook).toBe('function');

    expect(registerVisualizerComponents).toHaveBeenCalledWith(container);

    expect(resolveMock).toHaveBeenCalledWith(tokens.AnatomyDescriptionService);
    expect(resolveMock).toHaveBeenCalledWith(tokens.VisualizerStateController);
    expect(resolveMock).toHaveBeenCalledWith(tokens.VisualizationComposer);
    expect(resolveMock).toHaveBeenCalledWith(tokens.ClothingManagementService);

    expect(AnatomyVisualizerUI).toHaveBeenCalledWith({
      logger,
      registry: services.registry,
      entityManager: services.entityManager,
      anatomyDescriptionService: 'anatomy-service',
      eventDispatcher: services.eventDispatcher,
      documentContext: { document },
      visualizerStateController: 'state-controller',
      visualizationComposer: 'composer',
      clothingManagementService: 'clothing-service',
    });

    expect(mockUIInitialize).toHaveBeenCalledTimes(1);

    expect(logger.info).toHaveBeenNthCalledWith(
      1,
      'Anatomy Visualizer: Initializing UI...'
    );
    expect(logger.info).toHaveBeenNthCalledWith(
      2,
      'Anatomy Visualizer: Initialization complete'
    );
    expect(logger.warn).not.toHaveBeenCalled();

    expect(backButton.addEventListener).toHaveBeenCalledWith(
      'click',
      expect.any(Function)
    );
    const clickHandler = backButton.addEventListener.mock.calls[0][1];
    try {
      clickHandler();
    } catch (error) {
      expect(error.message).toContain('Not implemented');
    }

    addEventListenerSpy.mockRestore();
  });

  it('warns when clothing service is unavailable and runs immediately when DOM ready', async () => {
    Object.defineProperty(document, 'readyState', {
      configurable: true,
      value: 'complete',
    });

    const logger = {
      info: jest.fn(),
      warn: jest.fn(),
    };
    const services = {
      logger,
      registry: 'registry-service',
      entityManager: 'entity-manager',
      eventDispatcher: 'dispatcher',
    };

    const resolvedValues = {
      [tokens.AnatomyDescriptionService]: 'anatomy-service',
      [tokens.VisualizerStateController]: 'state-controller',
      [tokens.VisualizationComposer]: 'composer',
    };
    const resolveMock = jest.fn((token) => {
      if (token === tokens.ClothingManagementService) {
        throw new Error('missing service');
      }
      return resolvedValues[token];
    });
    const container = { resolve: resolveMock };

    bootstrapMock.mockImplementation(async (options) => {
      await options.postInitHook(services, container);
      return { container, services };
    });

    const addEventListenerSpy = jest.spyOn(document, 'addEventListener');

    await jest.isolateModulesAsync(async () => {
      await import('../../../src/anatomy-visualizer.js');
    });

    await flushMicrotasks();

    expect(addEventListenerSpy).not.toHaveBeenCalled();
    expect(bootstrapMock).toHaveBeenCalledTimes(1);

    await bootstrapMock.mock.results[0].value;

    expect(registerVisualizerComponents).toHaveBeenCalledWith(container);
    expect(resolveMock).toHaveBeenCalledWith(tokens.ClothingManagementService);
    expect(logger.warn).toHaveBeenCalledWith(
      'ClothingManagementService not available - equipment panel will be disabled'
    );

    expect(AnatomyVisualizerUI).toHaveBeenCalledWith({
      logger,
      registry: services.registry,
      entityManager: services.entityManager,
      anatomyDescriptionService: 'anatomy-service',
      eventDispatcher: services.eventDispatcher,
      documentContext: { document },
      visualizerStateController: 'state-controller',
      visualizationComposer: 'composer',
      clothingManagementService: null,
    });

    expect(mockUIInitialize).toHaveBeenCalledTimes(1);

    addEventListenerSpy.mockRestore();
  });

  it('propagates visualizer initialization failures to the fatal error handler', async () => {
    Object.defineProperty(document, 'readyState', {
      configurable: true,
      value: 'complete',
    });

    const logger = {
      info: jest.fn(),
      warn: jest.fn(),
    };
    const services = {
      logger,
      registry: 'registry-service',
      entityManager: 'entity-manager',
      eventDispatcher: 'dispatcher',
    };

    const resolvedValues = {
      [tokens.AnatomyDescriptionService]: 'anatomy-service',
      [tokens.VisualizerStateController]: 'state-controller',
      [tokens.VisualizationComposer]: 'composer',
      [tokens.ClothingManagementService]: 'clothing-service',
    };
    const resolveMock = jest.fn((token) => resolvedValues[token]);
    const container = { resolve: resolveMock };

    const initializationError = new Error('UI initialization failure');
    mockUIInitialize.mockReset();
    mockUIInitialize.mockRejectedValue(initializationError);

    bootstrapMock.mockImplementation(async (options) => {
      await options.postInitHook(services, container);
      return { container, services };
    });

    await jest.isolateModulesAsync(async () => {
      await import('../../../src/anatomy-visualizer.js');
    });

    await flushMicrotasks();

    expect(registerVisualizerComponents).toHaveBeenCalledWith(container);
    expect(resolveMock).toHaveBeenCalledWith(tokens.AnatomyDescriptionService);
    expect(resolveMock).toHaveBeenCalledWith(tokens.VisualizerStateController);
    expect(resolveMock).toHaveBeenCalledWith(tokens.VisualizationComposer);
    expect(resolveMock).toHaveBeenCalledWith(tokens.ClothingManagementService);

    expect(mockUIInitialize).toHaveBeenCalledTimes(1);
    await expect(bootstrapMock.mock.results[0].value).rejects.toBe(
      initializationError
    );

    expect(logger.info).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledWith(
      'Anatomy Visualizer: Initializing UI...'
    );
    expect(logger.warn).not.toHaveBeenCalled();

    expect(displayFatalStartupErrorMock).toHaveBeenCalledWith(
      'Failed to initialize anatomy visualizer: UI initialization failure',
      initializationError
    );
  });

  it('reports fatal startup error when bootstrap fails', async () => {
    Object.defineProperty(document, 'readyState', {
      configurable: true,
      value: 'complete',
    });

    const fatalError = new Error('bootstrap failure');
    bootstrapMock.mockRejectedValue(fatalError);

    const addEventListenerSpy = jest.spyOn(document, 'addEventListener');

    await jest.isolateModulesAsync(async () => {
      await import('../../../src/anatomy-visualizer.js');
    });

    await flushMicrotasks();

    expect(addEventListenerSpy).not.toHaveBeenCalled();
    expect(displayFatalStartupErrorMock).toHaveBeenCalledWith(
      'Failed to initialize anatomy visualizer: bootstrap failure',
      fatalError
    );
    expect(registerVisualizerComponents).not.toHaveBeenCalled();
    expect(AnatomyVisualizerUI).not.toHaveBeenCalled();

    addEventListenerSpy.mockRestore();
  });
});
