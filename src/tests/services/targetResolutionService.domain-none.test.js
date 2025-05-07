// src/tests/services/targetResolutionService.domain-none.test.js

import {describe, test, expect, beforeEach, jest} from '@jest/globals';
import {TargetResolutionService} from '../../services/targetResolutionService.js'; // Adjusted path
import {ResolutionStatus} from '../../types/resolutionStatus.js';
import {getEntityIdsForScopes} from "../../services/entityScopeService"; // Adjusted path
// Entity might not be strictly needed for 'none' domain, but good to have for consistency if other tests are added to this file.
// import Entity from '../entities/entity.js'; // Adjusted path

// --- Mocks for Dependencies ---
const mockEntityManager = {
    getEntityInstance: jest.fn(),
    getEntitiesInLocation: jest.fn(),
    // Add other methods if they become necessary
};

const mockWorldContext = {
    getLocationOfEntity: jest.fn(),
    getCurrentActor: jest.fn(),
    getCurrentLocation: jest.fn(),
    // Add other methods if they become necessary
};

const mockGameDataRepository = {
    getActionDefinition: jest.fn(),
    getAllActionDefinitions: jest.fn(),
    // Add other methods if they become necessary
};

const mockLogger = {
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
};
// --- End Mocks ---

describe('TargetResolutionService - Domain \'none\'', () => {
    let service;

    beforeEach(() => {
        // Reset all mocks before each test
        jest.resetAllMocks();

        // Instantiate the service with mocked dependencies
        const options = {
            entityManager: mockEntityManager,
            worldContext: mockWorldContext,
            gameDataRepository: mockGameDataRepository,
            logger: mockLogger,
            getEntityIdsForScopes: getEntityIdsForScopes
        };
        service = new TargetResolutionService(options);
        // Clear any calls from constructor right after instantiation for cleaner test assertions
        mockLogger.info.mockClear();
        mockLogger.error.mockClear();
        mockLogger.debug.mockClear();
        mockLogger.warn.mockClear();
    });

    // Sub-Ticket/Test Case 2.1: Domain 'none' - Successful Resolution
    describe("Domain 'none' - Successful Resolution", () => {
        test("Verifies the output when target_domain is 'none'", async () => {
            // Setup
            const actionDefinition = {id: 'test:wait', target_domain: 'none'};
            const actionContext = {actingEntity: null, nounPhrase: null};

            // Action
            const result = await service.resolveActionTarget(actionDefinition, actionContext);

            // Expected Outcome
            expect(result.status).toBe(ResolutionStatus.NONE);
            expect(result.targetType).toBe('none');
            expect(result.targetId).toBeNull();
            expect(result.error).toBeUndefined();

            // Verify logger calls
            // 1. Call from resolveActionTarget entry
            expect(mockLogger.debug).toHaveBeenCalledWith(
                "TargetResolutionService.resolveActionTarget called for action: 'test:wait', actor: 'undefined', noun: \"null\""
            );

            // 2. Call from #_resolveNone
            expect(mockLogger.debug).toHaveBeenCalledWith(
                "TargetResolutionService.#_resolveNone called"
            );

            // Ensure specific call order if necessary, or total number of calls
            expect(mockLogger.debug).toHaveBeenCalledTimes(2); // Exact number of debug calls
        });
    });
});