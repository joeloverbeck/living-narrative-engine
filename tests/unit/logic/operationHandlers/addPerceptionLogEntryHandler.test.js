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
import AddPerceptionLogEntryHandler from '../../../../src/logic/operationHandlers/addPerceptionLogEntryHandler.js';
import { PERCEPTION_LOG_COMPONENT_ID } from '../../../../src/constants/componentIds.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../../src/constants/eventIds.js';

// ─── JSDoc Types (optional) ───────────────────────────────────────────────────
/** @typedef {import('../../src/interfaces/coreServices.js').ILogger}  ILogger */
/** @typedef {import('../../src/entities/entityManager.js').default}   IEntityManager */

// ─── Helpers ──────────────────────────────────────────────────────────────────
const DEFAULT_MAX_LOG_ENTRIES = 50;

const makeRoutingPolicyService = () => ({
  validateAndHandle: jest.fn().mockReturnValue(true),
});

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
/** @type {{ validateAndHandle: jest.Mock }} */ let routingPolicyService;

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
  routingPolicyService = makeRoutingPolicyService();
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
        routingPolicyService,
      });
      expect(h).toBeInstanceOf(AddPerceptionLogEntryHandler);
    });

    test('throws if logger is missing or incomplete', () => {
      expect(
        () => new AddPerceptionLogEntryHandler({ entityManager: em, routingPolicyService })
      ).toThrow(/logger/);
      expect(
        () =>
          new AddPerceptionLogEntryHandler({ logger: {}, entityManager: em, routingPolicyService })
      ).toThrow(/logger/);
    });

    test('throws if entityManager is missing or incomplete', () => {
      expect(() => new AddPerceptionLogEntryHandler({ logger: log, routingPolicyService })).toThrow(
        /entityManager/
      );
      expect(
        () =>
          new AddPerceptionLogEntryHandler({ logger: log, entityManager: {}, routingPolicyService })
      ).toThrow(/entityManager/);
    });

    test('throws if safeEventDispatcher is missing or invalid', () => {
      expect(
        () =>
          new AddPerceptionLogEntryHandler({
            logger: log,
            entityManager: em,
            routingPolicyService,
          })
      ).toThrow(/safeEventDispatcher/);
      expect(
        () =>
          new AddPerceptionLogEntryHandler({
            logger: log,
            entityManager: em,
            safeEventDispatcher: {},
            routingPolicyService,
          })
      ).toThrow(/safeEventDispatcher/);
    });

    test('throws if routingPolicyService is missing or invalid', () => {
      expect(
        () =>
          new AddPerceptionLogEntryHandler({
            logger: log,
            entityManager: em,
            safeEventDispatcher: dispatcher,
          })
      ).toThrow(/IRecipientRoutingPolicyService/);
      expect(
        () =>
          new AddPerceptionLogEntryHandler({
            logger: log,
            entityManager: em,
            safeEventDispatcher: dispatcher,
            routingPolicyService: {},
          })
      ).toThrow(/IRecipientRoutingPolicyService/);
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
        routingPolicyService,
      });
    });

    test('dispatches error and bails when params object is missing/invalid', async () => {
      for (const bad of [null, undefined, 42, 'str']) {
        await h.execute(/** @type {any} */ (bad));
        expect(dispatcher.dispatch).toHaveBeenLastCalledWith(
          SYSTEM_ERROR_OCCURRED_ID,
          expect.objectContaining({
            message: 'ADD_PERCEPTION_LOG_ENTRY: params missing or invalid.',
          })
        );
      }
      expect(em.addComponent).not.toHaveBeenCalled();
    });

    test('dispatches error when location_id is missing/blank', async () => {
      for (const loc of [null, undefined, '', '   ', 123]) {
        await h.execute({
          location_id: /** @type {any} */ (loc),
          entry: makeEntry(),
        });
        expect(dispatcher.dispatch).toHaveBeenLastCalledWith(
          SYSTEM_ERROR_OCCURRED_ID,
          expect.objectContaining({
            message: 'ADD_PERCEPTION_LOG_ENTRY: location_id is required',
          })
        );
      }
      expect(em.addComponent).not.toHaveBeenCalled();
    });

    test('dispatches error when entry is missing/invalid', async () => {
      for (const ent of [null, undefined, 999, 'bad']) {
        await h.execute({
          location_id: 'loc:test',
          entry: /** @type {any} */ (ent),
        });
        expect(dispatcher.dispatch).toHaveBeenLastCalledWith(
          SYSTEM_ERROR_OCCURRED_ID,
          expect.objectContaining({
            message: 'ADD_PERCEPTION_LOG_ENTRY: entry object is required',
          })
        );
      }
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
        routingPolicyService,
      });
    });

    test('does nothing when location has no entities', async () => {
      em.getEntitiesInLocation.mockReturnValue(new Set());
      await h.execute({ location_id: LOC, entry: makeEntry('e0') });

      expect(em.hasComponent).not.toHaveBeenCalled();
      expect(em.addComponent).not.toHaveBeenCalled();
      expect(log.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          `ADD_PERCEPTION_LOG_ENTRY: No entities in location ${LOC}`
        )
      );
    });

    test('does nothing when no entities have perception log component', async () => {
      em.getEntitiesInLocation.mockReturnValue(new Set([ROCK]));
      em.hasComponent.mockReturnValue(false);

      await h.execute({ location_id: LOC, entry: makeEntry('e1') });

      expect(em.hasComponent).toHaveBeenCalledWith(
        ROCK,
        PERCEPTION_LOG_COMPONENT_ID
      );
      expect(em.addComponent).not.toHaveBeenCalled();
    });

    test('initialises a log for perceiver lacking component data', async () => {
      const entry = makeEntry('init');
      em.getEntitiesInLocation.mockReturnValue(new Set([NPC1]));
      em.hasComponent.mockReturnValue(true);
      em.getComponentData.mockReturnValue(null);
      em.addComponent.mockReturnValue(true);

      await h.execute({ location_id: LOC, entry });

      expect(em.addComponent).toHaveBeenCalledWith(
        NPC1,
        PERCEPTION_LOG_COMPONENT_ID,
        { maxEntries: DEFAULT_MAX_LOG_ENTRIES, logEntries: [entry] }
      );
    });

    test('appends to existing perception log', async () => {
      const oldEntry = makeEntry('old');
      const newEntry = makeEntry('new');
      em.getEntitiesInLocation.mockReturnValue(new Set([NPC1]));
      em.hasComponent.mockReturnValue(true);
      em.getComponentData.mockReturnValue({
        maxEntries: DEFAULT_MAX_LOG_ENTRIES,
        logEntries: [oldEntry],
      });
      em.addComponent.mockReturnValue(true);

      await h.execute({ location_id: LOC, entry: newEntry });

      expect(em.addComponent).toHaveBeenCalledWith(
        NPC1,
        PERCEPTION_LOG_COMPONENT_ID,
        {
          maxEntries: DEFAULT_MAX_LOG_ENTRIES,
          logEntries: [oldEntry, newEntry],
        }
      );
    });

    test('updates multiple perceivers and skips non-perceivers', async () => {
      const entry = makeEntry('multi');
      em.getEntitiesInLocation.mockReturnValue(new Set([NPC1, ROCK, NPC2]));
      em.hasComponent.mockImplementation(
        (id, comp) =>
          comp === PERCEPTION_LOG_COMPONENT_ID && (id === NPC1 || id === NPC2)
      );
      em.getComponentData.mockReturnValue({ maxEntries: 10, logEntries: [] });
      em.addComponent.mockReturnValue(true);

      await h.execute({ location_id: LOC, entry });

      expect(em.addComponent).toHaveBeenCalledTimes(2);
      expect(
        em.addComponent.mock.calls.every(
          ([id, , data]) =>
            data.logEntries.length === 1 && data.logEntries[0] === entry
        )
      ).toBe(true);

      expect(log.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          `ADD_PERCEPTION_LOG_ENTRY: wrote entry to 2/3 perceivers in ${LOC}`
        )
      );
    });

    test('restricts updates to explicit recipient list when array provided', async () => {
      const entry = makeEntry('targeted-array');
      const targeted = [NPC2];

      em.hasComponent.mockImplementation(
        (id, comp) => comp === PERCEPTION_LOG_COMPONENT_ID && id === NPC2
      );
      em.getComponentData.mockReturnValue({ maxEntries: 5, logEntries: [] });
      em.addComponent.mockResolvedValue(true);

      await h.execute({
        location_id: LOC,
        entry,
        recipient_ids: targeted,
      });

      expect(em.getEntitiesInLocation).not.toHaveBeenCalled();
      expect(em.hasComponent).toHaveBeenCalledTimes(1);
      expect(em.hasComponent).toHaveBeenCalledWith(
        NPC2,
        PERCEPTION_LOG_COMPONENT_ID
      );
      expect(em.addComponent).toHaveBeenCalledTimes(1);
      expect(em.addComponent).toHaveBeenCalledWith(
        NPC2,
        PERCEPTION_LOG_COMPONENT_ID,
        { maxEntries: 5, logEntries: [entry] }
      );
      expect(log.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          'ADD_PERCEPTION_LOG_ENTRY: wrote entry to 1/1 perceivers (targeted)'
        )
      );
    });

    test('accepts single recipient strings by normalising to targeted list', async () => {
      const entry = makeEntry('targeted-string');

      em.hasComponent.mockImplementation(
        (id, comp) => comp === PERCEPTION_LOG_COMPONENT_ID && id === NPC1
      );
      em.getComponentData.mockReturnValue({ maxEntries: 3, logEntries: [] });
      em.addComponent.mockResolvedValue(true);

      await h.execute({
        location_id: LOC,
        entry,
        recipient_ids: `  ${NPC1}  `,
      });

      expect(em.getEntitiesInLocation).not.toHaveBeenCalled();
      expect(em.hasComponent).toHaveBeenCalledTimes(1);
      expect(em.hasComponent).toHaveBeenCalledWith(
        NPC1,
        PERCEPTION_LOG_COMPONENT_ID
      );
      expect(em.addComponent).toHaveBeenCalledTimes(1);
      expect(em.addComponent).toHaveBeenCalledWith(
        NPC1,
        PERCEPTION_LOG_COMPONENT_ID,
        { maxEntries: 3, logEntries: [entry] }
      );
      expect(log.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          'ADD_PERCEPTION_LOG_ENTRY: wrote entry to 1/1 perceivers (targeted)'
        )
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
        routingPolicyService,
      });
      em.getEntitiesInLocation.mockReturnValue(new Set([NPC]));
      em.hasComponent.mockReturnValue(true);
    });

    it('honours maxEntries = 1 (keeps only most-recent entry)', async () => {
      const first = makeEntry('one');
      first.eventId = 'first';
      const second = makeEntry('two');
      second.eventId = 'second';

      // First write – empty log
      em.getComponentData.mockReturnValueOnce({
        maxEntries: 1,
        logEntries: [],
      });
      await h.execute({ location_id: LOC, entry: first });

      // Second write – log already holding `first`
      em.getComponentData.mockReturnValueOnce({
        maxEntries: 1,
        logEntries: [first],
      });
      await h.execute({ location_id: LOC, entry: second });

      // 2 calls total
      expect(em.addComponent).toHaveBeenCalledTimes(2);
      const [, , payload] = em.addComponent.mock.calls[1];
      expect(payload.logEntries).toEqual([second]);
    });

    it('appends without trimming when under maxEntries', async () => {
      const existing = [makeEntry('a'), makeEntry('b')];
      const fresh = makeEntry('c');

      em.getComponentData.mockReturnValue({
        maxEntries: 5,
        logEntries: [...existing],
      });
      await h.execute({ location_id: LOC, entry: fresh });

      const [, , payload] = em.addComponent.mock.calls[0];
      expect(payload.logEntries).toEqual([...existing, fresh]);
    });

    it('trims oldest when exceeding maxEntries', async () => {
      const max = 3;
      const initial = [makeEntry('old1'), makeEntry('old2'), makeEntry('old3')];
      const newest = makeEntry('new');

      em.getComponentData.mockReturnValue({
        maxEntries: max,
        logEntries: [...initial],
      });
      await h.execute({ location_id: LOC, entry: newest });

      const [, , payload] = em.addComponent.mock.calls[0];
      expect(payload.logEntries.length).toBe(max);
      expect(payload.logEntries.map((e) => e.eventId)).toEqual([
        initial[1].eventId,
        initial[2].eventId,
        newest.eventId,
      ]);
    });

    it('recovers when stored logEntries is not an array', async () => {
      const corrupt = /** @type {any} */ ('not-array');
      const entry = makeEntry('fix');

      em.getComponentData.mockReturnValue({
        maxEntries: 5,
        logEntries: corrupt,
      });
      await h.execute({ location_id: LOC, entry });

      const [, , payload] = em.addComponent.mock.calls[0];
      expect(payload.logEntries).toEqual([entry]);
    });

    it('defaults maxEntries to 50 when stored value is invalid', async () => {
      const badVals = [0, -3, null, undefined, 'bad'];
      const entry = makeEntry('default');

      for (const bad of badVals) {
        em.addComponent.mockClear();
        em.getComponentData.mockReturnValueOnce({
          maxEntries: /** @type {any} */ (bad),
          logEntries: [],
        });

        await h.execute({ location_id: LOC, entry });
        const [, , payload] = em.addComponent.mock.calls[0];

        expect(payload.maxEntries).toBe(DEFAULT_MAX_LOG_ENTRIES);
        expect(payload.logEntries).toEqual([entry]);
      }
    });
  });

  // ── Batch update optimization & error handling ─────────────────────────────
  describe('execute – batch update optimization', () => {
    const LOC = 'loc:batch_test';
    const NPC1 = 'npc:batch_one';
    const NPC2 = 'npc:batch_two';
    const NPC3 = 'npc:batch_three';

    /** @type {AddPerceptionLogEntryHandler} */ let h;

    beforeEach(() => {
      h = new AddPerceptionLogEntryHandler({
        logger: log,
        entityManager: em,
        safeEventDispatcher: dispatcher,
        routingPolicyService,
      });
    });

    test('uses optimized batch update when method exists', async () => {
      const entry = makeEntry('batch_opt');
      em.getEntitiesInLocation.mockReturnValue(new Set([NPC1, NPC2]));
      em.hasComponent.mockReturnValue(true);
      em.getComponentData.mockReturnValue({ maxEntries: 10, logEntries: [] });

      // Mock the optimized batch method
      em.batchAddComponentsOptimized = jest.fn().mockResolvedValue({
        updateCount: 2,
        errors: [],
      });

      await h.execute({ location_id: LOC, entry });

      // Verify optimized method was called
      expect(em.batchAddComponentsOptimized).toHaveBeenCalledWith(
        [
          {
            instanceId: NPC1,
            componentTypeId: PERCEPTION_LOG_COMPONENT_ID,
            componentData: { maxEntries: 10, logEntries: [entry] },
          },
          {
            instanceId: NPC2,
            componentTypeId: PERCEPTION_LOG_COMPONENT_ID,
            componentData: { maxEntries: 10, logEntries: [entry] },
          },
        ],
        true
      );

      // Regular addComponent should not be called
      expect(em.addComponent).not.toHaveBeenCalled();

      expect(log.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          'wrote entry to 2/2 perceivers in loc:batch_test (batch mode)'
        )
      );
    });

    test('handles partial errors from optimized batch update', async () => {
      const entry = makeEntry('batch_partial');
      em.getEntitiesInLocation.mockReturnValue(new Set([NPC1, NPC2, NPC3]));
      em.hasComponent.mockReturnValue(true);
      em.getComponentData.mockReturnValue({ maxEntries: 5, logEntries: [] });

      // Mock optimized batch with some errors
      em.batchAddComponentsOptimized = jest.fn().mockResolvedValue({
        updateCount: 2,
        errors: [
          {
            spec: {
              instanceId: NPC2,
              componentTypeId: PERCEPTION_LOG_COMPONENT_ID,
            },
            error: new Error('Update failed for NPC2'),
          },
        ],
      });

      await h.execute({ location_id: LOC, entry });

      expect(em.batchAddComponentsOptimized).toHaveBeenCalled();

      // Should dispatch error for the failed update
      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        expect.objectContaining({
          message: expect.stringContaining('failed to update npc:batch_two'),
        })
      );

      expect(log.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          'wrote entry to 2/3 perceivers in loc:batch_test (batch mode)'
        )
      );
    });

    test('falls back to individual updates when optimized method does not exist', async () => {
      const entry = makeEntry('fallback');
      em.getEntitiesInLocation.mockReturnValue(new Set([NPC1, NPC2]));
      em.hasComponent.mockReturnValue(true);
      em.getComponentData.mockReturnValue({ maxEntries: 10, logEntries: [] });

      // Don't mock batchAddComponentsOptimized - it doesn't exist
      delete em.batchAddComponentsOptimized;
      em.addComponent.mockResolvedValue(true);

      await h.execute({ location_id: LOC, entry });

      // Should use regular addComponent
      expect(em.addComponent).toHaveBeenCalledTimes(2);
      expect(em.addComponent).toHaveBeenCalledWith(
        NPC1,
        PERCEPTION_LOG_COMPONENT_ID,
        { maxEntries: 10, logEntries: [entry] }
      );
      expect(em.addComponent).toHaveBeenCalledWith(
        NPC2,
        PERCEPTION_LOG_COMPONENT_ID,
        { maxEntries: 10, logEntries: [entry] }
      );

      expect(log.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          'wrote entry to 2/2 perceivers in loc:batch_test'
        )
      );
      expect(log.debug).not.toHaveBeenCalledWith(
        expect.stringContaining('(batch mode)')
      );
    });

    test('handles individual update errors in fallback path', async () => {
      const entry = makeEntry('fallback_err');
      em.getEntitiesInLocation.mockReturnValue(new Set([NPC1, NPC2, NPC3]));
      em.hasComponent.mockReturnValue(true);
      em.getComponentData.mockReturnValue({ maxEntries: 10, logEntries: [] });

      // No optimized method
      delete em.batchAddComponentsOptimized;

      // Make NPC2 fail
      em.addComponent.mockImplementation(async (id) => {
        if (id === NPC2) {
          throw new Error('Cannot update NPC2');
        }
        return true;
      });

      await h.execute({ location_id: LOC, entry });

      expect(em.addComponent).toHaveBeenCalledTimes(3);

      // Should dispatch error for failed update
      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        expect.objectContaining({
          message: expect.stringContaining('failed to update npc:batch_two'),
        })
      );

      // Should report partial success
      expect(log.debug).toHaveBeenCalledWith(
        expect.stringContaining('wrote entry to 2/3 perceivers')
      );
    });

    test('recovers from complete batch update failure', async () => {
      const entry = makeEntry('batch_fail');
      em.getEntitiesInLocation.mockReturnValue(new Set([NPC1, NPC2]));
      em.hasComponent.mockReturnValue(true);
      em.getComponentData.mockReturnValue({ maxEntries: 10, logEntries: [] });

      // Mock optimized batch to throw error
      em.batchAddComponentsOptimized = jest
        .fn()
        .mockRejectedValue(new Error('Batch operation failed'));

      // Individual updates should succeed
      em.addComponent.mockResolvedValue(true);

      await h.execute({ location_id: LOC, entry });

      // Should try batch first
      expect(em.batchAddComponentsOptimized).toHaveBeenCalled();

      // Should log the batch failure
      expect(log.error).toHaveBeenCalledWith(
        'AddPerceptionLogEntryHandler: ADD_PERCEPTION_LOG_ENTRY: Batch update failed',
        expect.any(Error)
      );

      // Should fall back to individual updates
      expect(em.addComponent).toHaveBeenCalledTimes(2);

      expect(log.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          'wrote entry to 2/2 perceivers in loc:batch_test (fallback mode)'
        )
      );
    });

    test('handles partial failures in recovery path after batch failure', async () => {
      const entry = makeEntry('recovery_partial');
      em.getEntitiesInLocation.mockReturnValue(new Set([NPC1, NPC2, NPC3]));
      em.hasComponent.mockReturnValue(true);
      em.getComponentData.mockReturnValue({ maxEntries: 10, logEntries: [] });

      // Batch update fails completely
      em.batchAddComponentsOptimized = jest
        .fn()
        .mockRejectedValue(new Error('Batch failed'));

      // Some individual updates also fail in recovery
      em.addComponent.mockImplementation(async (id) => {
        if (id === NPC2) {
          throw new Error('Recovery also failed for NPC2');
        }
        return true;
      });

      await h.execute({ location_id: LOC, entry });

      expect(em.batchAddComponentsOptimized).toHaveBeenCalled();
      expect(log.error).toHaveBeenCalledWith(
        'AddPerceptionLogEntryHandler: ADD_PERCEPTION_LOG_ENTRY: Batch update failed',
        expect.any(Error)
      );

      // Should try all individual updates
      expect(em.addComponent).toHaveBeenCalledTimes(3);

      // Should dispatch error for the failed recovery update
      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        expect.objectContaining({
          message: expect.stringContaining('failed to update npc:batch_two'),
        })
      );

      // Should report partial success in fallback mode
      expect(log.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          'wrote entry to 2/3 perceivers in loc:batch_test (fallback mode)'
        )
      );
    });

    test('handles case when all perceivers are skipped in batch update', async () => {
      const entry = makeEntry('no_perceivers');
      const ITEM = 'item:rock';
      em.getEntitiesInLocation.mockReturnValue(new Set([ITEM, NPC1]));

      // Only NPC1 has perception, but we'll make it not have the component
      em.hasComponent.mockImplementation(
        (id, comp) => comp === PERCEPTION_LOG_COMPONENT_ID && false
      );

      await h.execute({ location_id: LOC, entry });

      // No batch update should be attempted
      if (em.batchAddComponentsOptimized) {
        expect(em.batchAddComponentsOptimized).not.toHaveBeenCalled();
      }
      expect(em.addComponent).not.toHaveBeenCalled();

      expect(log.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          'No perceivers found in location loc:batch_test'
        )
      );
    });
  });

  // ── Actor Exclusion ────────────────────────────────────────────────────────
  describe('execute – actor exclusion', () => {
    const LOC = 'loc:exclusion_test';
    const ACTOR_A = 'actor:alpha';
    const ACTOR_B = 'actor:beta';
    const ACTOR_C = 'actor:charlie';

    /** @type {AddPerceptionLogEntryHandler} */ let h;

    beforeEach(() => {
      h = new AddPerceptionLogEntryHandler({
        logger: log,
        entityManager: em,
        safeEventDispatcher: dispatcher,
        routingPolicyService,
      });
    });

    test('should exclude specified actors from location broadcast', async () => {
      const entry = makeEntry('exclude_alpha');
      em.getEntitiesInLocation.mockReturnValue(
        new Set([ACTOR_A, ACTOR_B, ACTOR_C])
      );
      em.hasComponent.mockReturnValue(true);
      em.getComponentData.mockReturnValue({ maxEntries: 10, logEntries: [] });
      em.addComponent.mockResolvedValue(true);

      await h.execute({
        location_id: LOC,
        entry,
        excluded_actor_ids: [ACTOR_A],
      });

      // Should query location entities
      expect(em.getEntitiesInLocation).toHaveBeenCalledWith(LOC);

      // Should only update ACTOR_B and ACTOR_C (not ACTOR_A)
      expect(em.addComponent).toHaveBeenCalledTimes(2);
      const updatedActors = em.addComponent.mock.calls.map((call) => call[0]);
      expect(updatedActors).toContain(ACTOR_B);
      expect(updatedActors).toContain(ACTOR_C);
      expect(updatedActors).not.toContain(ACTOR_A);
    });

    test('should handle empty excludedActorIds as no exclusion', async () => {
      const entry = makeEntry('no_exclusion');
      em.getEntitiesInLocation.mockReturnValue(new Set([ACTOR_A, ACTOR_B]));
      em.hasComponent.mockReturnValue(true);
      em.getComponentData.mockReturnValue({ maxEntries: 10, logEntries: [] });
      em.addComponent.mockResolvedValue(true);

      await h.execute({
        location_id: LOC,
        entry,
        excluded_actor_ids: [],
      });

      // Should update all actors
      expect(em.addComponent).toHaveBeenCalledTimes(2);
      const updatedActors = em.addComponent.mock.calls.map((call) => call[0]);
      expect(updatedActors).toContain(ACTOR_A);
      expect(updatedActors).toContain(ACTOR_B);
    });

    test('should handle all actors excluded gracefully', async () => {
      const entry = makeEntry('all_excluded');
      em.getEntitiesInLocation.mockReturnValue(new Set([ACTOR_A, ACTOR_B]));
      em.hasComponent.mockReturnValue(true);

      await h.execute({
        location_id: LOC,
        entry,
        excluded_actor_ids: [ACTOR_A, ACTOR_B],
      });

      // No actors should be updated
      expect(em.addComponent).not.toHaveBeenCalled();

      // Should log appropriate debug message
      expect(log.debug).toHaveBeenCalledWith(
        expect.stringContaining('All actors excluded for')
      );
    });

    test('should abort when both recipientIds and excludedActorIds provided (unified routing policy)', async () => {
      const entry = makeEntry('conflict_test');
      em.hasComponent.mockReturnValue(true);
      em.getComponentData.mockReturnValue({ maxEntries: 10, logEntries: [] });
      em.addComponent.mockResolvedValue(true);

      // Configure routing policy service to return false (conflict detected, abort)
      routingPolicyService.validateAndHandle.mockReturnValue(false);

      await h.execute({
        location_id: LOC,
        entry,
        recipient_ids: [ACTOR_B],
        excluded_actor_ids: [ACTOR_A],
      });

      // Verify routing policy service was called to validate mutual exclusivity
      expect(routingPolicyService.validateAndHandle).toHaveBeenCalledWith(
        [ACTOR_B],
        [ACTOR_A],
        'ADD_PERCEPTION_LOG_ENTRY'
      );

      // Should NOT update any components (operation aborted)
      expect(em.addComponent).not.toHaveBeenCalled();

      // Should NOT query location (aborted before reaching that logic)
      expect(em.getEntitiesInLocation).not.toHaveBeenCalled();
    });

    test('should handle non-existent excluded actor IDs gracefully', async () => {
      const entry = makeEntry('nonexistent_exclusion');
      em.getEntitiesInLocation.mockReturnValue(new Set([ACTOR_A, ACTOR_B]));
      em.hasComponent.mockReturnValue(true);
      em.getComponentData.mockReturnValue({ maxEntries: 10, logEntries: [] });
      em.addComponent.mockResolvedValue(true);

      await h.execute({
        location_id: LOC,
        entry,
        excluded_actor_ids: ['actor:nonexistent', 'actor:also_missing'],
      });

      // Should update all actual actors (exclusions ignored if not present)
      expect(em.addComponent).toHaveBeenCalledTimes(2);
      const updatedActors = em.addComponent.mock.calls.map((call) => call[0]);
      expect(updatedActors).toContain(ACTOR_A);
      expect(updatedActors).toContain(ACTOR_B);
    });

    test('should filter excluded actors from location entities correctly', async () => {
      const entry = makeEntry('filter_test');
      const allActors = new Set([
        ACTOR_A,
        ACTOR_B,
        ACTOR_C,
        'actor:delta',
        'actor:echo',
      ]);
      em.getEntitiesInLocation.mockReturnValue(allActors);
      em.hasComponent.mockReturnValue(true);
      em.getComponentData.mockReturnValue({ maxEntries: 10, logEntries: [] });
      em.addComponent.mockResolvedValue(true);

      await h.execute({
        location_id: LOC,
        entry,
        excluded_actor_ids: [ACTOR_A, ACTOR_C],
      });

      // Should update exactly 3 actors (5 total - 2 excluded)
      expect(em.addComponent).toHaveBeenCalledTimes(3);
      const updatedActors = em.addComponent.mock.calls.map((call) => call[0]);
      expect(updatedActors).toContain(ACTOR_B);
      expect(updatedActors).toContain('actor:delta');
      expect(updatedActors).toContain('actor:echo');
      expect(updatedActors).not.toContain(ACTOR_A);
      expect(updatedActors).not.toContain(ACTOR_C);
    });

    test('should work with batch optimization when excluding actors', async () => {
      const entry = makeEntry('batch_with_exclusion');
      em.getEntitiesInLocation.mockReturnValue(
        new Set([ACTOR_A, ACTOR_B, ACTOR_C])
      );
      em.hasComponent.mockReturnValue(true);
      em.getComponentData.mockReturnValue({ maxEntries: 10, logEntries: [] });

      em.batchAddComponentsOptimized = jest.fn().mockResolvedValue({
        updateCount: 2,
        errors: [],
      });

      await h.execute({
        location_id: LOC,
        entry,
        excluded_actor_ids: [ACTOR_A],
      });

      // Should call batch method with only 2 specs (B and C, not A)
      expect(em.batchAddComponentsOptimized).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ instanceId: ACTOR_B }),
          expect.objectContaining({ instanceId: ACTOR_C }),
        ]),
        true
      );

      const specs = em.batchAddComponentsOptimized.mock.calls[0][0];
      expect(specs).toHaveLength(2);
      expect(specs.find((s) => s.instanceId === ACTOR_A)).toBeUndefined();
    });

    test('should handle string excluded_actor_ids parameter', async () => {
      const entry = makeEntry('string_exclusion');
      em.getEntitiesInLocation.mockReturnValue(new Set([ACTOR_A, ACTOR_B]));
      em.hasComponent.mockReturnValue(true);
      em.getComponentData.mockReturnValue({ maxEntries: 10, logEntries: [] });
      em.addComponent.mockResolvedValue(true);

      await h.execute({
        location_id: LOC,
        entry,
        excluded_actor_ids: `  ${ACTOR_A}  `,
      });

      // Should update only ACTOR_B
      expect(em.addComponent).toHaveBeenCalledTimes(1);
      expect(em.addComponent).toHaveBeenCalledWith(
        ACTOR_B,
        PERCEPTION_LOG_COMPONENT_ID,
        expect.anything()
      );
    });
  });

  // ── Sense-Aware Filtering ──────────────────────────────────────────────────
  describe('execute – sense-aware filtering', () => {
    const LOC = 'loc:sense_test';
    const ACTOR = 'actor:performer';
    const NPC1 = 'npc:sighted';
    const NPC2 = 'npc:blind';
    const NPC3 = 'npc:deaf_blind';

    /** @type {AddPerceptionLogEntryHandler} */ let h;
    /** @type {jest.Mock} */ let mockPerceptionFilterService;

    beforeEach(() => {
      mockPerceptionFilterService = {
        filterEventForRecipients: jest.fn(),
      };

      h = new AddPerceptionLogEntryHandler({
        logger: log,
        entityManager: em,
        safeEventDispatcher: dispatcher,
        routingPolicyService,
        perceptionFilterService: mockPerceptionFilterService,
      });

      em.hasComponent.mockReturnValue(true);
      em.getComponentData.mockReturnValue({ maxEntries: 10, logEntries: [] });
      em.addComponent.mockResolvedValue(true);
    });

    test('constructor works without perceptionFilterService (backward compat)', () => {
      const handlerWithoutFilter = new AddPerceptionLogEntryHandler({
        logger: log,
        entityManager: em,
        safeEventDispatcher: dispatcher,
        routingPolicyService,
        // No perceptionFilterService provided
      });
      expect(handlerWithoutFilter).toBeInstanceOf(AddPerceptionLogEntryHandler);
    });

    test('sense_aware: false bypasses filtering', async () => {
      const entry = makeEntry('no_filter');
      entry.perceptionType = 'movement.arrival';
      em.getEntitiesInLocation.mockReturnValue(new Set([NPC1, NPC2]));

      await h.execute({
        location_id: LOC,
        entry,
        sense_aware: false,
        alternate_descriptions: {
          auditory: 'You hear footsteps.',
        },
      });

      // Filter service should NOT be called
      expect(
        mockPerceptionFilterService.filterEventForRecipients
      ).not.toHaveBeenCalled();

      // All recipients should receive the original entry
      expect(em.addComponent).toHaveBeenCalledTimes(2);
    });

    test('missing alternate_descriptions uses existing logic (no filtering)', async () => {
      const entry = makeEntry('no_alternates');
      entry.perceptionType = 'movement.arrival';
      em.getEntitiesInLocation.mockReturnValue(new Set([NPC1, NPC2]));

      await h.execute({
        location_id: LOC,
        entry,
        // No alternate_descriptions provided
      });

      // Filter service should NOT be called
      expect(
        mockPerceptionFilterService.filterEventForRecipients
      ).not.toHaveBeenCalled();

      // All recipients should receive the original entry
      expect(em.addComponent).toHaveBeenCalledTimes(2);
    });

    test('filtering removes recipients that cannot perceive (silent filter)', async () => {
      const entry = makeEntry('filtered');
      entry.perceptionType = 'movement.arrival';
      entry.descriptionText = 'Bob does a handstand.';
      em.getEntitiesInLocation.mockReturnValue(new Set([NPC1, NPC2, NPC3]));

      // Mock filter service: NPC1 can see, NPC2 uses auditory, NPC3 filtered out
      mockPerceptionFilterService.filterEventForRecipients.mockReturnValue([
        {
          entityId: NPC1,
          descriptionText: 'Bob does a handstand.',
          sense: 'visual',
          canPerceive: true,
        },
        {
          entityId: NPC2,
          descriptionText: 'You hear exertion sounds.',
          sense: 'auditory',
          canPerceive: true,
        },
        {
          entityId: NPC3,
          descriptionText: null,
          sense: 'visual',
          canPerceive: false, // Filtered out
        },
      ]);

      await h.execute({
        location_id: LOC,
        entry,
        originating_actor_id: ACTOR,
        alternate_descriptions: {
          auditory: 'You hear exertion sounds.',
          limited: 'You sense activity nearby.',
        },
      });

      // Filter service should be called
      expect(
        mockPerceptionFilterService.filterEventForRecipients
      ).toHaveBeenCalledWith(
        {
          perception_type: 'movement.arrival',
          description_text: 'Bob does a handstand.',
          alternate_descriptions: {
            auditory: 'You hear exertion sounds.',
            limited: 'You sense activity nearby.',
          },
        },
        expect.arrayContaining([NPC1, NPC2, NPC3]),
        LOC,
        ACTOR
      );

      // Only NPC1 and NPC2 should receive entries (NPC3 filtered out)
      expect(em.addComponent).toHaveBeenCalledTimes(2);

      // Verify NPC3 was NOT updated
      const updatedEntities = em.addComponent.mock.calls.map((call) => call[0]);
      expect(updatedEntities).toContain(NPC1);
      expect(updatedEntities).toContain(NPC2);
      expect(updatedEntities).not.toContain(NPC3);
    });

    test('perceivedVia field added to log entries when filtering', async () => {
      const entry = makeEntry('perceived_via');
      entry.perceptionType = 'movement.arrival';
      entry.descriptionText = 'Original visual text.';
      em.getEntitiesInLocation.mockReturnValue(new Set([NPC1, NPC2]));

      mockPerceptionFilterService.filterEventForRecipients.mockReturnValue([
        {
          entityId: NPC1,
          descriptionText: 'Original visual text.',
          sense: 'visual',
          canPerceive: true,
        },
        {
          entityId: NPC2,
          descriptionText: 'You hear sounds.',
          sense: 'auditory',
          canPerceive: true,
        },
      ]);

      await h.execute({
        location_id: LOC,
        entry,
        originating_actor_id: ACTOR,
        alternate_descriptions: {
          auditory: 'You hear sounds.',
        },
      });

      // Verify NPC1 received visual description with perceivedVia field
      const npc1Call = em.addComponent.mock.calls.find(
        (call) => call[0] === NPC1
      );
      expect(npc1Call[2].logEntries[0]).toMatchObject({
        descriptionText: 'Original visual text.',
        perceivedVia: 'visual',
      });

      // Verify NPC2 received auditory description with perceivedVia field
      const npc2Call = em.addComponent.mock.calls.find(
        (call) => call[0] === NPC2
      );
      expect(npc2Call[2].logEntries[0]).toMatchObject({
        descriptionText: 'You hear sounds.',
        perceivedVia: 'auditory',
      });
    });

    test('silent filtering does not dispatch errors', async () => {
      const entry = makeEntry('silent');
      entry.perceptionType = 'movement.arrival';
      em.getEntitiesInLocation.mockReturnValue(new Set([NPC1, NPC2]));

      // Both recipients filtered out
      mockPerceptionFilterService.filterEventForRecipients.mockReturnValue([
        {
          entityId: NPC1,
          descriptionText: null,
          sense: 'visual',
          canPerceive: false,
        },
        {
          entityId: NPC2,
          descriptionText: null,
          sense: 'visual',
          canPerceive: false,
        },
      ]);

      await h.execute({
        location_id: LOC,
        entry,
        alternate_descriptions: { auditory: 'fallback' },
      });

      // No error events should be dispatched (silent filter)
      expect(dispatcher.dispatch).not.toHaveBeenCalledWith(
        SYSTEM_ERROR_OCCURRED_ID,
        expect.anything()
      );

      // No entries should be added
      expect(em.addComponent).not.toHaveBeenCalled();
    });

    test('filtering works with batch optimization', async () => {
      const entry = makeEntry('batch_filter');
      entry.perceptionType = 'social.gesture';
      entry.descriptionText = 'Visual gesture description.';
      em.getEntitiesInLocation.mockReturnValue(new Set([NPC1, NPC2, NPC3]));

      // Mock optimized batch method
      em.batchAddComponentsOptimized = jest.fn().mockResolvedValue({
        updateCount: 2,
        errors: [],
      });

      // NPC3 filtered out
      mockPerceptionFilterService.filterEventForRecipients.mockReturnValue([
        {
          entityId: NPC1,
          descriptionText: 'Visual gesture description.',
          sense: 'visual',
          canPerceive: true,
        },
        {
          entityId: NPC2,
          descriptionText: 'You sense activity.',
          sense: 'limited',
          canPerceive: true,
        },
        {
          entityId: NPC3,
          descriptionText: null,
          sense: 'visual',
          canPerceive: false,
        },
      ]);

      await h.execute({
        location_id: LOC,
        entry,
        alternate_descriptions: { limited: 'You sense activity.' },
      });

      // Batch should only include NPC1 and NPC2 (not NPC3)
      expect(em.batchAddComponentsOptimized).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ instanceId: NPC1 }),
          expect.objectContaining({ instanceId: NPC2 }),
        ]),
        true
      );

      const specs = em.batchAddComponentsOptimized.mock.calls[0][0];
      expect(specs).toHaveLength(2);
      expect(specs.find((s) => s.instanceId === NPC3)).toBeUndefined();
    });

    test('filtering with no perceptionFilterService available uses original logic', async () => {
      // Create handler without filter service
      const handlerWithoutFilter = new AddPerceptionLogEntryHandler({
        logger: log,
        entityManager: em,
        safeEventDispatcher: dispatcher,
        routingPolicyService,
      });

      const entry = makeEntry('no_service');
      entry.perceptionType = 'movement.arrival';
      em.getEntitiesInLocation.mockReturnValue(new Set([NPC1, NPC2]));

      await handlerWithoutFilter.execute({
        location_id: LOC,
        entry,
        alternate_descriptions: { auditory: 'fallback' },
      });

      // All recipients should receive original entry (no filtering)
      expect(em.addComponent).toHaveBeenCalledTimes(2);

      // Verify all got the original descriptionText (no perceivedVia)
      em.addComponent.mock.calls.forEach((call) => {
        expect(call[2].logEntries[0].descriptionText).toBe(entry.descriptionText);
        expect(call[2].logEntries[0].perceivedVia).toBeUndefined();
      });
    });

    test('logs debug message about filtering results', async () => {
      const entry = makeEntry('debug_log');
      entry.perceptionType = 'movement.arrival';
      em.getEntitiesInLocation.mockReturnValue(new Set([NPC1, NPC2, NPC3]));

      mockPerceptionFilterService.filterEventForRecipients.mockReturnValue([
        { entityId: NPC1, descriptionText: 'text', sense: 'visual', canPerceive: true },
        { entityId: NPC2, descriptionText: 'text', sense: 'auditory', canPerceive: true },
        { entityId: NPC3, descriptionText: null, sense: 'visual', canPerceive: false },
      ]);

      await h.execute({
        location_id: LOC,
        entry,
        alternate_descriptions: { auditory: 'fallback' },
      });

      // Should log filtering results
      expect(log.debug).toHaveBeenCalledWith(
        expect.stringContaining('sense filtering applied - 2/3 can perceive')
      );
    });
  });

  // ── Actor/Target Description Routing (ACTOBSPERMES-004) ─────────────────────
  describe('execute – actor/target description routing', () => {
    const LOC = 'loc:test_room';
    const ACTOR_ID = 'npc:actor';
    const TARGET_ID = 'npc:target';
    const OBSERVER_ID = 'npc:observer';
    const ITEM_ID = 'item:rock'; // entity without perception log

    /** @type {AddPerceptionLogEntryHandler} */ let h;
    /** @type {jest.Mock} */ let mockPerceptionFilterService;

    beforeEach(() => {
      mockPerceptionFilterService = {
        filterEventForRecipients: jest.fn(),
      };

      h = new AddPerceptionLogEntryHandler({
        logger: log,
        entityManager: em,
        safeEventDispatcher: dispatcher,
        routingPolicyService,
        perceptionFilterService: mockPerceptionFilterService,
      });

      em.hasComponent.mockReturnValue(true);
      em.getComponentData.mockReturnValue({ maxEntries: 10, logEntries: [] });
      em.addComponent.mockResolvedValue(true);
    });

    test('delivers actor_description to actor without sense filtering', async () => {
      const entry = makeEntry('actor_routing');
      entry.descriptionText = 'Observer sees Alice do a handstand.';
      em.getEntitiesInLocation.mockReturnValue(
        new Set([ACTOR_ID, OBSERVER_ID])
      );

      // Mock filter service to return filtered version for observer
      mockPerceptionFilterService.filterEventForRecipients.mockReturnValue([
        {
          entityId: ACTOR_ID,
          descriptionText: 'Auditory fallback for actor.',
          sense: 'auditory',
          canPerceive: true,
        },
        {
          entityId: OBSERVER_ID,
          descriptionText: 'Auditory fallback for observer.',
          sense: 'auditory',
          canPerceive: true,
        },
      ]);

      await h.execute({
        location_id: LOC,
        entry,
        actor_description: 'I do a handstand, balancing upside-down.',
        originating_actor_id: ACTOR_ID,
        alternate_descriptions: { auditory: 'Sounds of exertion nearby.' },
      });

      expect(em.addComponent).toHaveBeenCalledTimes(2);

      // Actor should receive actor_description with perceivedVia: 'self'
      const actorCall = em.addComponent.mock.calls.find(
        (call) => call[0] === ACTOR_ID
      );
      expect(actorCall[2].logEntries[0].descriptionText).toBe(
        'I do a handstand, balancing upside-down.'
      );
      expect(actorCall[2].logEntries[0].perceivedVia).toBe('self');

      // Observer should receive filtered version
      const observerCall = em.addComponent.mock.calls.find(
        (call) => call[0] === OBSERVER_ID
      );
      expect(observerCall[2].logEntries[0].descriptionText).toBe(
        'Auditory fallback for observer.'
      );
      expect(observerCall[2].logEntries[0].perceivedVia).toBe('auditory');
    });

    test('delivers target_description to target with sense filtering applied', async () => {
      const entry = makeEntry('target_routing');
      entry.descriptionText = 'Observer sees Bob caress Alice\'s cheek.';
      em.getEntitiesInLocation.mockReturnValue(
        new Set([ACTOR_ID, TARGET_ID, OBSERVER_ID])
      );

      // Mock filter service - target uses auditory fallback
      mockPerceptionFilterService.filterEventForRecipients.mockReturnValue([
        {
          entityId: ACTOR_ID,
          descriptionText: 'Observer sees Bob caress Alice\'s cheek.',
          sense: 'visual',
          canPerceive: true,
        },
        {
          entityId: TARGET_ID,
          descriptionText: 'You feel a touch on your cheek.',
          sense: 'tactile',
          canPerceive: true,
        },
        {
          entityId: OBSERVER_ID,
          descriptionText: 'Observer sees Bob caress Alice\'s cheek.',
          sense: 'visual',
          canPerceive: true,
        },
      ]);

      await h.execute({
        location_id: LOC,
        entry,
        target_description: 'Bob caresses my cheek gently.',
        target_id: TARGET_ID,
        originating_actor_id: ACTOR_ID,
        alternate_descriptions: { tactile: 'You feel a touch on your cheek.' },
      });

      expect(em.addComponent).toHaveBeenCalledTimes(3);

      // Target should receive target_description (custom text takes priority over filtered observer text)
      // This ensures target sees "Bob caresses my cheek" not filtered tactile fallback
      const targetCall = em.addComponent.mock.calls.find(
        (call) => call[0] === TARGET_ID
      );
      expect(targetCall[2].logEntries[0].descriptionText).toBe(
        'Bob caresses my cheek gently.'
      );
      // perceivedVia still reflects the sense from filter service
      expect(targetCall[2].logEntries[0].perceivedVia).toBe('tactile');
    });

    test('delivers description_text to observers with filtering', async () => {
      const entry = makeEntry('observer_routing');
      entry.descriptionText = 'Alice does a dramatic pose.';
      em.getEntitiesInLocation.mockReturnValue(
        new Set([ACTOR_ID, TARGET_ID, OBSERVER_ID])
      );

      mockPerceptionFilterService.filterEventForRecipients.mockReturnValue([
        {
          entityId: ACTOR_ID,
          descriptionText: 'Alice does a dramatic pose.',
          sense: 'visual',
          canPerceive: true,
        },
        {
          entityId: TARGET_ID,
          descriptionText: 'Alice does a dramatic pose.',
          sense: 'visual',
          canPerceive: true,
        },
        {
          entityId: OBSERVER_ID,
          descriptionText: 'Sounds of dramatic movement.',
          sense: 'auditory',
          canPerceive: true,
        },
      ]);

      await h.execute({
        location_id: LOC,
        entry,
        actor_description: 'I strike a dramatic pose.',
        target_description: 'Alice strikes a pose in front of you.',
        target_id: TARGET_ID,
        originating_actor_id: ACTOR_ID,
        alternate_descriptions: { auditory: 'Sounds of dramatic movement.' },
      });

      expect(em.addComponent).toHaveBeenCalledTimes(3);

      // Observer should receive filtered description_text
      const observerCall = em.addComponent.mock.calls.find(
        (call) => call[0] === OBSERVER_ID
      );
      expect(observerCall[2].logEntries[0].descriptionText).toBe(
        'Sounds of dramatic movement.'
      );
      expect(observerCall[2].logEntries[0].perceivedVia).toBe('auditory');
    });

    test('delivers actor_description when actor equals target', async () => {
      // Self-action: actor is also the target
      const SELF_ACTOR_ID = 'npc:self_actor';
      const entry = makeEntry('self_action');
      entry.descriptionText = 'Observer sees someone examine themselves.';
      em.getEntitiesInLocation.mockReturnValue(
        new Set([SELF_ACTOR_ID, OBSERVER_ID])
      );

      mockPerceptionFilterService.filterEventForRecipients.mockReturnValue([
        {
          entityId: SELF_ACTOR_ID,
          descriptionText: 'Filtered version.',
          sense: 'visual',
          canPerceive: true,
        },
        {
          entityId: OBSERVER_ID,
          descriptionText: 'Observer sees someone examine themselves.',
          sense: 'visual',
          canPerceive: true,
        },
      ]);

      await h.execute({
        location_id: LOC,
        entry,
        actor_description: 'I examine myself in the mirror.',
        target_description: 'Someone examines you.', // Should be ignored for self
        target_id: SELF_ACTOR_ID, // Same as actor
        originating_actor_id: SELF_ACTOR_ID,
        alternate_descriptions: { auditory: 'Fallback.' },
      });

      expect(em.addComponent).toHaveBeenCalledTimes(2);

      // Actor/target (same entity) should receive actor_description, not target_description
      const selfCall = em.addComponent.mock.calls.find(
        (call) => call[0] === SELF_ACTOR_ID
      );
      expect(selfCall[2].logEntries[0].descriptionText).toBe(
        'I examine myself in the mirror.'
      );
      expect(selfCall[2].logEntries[0].perceivedVia).toBe('self');
    });

    test('warns when target_description provided but target lacks perception log', async () => {
      const entry = makeEntry('item_target');
      entry.descriptionText = 'Observer sees someone poke the rock.';

      // Setup: ITEM_ID lacks perception log component
      em.hasComponent.mockImplementation(
        (id, comp) =>
          comp === PERCEPTION_LOG_COMPONENT_ID && id !== ITEM_ID
      );
      em.getEntitiesInLocation.mockReturnValue(
        new Set([ACTOR_ID, ITEM_ID, OBSERVER_ID])
      );

      await h.execute({
        location_id: LOC,
        entry,
        target_description: 'Something pokes you.', // Won't be delivered - item has no log
        target_id: ITEM_ID,
        originating_actor_id: ACTOR_ID,
      });

      // Should log warning about item lacking perception log
      expect(log.warn).toHaveBeenCalledWith(
        expect.stringContaining(`target_description provided for entity '${ITEM_ID}'`)
      );
      expect(log.warn).toHaveBeenCalledWith(
        expect.stringContaining('lacks perception log component')
      );

      // Only actor and observer should receive messages (item skipped)
      expect(em.addComponent).toHaveBeenCalledTimes(2);
    });

    test('works unchanged when actor_description and target_description not provided', async () => {
      const entry = makeEntry('backward_compat');
      entry.descriptionText = 'Everyone sees the same thing.';
      em.getEntitiesInLocation.mockReturnValue(
        new Set([ACTOR_ID, TARGET_ID, OBSERVER_ID])
      );

      // No actor_description or target_description - standard behavior
      await h.execute({
        location_id: LOC,
        entry,
        originating_actor_id: ACTOR_ID,
      });

      expect(em.addComponent).toHaveBeenCalledTimes(3);

      // All recipients should receive the original entry
      em.addComponent.mock.calls.forEach((call) => {
        // Since no filtering, should preserve referential equality
        expect(call[2].logEntries[0]).toBe(entry);
        expect(call[2].logEntries[0].perceivedVia).toBeUndefined();
      });
    });

    test('sets perceivedVia to "self" for actor entries', async () => {
      const entry = makeEntry('perceived_via_self');
      entry.descriptionText = 'Observer text.';
      em.getEntitiesInLocation.mockReturnValue(new Set([ACTOR_ID]));

      await h.execute({
        location_id: LOC,
        entry,
        actor_description: 'I perform an action.',
        originating_actor_id: ACTOR_ID,
      });

      expect(em.addComponent).toHaveBeenCalledTimes(1);
      const call = em.addComponent.mock.calls[0];
      expect(call[2].logEntries[0].perceivedVia).toBe('self');
    });
  });

  describe('execute – sensorial link propagation', () => {
    const ORIGIN_LOC = 'loc:origin';
    const LINKED_LOC = 'loc:linked';
    const ORIGIN_ACTOR = 'npc:origin';
    const LINKED_ACTOR = 'npc:linked';

    /** @type {AddPerceptionLogEntryHandler} */ let h;
    beforeEach(() => {
      h = new AddPerceptionLogEntryHandler({
        logger: log,
        entityManager: em,
        safeEventDispatcher: dispatcher,
        routingPolicyService,
      });

      em.hasComponent.mockImplementation(
        (_id, componentTypeId) =>
          componentTypeId === PERCEPTION_LOG_COMPONENT_ID
      );
      em.getEntitiesInLocation.mockImplementation((locationId) => {
        if (locationId === ORIGIN_LOC) {
          return new Set([ORIGIN_ACTOR]);
        }
        if (locationId === LINKED_LOC) {
          return new Set([LINKED_ACTOR]);
        }
        return new Set();
      });
      em.getComponentData.mockImplementation((id, componentTypeId) => {
        if (
          id === ORIGIN_LOC &&
          componentTypeId === 'locations:sensorial_links'
        ) {
          return { targets: [LINKED_LOC] };
        }
        if (id === ORIGIN_LOC && componentTypeId === 'core:name') {
          return { text: 'Segment B' };
        }
        if (componentTypeId === PERCEPTION_LOG_COMPONENT_ID) {
          return { maxEntries: 10, logEntries: [] };
        }
        return null;
      });
    });

    test('prefixes forwarded entries and keeps origin unprefixed', async () => {
      const entry = makeEntry('sensorial');
      entry.descriptionText = 'A voice carries through the grate.';

      await h.execute({
        location_id: ORIGIN_LOC,
        entry,
        originating_actor_id: ORIGIN_ACTOR,
      });

      const originCall = em.addComponent.mock.calls.find(
        (call) => call[0] === ORIGIN_ACTOR
      );
      const linkedCall = em.addComponent.mock.calls.find(
        (call) => call[0] === LINKED_ACTOR
      );

      expect(originCall[2].logEntries[0].descriptionText).toBe(
        entry.descriptionText
      );
      expect(linkedCall[2].logEntries[0].descriptionText).toBe(
        `(From Segment B) ${entry.descriptionText}`
      );
    });

    test('skips propagation when origin_location_id differs', async () => {
      const entry = makeEntry('loop_guard');
      entry.descriptionText = 'A distant clang echoes.';

      await h.execute({
        location_id: ORIGIN_LOC,
        origin_location_id: 'loc:elsewhere',
        entry,
        originating_actor_id: ORIGIN_ACTOR,
      });

      expect(em.addComponent).toHaveBeenCalledTimes(1);
      expect(em.addComponent.mock.calls[0][0]).toBe(ORIGIN_ACTOR);
    });
  });
});
