import {describe, test, expect, beforeEach, jest} from '@jest/globals';
import {TargetResolutionService} from '../../src/services/targetResolutionService.js'; // Adjust path as necessary
import {ResolutionStatus} from '../../src/types/resolutionStatus.js'; // Adjust path as necessary
import Entity from '../../src/entities/entity.js';
import {getEntityIdsForScopes} from "../../src/services/entityScopeService.js"; // Adjust path as necessary

// Mocks for dependencies (common for this file)
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

describe('TargetResolutionService - Domain \'self\'', () => {
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

    // Sub-Ticket/Test Case 3.1: Domain 'self' - Successful Resolution
    describe("Domain 'self' - Successful Resolution", () => {
        test("Verifies resolution when target_domain is 'self' and actor is valid.", async () => {
            // Setup
            const actionDefinition = { id: 'test:look-self', target_domain: 'self' };
            const mockActorEntity = { id: 'player123', getComponentData: jest.fn() }; // Using a simple mock object
            // Alternatively, use a real Entity instance if its methods are needed beyond .id
            // const mockActorEntity = new Entity('player123');
            const actionContext = { actingEntity: mockActorEntity, nounPhrase: null };

            // Action
            const result = await service.resolveActionTarget(actionDefinition, actionContext);

            // Expected Outcome
            expect(result.status).toBe(ResolutionStatus.SELF);
            expect(result.targetType).toBe('self');
            expect(result.targetId).toBe('player123');
            expect(result.error).toBeUndefined();

            // Verify logger calls
            // 1. Call from resolveActionTarget entry
            expect(mockLogger.debug).toHaveBeenCalledWith(
                "TargetResolutionService.resolveActionTarget called for action: 'test:look-self', actor: 'player123', noun: \"null\""
            );

            // 2. Call from #_resolveSelf entry
            expect(mockLogger.debug).toHaveBeenCalledWith(
                "TargetResolutionService.#_resolveSelf called with actorEntity: player123"
            );

            // 3. Call from #_resolveSelf resolution
            expect(mockLogger.debug).toHaveBeenCalledWith(
                "TargetResolutionService.#_resolveSelf resolved to actor: player123"
            );

            // Ensure specific call order if necessary, or total number of calls
            expect(mockLogger.debug).toHaveBeenCalledTimes(3); // Exact number of debug calls
            expect(mockLogger.error).not.toHaveBeenCalled();
        });
    });

    // Sub-Ticket/Test Case 3.2: Domain 'self' - Actor Entity Missing id
    describe("Domain 'self' - Actor Entity Missing id", () => {
        test("Verifies error handling if the actingEntity somehow has a missing or null id.", async () => {
            // Setup
            const actionDefinition = { id: 'test:self-error', target_domain: 'self' };
            const mockActorEntityInvalid = { id: null, getComponentData: jest.fn() }; // Entity with null ID
            const actionContext = { actingEntity: mockActorEntityInvalid, nounPhrase: null };

            // Action
            const result = await service.resolveActionTarget(actionDefinition, actionContext);

            // Expected Outcome
            expect(result.status).toBe(ResolutionStatus.ERROR);
            expect(result.targetType).toBe('self'); // #_resolveSelf sets this even on error
            expect(result.targetId).toBeNull();
            expect(result.error).toBe("Internal error: Actor not available or invalid for 'self' target.");

            // Verify logger calls
            // 1. Call from resolveActionTarget entry
            expect(mockLogger.debug).toHaveBeenCalledWith(
                "TargetResolutionService.resolveActionTarget called for action: 'test:self-error', actor: 'null', noun: \"null\""
            );

            // 2. Call from #_resolveSelf entry
            expect(mockLogger.debug).toHaveBeenCalledWith(
                "TargetResolutionService.#_resolveSelf called with actorEntity: null"
            );

            expect(mockLogger.debug).toHaveBeenCalledTimes(2);


            // 3. Error call from #_resolveSelf
            expect(mockLogger.error).toHaveBeenCalledWith(
                "TargetResolutionService.#_resolveSelf: actorEntity is missing or has no valid .id despite domain check."
            );
            expect(mockLogger.error).toHaveBeenCalledTimes(1);
        });
    });
});