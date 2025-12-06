import {
  beforeEach,
  afterEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';

const TRAITS_GENERATOR_PATH = '../../src/traits-generator-main.js';
const BOOTSTRAP_PATH =
  '../../src/characterBuilder/CharacterBuilderBootstrap.js';
const CONTROLLER_PATH =
  '../../src/characterBuilder/controllers/TraitsGeneratorController.js';
const ENHANCER_PATH =
  '../../src/characterBuilder/services/TraitsDisplayEnhancer.js';

const flushPromises = () => new Promise((resolve) => setImmediate(resolve));

const originalEnv = process.env;
const originalReadyState = document.readyState;

const setReadyState = (value) => {
  Object.defineProperty(document, 'readyState', {
    configurable: true,
    value,
  });
};

const restoreReadyState = () => {
  Object.defineProperty(document, 'readyState', {
    configurable: true,
    value: originalReadyState,
  });
};

describe('traits-generator-main entrypoint', () => {
  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    delete window.__traitsGeneratorController;
  });

  afterEach(() => {
    jest.restoreAllMocks();
    restoreReadyState();
  });

  const mockBootstrapModule = (impl) => {
    const bootstrapMock = jest.fn(impl);
    jest.doMock(BOOTSTRAP_PATH, () => ({
      CharacterBuilderBootstrap: jest.fn().mockImplementation(() => ({
        bootstrap: bootstrapMock,
      })),
    }));
    jest.doMock(CONTROLLER_PATH, () => ({
      TraitsGeneratorController: jest.fn(),
    }));
    jest.doMock(ENHANCER_PATH, () => ({ TraitsDisplayEnhancer: jest.fn() }));
    return bootstrapMock;
  };

  it('defers initialization until DOMContentLoaded when the document is loading', async () => {
    setReadyState('loading');
    const addEventListenerSpy = jest.spyOn(document, 'addEventListener');

    const expectedController = { id: 'controller-1' };
    const bootstrapMock = mockBootstrapModule(async (config) => {
      expect(config).toMatchObject({
        pageName: 'traits-generator',
        includeModLoading: true,
        customSchemas: ['/data/schemas/trait.schema.json'],
      });
      expect(typeof config.hooks?.postInit).toBe('function');
      config.hooks.postInit(expectedController);
      return { controller: expectedController, container: { id: 'container' } };
    });

    process.env.NODE_ENV = 'development';

    await jest.isolateModulesAsync(async () => {
      await import(TRAITS_GENERATOR_PATH);
    });

    expect(bootstrapMock).not.toHaveBeenCalled();
    expect(addEventListenerSpy).toHaveBeenCalledWith(
      'DOMContentLoaded',
      expect.any(Function)
    );

    const handler = addEventListenerSpy.mock.calls[0][1];
    const result = await handler();

    expect(result).toEqual({
      controller: expectedController,
      container: { id: 'container' },
    });
    expect(bootstrapMock).toHaveBeenCalledTimes(1);
    expect(window.__traitsGeneratorController).toBe(expectedController);
  });

  it('initializes immediately when the DOM is already ready', async () => {
    setReadyState('complete');

    const bootstrapMock = mockBootstrapModule(async (config) => {
      config.hooks?.postInit?.({ id: 'controller-2' });
      return {
        controller: { id: 'controller-2' },
        container: { id: 'container-2' },
      };
    });

    await jest.isolateModulesAsync(async () => {
      await import(TRAITS_GENERATOR_PATH);
    });

    await flushPromises();

    expect(bootstrapMock).toHaveBeenCalledTimes(1);
    expect(bootstrapMock.mock.calls[0][0].pageName).toBe('traits-generator');
    expect(window.__traitsGeneratorController).toBeUndefined();
  });

  it('propagates initialization errors and logs them', async () => {
    setReadyState('loading');
    const addEventListenerSpy = jest.spyOn(document, 'addEventListener');
    const failure = new Error('bootstrap failed');
    const bootstrapMock = mockBootstrapModule(async () => {
      throw failure;
    });

    const consoleSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    await jest.isolateModulesAsync(async () => {
      await import(TRAITS_GENERATOR_PATH);
    });

    const handler = addEventListenerSpy.mock.calls[0][1];

    await expect(handler()).rejects.toThrow(failure);
    expect(bootstrapMock).toHaveBeenCalledTimes(1);
    expect(consoleSpy).toHaveBeenCalledWith(
      'Failed to initialize Traits Generator:',
      failure
    );
  });
});
