// src/tests/services/PerceptionUpdateService.edgeCases.test.js
/**
 * @jest-environment node
 */
import {describe, expect, test, jest, beforeEach, afterEach} from '@jest/globals';

// --- Function Under Test ---
import PerceptionUpdateService from '../../src/services/perceptionUpdateService.js'; // Adjust path as needed

// --- JSDoc Imports for Type Hinting (optional, but good practice) ---
/** @typedef {import('../../src/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../src/interfaces/IEntityManager.js').IEntityManager} IEntityManager */
/** @typedef {import('../../src/services/perceptionUpdateService.js').LogEntry} LogEntry */

// --- Constants ---
const PERCEPTION_LOG_COMPONENT_ID = 'core:perception_log';
// const DEFAULT_MAX_LOG_ENTRIES = 50; // Not directly used in this specific edge case, but good to have if other edge cases need it

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
        addComponent: jest.fn(),
        // Add other methods if they were to be called
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
    // eventId is intentionally left out sometimes to test generation, or set for specific assertions
});


// --- Test Suite for Edge Cases ---
describe('PerceptionUpdateService - addEntryToLogsInLocation - Edge Cases', () => {
    let service;
    const locationId = 'loc:edge_case_area';
    const perceiver1Id = 'npc:perceiver_edge_1';

    beforeEach(() => {
        service = new PerceptionUpdateService({logger: mockLogger, entityManager: mockEntityManager});
    });

    describe('Edge Cases', () => {
        test('should handle maxEntries = 1 correctly, only keeping the latest entry', async () => {
            const entry1 = createSampleLogEntry('event_edge_1');
            entry1.eventId = 'edge_event_1'; // Controlled ID for assertion
            const entry2 = createSampleLogEntry('event_edge_2');
            entry2.eventId = 'edge_event_2'; // Controlled ID for assertion

            mockEntityManager.getEntitiesInLocation.mockReturnValue(new Set([perceiver1Id]));
            mockEntityManager.hasComponent.mockReturnValue(true); // Entity is a perceiver
            mockEntityManager.addComponent.mockReturnValue(true); // Simulate successful update

            // First entry addition
            mockEntityManager.getComponentData.mockReturnValueOnce({
                maxEntries: 1,
                logEntries: [], // Initially empty log
            });
            await service.addEntryToLogsInLocation({locationId, entry: entry1});

            expect(mockEntityManager.addComponent).toHaveBeenCalledTimes(1);
            expect(mockEntityManager.addComponent).toHaveBeenLastCalledWith(perceiver1Id, PERCEPTION_LOG_COMPONENT_ID, {
                maxEntries: 1,
                logEntries: [entry1],
            });

            // Second entry addition, should replace the first
            mockEntityManager.getComponentData.mockReturnValueOnce({ // Simulate state after first entry was added
                maxEntries: 1,
                logEntries: [entry1],
            });
            const result = await service.addEntryToLogsInLocation({locationId, entry: entry2});

            expect(result.success).toBe(true);
            expect(result.logsUpdated).toBe(1);
            expect(mockEntityManager.addComponent).toHaveBeenCalledTimes(2); // Called again

            const updatedLogCall = mockEntityManager.addComponent.mock.calls[1]; // Get the second call
            expect(updatedLogCall[0]).toBe(perceiver1Id);
            expect(updatedLogCall[1]).toBe(PERCEPTION_LOG_COMPONENT_ID);
            const updatedLogData = updatedLogCall[2];
            expect(updatedLogData.logEntries.length).toBe(1);
            expect(updatedLogData.logEntries[0].eventId).toBe(entry2.eventId);
            expect(updatedLogData.logEntries[0]).toEqual(entry2); // Ensure the entire new entry is there
        });

        // originatingActorId filtering test would go here if logic was present in the service.
        // Since the provided code indicates originatingActorId is "currently unused" for filtering
        // within addEntryToLogsInLocation, there's no specific behavior to test here
        // beyond its parameter validation (covered in general parameter validation tests).
        // Example placeholder if it were implemented:
        // test.skip('should filter out the originatingActorId if implemented', () => {});
    });
});