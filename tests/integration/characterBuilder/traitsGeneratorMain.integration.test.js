import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

const MODULE_PATH = '../../../src/traits-generator-main.js';

/**
 * Utility to flush pending microtasks.
 *
 * @returns {Promise<void>}
 */
const flushPromises = () => new Promise((resolve) => setImmediate(resolve));

describe('traits-generator-main entrypoint integration', () => {
  const originalEnv = process.env;
  let readyStateValue = 'complete';
  let originalReadyDescriptor;

  beforeEach(() => {
    jest.resetModules();
    document.body.innerHTML = '<div id="app"></div><div id="error-display"></div>';
    process.env = { ...originalEnv };
    delete window.__traitsGeneratorController;

    readyStateValue = 'complete';
    originalReadyDescriptor = Object.getOwnPropertyDescriptor(document, 'readyState');
    Object.defineProperty(document, 'readyState', {
      configurable: true,
      get: () => readyStateValue,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    document.body.innerHTML = '';
    delete window.__traitsGeneratorController;
    if (originalReadyDescriptor) {
      Object.defineProperty(document, 'readyState', originalReadyDescriptor);
    } else {
      delete document.readyState;
    }
    process.env = originalEnv;
  });

  it('waits for DOMContentLoaded when document is still loading and exposes controller in development', async () => {
    readyStateValue = 'loading';
    process.env.NODE_ENV = 'development';

    const addEventListenerSpy = jest.spyOn(document, 'addEventListener');
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    const controller = { id: 'controller-1' };
    let capturedConfig;
    let bootstrapSpy;

    await jest.isolateModulesAsync(async () => {
      const { CharacterBuilderBootstrap } = await import(
        '../../../src/characterBuilder/CharacterBuilderBootstrap.js'
      );
      const { TraitsGeneratorController } = await import(
        '../../../src/characterBuilder/controllers/TraitsGeneratorController.js'
      );
      const { TraitsDisplayEnhancer } = await import(
        '../../../src/characterBuilder/services/TraitsDisplayEnhancer.js'
      );

      bootstrapSpy = jest
        .spyOn(CharacterBuilderBootstrap.prototype, 'bootstrap')
        .mockImplementation(async (config) => {
          capturedConfig = config;
          expect(config.controllerClass).toBe(TraitsGeneratorController);
          expect(config.services?.traitsDisplayEnhancer).toBe(TraitsDisplayEnhancer);
          if (config.hooks?.postInit) {
            await config.hooks.postInit(controller);
          }
          return { controller, container: { id: 'container' }, bootstrapTime: 42 };
        });

      await import(MODULE_PATH);
    });

    expect(bootstrapSpy).not.toHaveBeenCalled();
    expect(addEventListenerSpy).toHaveBeenCalledWith(
      'DOMContentLoaded',
      expect.any(Function)
    );

    const handler = addEventListenerSpy.mock.calls[0][1];
    const result = await handler();

    expect(result).toEqual({ controller, container: { id: 'container' }, bootstrapTime: 42 });
    expect(bootstrapSpy).toHaveBeenCalledTimes(1);
    expect(capturedConfig.pageName).toBe('traits-generator');
    expect(capturedConfig.includeModLoading).toBe(true);
    expect(capturedConfig.customSchemas).toEqual([
      '/data/schemas/trait.schema.json',
    ]);
    expect(typeof capturedConfig.hooks?.postInit).toBe('function');
    expect(window.__traitsGeneratorController).toBe(controller);
    expect(consoleLogSpy).toHaveBeenCalledWith('Initializing Traits Generator...');
  });

  it('initializes immediately when DOM is already ready', async () => {
    readyStateValue = 'complete';
    process.env.NODE_ENV = 'production';

    const addEventListenerSpy = jest.spyOn(document, 'addEventListener');
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    const bootstrapResult = {
      controller: { id: 'controller-2' },
      container: { id: 'container-2' },
      bootstrapTime: 21,
    };
    let bootstrapSpy;

    await jest.isolateModulesAsync(async () => {
      const { CharacterBuilderBootstrap } = await import(
        '../../../src/characterBuilder/CharacterBuilderBootstrap.js'
      );

      bootstrapSpy = jest
        .spyOn(CharacterBuilderBootstrap.prototype, 'bootstrap')
        .mockResolvedValue(bootstrapResult);

      await import(MODULE_PATH);
    });

    await flushPromises();

    expect(addEventListenerSpy).not.toHaveBeenCalled();
    expect(bootstrapSpy).toHaveBeenCalledTimes(1);
    expect(window.__traitsGeneratorController).toBeUndefined();
    expect(consoleLogSpy).toHaveBeenCalledWith('Initializing Traits Generator...');
  });

  it('logs and rethrows errors when initialization fails', async () => {
    readyStateValue = 'loading';
    process.env.NODE_ENV = 'test';

    const addEventListenerSpy = jest.spyOn(document, 'addEventListener');
    const failure = new Error('bootstrap failed');
    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    let bootstrapSpy;

    await jest.isolateModulesAsync(async () => {
      const { CharacterBuilderBootstrap } = await import(
        '../../../src/characterBuilder/CharacterBuilderBootstrap.js'
      );

      bootstrapSpy = jest
        .spyOn(CharacterBuilderBootstrap.prototype, 'bootstrap')
        .mockRejectedValue(failure);

      await import(MODULE_PATH);
    });

    const handler = addEventListenerSpy.mock.calls[0][1];
    await expect(handler()).rejects.toThrow(failure);

    expect(bootstrapSpy).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to initialize Traits Generator:',
      failure
    );
  });
});
