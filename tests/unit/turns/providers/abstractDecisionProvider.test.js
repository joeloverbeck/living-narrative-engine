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

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

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

  it('throws when safeEventDispatcher lacks required dispatch method', () => {
    expect(
      () =>
        new TestProvider({
          index: 1,
          logger: mockLogger,
          safeEventDispatcher: {},
        })
    ).toThrow(
      "Invalid or missing method 'dispatch' on dependency 'safeEventDispatcher'."
    );
    expect(mockLogger.error).toHaveBeenCalledWith(
      "Invalid or missing method 'dispatch' on dependency 'safeEventDispatcher'."
    );
  });

  it('base choose implementation rejects with abstract error', async () => {
    const base = new AbstractDecisionProvider({
      logger: mockLogger,
      safeEventDispatcher: mockDispatcher,
    });

    await expect(base.choose({}, {}, [])).rejects.toThrow('abstract');
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
          moodUpdate: undefined,
          sexualUpdate: undefined,
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
          moodUpdate: undefined,
          sexualUpdate: undefined,
        },
      }
    );
  });

  it('decide normalizes optional fields when choose omits them', async () => {
    const provider = new TestProvider({
      index: 1,
      logger: mockLogger,
      safeEventDispatcher: mockDispatcher,
    });

    const result = await provider.decide({ id: 'actor-1' }, { context: true }, [
      'first',
    ]);

    expect(result).toEqual({
      chosenIndex: 1,
      speech: null,
      thoughts: null,
      notes: null,
      moodUpdate: null,
      sexualUpdate: null,
      cognitiveLedger: null,
    });
  });

  it('decide forwards values returned by choose and passes abort signal through', async () => {
    const captured = {
      actor: null,
      context: null,
      actions: null,
      abortSignal: null,
    };

    class RichProvider extends AbstractDecisionProvider {
      #result;

      constructor({ result, logger, safeEventDispatcher }) {
        super({ logger, safeEventDispatcher });
        this.#result = result;
      }

      async choose(actor, context, actions, abortSignal) {
        captured.actor = actor;
        captured.context = context;
        captured.actions = actions;
        captured.abortSignal = abortSignal;
        return this.#result;
      }
    }

    const abortController = new AbortController();
    const expectedNotes = [{ text: 'note', subject: 'subject' }];
    const expectedCognitiveLedger = {
      settled_conclusions: ['Realized something'],
      open_questions: ['What next?'],
    };
    const provider = new RichProvider({
      result: {
        index: 1,
        speech: 'Hello there',
        thoughts: 'Thinking',
        notes: expectedNotes,
        moodUpdate: {
          valence: 20,
          arousal: 10,
          agency_control: 5,
          threat: -5,
          engagement: 15,
          future_expectancy: 10,
          self_evaluation: 8,
        },
        sexualUpdate: { sex_excitation: 40, sex_inhibition: 10 },
        cognitiveLedger: expectedCognitiveLedger,
      },
      logger: mockLogger,
      safeEventDispatcher: mockDispatcher,
    });

    const actor = { id: 'actor-42' };
    const context = { some: 'context' };
    const actions = ['do', 'redo'];
    const result = await provider.decide(
      actor,
      context,
      actions,
      abortController.signal
    );

    expect(result).toEqual({
      chosenIndex: 1,
      speech: 'Hello there',
      thoughts: 'Thinking',
      notes: expectedNotes,
      moodUpdate: {
        valence: 20,
        arousal: 10,
        agency_control: 5,
        threat: -5,
        engagement: 15,
        future_expectancy: 10,
        self_evaluation: 8,
      },
      sexualUpdate: { sex_excitation: 40, sex_inhibition: 10 },
      cognitiveLedger: expectedCognitiveLedger,
    });
    expect(captured).toEqual({
      actor,
      context,
      actions,
      abortSignal: abortController.signal,
    });
  });

  it('decide passes through cognitiveLedger from choose', async () => {
    class LedgerProvider extends AbstractDecisionProvider {
      #ledger;

      constructor({ ledger, logger, safeEventDispatcher }) {
        super({ logger, safeEventDispatcher });
        this.#ledger = ledger;
      }

      async choose() {
        return {
          index: 1,
          cognitiveLedger: this.#ledger,
        };
      }
    }

    const testLedger = {
      settled_conclusions: ['Insight A', 'Insight B'],
      open_questions: ['Question X'],
    };
    const provider = new LedgerProvider({
      ledger: testLedger,
      logger: mockLogger,
      safeEventDispatcher: mockDispatcher,
    });

    const result = await provider.decide({ id: 'actor-ledger' }, {}, ['action']);

    expect(result.cognitiveLedger).toEqual(testLedger);
  });

  it('decide returns null cognitiveLedger when choose does not provide it', async () => {
    const provider = new TestProvider({
      index: 1,
      logger: mockLogger,
      safeEventDispatcher: mockDispatcher,
    });

    const result = await provider.decide({ id: 'actor-no-ledger' }, {}, ['action']);

    expect(result.cognitiveLedger).toBeNull();
  });
});
