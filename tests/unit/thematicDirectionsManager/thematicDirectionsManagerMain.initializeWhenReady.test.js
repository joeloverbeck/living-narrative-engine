import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

let mockAutoInitFlag;
let mockBootstrapImpl;
let mockRegistrar;
let mockControllerHook;
let mockBootstrapInstance;
let addEventListenerSpy;
let originalReadyStateDescriptor;

jest.mock('../../../src/thematicDirectionsManager/controllers/thematicDirectionsManagerController.js', () => {
  return {
    ThematicDirectionsManagerController: jest.fn(() => {
      mockControllerHook?.();
      return {};
    }),
  };
});

jest.mock('../../../src/dependencyInjection/tokens.js', () => ({
  tokens: {
    ILogger: Symbol('ILogger'),
    CharacterBuilderService: Symbol('CharacterBuilderService'),
    ISafeEventDispatcher: Symbol('ISafeEventDispatcher'),
    ISchemaValidator: Symbol('ISchemaValidator'),
    ThematicDirectionsManagerController: Symbol('ThematicDirectionsManagerController'),
  },
}));

jest.mock('../../../src/utils/registrarHelpers.js', () => ({
  Registrar: jest.fn().mockImplementation(() => mockRegistrar),
}));

jest.mock('../../../src/characterBuilder/CharacterBuilderBootstrap.js', () => ({
  CharacterBuilderBootstrap: jest.fn(() => {
    mockBootstrapInstance = {
      bootstrap: jest.fn((config) => mockBootstrapImpl(config)),
    };
    return mockBootstrapInstance;
  }),
}));

const modulePath = '../../../src/thematicDirectionsManager/thematicDirectionsManagerMain.js';

async function importModule() {
  jest.resetModules();
  return import(modulePath);
}

describe('thematicDirectionsManagerMain initializeWhenReady', () => {
  beforeEach(() => {
    mockAutoInitFlag = true;
    mockBootstrapImpl = () => Promise.resolve({ success: true });
    mockRegistrar = { singletonFactory: jest.fn() };
    mockControllerHook = jest.fn();
    mockBootstrapInstance = null;

    addEventListenerSpy = jest.spyOn(document, 'addEventListener');
    originalReadyStateDescriptor = Object.getOwnPropertyDescriptor(
      document,
      'readyState'
    );
    Object.defineProperty(document, 'readyState', {
      value: 'loading',
      configurable: true,
    });
    document.body.innerHTML = '';
    globalThis.__LNE_FORCE_AUTO_INIT__ = mockAutoInitFlag;
  });

  afterEach(() => {
    addEventListenerSpy.mockRestore();
    if (originalReadyStateDescriptor) {
      Object.defineProperty(document, 'readyState', originalReadyStateDescriptor);
    }
    delete globalThis.__LNE_FORCE_AUTO_INIT__;
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('returns early when auto initialization is disabled', async () => {
    mockAutoInitFlag = false;
    globalThis.__LNE_FORCE_AUTO_INIT__ = mockAutoInitFlag;

    const { initializeWhenReady } = await importModule();

    initializeWhenReady();

    expect(addEventListenerSpy).not.toHaveBeenCalled();
    expect(document.body.innerHTML).toBe('');
  });

  it('attaches DOMContentLoaded listener when document is still loading', async () => {
    mockAutoInitFlag = true;
    globalThis.__LNE_FORCE_AUTO_INIT__ = mockAutoInitFlag;

    const { initializeWhenReady } = await importModule();

    initializeWhenReady();

    expect(addEventListenerSpy).toHaveBeenCalledWith(
      'DOMContentLoaded',
      expect.any(Function)
    );
  });

  it('displays a simplified error message when initialization fails', async () => {
    const failure = new Error('bootstrap failure');
    mockAutoInitFlag = true;
    mockBootstrapImpl = () => Promise.reject(failure);
    globalThis.__LNE_FORCE_AUTO_INIT__ = mockAutoInitFlag;

    const { initializeWhenReady } = await importModule();

    initializeWhenReady();
    const initCallback = addEventListenerSpy.mock.calls[0][1];

    await expect(initCallback()).resolves.toBeUndefined();

    // initializeWhenReady should set the listener again if invoked directly
    initializeWhenReady();

    expect(mockBootstrapInstance.bootstrap).toHaveBeenCalled();
    expect(document.body.innerHTML).toContain(
      'Failed to initialize thematic directions manager'
    );
    expect(document.body.innerHTML).toContain('bootstrap failure');
  });
});
