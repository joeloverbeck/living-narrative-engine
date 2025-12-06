import { describe, it, expect, jest, afterEach } from '@jest/globals';

/**
 * @file Additional coverage for thematic-direction-main.js focusing on the
 * fallback error handling inside the module-level initialize function.
 */

describe('thematic-direction-main fallback error handling', () => {
  const readyStateDescriptor = Object.getOwnPropertyDescriptor(
    document,
    'readyState'
  );

  afterEach(() => {
    if (readyStateDescriptor) {
      Object.defineProperty(document, 'readyState', readyStateDescriptor);
    } else {
      delete document.readyState;
    }
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('logs a fatal error when ThematicDirectionApp.initialize rejects unexpectedly', async () => {
    Object.defineProperty(document, 'readyState', {
      configurable: true,
      get: jest.fn(() => 'loading'),
    });

    const addEventListenerSpy = jest.spyOn(document, 'addEventListener');
    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    const unexpectedFailure = new Error(
      'unexpected thematic direction failure'
    );

    await jest.isolateModulesAsync(async () => {
      const module = await import('../../src/thematic-direction-main.js');

      const domContentLoadedHandler = addEventListenerSpy.mock.calls.find(
        ([eventName]) => eventName === 'DOMContentLoaded'
      )?.[1];

      expect(domContentLoadedHandler).toBeInstanceOf(Function);

      jest
        .spyOn(module.ThematicDirectionApp.prototype, 'initialize')
        .mockRejectedValueOnce(unexpectedFailure);

      await domContentLoadedHandler();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to initialize thematic direction generator:',
        unexpectedFailure
      );
    });

    consoleErrorSpy.mockRestore();
    addEventListenerSpy.mockRestore();
  });
});
