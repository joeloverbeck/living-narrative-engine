import {
  describe,
  it,
  beforeEach,
  afterEach,
  expect,
  jest,
} from '@jest/globals';

const ENTRY_MODULE_PATH = '../../../src/character-concepts-manager-entry.js';
const MAIN_MODULE_PATH = '../../../src/character-concepts-manager-main.js';
const BOOTSTRAP_PATH =
  '../../../src/characterBuilder/CharacterBuilderBootstrap.js';

const flushMicrotasks = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('character-concepts-manager entry integration', () => {
  let originalReadyStateDescriptor;
  let originalController;

  beforeEach(() => {
    jest.resetModules();
    originalController = window.__characterConceptsManagerController;
    originalReadyStateDescriptor = Object.getOwnPropertyDescriptor(
      document,
      'readyState'
    );
    document.body.innerHTML = '<div id="error-display"></div>';
  });

  afterEach(() => {
    jest.restoreAllMocks();
    window.__characterConceptsManagerController = originalController;
    if (originalReadyStateDescriptor) {
      Object.defineProperty(
        document,
        'readyState',
        originalReadyStateDescriptor
      );
    } else {
      delete document.readyState;
    }
    delete document.hidden;
    document.body.innerHTML = '';
  });

  it('waits for DOMContentLoaded before bootstrapping the manager', async () => {
    await jest.isolateModulesAsync(async () => {
      let readyState = 'loading';
      Object.defineProperty(document, 'readyState', {
        configurable: true,
        get: () => readyState,
      });

      const consoleLogSpy = jest
        .spyOn(console, 'log')
        .mockImplementation(() => {});

      const { CharacterBuilderBootstrap } = await import(BOOTSTRAP_PATH);
      const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
      const controller = {
        logger,
        refreshOnVisible: true,
        refreshData: jest.fn(),
        handleOnline: jest.fn(),
        handleOffline: jest.fn(),
      };

      const bootstrapSpy = jest
        .spyOn(CharacterBuilderBootstrap.prototype, 'bootstrap')
        .mockImplementation(async (config) => {
          await config.hooks.postInit(controller);
          return { controller, container: {}, bootstrapTime: 5.5 };
        });

      await import(MAIN_MODULE_PATH);
      await import(ENTRY_MODULE_PATH);

      expect(bootstrapSpy).not.toHaveBeenCalled();

      readyState = 'complete';
      document.dispatchEvent(new Event('DOMContentLoaded'));

      await flushMicrotasks();
      await flushMicrotasks();

      expect(bootstrapSpy).toHaveBeenCalledTimes(1);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        'Character Concepts Manager initialized successfully in 5.50ms'
      );
      expect(window.__characterConceptsManagerController).toBe(controller);

      Object.defineProperty(document, 'hidden', {
        configurable: true,
        value: true,
      });
      document.dispatchEvent(new Event('visibilitychange'));
      expect(logger.info).toHaveBeenCalledWith('Page hidden');

      Object.defineProperty(document, 'hidden', {
        configurable: true,
        value: false,
      });
      document.dispatchEvent(new Event('visibilitychange'));
      expect(logger.info).toHaveBeenCalledWith('Page visible');
      expect(controller.refreshData).toHaveBeenCalledTimes(1);

      window.dispatchEvent(new Event('online'));
      expect(controller.handleOnline).toHaveBeenCalledTimes(1);
      window.dispatchEvent(new Event('offline'));
      expect(controller.handleOffline).toHaveBeenCalledTimes(1);
    });
  });

  it('logs fatal errors when initialization rejects and DOM is already ready', async () => {
    await jest.isolateModulesAsync(async () => {
      Object.defineProperty(document, 'readyState', {
        configurable: true,
        get: () => 'complete',
      });

      const failure = new Error('entry bootstrap failure');
      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      jest.doMock(MAIN_MODULE_PATH, () => ({
        initializeApp: jest.fn(() => Promise.reject(failure)),
      }));

      await import(ENTRY_MODULE_PATH);

      await flushMicrotasks();
      await flushMicrotasks();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to initialize application:',
        failure
      );
    });
  });
});
