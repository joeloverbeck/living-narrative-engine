import { describe, it, expect, afterEach, jest } from '@jest/globals';

import AbstractLoader from '../../../src/loaders/abstractLoader.js';

describe('AbstractLoader', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('uses the provided logger when it implements the expected interface', () => {
    const logger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    const loader = new AbstractLoader(logger);

    expect(loader._logger).toBe(logger);
    expect(logger.debug).toHaveBeenCalledTimes(1);
    expect(logger.debug).toHaveBeenCalledWith('AbstractLoader: Initialized.');
  });

  it('falls back to a console-based logger when the provided logger is incomplete', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const debugSpy = jest.spyOn(console, 'debug').mockImplementation(() => {});

    const invalidLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      // missing debug()
    };

    const loader = new AbstractLoader(invalidLogger);

    expect(loader._logger).not.toBe(invalidLogger);
    expect(typeof loader._logger.debug).toBe('function');
    expect(warnSpy).toHaveBeenCalledWith(
      'AbstractLoader: ',
      'An invalid logger instance was provided. Falling back to console logging with prefix "AbstractLoader".'
    );
    expect(debugSpy).toHaveBeenCalledWith(
      'AbstractLoader: ',
      'AbstractLoader: Initialized.'
    );
  });

  it('creates a fallback logger when no logger is supplied', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const debugSpy = jest.spyOn(console, 'debug').mockImplementation(() => {});

    const loader = new AbstractLoader(null);

    expect(typeof loader._logger.info).toBe('function');
    expect(warnSpy).not.toHaveBeenCalled();
    expect(debugSpy).toHaveBeenCalledWith(
      'AbstractLoader: ',
      'AbstractLoader: Initialized.'
    );
  });
});
