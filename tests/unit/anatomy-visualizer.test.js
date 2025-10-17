import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

jest.mock('../../src/bootstrapper/CommonBootstrapper.js', () => ({
  CommonBootstrapper: jest.fn(),
}));

jest.mock('../../src/dependencyInjection/registrations/visualizerRegistrations.js', () => ({
  registerVisualizerComponents: jest.fn(),
}));

jest.mock('../../src/domUI/AnatomyVisualizerUI.js', () =>
  jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(),
  }))
);

import { CommonBootstrapper } from '../../src/bootstrapper/CommonBootstrapper.js';
import { registerVisualizerComponents } from '../../src/dependencyInjection/registrations/visualizerRegistrations.js';
import AnatomyVisualizerUI from '../../src/domUI/AnatomyVisualizerUI.js';
import { tokens } from '../../src/dependencyInjection/tokens.js';

const ORIGINAL_READY_STATE = Object.getOwnPropertyDescriptor(document, 'readyState');
const ORIGINAL_ADD_EVENT_LISTENER = document.addEventListener;

function setDocumentReadyState(state) {
  Object.defineProperty(document, 'readyState', {
    configurable: true,
    value: state,
  });
}

async function loadModule() {
  let module;
  await jest.isolateModulesAsync(async () => {
    module = await import('../../src/anatomy-visualizer.js');
  });
  return module;
}

describe('anatomy-visualizer bootstrap flow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    document.body.innerHTML = '';
    document.addEventListener = ORIGINAL_ADD_EVENT_LISTENER;
    setDocumentReadyState('loading');
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  afterAll(() => {
    if (ORIGINAL_READY_STATE) {
      Object.defineProperty(document, 'readyState', ORIGINAL_READY_STATE);
    }
    document.addEventListener = ORIGINAL_ADD_EVENT_LISTENER;
  });

  function createServices(overrides = {}) {
    const logger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };
    return {
      services: {
        logger,
        registry: { type: 'registry' },
        entityManager: { type: 'entityManager' },
        eventDispatcher: { type: 'dispatcher' },
        ...overrides.services,
      },
      logger,
    };
  }

  it('initializes the visualizer UI and wires navigation controls', async () => {
    const { services, logger } = createServices();
    const anatomyDescriptionService = { type: 'anatomy' };
    const visualizerStateController = { type: 'state' };
    const visualizationComposer = { type: 'composer' };
    const clothingManagementService = { type: 'clothing' };

    const container = {
      resolve: jest.fn((token) => {
        switch (token) {
          case tokens.AnatomyDescriptionService:
            return anatomyDescriptionService;
          case tokens.VisualizerStateController:
            return visualizerStateController;
          case tokens.VisualizationComposer:
            return visualizationComposer;
          case tokens.ClothingManagementService:
            return clothingManagementService;
          default:
            throw new Error(`Unexpected token: ${String(token)}`);
        }
      }),
    };

    const bootstrapperMock = {
      bootstrap: jest.fn(async (config) => {
        await config.postInitHook(services, container);
        return { services, container };
      }),
      displayFatalStartupError: jest.fn(),
    };
    CommonBootstrapper.mockImplementation(() => bootstrapperMock);

    const backButton = document.createElement('button');
    backButton.id = 'back-button';
    const addEventListenerMock = jest.fn();
    backButton.addEventListener = addEventListenerMock;
    document.body.appendChild(backButton);

    const { initialize } = await loadModule();

    await initialize();

    expect(bootstrapperMock.bootstrap).toHaveBeenCalledWith(
      expect.objectContaining({
        containerConfigType: 'minimal',
        worldName: 'default',
        includeAnatomyFormatting: true,
      })
    );

    expect(registerVisualizerComponents).toHaveBeenCalledWith(container);

    const uiConfig = AnatomyVisualizerUI.mock.calls[0][0];
    expect(uiConfig).toMatchObject({
      logger,
      registry: services.registry,
      entityManager: services.entityManager,
      anatomyDescriptionService,
      eventDispatcher: services.eventDispatcher,
      documentContext: { document },
      visualizerStateController,
      visualizationComposer,
      clothingManagementService,
    });

    const uiInstance = AnatomyVisualizerUI.mock.results[0]?.value;
    expect(uiInstance.initialize).toHaveBeenCalled();

    expect(logger.info).toHaveBeenCalledWith(
      'Anatomy Visualizer: Initializing UI...'
    );
    expect(logger.info).toHaveBeenCalledWith(
      'Anatomy Visualizer: Initialization complete'
    );
    expect(logger.warn).not.toHaveBeenCalled();

    expect(addEventListenerMock).toHaveBeenCalledWith(
      'click',
      expect.any(Function)
    );

    expect(document.addEventListener).toBe(ORIGINAL_ADD_EVENT_LISTENER);
  });

  it('logs a warning and disables clothing management when the service is missing', async () => {
    const { services, logger } = createServices();
    const anatomyDescriptionService = { type: 'anatomy' };
    const visualizerStateController = { type: 'state' };
    const visualizationComposer = { type: 'composer' };

    const container = {
      resolve: jest.fn((token) => {
        if (token === tokens.ClothingManagementService) {
          throw new Error('service missing');
        }
        if (token === tokens.AnatomyDescriptionService) {
          return anatomyDescriptionService;
        }
        if (token === tokens.VisualizerStateController) {
          return visualizerStateController;
        }
        if (token === tokens.VisualizationComposer) {
          return visualizationComposer;
        }
        throw new Error(`Unexpected token: ${String(token)}`);
      }),
    };

    const bootstrapperMock = {
      bootstrap: jest.fn(async (config) => {
        await config.postInitHook(services, container);
        return { services, container };
      }),
      displayFatalStartupError: jest.fn(),
    };
    CommonBootstrapper.mockImplementation(() => bootstrapperMock);

    document.body.innerHTML = '<button id="back-button"></button>';

    const { initialize } = await loadModule();

    await initialize();

    expect(logger.warn).toHaveBeenCalledWith(
      'ClothingManagementService not available - equipment panel will be disabled'
    );

    const uiConfig = AnatomyVisualizerUI.mock.calls[0][0];
    expect(uiConfig.clothingManagementService).toBeNull();
  });

  it('reports fatal startup errors when bootstrapping fails', async () => {
    const { services } = createServices();
    const error = new Error('boom');

    const bootstrapperMock = {
      bootstrap: jest.fn(async () => {
        throw error;
      }),
      displayFatalStartupError: jest.fn(),
    };
    CommonBootstrapper.mockImplementation(() => bootstrapperMock);

    document.body.innerHTML = '<button id="back-button"></button>';

    const { initialize } = await loadModule();

    await initialize();

    expect(bootstrapperMock.displayFatalStartupError).toHaveBeenCalledWith(
      'Failed to initialize anatomy visualizer: boom',
      error
    );
  });

  it('defers initialization until DOMContentLoaded when the document is still loading', async () => {
    const { services } = createServices();
    const container = {
      resolve: jest.fn(() => ({})),
    };
    const bootstrapperMock = {
      bootstrap: jest.fn(async (config) => {
        await config.postInitHook(services, container);
        return { services, container };
      }),
      displayFatalStartupError: jest.fn(),
    };
    CommonBootstrapper.mockImplementation(() => bootstrapperMock);

    const addEventListenerMock = jest.fn();
    document.addEventListener = addEventListenerMock;

    await loadModule();

    expect(addEventListenerMock).toHaveBeenCalledWith(
      'DOMContentLoaded',
      expect.any(Function)
    );

    const handler = addEventListenerMock.mock.calls[0][1];
    await handler();

    expect(bootstrapperMock.bootstrap).toHaveBeenCalledTimes(1);
  });

  it('immediately initializes when the DOM is already ready', async () => {
    const { services } = createServices();
    const container = {
      resolve: jest.fn(() => ({})),
    };
    const bootstrapperMock = {
      bootstrap: jest.fn(async (config) => {
        await config.postInitHook(services, container);
        return { services, container };
      }),
      displayFatalStartupError: jest.fn(),
    };
    CommonBootstrapper.mockImplementation(() => bootstrapperMock);

    setDocumentReadyState('complete');
    const addEventListenerMock = jest.fn();
    document.addEventListener = addEventListenerMock;

    await loadModule();

    expect(addEventListenerMock).not.toHaveBeenCalled();
    expect(bootstrapperMock.bootstrap).toHaveBeenCalledTimes(1);
  });
});
