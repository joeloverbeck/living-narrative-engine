// src/tests/services/perceptionUpdateService.test.js
/**
 * @jest-environment node
 */
import {
  describe,
  expect,
  test,
  jest,
  beforeEach,
  afterEach,
} from '@jest/globals';

// --- Function Under Test ---
import PerceptionUpdateService from '../../src/services/perceptionUpdateService.js';
import { PERCEPTION_LOG_COMPONENT_ID } from '../../src/constants/componentIds.js'; // Adjust path as needed

// --- JSDoc Imports for Type Hinting (optional, but good practice) ---
/** @typedef {import('../../src/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../src/interfaces/IEntityManager.js').IEntityManager} IEntityManager */
/** @typedef {import('../../src/services/perceptionUpdateService.js').LogEntry} LogEntry */
/** @typedef {import('../../src/services/perceptionUpdateService.js').AddEntryParams} AddEntryParams */
/** @typedef {import('../../src/services/perceptionUpdateService.js').PerceptionUpdateResult} PerceptionUpdateResult */
/** @typedef {import('../../src/services/perceptionUpdateService.js').QueryDetailsForPerceptionUpdate} QueryDetailsForPerceptionUpdate */

// --- Constants ---
const DEFAULT_MAX_LOG_ENTRIES = 50;

// --- Mocking Dependencies ---

/** @type {jest.Mocked<ILogger>} */
let mockLogger;
/** @type {jest.Mocked<IEntityManager>} */
let mockEntityManager;

beforeEach(() => {
  mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };

  mockEntityManager = {
    getEntitiesInLocation: jest.fn(),
    hasComponent: jest.fn(),
    getComponentData: jest.fn(),
    addComponent: jest.fn(), // This is used for updating component data in the service
    // Add other methods if they were to be called, even if not directly by addEntryToLogsInLocation
    getEntityInstance: jest.fn(),
    createEntityInstance: jest.fn(),
    getEntitiesWithComponent: jest.fn(),
    removeComponent: jest.fn(),
  };
});

afterEach(() => {
  jest.clearAllMocks();
});

// --- Helper Functions ---
/**
 * @param {string} id
 * @returns {LogEntry}
 */
const createSampleLogEntry = (id = '1') => ({
  descriptionText: `Event ${id} occurred`,
  timestamp: new Date().toISOString(),
  perceptionType: 'test_event',
  actorId: `actor:npc_guard_${id}`,
  targetId: `item:magic_scroll_${id}`,
  involvedEntities: [`actor:player_character`, `env:trap_trigger_${id}`],
  eventId: `ple_${Date.now()}_${id}`,
});

// --- Test Suite ---

describe('PerceptionUpdateService', () => {
  describe('Constructor', () => {
    test('should create an instance with valid dependencies', () => {
      const service = new PerceptionUpdateService({
        logger: mockLogger,
        entityManager: mockEntityManager,
      });
      expect(service).toBeInstanceOf(PerceptionUpdateService);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'PerceptionUpdateService: Instance created.'
      );
    });

    test('should throw error if logger is missing or invalid', () => {
      expect(
        () => new PerceptionUpdateService({ entityManager: mockEntityManager })
      ).toThrow('PerceptionUpdateService: Valid ILogger instance is required.');
      expect(
        () =>
          new PerceptionUpdateService({
            logger: {},
            entityManager: mockEntityManager,
          })
      ).toThrow('PerceptionUpdateService: Valid ILogger instance is required.');
      expect(
        () =>
          new PerceptionUpdateService({
            logger: { info: jest.fn() },
            entityManager: mockEntityManager,
          })
      ) // missing error func
        .toThrow(
          'PerceptionUpdateService: Valid ILogger instance is required.'
        );
    });

    test('should throw error if entityManager is missing or invalid', () => {
      expect(() => new PerceptionUpdateService({ logger: mockLogger })).toThrow(
        'PerceptionUpdateService: Valid IEntityManager instance with required methods (getEntitiesInLocation, hasComponent, getComponentData, addComponent) is required.'
      );

      const invalidEntityManagerMissingMethods = {
        // getEntitiesInLocation: jest.fn(), // Missing
        hasComponent: jest.fn(),
        getComponentData: jest.fn(),
        addComponent: jest.fn(),
      };
      expect(
        () =>
          new PerceptionUpdateService({
            logger: mockLogger,
            entityManager: invalidEntityManagerMissingMethods,
          })
      ).toThrow(
        'PerceptionUpdateService: Valid IEntityManager instance with required methods'
      );
    });
  });

  describe('handleQuery Method', () => {
    let service;

    beforeEach(() => {
      service = new PerceptionUpdateService({
        logger: mockLogger,
        entityManager: mockEntityManager,
      });
      // Spy on the actual addEntryToLogsInLocation method of this instance
      jest
        .spyOn(service, 'addEntryToLogsInLocation')
        .mockResolvedValue({ success: true, logsUpdated: 0 });
    });

    test('should dispatch to addEntryToLogsInLocation for "addEntryToLogsInLocation" action', async () => {
      const params = {
        locationId: 'loc:test_area',
        entry: createSampleLogEntry('query'),
        originatingActorId: 'actor:player',
      };
      /** @type {QueryDetailsForPerceptionUpdate} */
      const queryDetails = {
        action: 'addEntryToLogsInLocation',
        ...params,
      };

      await service.handleQuery(queryDetails);

      expect(service.addEntryToLogsInLocation).toHaveBeenCalledTimes(1);
      expect(service.addEntryToLogsInLocation).toHaveBeenCalledWith(params);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'PerceptionUpdateService.handleQuery: Received query',
        { queryDetails }
      );
    });

    test('should return error for an unknown action', async () => {
      /** @type {QueryDetailsForPerceptionUpdate} */
      const queryDetails = {
        action: 'unknownAction',
        someData: 'test',
      };

      const result = await service.handleQuery(queryDetails);

      expect(result).toEqual({
        success: false,
        error: 'Unknown action: unknownAction',
        logsUpdated: 0,
      });
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'PerceptionUpdateService.handleQuery: Unknown action: unknownAction',
        { queryDetails }
      );
      expect(service.addEntryToLogsInLocation).not.toHaveBeenCalled();
    });

    test('should return error for invalid queryDetails (null, undefined, no action)', async () => {
      const testCases = [
        null,
        undefined,
        { notAction: 'test' },
        { action: '' },
        { action: '   ' },
      ];

      for (const invalidQuery of testCases) {
        mockLogger.error.mockClear(); // Clear for each case
        const result = await service.handleQuery(
          /** @type {any} */ (invalidQuery)
        );
        expect(result).toEqual({
          success: false,
          error:
            "Invalid queryDetails: must be an object with a non-empty 'action' string property.",
          logsUpdated: 0,
        });
        expect(mockLogger.error).toHaveBeenCalledWith(
          "PerceptionUpdateService.handleQuery: Invalid queryDetails: must be an object with a non-empty 'action' string property.",
          { queryDetails: invalidQuery }
        );
      }
      expect(service.addEntryToLogsInLocation).not.toHaveBeenCalled();
    });
  });

  describe('addEntryToLogsInLocation Method', () => {
    let service;
    const locationId = 'loc:test_chamber';
    const perceiver1Id = 'npc:perceiver_1';
    const perceiver2Id = 'npc:perceiver_2';
    const nonPerceiverId = 'item:rock';

    beforeEach(() => {
      service = new PerceptionUpdateService({
        logger: mockLogger,
        entityManager: mockEntityManager,
      });
      // Common mocks for these tests: one perceiver entity
      mockEntityManager.getEntitiesInLocation.mockReturnValue(
        new Set([perceiver1Id])
      );
      mockEntityManager.hasComponent.mockImplementation(
        (entityId, componentId) =>
          entityId === perceiver1Id &&
          componentId === PERCEPTION_LOG_COMPONENT_ID
      );
      mockEntityManager.addComponent.mockReturnValue(true); // Assume success for these tests
    });

    describe('Parameter Validation', () => {
      test('should return error if params object itself is invalid', async () => {
        const invalidParamsList = [null, undefined, 'not-an-object', 123];
        for (const invalidParams of invalidParamsList) {
          mockLogger.error.mockClear();
          const result = await service.addEntryToLogsInLocation(
            /** @type {any} */ (invalidParams)
          );
          expect(result).toEqual({
            success: false,
            error: 'Invalid parameters: input must be an object.',
            logsUpdated: 0,
          });
          expect(mockLogger.error).toHaveBeenCalledWith(
            'PerceptionUpdateService.addEntryToLogsInLocation: Invalid params object.',
            { params: invalidParams }
          );
        }
      });

      test('should return error if locationId is invalid or missing', async () => {
        const entry = createSampleLogEntry();
        const invalidLocationIds = [null, undefined, '', '   ', 123];

        for (const locId of invalidLocationIds) {
          mockLogger.error.mockClear();
          const params = { locationId: /** @type {any} */ (locId), entry };
          const result = await service.addEntryToLogsInLocation(params);
          expect(result).toEqual({
            success: false,
            error: 'Invalid or missing locationId.',
            logsUpdated: 0,
          });
          expect(mockLogger.error).toHaveBeenCalledWith(
            'PerceptionUpdateService.addEntryToLogsInLocation: Invalid or missing locationId.',
            { locationId: locId }
          );
        }
      });

      test('should return error if entry object is invalid or missing', async () => {
        const locationId = 'loc:valid_location';
        const invalidEntries = [null, undefined, 'not-an-object', 123];

        for (const invalidEntry of invalidEntries) {
          mockLogger.error.mockClear();
          const params = {
            locationId,
            entry: /** @type {any} */ (invalidEntry),
          };
          const result = await service.addEntryToLogsInLocation(params);
          expect(result).toEqual({
            success: false,
            error: 'Invalid or missing entry object.',
            logsUpdated: 0,
          });
          expect(mockLogger.error).toHaveBeenCalledWith(
            'PerceptionUpdateService.addEntryToLogsInLocation: Invalid or missing entry object.',
            { entry: invalidEntry }
          );
        }
      });

      const requiredEntryFields = [
        'descriptionText',
        'timestamp',
        'perceptionType',
        'actorId',
      ];
      requiredEntryFields.forEach((field) => {
        test(`should return error if required entry field "${field}" is missing or invalid`, async () => {
          const locationId = 'loc:valid_location';
          let entry = createSampleLogEntry();
          // @ts-ignore
          delete entry[field]; // Test missing

          let result = await service.addEntryToLogsInLocation({
            locationId,
            entry,
          });
          expect(result).toEqual({
            success: false,
            error: `Missing or invalid required field in entry: ${field}.`,
            logsUpdated: 0,
          });
          expect(mockLogger.error).toHaveBeenCalledWith(
            `PerceptionUpdateService.addEntryToLogsInLocation: Missing or invalid required field in entry: ${field}.`,
            { entry }
          );

          mockLogger.error.mockClear();
          entry = createSampleLogEntry();
          // @ts-ignore
          entry[field] = ''; // Test empty string (invalid for non-targetId fields)
          if (field === 'targetId') return; // targetId can be empty, skip this case

          result = await service.addEntryToLogsInLocation({
            locationId,
            entry,
          });
          expect(result).toEqual({
            success: false,
            error: `Missing or invalid required field in entry: ${field}.`,
            logsUpdated: 0,
          });
          expect(mockLogger.error).toHaveBeenCalledWith(
            `PerceptionUpdateService.addEntryToLogsInLocation: Missing or invalid required field in entry: ${field}.`,
            { entry }
          );

          mockLogger.error.mockClear();
          entry = createSampleLogEntry();
          // @ts-ignore
          entry[field] = '   '; // Test blank string (invalid for non-targetId fields)
          if (field === 'targetId') return; // targetId can be empty, skip this case

          result = await service.addEntryToLogsInLocation({
            locationId,
            entry,
          });
          expect(result).toEqual({
            success: false,
            error: `Missing or invalid required field in entry: ${field}.`,
            logsUpdated: 0,
          });
          expect(mockLogger.error).toHaveBeenCalledWith(
            `PerceptionUpdateService.addEntryToLogsInLocation: Missing or invalid required field in entry: ${field}.`,
            { entry }
          );
        });
      });

      test('should allow empty string for optional entry.targetId', async () => {
        const locationId = 'loc:valid_location';
        const entry = createSampleLogEntry();
        entry.targetId = ''; // Empty string for targetId is allowed

        mockEntityManager.getEntitiesInLocation.mockReturnValue(new Set()); // No perceivers

        const result = await service.addEntryToLogsInLocation({
          locationId,
          entry,
        });
        expect(result.success).toBe(true); // Should not fail validation
        expect(result.error).toBeUndefined();
      });

      test('should return error if entry.involvedEntities is provided but not an array', async () => {
        const locationId = 'loc:valid_location';
        const entry = createSampleLogEntry();
        // @ts-ignore
        entry.involvedEntities = 'not-an-array';

        const result = await service.addEntryToLogsInLocation({
          locationId,
          entry,
        });
        expect(result).toEqual({
          success: false,
          error: 'entry.involvedEntities must be an array if provided.',
          logsUpdated: 0,
        });
        expect(mockLogger.error).toHaveBeenCalledWith(
          'PerceptionUpdateService.addEntryToLogsInLocation: entry.involvedEntities must be an array if provided.',
          { entry }
        );
      });

      test('should proceed if entry.involvedEntities is an empty array or undefined', async () => {
        const locationId = 'loc:empty_room';
        mockEntityManager.getEntitiesInLocation.mockReturnValue(new Set()); // No perceivers

        let entry = createSampleLogEntry();
        delete entry.involvedEntities; // Undefined

        let result = await service.addEntryToLogsInLocation({
          locationId,
          entry,
        });
        expect(result.success).toBe(true);
        expect(result.logsUpdated).toBe(0);

        entry = createSampleLogEntry();
        entry.involvedEntities = []; // Empty array

        result = await service.addEntryToLogsInLocation({ locationId, entry });
        expect(result.success).toBe(true);
        expect(result.logsUpdated).toBe(0);
      });
    });
    // ... (Other test suites for addEntryToLogsInLocation will go here) ...

    describe('Entity Querying & Basic Log Updates', () => {
      test('should return success with logsUpdated: 0 if location is empty (no entities)', async () => {
        const entry = createSampleLogEntry('event_empty_loc');
        mockEntityManager.getEntitiesInLocation.mockReturnValue(new Set());

        const result = await service.addEntryToLogsInLocation({
          locationId,
          entry,
        });

        expect(result).toEqual({ success: true, logsUpdated: 0, warnings: [] });
        expect(mockEntityManager.getEntitiesInLocation).toHaveBeenCalledWith(
          locationId
        );
        expect(mockEntityManager.hasComponent).not.toHaveBeenCalled();
        expect(mockEntityManager.getComponentData).not.toHaveBeenCalled();
        expect(mockEntityManager.addComponent).not.toHaveBeenCalled();
        expect(mockLogger.info).toHaveBeenCalledWith(
          `PerceptionUpdateService: No entities with '${PERCEPTION_LOG_COMPONENT_ID}' found in location '${locationId}'. No logs will be updated.`
        );
      });

      test('should return success with logsUpdated: 0 if location has entities but none have perception_log component', async () => {
        const entry = createSampleLogEntry('event_no_perceivers');
        mockEntityManager.getEntitiesInLocation.mockReturnValue(
          new Set([nonPerceiverId, 'item:another_rock'])
        );
        mockEntityManager.hasComponent.mockReturnValue(false); // All entities lack the component

        const result = await service.addEntryToLogsInLocation({
          locationId,
          entry,
        });

        expect(result).toEqual({ success: true, logsUpdated: 0, warnings: [] });
        expect(mockEntityManager.getEntitiesInLocation).toHaveBeenCalledWith(
          locationId
        );
        expect(mockEntityManager.hasComponent).toHaveBeenCalledWith(
          nonPerceiverId,
          PERCEPTION_LOG_COMPONENT_ID
        );
        expect(mockEntityManager.hasComponent).toHaveBeenCalledWith(
          'item:another_rock',
          PERCEPTION_LOG_COMPONENT_ID
        );
        expect(mockEntityManager.getComponentData).not.toHaveBeenCalled();
        expect(mockEntityManager.addComponent).not.toHaveBeenCalled();
        expect(mockLogger.info).toHaveBeenCalledWith(
          `PerceptionUpdateService: No entities with '${PERCEPTION_LOG_COMPONENT_ID}' found in location '${locationId}'. No logs will be updated.`
        );
      });

      test('should initialize log for a single perceiver if it has no existing core:perception_log', async () => {
        const entry = createSampleLogEntry('event_init_log');
        entry.eventId = 'fixed_event_id_1'; // Control eventId for easier assertion
        mockEntityManager.getEntitiesInLocation.mockReturnValue(
          new Set([perceiver1Id])
        );
        mockEntityManager.hasComponent.mockImplementation(
          (entityId, componentId) =>
            entityId === perceiver1Id &&
            componentId === PERCEPTION_LOG_COMPONENT_ID
        );
        mockEntityManager.getComponentData.mockReturnValue(null); // No existing log data
        mockEntityManager.addComponent.mockReturnValue(true); // Simulate successful update

        const result = await service.addEntryToLogsInLocation({
          locationId,
          entry,
        });

        expect(result.success).toBe(true);
        expect(result.logsUpdated).toBe(1);
        expect(result.warnings).toEqual([
          `Entity ${perceiver1Id} in location ${locationId} was expected to have ${PERCEPTION_LOG_COMPONENT_ID} but data not found. Initializing new log.`,
        ]);

        expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
          perceiver1Id,
          PERCEPTION_LOG_COMPONENT_ID
        );
        expect(mockEntityManager.addComponent).toHaveBeenCalledTimes(1);
        expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
          perceiver1Id,
          PERCEPTION_LOG_COMPONENT_ID,
          {
            maxEntries: DEFAULT_MAX_LOG_ENTRIES,
            logEntries: [entry], // Entry directly used as eventId was provided
          }
        );
        expect(mockLogger.error).toHaveBeenCalledWith(
          // Service logs this as an error due to unexpected state
          `PerceptionUpdateService: Entity ${perceiver1Id} in location ${locationId} was expected to have ${PERCEPTION_LOG_COMPONENT_ID} but data not found. Initializing new log.`
        );
      });

      test('should append to existing log for a single perceiver', async () => {
        const entry = createSampleLogEntry('event_append_log');
        entry.eventId = 'fixed_event_id_2';
        const existingLogEntry = createSampleLogEntry('existing_event');
        existingLogEntry.eventId = 'fixed_existing_event_id_1';

        const initialLogData = {
          maxEntries: DEFAULT_MAX_LOG_ENTRIES,
          logEntries: [existingLogEntry],
        };
        mockEntityManager.getEntitiesInLocation.mockReturnValue(
          new Set([perceiver1Id])
        );
        mockEntityManager.hasComponent.mockReturnValue(true);
        mockEntityManager.getComponentData.mockReturnValue(
          JSON.parse(JSON.stringify(initialLogData))
        ); // Deep clone like service
        mockEntityManager.addComponent.mockReturnValue(true);

        const result = await service.addEntryToLogsInLocation({
          locationId,
          entry,
        });

        expect(result.success).toBe(true);
        expect(result.logsUpdated).toBe(1);
        expect(result.warnings).toEqual([]);
        expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
          perceiver1Id,
          PERCEPTION_LOG_COMPONENT_ID,
          {
            maxEntries: DEFAULT_MAX_LOG_ENTRIES,
            logEntries: [existingLogEntry, entry],
          }
        );
      });

      test('should update logs for multiple perceivers in a location', async () => {
        const entry = createSampleLogEntry('event_multi_log');
        entry.eventId = 'fixed_event_id_3';
        const existingLogEntry1 = createSampleLogEntry('existing1');
        const existingLogEntry2 = createSampleLogEntry('existing2');
        existingLogEntry1.eventId = 'fixed_existing_event_id_multi1';
        existingLogEntry2.eventId = 'fixed_existing_event_id_multi2';

        mockEntityManager.getEntitiesInLocation.mockReturnValue(
          new Set([perceiver1Id, nonPerceiverId, perceiver2Id])
        );
        mockEntityManager.hasComponent.mockImplementation(
          (entityId, componentId) => {
            if (componentId !== PERCEPTION_LOG_COMPONENT_ID) return false;
            return entityId === perceiver1Id || entityId === perceiver2Id;
          }
        );

        const logData1 = {
          maxEntries: DEFAULT_MAX_LOG_ENTRIES,
          logEntries: [existingLogEntry1],
        };
        // Perceiver 2 will have its log initialized
        mockEntityManager.getComponentData.mockImplementation(
          (entityId, componentId) => {
            if (componentId === PERCEPTION_LOG_COMPONENT_ID) {
              if (entityId === perceiver1Id)
                return JSON.parse(JSON.stringify(logData1));
              if (entityId === perceiver2Id) return null; // Perceiver 2 has no log data
            }
            return undefined;
          }
        );
        mockEntityManager.addComponent.mockReturnValue(true);

        const result = await service.addEntryToLogsInLocation({
          locationId,
          entry,
        });

        expect(result.success).toBe(true);
        expect(result.logsUpdated).toBe(2);
        expect(result.warnings).toContain(
          `Entity ${perceiver2Id} in location ${locationId} was expected to have ${PERCEPTION_LOG_COMPONENT_ID} but data not found. Initializing new log.`
        );

        expect(mockEntityManager.addComponent).toHaveBeenCalledTimes(2);
        expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
          perceiver1Id,
          PERCEPTION_LOG_COMPONENT_ID,
          {
            maxEntries: DEFAULT_MAX_LOG_ENTRIES,
            logEntries: [existingLogEntry1, entry],
          }
        );
        expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
          perceiver2Id,
          PERCEPTION_LOG_COMPONENT_ID,
          {
            maxEntries: DEFAULT_MAX_LOG_ENTRIES,
            logEntries: [entry],
          }
        );
        expect(mockLogger.info).toHaveBeenCalledWith(
          `PerceptionUpdateService: Processed location ${locationId}. Logs updated for 2 out of 2 targeted entities. Warnings: ${result.warnings.length}`
        );
      });

      test('should generate eventId if not provided in the entry', async () => {
        const entry = createSampleLogEntry('event_no_id');
        // @ts-ignore
        delete entry.eventId; // Ensure eventId is not provided

        mockEntityManager.getEntitiesInLocation.mockReturnValue(
          new Set([perceiver1Id])
        );
        mockEntityManager.hasComponent.mockReturnValue(true);
        mockEntityManager.getComponentData.mockReturnValue({
          maxEntries: DEFAULT_MAX_LOG_ENTRIES,
          logEntries: [],
        });
        mockEntityManager.addComponent.mockReturnValue(true);

        await service.addEntryToLogsInLocation({ locationId, entry });

        expect(mockEntityManager.addComponent).toHaveBeenCalledTimes(1);
        const callArgs = mockEntityManager.addComponent.mock.calls[0];
        const updatedLogData = callArgs[2]; // Third argument is the component data

        expect(updatedLogData.logEntries.length).toBe(1);
        expect(updatedLogData.logEntries[0].eventId).toEqual(
          expect.stringMatching(/^ple_\d{13}_[a-z0-9]{9}$/)
        );
        expect(updatedLogData.logEntries[0].descriptionText).toBe(
          entry.descriptionText
        ); // Check other fields still match
      });
    });

    describe('Log Appending, Trimming, and Data Correction', () => {
      test('should append log entry when count is less than maxEntries', async () => {
        const entry = createSampleLogEntry('append_less');
        entry.eventId = 'event_less_max';
        const existingEntries = [
          createSampleLogEntry('old1'),
          createSampleLogEntry('old2'),
        ];
        existingEntries.forEach((e, i) => (e.eventId = `old_less_${i}`));

        mockEntityManager.getComponentData.mockReturnValue({
          maxEntries: 5,
          logEntries: [...existingEntries],
        });

        const result = await service.addEntryToLogsInLocation({
          locationId,
          entry,
        });

        expect(result.success).toBe(true);
        expect(result.logsUpdated).toBe(1);
        expect(result.warnings).toEqual([]);
        expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
          perceiver1Id,
          PERCEPTION_LOG_COMPONENT_ID,
          {
            maxEntries: 5,
            logEntries: [...existingEntries, entry],
          }
        );
      });

      test('should append log entry when count reaches maxEntries (no trimming yet)', async () => {
        const entry = createSampleLogEntry('append_reaches');
        entry.eventId = 'event_reaches_max';
        const existingEntries = Array.from({ length: 4 }, (_, i) => {
          const e = createSampleLogEntry(`old_reach_${i}`);
          e.eventId = `old_reach_ev_${i}`;
          return e;
        });

        mockEntityManager.getComponentData.mockReturnValue({
          maxEntries: 5,
          logEntries: [...existingEntries], // 4 entries, new one will be the 5th
        });

        const result = await service.addEntryToLogsInLocation({
          locationId,
          entry,
        });

        expect(result.success).toBe(true);
        expect(result.logsUpdated).toBe(1);
        const updatedLog =
          mockEntityManager.addComponent.mock.calls[0][2].logEntries;
        expect(updatedLog.length).toBe(5);
        expect(updatedLog[4]).toEqual(entry);
      });

      test('should append and trim oldest entries when logEntries count exceeds maxEntries', async () => {
        const maxEntries = 3;
        const newEntry = createSampleLogEntry('new_trim_event');
        newEntry.eventId = 'new_event_trim';

        const initialEntries = [
          {
            ...createSampleLogEntry('oldest'),
            eventId: 'event_oldest',
            timestamp: new Date(Date.now() - 2000).toISOString(),
          },
          {
            ...createSampleLogEntry('middle'),
            eventId: 'event_middle',
            timestamp: new Date(Date.now() - 1000).toISOString(),
          },
          {
            ...createSampleLogEntry('newest_old'),
            eventId: 'event_newest_old',
            timestamp: new Date(Date.now() - 500).toISOString(),
          },
        ]; // Already at maxEntries

        mockEntityManager.getComponentData.mockReturnValue({
          maxEntries: maxEntries,
          logEntries: [...initialEntries],
        });

        const result = await service.addEntryToLogsInLocation({
          locationId,
          entry: newEntry,
        });

        expect(result.success).toBe(true);
        expect(result.logsUpdated).toBe(1);
        expect(result.warnings).toEqual([]);

        const updatedLogData = mockEntityManager.addComponent.mock.calls[0][2];
        expect(updatedLogData.logEntries.length).toBe(maxEntries);
        expect(updatedLogData.logEntries[0].eventId).toBe('event_middle'); // 'event_oldest' should be trimmed
        expect(updatedLogData.logEntries[1].eventId).toBe('event_newest_old');
        expect(updatedLogData.logEntries[2].eventId).toBe(newEntry.eventId); // Newest entry is last
      });

      test('should reset logEntries to empty array if existing logEntries is not an array, then append', async () => {
        const entry = createSampleLogEntry('corrupt_entries');
        entry.eventId = 'event_corrupt_logentries';
        mockEntityManager.getComponentData.mockReturnValue({
          maxEntries: DEFAULT_MAX_LOG_ENTRIES,
          logEntries: 'this is not an array', // Corrupted data
        });

        const result = await service.addEntryToLogsInLocation({
          locationId,
          entry,
        });

        expect(result.success).toBe(true);
        expect(result.logsUpdated).toBe(1);
        const warningMsg = `Entity ${perceiver1Id}'s ${PERCEPTION_LOG_COMPONENT_ID}.logEntries was not an array (found string). Resetting to empty array.`;
        expect(result.warnings).toContain(warningMsg);
        expect(mockLogger.warn).toHaveBeenCalledWith(
          `PerceptionUpdateService: ${warningMsg}`
        );

        expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
          perceiver1Id,
          PERCEPTION_LOG_COMPONENT_ID,
          {
            maxEntries: DEFAULT_MAX_LOG_ENTRIES,
            logEntries: [entry], // Log is reset and new entry added
          }
        );
      });

      test('should use default maxEntries if existing maxEntries is invalid (e.g., not a number, < 1), then append/trim', async () => {
        const entry = createSampleLogEntry('corrupt_max');
        entry.eventId = 'event_corrupt_maxentries';
        const existingEntries = Array.from(
          { length: DEFAULT_MAX_LOG_ENTRIES },
          (_, i) => {
            const e = createSampleLogEntry(`old_default_${i}`);
            e.eventId = `old_default_ev_${i}`;
            return e;
          }
        );

        const invalidMaxEntriesValues = [
          0,
          -5,
          'not-a-number',
          null,
          undefined,
        ];
        for (const invalidMax of invalidMaxEntriesValues) {
          mockLogger.warn.mockClear();
          mockEntityManager.addComponent.mockClear();
          mockEntityManager.getComponentData.mockReturnValueOnce({
            maxEntries: invalidMax, // Corrupted data
            logEntries: [...existingEntries], // Log has many entries
          });

          const result = await service.addEntryToLogsInLocation({
            locationId,
            entry,
          });

          expect(result.success).toBe(true);
          expect(result.logsUpdated).toBe(1);
          const warningMsg = `Entity ${perceiver1Id}'s ${PERCEPTION_LOG_COMPONENT_ID}.maxEntries is invalid (${invalidMax}). Using default ${DEFAULT_MAX_LOG_ENTRIES}.`;
          expect(result.warnings).toContain(warningMsg);
          expect(mockLogger.warn).toHaveBeenCalledWith(
            `PerceptionUpdateService: ${warningMsg}`
          );

          const updatedLogData =
            mockEntityManager.addComponent.mock.calls[0][2];
          expect(updatedLogData.maxEntries).toBe(DEFAULT_MAX_LOG_ENTRIES);
          expect(updatedLogData.logEntries.length).toBe(
            DEFAULT_MAX_LOG_ENTRIES
          ); // Trimming happened based on default
          expect(
            updatedLogData.logEntries[DEFAULT_MAX_LOG_ENTRIES - 1]
          ).toEqual(entry); // Newest entry is last
        }
      });
    });
  });
});
