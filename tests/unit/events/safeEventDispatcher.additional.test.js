import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { SafeEventDispatcher } from '../../../src/events/safeEventDispatcher.js';
import { describeConstructorValidation } from '../../common/constructorValidationHelpers.js';

/**
 * Creates a set of mocked dependencies for the dispatcher.
 *
 * @returns {{validatedEventDispatcher: object, logger: object}} Mocked deps
 */
function createDeps() {
  return {
    validatedEventDispatcher: {
      dispatch: jest.fn(),
      subscribe: jest.fn(),
      unsubscribe: jest.fn(),
    },
    logger: {
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    },
  };
}

const spec = {
  validatedEventDispatcher: {
    error: /validatedEventDispatcher/,
    methods: ['dispatch', 'subscribe', 'unsubscribe'],
  },
  logger: { error: /logger dependency/, methods: ['error', 'debug'] },
};

describe('SafeEventDispatcher', () => {
  describeConstructorValidation(SafeEventDispatcher, createDeps, spec);

  /** @type {ReturnType<typeof createDeps>} */
  let deps;
  /** @type {SafeEventDispatcher} */
  let dispatcher;

  beforeEach(() => {
    deps = createDeps();
    dispatcher = new SafeEventDispatcher(deps);
  });

  describe('dispatch', () => {
    it('returns true and logs on success', async () => {
      deps.validatedEventDispatcher.dispatch.mockResolvedValue(true);
      const ok = await dispatcher.dispatch('evt', { a: 1 });
      expect(ok).toBe(true);
      expect(deps.logger.debug).toHaveBeenCalledWith(
        "SafeEventDispatcher: Successfully dispatched event 'evt'."
      );
    });

    it('warns and returns false when underlying dispatcher returns false', async () => {
      deps.validatedEventDispatcher.dispatch.mockResolvedValue(false);
      const ok = await dispatcher.dispatch('evt', { a: 2 });
      expect(ok).toBe(false);
      expect(deps.logger.warn).toHaveBeenCalledWith(
        expect.stringContaining("Underlying VED failed to dispatch event 'evt'")
      );
    });

    it('handles circular payloads without throwing when underlying dispatcher returns false', async () => {
      deps.validatedEventDispatcher.dispatch.mockResolvedValue(false);

      const payload = {};
      payload.self = payload;

      const ok = await dispatcher.dispatch('evt', payload);

      expect(ok).toBe(false);
      expect(deps.logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('[Circular]')
      );
    });

    it('logs error and returns false when dispatch throws', async () => {
      deps.validatedEventDispatcher.dispatch.mockRejectedValue(
        new Error('boom')
      );
      const ok = await dispatcher.dispatch('evt', {});
      expect(ok).toBe(false);
      expect(deps.logger.error).toHaveBeenCalled();
    });
  });

  describe('subscribe', () => {
    it('returns unsubscribe function and logs on success', () => {
      const unsub = jest.fn();
      deps.validatedEventDispatcher.subscribe.mockReturnValue(unsub);
      const result = dispatcher.subscribe('evt', jest.fn());
      expect(result).toBe(unsub);
      expect(deps.logger.debug).toHaveBeenCalledWith(
        "SafeEventDispatcher: Successfully subscribed to event 'evt'."
      );
    });

    it('returns null when subscribe throws', () => {
      deps.validatedEventDispatcher.subscribe.mockImplementation(() => {
        throw new Error('fail');
      });
      const result = dispatcher.subscribe('evt', jest.fn());
      expect(result).toBeNull();
      expect(deps.logger.error).toHaveBeenCalled();
    });

    it('returns null and logs when unsubscribe function invalid', () => {
      deps.validatedEventDispatcher.subscribe.mockReturnValue('nope');
      const result = dispatcher.subscribe('evt', jest.fn());
      expect(result).toBeNull();
      expect(deps.logger.error).toHaveBeenCalledWith(
        "SafeEventDispatcher: Underlying VED.subscribe for 'evt' did not return a valid unsubscribe function."
      );
    });
  });

  describe('unsubscribe', () => {
    it('logs debug when unsubscribe succeeds', () => {
      deps.validatedEventDispatcher.unsubscribe.mockReturnValue(true);
      dispatcher.unsubscribe('evt', jest.fn());
      expect(deps.logger.debug).toHaveBeenCalledWith(
        "SafeEventDispatcher: Successfully unsubscribed from event 'evt' (direct call)."
      );
    });

    it('handles errors from unsubscribe gracefully', () => {
      deps.validatedEventDispatcher.unsubscribe.mockImplementation(() => {
        throw new Error('fail');
      });
      expect(() => dispatcher.unsubscribe('evt', jest.fn())).not.toThrow();
      expect(deps.logger.error).toHaveBeenCalled();
    });
  });
});
