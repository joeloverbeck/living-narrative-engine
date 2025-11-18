import { describe, it, beforeEach, afterEach, expect, jest } from '@jest/globals';

const MAIN_MODULE_PATH = '../../../src/character-concepts-manager-main.js';
const BOOTSTRAP_PATH = '../../../src/characterBuilder/CharacterBuilderBootstrap.js';

/**
 *
 * @param bootstrapImplementation
 */
async function loadMainModuleWithBootstrap(bootstrapImplementation) {
  let moduleUnderTest;
  let bootstrapSpy;

  await jest.isolateModulesAsync(async () => {
    const { CharacterBuilderBootstrap } = await import(BOOTSTRAP_PATH);
    bootstrapSpy = jest
      .spyOn(CharacterBuilderBootstrap.prototype, 'bootstrap')
      .mockImplementation(bootstrapImplementation);
    moduleUnderTest = await import(MAIN_MODULE_PATH);
  });

  return { moduleUnderTest, bootstrapSpy };
}

describe('character-concepts-manager main integration', () => {
  let originalController;
  let bootstrapSpy;

  beforeEach(() => {
    jest.resetModules();
    originalController = window.__characterConceptsManagerController;
    document.body.innerHTML = '<div id="error-display"></div>';
  });

  afterEach(() => {
    jest.restoreAllMocks();
    bootstrapSpy?.mockRestore();
    bootstrapSpy = undefined;
    window.__characterConceptsManagerController = originalController;
    delete document.hidden;
    document.body.innerHTML = '';
  });

  it('bootstraps application and wires lifecycle hooks', async () => {
    const logger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    const controller = {
      logger,
      refreshOnVisible: true,
      refreshData: jest.fn(),
      handleOnline: jest.fn(),
      handleOffline: jest.fn(),
    };
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    let capturedConfig;
    const bootstrapImplementation = async (config) => {
      capturedConfig = config;
      await config.hooks.postInit(controller);
      return {
        controller,
        container: {},
        bootstrapTime: 12.34,
      };
    };

    const { moduleUnderTest, bootstrapSpy: spy } =
      await loadMainModuleWithBootstrap(bootstrapImplementation);
    bootstrapSpy = spy;

    const { initializeApp, PAGE_NAME } = moduleUnderTest;

    await initializeApp();

    expect(bootstrapSpy).toHaveBeenCalledTimes(1);
    const config = capturedConfig;
    expect(config.pageName).toBe(PAGE_NAME);
    expect(config.includeModLoading).toBe(true);
    expect(config.errorDisplay).toEqual(
      expect.objectContaining({ elementId: 'error-display', dismissible: true })
    );
    expect(config.hooks.postInit).toBeInstanceOf(Function);
    expect(config.controllerClass.name).toBe('CharacterConceptsManagerController');

    expect(consoleLogSpy).toHaveBeenCalledWith(
      'Character Concepts Manager initialized successfully in 12.34ms'
    );

    expect(window.__characterConceptsManagerController).toBe(controller);

    const setDocumentHidden = (value) => {
      Object.defineProperty(document, 'hidden', {
        value,
        configurable: true,
      });
    };

    setDocumentHidden(true);
    document.dispatchEvent(new Event('visibilitychange'));
    expect(logger.info).toHaveBeenCalledWith('Page hidden');

    setDocumentHidden(false);
    document.dispatchEvent(new Event('visibilitychange'));
    expect(logger.info).toHaveBeenCalledWith('Page visible');
    expect(controller.refreshData).toHaveBeenCalledTimes(1);

    window.dispatchEvent(new Event('online'));
    expect(logger.info).toHaveBeenCalledWith('Connection restored');
    expect(controller.handleOnline).toHaveBeenCalledTimes(1);

    window.dispatchEvent(new Event('offline'));
    expect(logger.warn).toHaveBeenCalledWith('Connection lost');
    expect(controller.handleOffline).toHaveBeenCalledTimes(1);

    const errorEvent = new Event('error');
    errorEvent.message = 'boom';
    errorEvent.filename = 'test.js';
    errorEvent.lineno = 10;
    errorEvent.colno = 5;
    errorEvent.error = new Error('boom');
    errorEvent.preventDefault = jest.fn();
    window.dispatchEvent(errorEvent);
    expect(logger.error).toHaveBeenNthCalledWith(
      1,
      'Unhandled error',
      expect.objectContaining({
        message: 'boom',
        filename: 'test.js',
        lineno: 10,
        colno: 5,
        error: errorEvent.error,
      })
    );
    expect(errorEvent.preventDefault).toHaveBeenCalledTimes(1);

    const rejectionEvent = new Event('unhandledrejection');
    rejectionEvent.reason = new Error('reject');
    rejectionEvent.promise = Promise.resolve();
    rejectionEvent.preventDefault = jest.fn();
    window.dispatchEvent(rejectionEvent);
    expect(logger.error).toHaveBeenNthCalledWith(
      2,
      'Unhandled promise rejection',
      expect.objectContaining({
        reason: rejectionEvent.reason,
        promise: rejectionEvent.promise,
      })
    );
    expect(rejectionEvent.preventDefault).toHaveBeenCalledTimes(1);
  });

  it('logs initialization failures gracefully', async () => {
    const failure = new Error('bootstrap failure');
    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    const { moduleUnderTest, bootstrapSpy: spy } =
      await loadMainModuleWithBootstrap(async () => {
        throw failure;
      });
    bootstrapSpy = spy;

    const { initializeApp, PAGE_NAME } = moduleUnderTest;

    await initializeApp();

    expect(bootstrapSpy).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      `Failed to initialize ${PAGE_NAME}:`,
      failure
    );
  });
});
