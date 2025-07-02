import { describe, it, expect, jest } from '@jest/globals';
import { AbstractDecisionProvider } from '../../../../src/turns/providers/abstractDecisionProvider.js';
import * as actionIndexUtils from '../../../../src/utils/actionIndexUtils.js';

/**
 * @class TestProvider
 * @augments AbstractDecisionProvider
 * @description Simple concrete implementation returning a predefined index.
 */
class TestProvider extends AbstractDecisionProvider {
  /** @type {number} */
  #index;
  /**
   * @param {object} deps
   * @param {number} deps.index - Index returned by {@link choose}
   * @param {import('../../../../src/interfaces/coreServices').ILogger} deps.logger - Logger instance
   * @param {import('../../../../src/interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} deps.safeEventDispatcher - Dispatcher for errors
   * @returns {void}
   */
  constructor({ index, logger, safeEventDispatcher }) {
    super({ logger, safeEventDispatcher });
    this.#index = index;
  }

  /**
   * @protected
   * @override
   * @returns {Promise<{ index: number }>}
   */
  async choose() {
    return { index: this.#index };
  }
}

describe('AbstractDecisionProvider base logic', () => {
  const mockLogger = { error: jest.fn(), debug: jest.fn() };
  const mockDispatcher = { dispatch: jest.fn() };

  it('throws when logger is missing', () => {
    expect(
      () => new TestProvider({ index: 1, safeEventDispatcher: mockDispatcher })
    ).toThrow('Missing required dependency: logger.');
  });

  it('throws when safeEventDispatcher is missing', () => {
    expect(() => new TestProvider({ index: 1, logger: mockLogger })).toThrow(
      'Missing required dependency: safeEventDispatcher.'
    );
  });

  it('invalid index triggers assertValidActionIndex for non-integer', async () => {
    const spy = jest.spyOn(actionIndexUtils, 'assertValidActionIndex');
    const provider = new TestProvider({
      index: 1.5,
      logger: mockLogger,
      safeEventDispatcher: mockDispatcher,
    });

    await expect(provider.decide({ id: 'a1' }, {}, ['a', 'b'])).rejects.toThrow(
      'Could not resolve the chosen action to a valid index.'
    );

    expect(spy).toHaveBeenCalledWith(
      1.5,
      2,
      'TestProvider',
      'a1',
      mockDispatcher,
      mockLogger,
      {
        result: {
          index: 1.5,
          speech: undefined,
          thoughts: undefined,
          notes: undefined,
        },
      }
    );
  });

  it('invalid index triggers assertValidActionIndex for out-of-range', async () => {
    const spy = jest.spyOn(actionIndexUtils, 'assertValidActionIndex');
    const provider = new TestProvider({
      index: 3,
      logger: mockLogger,
      safeEventDispatcher: mockDispatcher,
    });

    await expect(provider.decide({ id: 'a2' }, {}, ['a', 'b'])).rejects.toThrow(
      'Player chose an index that does not exist for this turn.'
    );

    expect(spy).toHaveBeenCalledWith(
      3,
      2,
      'TestProvider',
      'a2',
      mockDispatcher,
      mockLogger,
      {
        result: {
          index: 3,
          speech: undefined,
          thoughts: undefined,
          notes: undefined,
        },
      }
    );
  });
});
