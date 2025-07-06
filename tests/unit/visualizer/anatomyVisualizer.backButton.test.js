import {
  jest,
  describe,
  it,
  beforeEach,
  afterEach,
  expect,
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
  loadMods: jest.fn(async () => ({ finalModOrder: [] })),
};
const registryMock = {};
const entityManagerMock = {};
const anatomyServiceMock = {};
const anatomyFormattingServiceMock = { initialize: jest.fn(async () => {}) };
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
    AnatomyFormattingService: 'AnatomyFormattingService',
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
  Object.defineProperty(document, 'readyState', {
    value: 'complete',
    writable: true,
  });
  global.fetch = jest.fn(async () => ({
    ok: true,
    json: async () => ({ mods: [] }),
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
      case 'AnatomyFormattingService':
        return anatomyFormattingServiceMock;
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

describe('anatomy-visualizer back button handling', () => {
  it('initializes without back button present', async () => {
    document.body.innerHTML = '';
    await jest.isolateModulesAsync(async () => {
      await import('../../../src/anatomy-visualizer.js');
    });
    await Promise.resolve();
    expect(document.getElementById('back-button')).toBeNull();
    expect(mockUIInitialize).toHaveBeenCalled();
  });

  it('navigates to index on back button click', async () => {
    document.body.innerHTML = '<button id="back-button"></button>';
    const locationMock = { href: 'anatomy-visualizer.html' };
    Object.defineProperty(window, 'location', {
      writable: true,
      value: locationMock,
    });
    await jest.isolateModulesAsync(async () => {
      await import('../../../src/anatomy-visualizer.js');
    });
    await Promise.resolve();
    const btn = document.getElementById('back-button');
    expect(btn).not.toBeNull();
    btn.click();
    expect(locationMock.href).toBe('index.html');
  });
});
