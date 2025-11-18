import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

const MODULE_PATH = '../../../src/core-motivations-generator-main.js';

/**
 * Utility to flush pending microtasks.
 *
 * @returns {Promise<void>}
 */
const flushPromises = () => new Promise((resolve) => setImmediate(resolve));

describe('core-motivations-generator-main entrypoint integration', () => {
  const originalEnv = process.env;
  let readyStateValue = 'complete';
  let originalReadyDescriptor;

  beforeEach(() => {
    jest.resetModules();
    document.body.innerHTML = '<div id="core-motivations-container"></div>';
    process.env = { ...originalEnv };
    delete window.__coreMotivationsController;

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
    delete window.__coreMotivationsController;
    if (originalReadyDescriptor) {
      Object.defineProperty(document, 'readyState', originalReadyDescriptor);
    } else {
      delete document.readyState;
    }
    process.env = originalEnv;
  });

  it('waits for DOMContentLoaded, exposes controller in development, and registers cleanup handler', async () => {
    readyStateValue = 'loading';
    process.env.NODE_ENV = 'development';

    const addDocumentListenerSpy = jest.spyOn(document, 'addEventListener');
    const addWindowListenerSpy = jest.spyOn(window, 'addEventListener');
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    const controller = { cleanup: jest.fn().mockResolvedValue(undefined) };
    let capturedConfig;
    let bootstrapSpy;

    await jest.isolateModulesAsync(async () => {
      const { CharacterBuilderBootstrap } = await import(
        '../../../src/characterBuilder/CharacterBuilderBootstrap.js'
      );
      const { CoreMotivationsGeneratorController } = await import(
        '../../../src/coreMotivationsGenerator/controllers/CoreMotivationsGeneratorController.js'
      );
      const { CoreMotivationsDisplayEnhancer } = await import(
        '../../../src/coreMotivationsGenerator/services/CoreMotivationsDisplayEnhancer.js'
      );
      const { CoreMotivationsGenerator } = await import(
        '../../../src/characterBuilder/services/CoreMotivationsGenerator.js'
      );

      bootstrapSpy = jest
        .spyOn(CharacterBuilderBootstrap.prototype, 'bootstrap')
        .mockImplementation(async (config) => {
          capturedConfig = config;
          expect(config.controllerClass).toBe(CoreMotivationsGeneratorController);
          expect(config.services?.displayEnhancer).toBe(CoreMotivationsDisplayEnhancer);
          expect(config.services?.coreMotivationsGenerator).toBe(CoreMotivationsGenerator);
          if (config.hooks?.postInit) {
            await config.hooks.postInit(controller);
          }
          return {
            controller,
            container: { id: 'container-1' },
            bootstrapTime: 123.456,
          };
        });

      await import(MODULE_PATH);
    });

    expect(bootstrapSpy).not.toHaveBeenCalled();
    expect(addDocumentListenerSpy).toHaveBeenCalledWith(
      'DOMContentLoaded',
      expect.any(Function)
    );

    const domReadyHandler = addDocumentListenerSpy.mock.calls[0][1];
    const result = await domReadyHandler();

    expect(bootstrapSpy).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      controller,
      container: { id: 'container-1' },
      bootstrapTime: 123.456,
    });

    expect(capturedConfig.pageName).toBe('core-motivations-generator');
    expect(capturedConfig.includeModLoading).toBe(true);
    expect(capturedConfig.customSchemas).toEqual([
      '/data/schemas/core-motivation.schema.json',
    ]);
    expect(typeof capturedConfig.hooks?.postInit).toBe('function');

    expect(window.__coreMotivationsController).toBe(controller);
    expect(consoleLogSpy).toHaveBeenCalledWith(
      'Initializing Core Motivations Generator...'
    );
    expect(consoleLogSpy).toHaveBeenCalledWith(
      'Core Motivations Generator initialized in 123.46ms'
    );

    expect(addWindowListenerSpy).toHaveBeenCalledWith(
      'beforeunload',
      expect.any(Function)
    );
    const beforeUnloadHandler = addWindowListenerSpy.mock.calls[0][1];
    await beforeUnloadHandler();
    expect(controller.cleanup).toHaveBeenCalledTimes(1);

    // Cover branch where cleanup handler is absent
    controller.cleanup = undefined;
    await beforeUnloadHandler();
    expect(controller.cleanup).toBeUndefined();
  });

  it('initializes immediately when DOM is ready and skips exposing controller outside development', async () => {
    readyStateValue = 'complete';
    process.env.NODE_ENV = 'production';

    const addDocumentListenerSpy = jest.spyOn(document, 'addEventListener');
    const addWindowListenerSpy = jest.spyOn(window, 'addEventListener');
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    const controller = { cleanup: jest.fn().mockResolvedValue(undefined) };
    let bootstrapSpy;

    await jest.isolateModulesAsync(async () => {
      const { CharacterBuilderBootstrap } = await import(
        '../../../src/characterBuilder/CharacterBuilderBootstrap.js'
      );
      const { CoreMotivationsGeneratorController } = await import(
        '../../../src/coreMotivationsGenerator/controllers/CoreMotivationsGeneratorController.js'
      );
      const { CoreMotivationsDisplayEnhancer } = await import(
        '../../../src/coreMotivationsGenerator/services/CoreMotivationsDisplayEnhancer.js'
      );
      const { CoreMotivationsGenerator } = await import(
        '../../../src/characterBuilder/services/CoreMotivationsGenerator.js'
      );

      bootstrapSpy = jest
        .spyOn(CharacterBuilderBootstrap.prototype, 'bootstrap')
        .mockImplementation(async (config) => {
          expect(config.controllerClass).toBe(CoreMotivationsGeneratorController);
          expect(config.services?.displayEnhancer).toBe(CoreMotivationsDisplayEnhancer);
          expect(config.services?.coreMotivationsGenerator).toBe(CoreMotivationsGenerator);
          if (config.hooks?.postInit) {
            await config.hooks.postInit(controller);
          }
          return { controller, container: { id: 'container-2' } };
        });

      await import(MODULE_PATH);
    });

    await flushPromises();

    expect(addDocumentListenerSpy).not.toHaveBeenCalled();
    expect(bootstrapSpy).toHaveBeenCalledTimes(1);
    expect(window.__coreMotivationsController).toBeUndefined();
    expect(consoleLogSpy).toHaveBeenCalledWith(
      'Initializing Core Motivations Generator...'
    );
    expect(consoleLogSpy).toHaveBeenCalledWith(
      'Core Motivations Generator initialized successfully'
    );

    expect(addWindowListenerSpy).toHaveBeenCalledWith(
      'beforeunload',
      expect.any(Function)
    );
    const beforeUnloadHandler = addWindowListenerSpy.mock.calls[0][1];
    await beforeUnloadHandler();
    expect(controller.cleanup).toHaveBeenCalledTimes(1);

    controller.cleanup = undefined;
    await beforeUnloadHandler();
    expect(controller.cleanup).toBeUndefined();
  });

  it('handles bootstrap resolving to null without emitting success logs', async () => {
    readyStateValue = 'complete';
    process.env.NODE_ENV = 'test';

    const addDocumentListenerSpy = jest.spyOn(document, 'addEventListener');
    const addWindowListenerSpy = jest.spyOn(window, 'addEventListener');
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    await jest.isolateModulesAsync(async () => {
      const { CharacterBuilderBootstrap } = await import(
        '../../../src/characterBuilder/CharacterBuilderBootstrap.js'
      );

      jest
        .spyOn(CharacterBuilderBootstrap.prototype, 'bootstrap')
        .mockResolvedValue(null);

      await import(MODULE_PATH);
    });

    await flushPromises();

    expect(addDocumentListenerSpy).not.toHaveBeenCalled();
    expect(addWindowListenerSpy).toHaveBeenCalledWith(
      'beforeunload',
      expect.any(Function)
    );
    expect(consoleLogSpy).toHaveBeenCalledWith(
      'Initializing Core Motivations Generator...'
    );
    expect(consoleLogSpy).not.toHaveBeenCalledWith(
      'Core Motivations Generator initialized successfully'
    );
  });

  it('renders a friendly error message and rethrows when bootstrap fails', async () => {
    readyStateValue = 'loading';
    process.env.NODE_ENV = 'test';

    const addDocumentListenerSpy = jest.spyOn(document, 'addEventListener');
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const failure = new Error('bootstrap failed');
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

    const domReadyHandler = addDocumentListenerSpy.mock.calls[0][1];
    await expect(domReadyHandler()).rejects.toThrow(failure);

    expect(bootstrapSpy).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to initialize Core Motivations Generator:',
      failure
    );

    const container = document.getElementById('core-motivations-container');
    expect(container.innerHTML).toContain('Unable to Load Core Motivations Generator');
    expect(container.innerHTML).toContain('bootstrap failed');

    // Cover the branch where the container is missing
    document.body.innerHTML = '';
    await expect(domReadyHandler()).rejects.toThrow(failure);
  });
});
