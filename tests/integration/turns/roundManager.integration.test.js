import {
  describe,
  it,
  expect,
  beforeEach,
} from '@jest/globals';
import RoundManager from '../../../src/turns/roundManager.js';
import { TurnOrderService } from '../../../src/turns/order/turnOrderService.js';
import SimpleEntityManager from '../../common/entities/simpleEntityManager.js';
import { ACTOR_COMPONENT_ID } from '../../../src/constants/componentIds.js';

class CapturingLogger {
  constructor() {
    this.debugLogs = [];
    this.infoLogs = [];
    this.warnLogs = [];
    this.errorLogs = [];
  }

  debug(message, ...args) {
    this.debugLogs.push({ message, args });
  }

  info(message, ...args) {
    this.infoLogs.push({ message, args });
  }

  warn(message, ...args) {
    this.warnLogs.push({ message, args });
  }

  error(message, ...args) {
    this.errorLogs.push({ message, args });
  }
}

function createActor(id) {
  return {
    id,
    components: {
      [ACTOR_COMPONENT_ID]: {},
    },
  };
}

describe('RoundManager integration with real turn order service', () => {
  /** @type {CapturingLogger} */
  let logger;
  /** @type {SimpleEntityManager} */
  let entityManager;
  /** @type {TurnOrderService} */
  let turnOrderService;
  /** @type {RoundManager} */
  let roundManager;
  let mockDispatcher;

  beforeEach(() => {
    logger = new CapturingLogger();
    entityManager = new SimpleEntityManager();
    turnOrderService = new TurnOrderService({ logger });
    mockDispatcher = {
      dispatch: jest.fn(),
    };
    roundManager = new RoundManager(
      turnOrderService,
      entityManager,
      logger,
      mockDispatcher
    );
  });

  it('normalises complex initiative Maps supplied via options object and starts an initiative round', async () => {
    entityManager.setEntities([
      createActor('actor1'),
      createActor('actor2'),
      createActor('actor3'),
      createActor('actor4'),
      createActor('actor6'),
      createActor('actor7'),
    ]);

    const rawMap = new Map();
    rawMap.set('actor1', 5);
    rawMap.set(' actor1 ', '7');
    rawMap.set(42, 10);
    rawMap.set('   ', 3);
    rawMap.set('actor2', ' 9 ');
    rawMap.set('actor3', null);
    rawMap.set('actor4', 'foo');
    rawMap.set('actor5', {});
    rawMap.set('actor7', '');
    rawMap.set('actor6', true);

    await roundManager.startRound({ initiativeData: rawMap });

    expect(roundManager.inProgress).toBe(true);
    expect(roundManager.hadSuccess).toBe(false);

    const warnMessages = logger.warnLogs
      .map((entry) => entry.message)
      .filter((message) => message.startsWith('RoundManager.startRound()'));

    expect(warnMessages).toEqual(
      expect.arrayContaining([
        'RoundManager.startRound(): Duplicate initiative entry for entity id "actor1" after normalisation. Using latest value.',
        'RoundManager.startRound(): Ignoring initiative entry with non-string entity id from Map input.',
        'RoundManager.startRound(): Ignoring initiative entry with blank entity id from Map input after trimming whitespace.',
        'RoundManager.startRound(): Ignoring initiative entry with missing score.',
        'RoundManager.startRound(): Ignoring initiative entry with non-numeric score.',
        'RoundManager.startRound(): Ignoring initiative entry with empty string score.',
      ])
    );

    const first = turnOrderService.getNextEntity();
    const second = turnOrderService.getNextEntity();

    expect(first?.id).toBe('actor2');
    expect(second?.id).toBe('actor1');
  });

  it('falls back to the initiative strategy when unknown strategy and object initiative data are provided', async () => {
    entityManager.setEntities([createActor('alpha'), createActor('beta')]);

    const rawObject = {
      alpha: '5',
      ' beta ': '9',
      gamma: '',
    };

    await roundManager.startRound({
      strategy: ' Mystery ',
      initiativeData: rawObject,
    });

    const warnMessages = logger.warnLogs
      .map((entry) => entry.message)
      .filter((message) => message.startsWith('RoundManager.startRound(): Unknown strategy'));

    expect(warnMessages).toContain(
      "RoundManager.startRound(): Unknown strategy 'mystery'. Falling back to 'initiative' because initiative data was provided."
    );

    expect(
      logger.debugLogs.some((entry) =>
        entry.message.includes(
          'RoundManager.startRound(): Normalised plain object initiative data into Map for initiative round.'
        )
      )
    ).toBe(true);

    const next = turnOrderService.peekNextEntity();
    expect(next?.id).toBe('beta');
  });

  it('falls back to round-robin when unknown strategy is provided without usable initiative data', async () => {
    entityManager.setEntities([createActor('actor1'), createActor('actor2')]);

    await roundManager.startRound('mystery', []);

    const warnMessages = logger.warnLogs
      .map((entry) => entry.message)
      .filter((message) => message.startsWith('RoundManager.startRound(): Unknown strategy'));

    expect(warnMessages).toContain(
      "RoundManager.startRound(): Unknown strategy 'mystery'. Falling back to 'round-robin'."
    );

    const first = turnOrderService.getNextEntity();
    const second = turnOrderService.getNextEntity();

    expect(first?.id).toBe('actor1');
    expect(second?.id).toBe('actor2');
  });

  it('normalises initiative arrays and surfaces data issues before starting the round', async () => {
    entityManager.setEntities([
      createActor('actorA'),
      createActor('actorB'),
      createActor('actorC'),
      createActor('actorD'),
      createActor('actorE'),
      createActor('actorF'),
    ]);

    const rawArray = [
      ['actorA', '10'],
      'bad entry',
      ['actorB'],
      ['actorC', null],
      [{ id: 'actorD' }, 5],
      ['  ', 4],
      ['actorE', {}],
      ['actorF', ''],
      ['actorA', 15],
    ];

    await roundManager.startRound('initiative', rawArray);

    const warnMessages = logger.warnLogs
      .map((entry) => entry.message)
      .filter((message) => message.startsWith('RoundManager.startRound()'));

    expect(warnMessages).toEqual(
      expect.arrayContaining([
        'RoundManager.startRound(): Ignoring malformed initiative entry from array input.',
        'RoundManager.startRound(): Ignoring initiative entry with missing score.',
        'RoundManager.startRound(): Ignoring initiative entry with non-string entity id from array input.',
        'RoundManager.startRound(): Ignoring initiative entry with blank entity id from array input after trimming whitespace.',
        'RoundManager.startRound(): Ignoring initiative entry with non-numeric score.',
        'RoundManager.startRound(): Ignoring initiative entry with empty string score.',
        'RoundManager.startRound(): Duplicate initiative entry for entity id "actorA" after normalisation. Using latest value.',
      ])
    );

    const next = turnOrderService.getNextEntity();
    expect(next?.id).toBe('actorA');
  });

  it('rejects initiative rounds when normalisation produces no usable entries', async () => {
    entityManager.setEntities([createActor('actor1')]);

    await expect(roundManager.startRound('initiative', new Map())).rejects.toThrow(
      'Cannot start an initiative round: initiativeData Map is required.'
    );

    expect(
      logger.errorLogs.some((entry) =>
        entry.message.includes('Cannot start an initiative round: initiativeData Map is required.')
      )
    ).toBe(true);
  });

  it('rejects rounds when there are no active actor entities', async () => {
    entityManager.setEntities([{ id: 'noActor', components: {} }]);

    await expect(roundManager.startRound()).rejects.toThrow(
      'Cannot start a new round: No active entities with an Actor component found.'
    );

    expect(
      logger.errorLogs.some((entry) =>
        entry.message.includes('Cannot start a new round: No active entities with an Actor component found.')
      )
    ).toBe(true);
  });

  it('exposes lifecycle flags that reflect round progress', async () => {
    entityManager.setEntities([createActor('actor1'), createActor('actor2')]);

    await roundManager.startRound(42);

    expect(roundManager.inProgress).toBe(true);
    expect(roundManager.hadSuccess).toBe(false);

    roundManager.endTurn(true);
    expect(roundManager.hadSuccess).toBe(true);

    roundManager.resetFlags();
    expect(roundManager.inProgress).toBe(false);
    expect(roundManager.hadSuccess).toBe(false);
  });
});
