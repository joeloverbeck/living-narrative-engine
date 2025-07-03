import {
  jest,
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
} from '@jest/globals';

const mockConfigure = jest.fn();
const mockResolve = jest.fn();
const mockUIInitialize = jest.fn();

const loggerMock = {
  info: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn(),
};
const modsLoaderMock = {
  loadMods: jest.fn(async () => ({ finalModOrder: ['a', 'b'] })),
};
const registryMock = {};
const entityManagerMock = {};
const anatomyServiceMock = {};
const systemInitializerMock = { initializeAll: jest.fn(async () => {}) };
const dispatcherMock = {};

jest.mock('../../../src/dependencyInjection/minimalContainerConfig.js', () => ({
  __esModule: true,
  configureMinimalContainer: (...args) => mockConfigure(...args),
}));

jest.mock('../../../src/dependencyInjection/tokens.js', () => ({
  __esModule: true,
  tokens: {
    ILogger: 'ILogger',
    ModsLoader: 'ModsLoader',
    IDataRegistry: 'IDataRegistry',
    IEntityManager: 'IEntityManager',
    AnatomyDescriptionService: 'AnatomyDescriptionService',
    SystemInitializer: 'SystemInitializer',
    ISafeEventDispatcher: 'ISafeEventDispatcher',
  },
}));

jest.mock('../../../src/dependencyInjection/appContainer.js', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    resolve: mockResolve,
  })),
}));

jest.mock('../../../src/domUI/AnatomyVisualizerUI.js', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    initialize: mockUIInitialize,
  })),
}));

beforeEach(() => {
  jest.resetModules();
  jest.clearAllMocks();
  document.body.innerHTML = '<button id="back-button"></button>';
  Object.defineProperty(document, 'readyState', {
    value: 'complete',
    writable: true,
  });
  global.fetch = jest.fn(async () => ({
    ok: true,
    json: async () => ({ mods: ['modX'] }),
  }));
  global.alert = jest.fn();

  mockResolve.mockImplementation((token) => {
    switch (token) {
      case 'ILogger':
        return loggerMock;
      case 'ModsLoader':
        return modsLoaderMock;
      case 'IDataRegistry':
        return registryMock;
      case 'IEntityManager':
        return entityManagerMock;
      case 'AnatomyDescriptionService':
        return anatomyServiceMock;
      case 'SystemInitializer':
        return systemInitializerMock;
      case 'ISafeEventDispatcher':
        return dispatcherMock;
      default:
        return undefined;
    }
  });
});

afterEach(() => {
  delete global.fetch;
  delete global.alert;
});

describe('anatomy-visualizer initialization', () => {
  it('initializes immediately when DOM is ready', async () => {
    await jest.isolateModulesAsync(async () => {
      await import('../../../src/anatomy-visualizer.js');
    });
    await Promise.resolve();

    expect(mockConfigure).toHaveBeenCalledWith(expect.any(Object));
    expect(modsLoaderMock.loadMods).toHaveBeenCalledWith('default', ['modX']);
    expect(systemInitializerMock.initializeAll).toHaveBeenCalled();
    expect(mockUIInitialize).toHaveBeenCalled();
    const backButton = document.getElementById('back-button');
    expect(backButton).not.toBeNull();
    expect(backButton?.addEventListener).toBeDefined();
  });

  it('waits for DOMContentLoaded when document is loading', async () => {
    Object.defineProperty(document, 'readyState', { value: 'loading' });
    const addListenerSpy = jest.spyOn(document, 'addEventListener');
    let listener;
    addListenerSpy.mockImplementation((event, cb) => {
      if (event === 'DOMContentLoaded') {
        listener = cb;
      }
    });

    await jest.isolateModulesAsync(async () => {
      await import('../../../src/anatomy-visualizer.js');
    });
    expect(addListenerSpy).toHaveBeenCalledWith(
      'DOMContentLoaded',
      expect.any(Function)
    );
    expect(listener).toBeDefined();
    // Ensure init not called yet
    expect(mockConfigure).not.toHaveBeenCalled();

    // Trigger DOMContentLoaded
    Object.defineProperty(document, 'readyState', { value: 'complete' });
    await listener();
    await Promise.resolve();

    expect(mockConfigure).toHaveBeenCalled();
    expect(mockUIInitialize).toHaveBeenCalled();
  });

  it('alerts user when mod loading fails', async () => {
    global.fetch.mockResolvedValueOnce({ ok: false });

    await jest.isolateModulesAsync(async () => {
      await import('../../../src/anatomy-visualizer.js');
    });
    await Promise.resolve();

    expect(global.alert).toHaveBeenCalledWith(
      expect.stringContaining('Failed to initialize anatomy visualizer')
    );
  });
});
