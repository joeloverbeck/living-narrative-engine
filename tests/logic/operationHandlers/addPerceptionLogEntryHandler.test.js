/**
 * @jest-environment node
 */
/**
 * @file Tests the behavior of AddPerceptionLogEntryHandler.js
 * @see tests/logic/operationHandlers/addPerceptionLogEntryHandler.tests.js
 */

import {
  describe,
  it,
  test,
  expect,
  jest,
  beforeEach,
  afterEach,
} from '@jest/globals';

// ─── Function Under Test ──────────────────────────────────────────────────────
import AddPerceptionLogEntryHandler from '../../../src/logic/operationHandlers/addPerceptionLogEntryHandler.js';
import { PERCEPTION_LOG_COMPONENT_ID } from '../../../src/constants/componentIds.js';
import { DISPLAY_ERROR_ID } from '../../../src/constants/eventIds.js';

// ─── JSDoc Types (optional) ───────────────────────────────────────────────────
/** @typedef {import('../../src/interfaces/coreServices.js').ILogger}  ILogger */
/** @typedef {import('../../src/entities/entityManager.js').default}   IEntityManager */

// ─── Helpers ──────────────────────────────────────────────────────────────────
const DEFAULT_MAX_LOG_ENTRIES = 50;

/**
 * Produce a minimally-valid log entry object.
 *
 * @param {string} [id]
 */
const makeEntry = (id = '1') => ({
  descriptionText: `Event-${id}`,
  timestamp: new Date().toISOString(),
  perceptionType: 'unit_test',
  actorId: `actor:npc_${id}`,
  targetId: `item:scroll_${id}`,
  involvedEntities: [`actor:player`, `env:trap_${id}`],
  eventId: `ut_${Date.now()}_${id}`,
});

// ─── Test Doubles ─────────────────────────────────────────────────────────────
/** @type {jest.Mocked<ILogger>}         */ let log;
/** @type {jest.Mocked<IEntityManager>}  */ let em;
/** @type {{ dispatch: jest.Mock }}      */ let dispatcher;

beforeEach(() => {
  log = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };

  em = {
    getEntitiesInLocation: jest.fn(),
    hasComponent: jest.fn(),
    getComponentData: jest.fn(),
    addComponent: jest.fn(),

    // Extraneous methods that might be called in future: keep stubbed
    getEntityInstance: jest.fn(),
    createEntityInstance: jest.fn(),
    getEntitiesWithComponent: jest.fn(),
    removeComponent: jest.fn(),
  };
  dispatcher = { dispatch: jest.fn().mockResolvedValue(true) };
});

afterEach(() => jest.clearAllMocks());

// ─── Suite ────────────────────────────────────────────────────────────────────
describe('AddPerceptionLogEntryHandler', () => {
  // ── Constructor ────────────────────────────────────────────────────────────
  describe('constructor', () => {
    test('creates an instance when dependencies are valid', () => {
      const h = new AddPerceptionLogEntryHandler({
        logger: log,
        entityManager: em,
        safeEventDispatcher: dispatcher,
      });
      expect(h).toBeInstanceOf(AddPerceptionLogEntryHandler);
    });

    test('throws if logger is missing or incomplete', () => {
      expect(
        () => new AddPerceptionLogEntryHandler({ entityManager: em })
      ).toThrow(/ILogger/);
      expect(
        () =>
          new AddPerceptionLogEntryHandler({ logger: {}, entityManager: em })
      ).toThrow(/ILogger/);
    });

    test('throws if entityManager is missing or incomplete', () => {
      expect(() => new AddPerceptionLogEntryHandler({ logger: log })).toThrow(
        /IEntityManager/
      );
      expect(
        () =>
          new AddPerceptionLogEntryHandler({ logger: log, entityManager: {} })
      ).toThrow(/IEntityManager/);
    });

    test('throws if safeEventDispatcher is missing or invalid', () => {
      expect(
        () =>
          new AddPerceptionLogEntryHandler({
            logger: log,
            entityManager: em,
          })
      ).toThrow(/ISafeEventDispatcher/);
      expect(
        () =>
          new AddPerceptionLogEntryHandler({
            logger: log,
            entityManager: em,
            safeEventDispatcher: {},
          })
      ).toThrow(/ISafeEventDispatcher/);
    });
  });

  // ── Parameter-validation ───────────────────────────────────────────────────
  describe('execute – parameter validation', () => {
    /** @type {AddPerceptionLogEntryHandler} */ let h;
    beforeEach(() => {
      h = new AddPerceptionLogEntryHandler({
        logger: log,
        entityManager: em,
        safeEventDispatcher: dispatcher,
      });
    });

    test('dispatches error and bails when params object is missing/invalid', () => {
      [null, undefined, 42, 'str'].forEach((bad) => {
        h.execute(/** @type {any} */ (bad));
        expect(dispatcher.dispatch).toHaveBeenLastCalledWith(
          DISPLAY_ERROR_ID,
          expect.objectContaining({
            message: 'ADD_PERCEPTION_LOG_ENTRY: params missing or invalid.',
          })
        );
      });
      expect(em.addComponent).not.toHaveBeenCalled();
    });

    test('dispatches error when location_id is missing/blank', () => {
      [null, undefined, '', '   ', 123].forEach((loc) => {
        h.execute({
          location_id: /** @type {any} */ (loc),
          entry: makeEntry(),
        });
        expect(dispatcher.dispatch).toHaveBeenLastCalledWith(
          DISPLAY_ERROR_ID,
          expect.objectContaining({
            message: 'ADD_PERCEPTION_LOG_ENTRY: location_id is required',
          })
        );
      });
      expect(em.addComponent).not.toHaveBeenCalled();
    });

    test('dispatches error when entry is missing/invalid', () => {
      [null, undefined, 999, 'bad'].forEach((ent) => {
        h.execute({ location_id: 'loc:test', entry: /** @type {any} */ (ent) });
        expect(dispatcher.dispatch).toHaveBeenLastCalledWith(
          DISPLAY_ERROR_ID,
          expect.objectContaining({
            message: 'ADD_PERCEPTION_LOG_ENTRY: entry object is required',
          })
        );
      });
      expect(em.addComponent).not.toHaveBeenCalled();
    });
  });

  // ── Entity discovery & basic flow ──────────────────────────────────────────
  describe('execute – entity querying & basic updates', () => {
    const LOC = 'loc:test_area';
    const NPC1 = 'npc:one';
    const NPC2 = 'npc:two';
    const ROCK = 'item:rock';

    /** @type {AddPerceptionLogEntryHandler} */ let h;
    beforeEach(() => {
      h = new AddPerceptionLogEntryHandler({
        logger: log,
        entityManager: em,
        safeEventDispatcher: dispatcher,
      });
    });

    test('does nothing when location has no entities', () => {
      em.getEntitiesInLocation.mockReturnValue(new Set());
      h.execute({ location_id: LOC, entry: makeEntry('e0') });

      expect(em.hasComponent).not.toHaveBeenCalled();
      expect(em.addComponent).not.toHaveBeenCalled();
      expect(log.debug).toHaveBeenCalledWith(
        `ADD_PERCEPTION_LOG_ENTRY: No entities in location ${LOC}`
      );
    });

    test('does nothing when no entities have perception log component', () => {
      em.getEntitiesInLocation.mockReturnValue(new Set([ROCK]));
      em.hasComponent.mockReturnValue(false);

      h.execute({ location_id: LOC, entry: makeEntry('e1') });

      expect(em.hasComponent).toHaveBeenCalledWith(
        ROCK,
        PERCEPTION_LOG_COMPONENT_ID
      );
      expect(em.addComponent).not.toHaveBeenCalled();
    });

    test('initialises a log for perceiver lacking component data', () => {
      const entry = makeEntry('init');
      em.getEntitiesInLocation.mockReturnValue(new Set([NPC1]));
      em.hasComponent.mockReturnValue(true);
      em.getComponentData.mockReturnValue(null);
      em.addComponent.mockReturnValue(true);

      h.execute({ location_id: LOC, entry });

      expect(em.addComponent).toHaveBeenCalledWith(
        NPC1,
        PERCEPTION_LOG_COMPONENT_ID,
        { maxEntries: DEFAULT_MAX_LOG_ENTRIES, logEntries: [entry] }
      );
    });

    test('appends to existing perception log', () => {
      const oldEntry = makeEntry('old');
      const newEntry = makeEntry('new');
      em.getEntitiesInLocation.mockReturnValue(new Set([NPC1]));
      em.hasComponent.mockReturnValue(true);
      em.getComponentData.mockReturnValue({
        maxEntries: DEFAULT_MAX_LOG_ENTRIES,
        logEntries: [oldEntry],
      });
      em.addComponent.mockReturnValue(true);

      h.execute({ location_id: LOC, entry: newEntry });

      expect(em.addComponent).toHaveBeenCalledWith(
        NPC1,
        PERCEPTION_LOG_COMPONENT_ID,
        {
          maxEntries: DEFAULT_MAX_LOG_ENTRIES,
          logEntries: [oldEntry, newEntry],
        }
      );
    });

    test('updates multiple perceivers and skips non-perceivers', () => {
      const entry = makeEntry('multi');
      em.getEntitiesInLocation.mockReturnValue(new Set([NPC1, ROCK, NPC2]));
      em.hasComponent.mockImplementation(
        (id, comp) =>
          comp === PERCEPTION_LOG_COMPONENT_ID && (id === NPC1 || id === NPC2)
      );
      em.getComponentData.mockReturnValue({ maxEntries: 10, logEntries: [] });
      em.addComponent.mockReturnValue(true);

      h.execute({ location_id: LOC, entry });

      expect(em.addComponent).toHaveBeenCalledTimes(2);
      expect(
        em.addComponent.mock.calls.every(
          ([id, , data]) =>
            data.logEntries.length === 1 && data.logEntries[0] === entry
        )
      ).toBe(true);

      expect(log.debug).toHaveBeenCalledWith(
        `ADD_PERCEPTION_LOG_ENTRY: wrote entry to 2/3 perceivers in ${LOC}`
      );
    });
  });

  // ── Log size & trimming edge-cases ─────────────────────────────────────────
  describe('execute – log size & trimming', () => {
    const LOC = 'loc:trim';
    const NPC = 'npc:solo';
    /** @type {AddPerceptionLogEntryHandler} */ let h;

    beforeEach(() => {
      h = new AddPerceptionLogEntryHandler({
        logger: log,
        entityManager: em,
        safeEventDispatcher: dispatcher,
      });
      em.getEntitiesInLocation.mockReturnValue(new Set([NPC]));
      em.hasComponent.mockReturnValue(true);
    });

    it('honours maxEntries = 1 (keeps only most-recent entry)', () => {
      const first = makeEntry('one');
      first.eventId = 'first';
      const second = makeEntry('two');
      second.eventId = 'second';

      // First write – empty log
      em.getComponentData.mockReturnValueOnce({
        maxEntries: 1,
        logEntries: [],
      });
      h.execute({ location_id: LOC, entry: first });

      // Second write – log already holding `first`
      em.getComponentData.mockReturnValueOnce({
        maxEntries: 1,
        logEntries: [first],
      });
      h.execute({ location_id: LOC, entry: second });

      // 2 calls total
      expect(em.addComponent).toHaveBeenCalledTimes(2);
      const [, , payload] = em.addComponent.mock.calls[1];
      expect(payload.logEntries).toEqual([second]);
    });

    it('appends without trimming when under maxEntries', () => {
      const existing = [makeEntry('a'), makeEntry('b')];
      const fresh = makeEntry('c');

      em.getComponentData.mockReturnValue({
        maxEntries: 5,
        logEntries: [...existing],
      });
      h.execute({ location_id: LOC, entry: fresh });

      const [, , payload] = em.addComponent.mock.calls[0];
      expect(payload.logEntries).toEqual([...existing, fresh]);
    });

    it('trims oldest when exceeding maxEntries', () => {
      const max = 3;
      const initial = [makeEntry('old1'), makeEntry('old2'), makeEntry('old3')];
      const newest = makeEntry('new');

      em.getComponentData.mockReturnValue({
        maxEntries: max,
        logEntries: [...initial],
      });
      h.execute({ location_id: LOC, entry: newest });

      const [, , payload] = em.addComponent.mock.calls[0];
      expect(payload.logEntries.length).toBe(max);
      expect(payload.logEntries.map((e) => e.eventId)).toEqual([
        initial[1].eventId,
        initial[2].eventId,
        newest.eventId,
      ]);
    });

    it('recovers when stored logEntries is not an array', () => {
      const corrupt = /** @type {any} */ ('not-array');
      const entry = makeEntry('fix');

      em.getComponentData.mockReturnValue({
        maxEntries: 5,
        logEntries: corrupt,
      });
      h.execute({ location_id: LOC, entry });

      const [, , payload] = em.addComponent.mock.calls[0];
      expect(payload.logEntries).toEqual([entry]);
    });

    it('defaults maxEntries to 50 when stored value is invalid', () => {
      const badVals = [0, -3, null, undefined, 'bad'];
      const entry = makeEntry('default');

      badVals.forEach((bad) => {
        em.addComponent.mockClear();
        em.getComponentData.mockReturnValueOnce({
          maxEntries: /** @type {any} */ (bad),
          logEntries: [],
        });

        h.execute({ location_id: LOC, entry });
        const [, , payload] = em.addComponent.mock.calls[0];

        expect(payload.maxEntries).toBe(DEFAULT_MAX_LOG_ENTRIES);
        expect(payload.logEntries).toEqual([entry]);
      });
    });
  });
});
