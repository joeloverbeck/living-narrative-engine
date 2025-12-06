/**
 * @file Additional SafeEventDispatcher coverage tests
 * @description Ensures difficult error-handling branches are exercised.
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { SafeEventDispatcher } from '../../../src/events/safeEventDispatcher.js';
import * as safeStringifyModule from '../../../src/utils/safeStringify.js';

/**
 * Creates mocked dependencies for SafeEventDispatcher.
 *
 * @returns {{ validatedEventDispatcher: object, logger: object }} Mocked deps
 */
function createDeps() {
  return {
    validatedEventDispatcher: {
      dispatch: jest.fn(),
      subscribe: jest.fn(),
      unsubscribe: jest.fn(),
      setBatchMode: jest.fn(),
    },
    logger: {
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    },
  };
}

describe('SafeEventDispatcher - error handling coverage', () => {
  /** @type {ReturnType<typeof createDeps>} */
  let deps;
  /** @type {SafeEventDispatcher} */
  let dispatcher;

  beforeEach(() => {
    deps = createDeps();
    dispatcher = new SafeEventDispatcher(deps);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('uses object message fields and console fallback for error events', async () => {
    const consoleSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    const rejection = { message: '  trimmed message  ' };
    deps.validatedEventDispatcher.dispatch.mockRejectedValue(rejection);

    const result = await dispatcher.dispatch('workflow_error_event', {
      payload: true,
    });

    expect(result).toBe(false);
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('trimmed message'),
      expect.objectContaining({
        error: rejection,
        payload: { payload: true },
      })
    );
    expect(deps.logger.error).not.toHaveBeenCalled();
  });

  it('falls back to console when logger throws for async errors with unstringifiable values', async () => {
    const consoleSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    const problematic = {
      toString() {
        throw new Error('no string for you');
      },
    };

    deps.validatedEventDispatcher.dispatch.mockRejectedValue(problematic);
    deps.logger.error.mockImplementation(() => {
      throw new Error('logger failure');
    });

    const result = await dispatcher.dispatch('info_event', {});

    expect(result).toBe(false);
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        'Logger failed while handling error in dispatching event'
      ),
      problematic,
      'Logger error:',
      expect.any(Error)
    );
  });

  it('normalizes null synchronous errors and logs to console for error-labelled operations', () => {
    const consoleSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    deps.validatedEventDispatcher.subscribe.mockImplementation(() => {
      throw null;
    });

    const result = dispatcher.subscribe('critical_error_event', jest.fn());

    expect(result).toBeNull();
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Unknown error.'),
      expect.objectContaining({ error: null })
    );
    expect(deps.logger.error).not.toHaveBeenCalled();
  });

  it('trims string errors and provides console fallback when logger fails synchronously', () => {
    const consoleSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    deps.validatedEventDispatcher.unsubscribe.mockImplementation(() => {
      throw '  spaced message  ';
    });
    deps.logger.error.mockImplementation(() => {
      throw new Error('logger failure');
    });

    expect(() =>
      dispatcher.unsubscribe('regular_event', jest.fn())
    ).not.toThrow();

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('spaced message'),
      '  spaced message  ',
      'Logger error:',
      expect.any(Error)
    );
  });

  it('surfaces custom toString() results through logger for synchronous errors', () => {
    const customError = {
      toString() {
        return 'Detailed failure message';
      },
    };
    deps.validatedEventDispatcher.setBatchMode.mockImplementation(() => {
      throw customError;
    });

    expect(() =>
      dispatcher.setBatchMode(true, { context: 'normal-operation' })
    ).not.toThrow();

    expect(deps.logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Detailed failure message'),
      expect.objectContaining({ error: customError })
    );
  });

  it('reports generic unknown messages for plain object errors via console path', () => {
    const consoleSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    const plainObjectError = {};
    deps.validatedEventDispatcher.setBatchMode.mockImplementation(() => {
      throw plainObjectError;
    });

    expect(() =>
      dispatcher.setBatchMode(true, { context: 'error-phase' })
    ).not.toThrow();

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Unknown error.'),
      expect.objectContaining({ error: plainObjectError })
    );
  });

  it('logs debug details when safeStringify fails after a false dispatch result', async () => {
    deps.validatedEventDispatcher.dispatch.mockResolvedValue(false);
    const stringifySpy = jest
      .spyOn(safeStringifyModule, 'safeStringify')
      .mockImplementation(() => {
        throw new Error('stringify boom');
      });

    const result = await dispatcher.dispatch('no_error_event', {
      data: 'value',
    });

    expect(result).toBe(false);
    expect(deps.logger.debug).toHaveBeenCalledWith(
      'SafeEventDispatcher: Failed to stringify payload after VED returned false.',
      expect.objectContaining({ error: expect.any(Error) })
    );

    stringifySpy.mockRestore();
  });
});
